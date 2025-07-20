use crate::{
    config::{Config, CacheConfig},
    error::AppError,
    rpc::{get_method_category, is_method_cacheable, get_cache_ttl, RpcMethodCategory},
};
use redis::{aio::ConnectionManager, AsyncCommands, Client, RedisResult};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

#[derive(Clone)]
pub struct CacheService {
    config: CacheConfig,
    redis_client: Option<Client>,
    connection_manager: Arc<RwLock<Option<ConnectionManager>>>,
    local_cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    stats: Arc<CacheStats>,
}

impl std::fmt::Debug for CacheService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CacheService")
            .field("config", &self.config)
            .field("redis_client", &self.redis_client.is_some())
            .field("connection_manager", &"<ConnectionManager>")
            .field("local_cache", &"<LocalCache>")
            .field("stats", &self.stats)
            .finish()
    }
}

#[derive(Debug, Clone)]
struct CacheEntry {
    value: Value,
    expires_at: Instant,
    access_count: u64,
    last_accessed: Instant,
}

#[derive(Debug)]
struct CacheStats {
    hits: AtomicU64,
    misses: AtomicU64,
    redis_errors: AtomicU64,
    evictions: AtomicU64,
    total_requests: AtomicU64,
}

impl CacheService {
    pub async fn new(config: &Config) -> Result<Self, AppError> {
        let cache_config = config.cache.clone();
        
        let (redis_client, connection_manager) = if cache_config.enabled {
            match Self::create_redis_connection(&cache_config).await {
                Ok((client, manager)) => {
                    info!("Redis cache connected successfully");
                    (Some(client), Arc::new(RwLock::new(Some(manager))))
                }
                Err(e) => {
                    warn!("Failed to connect to Redis, using local cache only: {}", e);
                    (None, Arc::new(RwLock::new(None)))
                }
            }
        } else {
            info!("Cache disabled in configuration");
            (None, Arc::new(RwLock::new(None)))
        };

        Ok(Self {
            config: cache_config,
            redis_client,
            connection_manager,
            local_cache: Arc::new(RwLock::new(HashMap::new())),
            stats: Arc::new(CacheStats {
                hits: AtomicU64::new(0),
                misses: AtomicU64::new(0),
                redis_errors: AtomicU64::new(0),
                evictions: AtomicU64::new(0),
                total_requests: AtomicU64::new(0),
            }),
        })
    }

    async fn create_redis_connection(config: &CacheConfig) -> Result<(Client, ConnectionManager), AppError> {
        let client = Client::open(config.redis_url.as_str())
            .map_err(|e| AppError::cache(&format!("Failed to create Redis client: {}", e)))?;
        
        let manager = ConnectionManager::new(client.clone()).await
            .map_err(|e| AppError::cache(&format!("Failed to connect to Redis: {}", e)))?;
        
        Ok((client, manager))
    }

    pub async fn get(&self, method: &str, params: &Value) -> Option<Value> {
        if !self.config.enabled || !is_method_cacheable(method) {
            return None;
        }

        self.stats.total_requests.fetch_add(1, Ordering::Relaxed);
        let cache_key = self.create_cache_key(method, params);

        // Try local cache first
        if let Some(value) = self.get_from_local_cache(&cache_key).await {
            self.stats.hits.fetch_add(1, Ordering::Relaxed);
            debug!("Cache hit (local): {}", cache_key);
            return Some(value);
        }

        // Try Redis cache
        if let Some(value) = self.get_from_redis(&cache_key).await {
            // Store in local cache for faster access
            self.store_in_local_cache(&cache_key, &value, method).await;
            self.stats.hits.fetch_add(1, Ordering::Relaxed);
            debug!("Cache hit (redis): {}", cache_key);
            return Some(value);
        }

        self.stats.misses.fetch_add(1, Ordering::Relaxed);
        debug!("Cache miss: {}", cache_key);
        None
    }

    pub async fn set(&self, method: &str, params: &Value, response: &Value) {
        if !self.config.enabled || !is_method_cacheable(method) {
            return;
        }

        let cache_key = self.create_cache_key(method, params);
        let ttl = self.get_ttl_for_method(method);

        // Store in local cache
        self.store_in_local_cache(&cache_key, response, method).await;

        // Store in Redis cache
        self.store_in_redis(&cache_key, response, ttl).await;

        debug!("Cached response: {} (TTL: {}s)", cache_key, ttl);
    }

    async fn get_from_local_cache(&self, key: &str) -> Option<Value> {
        let mut cache = self.local_cache.write().await;
        
        if let Some(entry) = cache.get_mut(key) {
            if entry.expires_at > Instant::now() {
                entry.access_count += 1;
                entry.last_accessed = Instant::now();
                return Some(entry.value.clone());
            } else {
                // Entry expired, remove it
                cache.remove(key);
                self.stats.evictions.fetch_add(1, Ordering::Relaxed);
            }
        }

        None
    }

    async fn store_in_local_cache(&self, key: &str, value: &Value, method: &str) {
        let mut cache = self.local_cache.write().await;
        let ttl = Duration::from_secs(self.get_ttl_for_method(method));
        
        // Check cache size limit
        if cache.len() >= 10000 { // TODO: make configurable
            self.evict_local_cache_entries(&mut cache).await;
        }

        let entry = CacheEntry {
            value: value.clone(),
            expires_at: Instant::now() + ttl,
            access_count: 1,
            last_accessed: Instant::now(),
        };

        cache.insert(key.to_string(), entry);
    }

    async fn evict_local_cache_entries(&self, cache: &mut HashMap<String, CacheEntry>) {
        let now = Instant::now();
        let mut to_remove = Vec::new();

        // First, remove expired entries
        for (key, entry) in cache.iter() {
            if entry.expires_at <= now {
                to_remove.push(key.clone());
            }
        }

        // If still too many entries, remove least recently used
        if cache.len() - to_remove.len() > 8000 {
            let mut entries: Vec<_> = cache
                .iter()
                .filter(|(key, _)| !to_remove.contains(key))
                .map(|(key, entry)| (key.clone(), entry.last_accessed))
                .collect();
            
            entries.sort_by_key(|(_, last_accessed)| *last_accessed);
            
            let to_evict = (cache.len() - to_remove.len()).saturating_sub(8000);
            for (key, _) in entries.into_iter().take(to_evict) {
                to_remove.push(key);
            }
        }

        for key in to_remove {
            cache.remove(&key);
            self.stats.evictions.fetch_add(1, Ordering::Relaxed);
        }
    }

    async fn get_from_redis(&self, key: &str) -> Option<Value> {
        let manager_guard = self.connection_manager.read().await;
        let manager = manager_guard.as_ref()?;
        
        let mut conn = manager.clone();
        match conn.get::<String, Option<String>>(key.to_string()).await {
            Ok(Some(data)) => {
                match serde_json::from_str(&data) {
                    Ok(value) => Some(value),
                    Err(e) => {
                        warn!("Failed to deserialize cached value: {}", e);
                        None
                    }
                }
            }
            Ok(None) => None,
            Err(e) => {
                error!("Redis get error: {}", e);
                self.stats.redis_errors.fetch_add(1, Ordering::Relaxed);
                None
            }
        }
    }

    async fn store_in_redis(&self, key: &str, value: &Value, ttl: u64) {
        let manager_guard = self.connection_manager.read().await;
        if let Some(manager) = manager_guard.as_ref() {
            let mut conn = manager.clone();
            
            match serde_json::to_string(value) {
                Ok(data) => {
                    let result: RedisResult<()> = conn.set_ex(key, data, ttl as usize).await;
                    if let Err(e) = result {
                        error!("Redis set error: {}", e);
                        self.stats.redis_errors.fetch_add(1, Ordering::Relaxed);
                    }
                }
                Err(e) => {
                    error!("Failed to serialize value for cache: {}", e);
                }
            }
        }
    }

    fn create_cache_key(&self, method: &str, params: &Value) -> String {
        // Create a deterministic cache key
        let params_str = if params.is_null() {
            String::new()
        } else {
            // Sort object keys for consistent hashing
            self.normalize_params(params)
        };
        
        format!("multi-rpc:{}:{}", method, params_str)
    }

    fn normalize_params(&self, params: &Value) -> String {
        match params {
            Value::Object(map) => {
                let mut sorted_pairs: Vec<_> = map.iter().collect();
                sorted_pairs.sort_by_key(|(k, _)| *k);
                let normalized_map: serde_json::Map<String, Value> = sorted_pairs
                    .into_iter()
                    .map(|(k, v)| (k.clone(), self.normalize_value(v)))
                    .collect();
                serde_json::to_string(&normalized_map).unwrap_or_default()
            }
            Value::Array(arr) => {
                let normalized_arr: Vec<Value> = arr.iter().map(|v| self.normalize_value(v)).collect();
                serde_json::to_string(&normalized_arr).unwrap_or_default()
            }
            _ => serde_json::to_string(params).unwrap_or_default(),
        }
    }

    fn normalize_value(&self, value: &Value) -> Value {
        match value {
            Value::Object(map) => {
                let mut sorted_pairs: Vec<_> = map.iter().collect();
                sorted_pairs.sort_by_key(|(k, _)| *k);
                let normalized_map: serde_json::Map<String, Value> = sorted_pairs
                    .into_iter()
                    .map(|(k, v)| (k.clone(), self.normalize_value(v)))
                    .collect();
                Value::Object(normalized_map)
            }
            Value::Array(arr) => {
                let normalized_arr: Vec<Value> = arr.iter().map(|v| self.normalize_value(v)).collect();
                Value::Array(normalized_arr)
            }
            _ => value.clone(),
        }
    }

    fn get_ttl_for_method(&self, method: &str) -> u64 {
        // Check method-specific TTLs first
        if let Some(&ttl) = self.config.method_ttls.get(method) {
            return ttl;
        }

        // Use category-based TTL
        get_cache_ttl(method).unwrap_or(self.config.default_ttl)
    }

    pub async fn invalidate(&self, pattern: &str) {
        // Invalidate from local cache
        {
            let mut cache = self.local_cache.write().await;
            cache.retain(|key, _| !key.contains(pattern));
        }

        // Invalidate from Redis
        self.invalidate_redis_pattern(pattern).await;
    }

    async fn invalidate_redis_pattern(&self, pattern: &str) {
        let manager_guard = self.connection_manager.read().await;
        if let Some(manager) = manager_guard.as_ref() {
            let mut conn = manager.clone();
            
            // Use SCAN to find matching keys
            let scan_pattern = format!("multi-rpc:*{}*", pattern);
            
            // Use KEYS command for pattern matching (less efficient but simpler)
            let keys_result: RedisResult<Vec<String>> = redis::cmd("KEYS")
                .arg(&scan_pattern)
                .query_async(&mut conn)
                .await;
                
            match keys_result {
                Ok(keys) => {
                    if !keys.is_empty() {
                        let result: RedisResult<usize> = conn.del(keys).await;
                        match result {
                            Ok(deleted) => debug!("Invalidated {} keys from Redis", deleted),
                            Err(e) => error!("Failed to delete keys from Redis: {}", e),
                        }
                    }
                }
                Err(e) => error!("Failed to get Redis keys: {}", e),
            }
        }
    }

    pub async fn invalidate_slot_based(&self, slot: u64) {
        // Invalidate slot-dependent data
        let slot_pattern = format!("slot:{}", slot);
        let patterns = vec![
            "getSlot",
            "getBlockHeight", 
            "getRecentBlockhash",
            "getLatestBlockhash",
            slot_pattern.as_str(),
        ];

        for pattern in patterns {
            self.invalidate(pattern).await;
        }
    }

    pub async fn get_stats(&self) -> serde_json::Value {
        let local_cache_size = self.local_cache.read().await.len();
        let hits = self.stats.hits.load(Ordering::Relaxed);
        let misses = self.stats.misses.load(Ordering::Relaxed);
        let total = hits + misses;
        
        let hit_rate = if total > 0 {
            hits as f64 / total as f64
        } else {
            0.0
        };

        json!({
            "enabled": self.config.enabled,
            "local_cache_size": local_cache_size,
            "redis_connected": self.connection_manager.read().await.is_some(),
            "statistics": {
                "hits": hits,
                "misses": misses,
                "hit_rate": hit_rate,
                "redis_errors": self.stats.redis_errors.load(Ordering::Relaxed),
                "evictions": self.stats.evictions.load(Ordering::Relaxed),
                "total_requests": self.stats.total_requests.load(Ordering::Relaxed),
            },
            "config": {
                "default_ttl": self.config.default_ttl,
                "max_cache_size": self.config.max_cache_size,
                "method_ttls": self.config.method_ttls,
            }
        })
    }

    pub async fn get_debug_info(&self) -> Value {
        let cache = self.local_cache.read().await;
        let mut method_breakdown = HashMap::new();
        let mut total_memory = 0;

        for (key, entry) in cache.iter() {
            if let Some(method) = key.split(':').nth(1) {
                let entry_data = method_breakdown.entry(method.to_string()).or_insert(json!({
                    "count": 0,
                    "total_accesses": 0,
                    "avg_access_count": 0.0
                }));
                
                if let Some(obj) = entry_data.as_object_mut() {
                    obj["count"] = json!(obj["count"].as_u64().unwrap_or(0) + 1);
                    obj["total_accesses"] = json!(obj["total_accesses"].as_u64().unwrap_or(0) + entry.access_count);
                }
            }
            
            // Estimate memory usage (rough calculation)
            total_memory += key.len() + serde_json::to_string(&entry.value).unwrap_or_default().len();
        }

        // Calculate averages
        for (_, data) in method_breakdown.iter_mut() {
            if let Some(obj) = data.as_object_mut() {
                let count = obj["count"].as_u64().unwrap_or(1);
                let total_accesses = obj["total_accesses"].as_u64().unwrap_or(0);
                obj["avg_access_count"] = json!(total_accesses as f64 / count as f64);
            }
        }

        json!({
            "local_cache": {
                "size": cache.len(),
                "estimated_memory_bytes": total_memory,
                "method_breakdown": method_breakdown,
            },
            "redis_status": if self.connection_manager.read().await.is_some() {
                "connected"
            } else {
                "disconnected"
            },
            "stats": self.get_stats().await["statistics"],
        })
    }

    pub async fn clear_cache(&self) {
        // Clear local cache
        {
            let mut cache = self.local_cache.write().await;
            cache.clear();
        }

        // Clear Redis cache
        self.clear_redis_cache().await;
        
        info!("Cache cleared");
    }

    async fn clear_redis_cache(&self) {
        let manager_guard = self.connection_manager.read().await;
        if let Some(manager) = manager_guard.as_ref() {
            let mut conn = manager.clone();
            
            let keys_result: RedisResult<Vec<String>> = redis::cmd("KEYS")
                .arg("multi-rpc:*")
                .query_async(&mut conn)
                .await;
                
            match keys_result {
                Ok(keys) => {
                    if !keys.is_empty() {
                        let result: RedisResult<usize> = conn.del(keys).await;
                        match result {
                            Ok(deleted) => info!("Cleared {} keys from Redis", deleted),
                            Err(e) => error!("Failed to clear Redis cache: {}", e),
                        }
                    }
                }
                Err(e) => error!("Failed to get Redis keys for clearing: {}", e),
            }
        }
    }

    pub async fn warmup_cache(&self) {
        // Pre-populate cache with common requests
        info!("Starting cache warmup...");
        
        let common_requests = vec![
            ("getHealth", json!(null)),
            ("getVersion", json!(null)),
            ("getGenesisHash", json!(null)),
            ("getSlot", json!(null)),
            ("getBlockHeight", json!(null)),
        ];

        for (method, params) in common_requests {
            let cache_key = self.create_cache_key(method, &params);
            debug!("Warming up cache for: {}", cache_key);
            // In practice, you'd make actual RPC calls to populate the cache
        }
        
        info!("Cache warmup completed");
    }
}