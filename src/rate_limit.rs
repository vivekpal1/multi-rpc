use crate::{
    config::{Config, RateLimit, RateLimitConfig},
    error::AppError,
};
use governor::{
    clock::{Clock, DefaultClock},
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    num::NonZeroU32,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;
use tracing::{debug, warn};

type RateLimiterType = RateLimiter<NotKeyed, InMemoryState, DefaultClock>;

#[derive(Debug, Clone)]
pub struct RateLimitService {
    config: RateLimitConfig,
    global_limiter: Option<Arc<RateLimiterType>>,
    method_limiters: Arc<RwLock<HashMap<String, Arc<RateLimiterType>>>>,
    ip_limiters: Arc<RwLock<HashMap<String, Arc<RateLimiterType>>>>,
    api_key_limiters: Arc<RwLock<HashMap<String, Arc<RateLimiterType>>>>,
    rate_limit_stats: Arc<RwLock<RateLimitStats>>,
}

#[derive(Debug, Clone)]
struct RateLimitStats {
    total_requests: u64,
    blocked_requests: u64,
    blocked_by_global: u64,
    blocked_by_method: u64,
    blocked_by_ip: u64,
    blocked_by_api_key: u64,
    method_stats: HashMap<String, MethodStats>,
    ip_stats: HashMap<String, IpStats>,
    api_key_stats: HashMap<String, ApiKeyStats>,
}

#[derive(Debug, Clone)]
struct MethodStats {
    requests: u64,
    blocked: u64,
    last_request: Instant,
}

#[derive(Debug, Clone)]
struct IpStats {
    requests: u64,
    blocked: u64,
    last_request: Instant,
    first_seen: Instant,
}

#[derive(Debug, Clone)]
struct ApiKeyStats {
    requests: u64,
    blocked: u64,
    last_request: Instant,
    first_seen: Instant,
}

impl Default for RateLimitStats {
    fn default() -> Self {
        Self {
            total_requests: 0,
            blocked_requests: 0,
            blocked_by_global: 0,
            blocked_by_method: 0,
            blocked_by_ip: 0,
            blocked_by_api_key: 0,
            method_stats: HashMap::new(),
            ip_stats: HashMap::new(),
            api_key_stats: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct RateLimitContext {
    pub ip_address: Option<String>,
    pub api_key: Option<String>,
    pub method: String,
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RateLimitResult {
    pub allowed: bool,
    pub reason: Option<String>,
    pub retry_after: Option<Duration>,
    pub remaining_requests: Option<u32>,
    pub reset_time: Option<Instant>,
}

impl RateLimitService {
    pub fn new(config: &Config) -> Self {
        let rate_config = config.rate_limiting.clone();
        
        // Create global rate limiter
        let global_limiter = if rate_config.enabled {
            if let (Some(rate), Some(burst)) = (
                NonZeroU32::new(rate_config.default_rate),
                NonZeroU32::new(rate_config.default_burst)
            ) {
                let quota = Quota::per_second(rate).allow_burst(burst);
                Some(Arc::new(RateLimiter::direct(quota)))
            } else {
                None
            }
        } else {
            None
        };

        Self {
            config: rate_config,
            global_limiter,
            method_limiters: Arc::new(RwLock::new(HashMap::new())),
            ip_limiters: Arc::new(RwLock::new(HashMap::new())),
            api_key_limiters: Arc::new(RwLock::new(HashMap::new())),
            rate_limit_stats: Arc::new(RwLock::new(RateLimitStats::default())),
        }
    }

    pub async fn check_rate_limit(&self, context: RateLimitContext) -> RateLimitResult {
        if !self.config.enabled {
            return RateLimitResult {
                allowed: true,
                reason: None,
                retry_after: None,
                remaining_requests: None,
                reset_time: None,
            };
        }

        let mut stats = self.rate_limit_stats.write().await;
        stats.total_requests += 1;

        // Update method stats
        let method_entry = stats.method_stats.entry(context.method.clone()).or_insert(MethodStats {
            requests: 0,
            blocked: 0,
            last_request: Instant::now(),
        });
        method_entry.requests += 1;
        method_entry.last_request = Instant::now();

        // Update IP stats
        if let Some(ip) = &context.ip_address {
            let ip_entry = stats.ip_stats.entry(ip.clone()).or_insert(IpStats {
                requests: 0,
                blocked: 0,
                last_request: Instant::now(),
                first_seen: Instant::now(),
            });
            ip_entry.requests += 1;
            ip_entry.last_request = Instant::now();
        }

        // Update API key stats
        if let Some(api_key) = &context.api_key {
            let key_entry = stats.api_key_stats.entry(api_key.clone()).or_insert(ApiKeyStats {
                requests: 0,
                blocked: 0,
                last_request: Instant::now(),
                first_seen: Instant::now(),
            });
            key_entry.requests += 1;
            key_entry.last_request = Instant::now();
        }

        drop(stats); // Release the write lock

        // Check global rate limit first
        if let Some(global_limiter) = &self.global_limiter {
            match global_limiter.check() {
                Ok(_) => {} // Allowed
                Err(not_until) => {
                    self.record_blocked_request("global", &context).await;
                    return RateLimitResult {
                        allowed: false,
                        reason: Some("Global rate limit exceeded".to_string()),
                        retry_after: Some(not_until.wait_time_from(DefaultClock::default().now())),
                        remaining_requests: Some(0),
                        reset_time: Some(Instant::now() + not_until.wait_time_from(DefaultClock::default().now())),
                    };
                }
            }
        }

        // Check method-specific rate limit
        if let Some(method_limit) = self.config.per_method_limits.get(&context.method) {
            let limiter = self.get_or_create_method_limiter(&context.method, method_limit).await;
            match limiter.check() {
                Ok(_) => {} // Allowed
                Err(not_until) => {
                    self.record_blocked_request("method", &context).await;
                    return RateLimitResult {
                        allowed: false,
                        reason: Some(format!("Method rate limit exceeded for {}", context.method)),
                        retry_after: Some(not_until.wait_time_from(DefaultClock::default().now())),
                        remaining_requests: Some(0),
                        reset_time: Some(Instant::now() + not_until.wait_time_from(DefaultClock::default().now())),
                    };
                }
            }
        }

        // Check IP-specific rate limit
        if let Some(ip) = &context.ip_address {
            if let Some(ip_limit) = self.config.per_ip_limits.get(ip) {
                let limiter = self.get_or_create_ip_limiter(ip, ip_limit).await;
                match limiter.check() {
                    Ok(_) => {} // Allowed
                    Err(not_until) => {
                        self.record_blocked_request("ip", &context).await;
                        return RateLimitResult {
                            allowed: false,
                            reason: Some(format!("IP rate limit exceeded for {}", ip)),
                            retry_after: Some(not_until.wait_time_from(DefaultClock::default().now())),
                            remaining_requests: Some(0),
                            reset_time: Some(Instant::now() + not_until.wait_time_from(DefaultClock::default().now())),
                        };
                    }
                }
            }
        }

        // Check API key rate limit (if not already checked by auth service)
        if let Some(api_key) = &context.api_key {
            // This would typically be configured per API key
            // For now, use a default rate limit for API keys
            let default_limit = RateLimit {
                rate: 1000,
                burst: 100,
                window_seconds: 60,
            };
            
            let limiter = self.get_or_create_api_key_limiter(api_key, &default_limit).await;
            match limiter.check() {
                Ok(_) => {} // Allowed
                Err(not_until) => {
                    self.record_blocked_request("api_key", &context).await;
                    return RateLimitResult {
                        allowed: false,
                        reason: Some("API key rate limit exceeded".to_string()),
                        retry_after: Some(not_until.wait_time_from(DefaultClock::default().now())),
                        remaining_requests: Some(0),
                        reset_time: Some(Instant::now() + not_until.wait_time_from(DefaultClock::default().now())),
                    };
                }
            }
        }

        // All checks passed
        RateLimitResult {
            allowed: true,
            reason: None,
            retry_after: None,
            remaining_requests: self.get_remaining_requests(&context).await,
            reset_time: None,
        }
    }

    async fn get_or_create_method_limiter(&self, method: &str, limit: &RateLimit) -> Arc<RateLimiterType> {
        let mut limiters = self.method_limiters.write().await;
        
        if let Some(limiter) = limiters.get(method) {
            limiter.clone()
        } else {
            let quota = Quota::per_second(NonZeroU32::new(limit.rate).unwrap_or(NonZeroU32::new(1).unwrap()))
                .allow_burst(NonZeroU32::new(limit.burst).unwrap_or(NonZeroU32::new(1).unwrap()));
            let limiter = Arc::new(RateLimiter::direct(quota));
            limiters.insert(method.to_string(), limiter.clone());
            limiter
        }
    }

    async fn get_or_create_ip_limiter(&self, ip: &str, limit: &RateLimit) -> Arc<RateLimiterType> {
        let mut limiters = self.ip_limiters.write().await;
        
        if let Some(limiter) = limiters.get(ip) {
            limiter.clone()
        } else {
            let quota = Quota::per_second(NonZeroU32::new(limit.rate).unwrap_or(NonZeroU32::new(1).unwrap()))
                .allow_burst(NonZeroU32::new(limit.burst).unwrap_or(NonZeroU32::new(1).unwrap()));
            let limiter = Arc::new(RateLimiter::direct(quota));
            limiters.insert(ip.to_string(), limiter.clone());
            limiter
        }
    }

    async fn get_or_create_api_key_limiter(&self, api_key: &str, limit: &RateLimit) -> Arc<RateLimiterType> {
        let mut limiters = self.api_key_limiters.write().await;
        
        if let Some(limiter) = limiters.get(api_key) {
            limiter.clone()
        } else {
            let quota = Quota::per_second(NonZeroU32::new(limit.rate).unwrap_or(NonZeroU32::new(1).unwrap()))
                .allow_burst(NonZeroU32::new(limit.burst).unwrap_or(NonZeroU32::new(1).unwrap()));
            let limiter = Arc::new(RateLimiter::direct(quota));
            limiters.insert(api_key.to_string(), limiter.clone());
            limiter
        }
    }

    async fn record_blocked_request(&self, reason: &str, context: &RateLimitContext) {
        let mut stats = self.rate_limit_stats.write().await;
        stats.blocked_requests += 1;

        match reason {
            "global" => stats.blocked_by_global += 1,
            "method" => {
                stats.blocked_by_method += 1;
                if let Some(method_stats) = stats.method_stats.get_mut(&context.method) {
                    method_stats.blocked += 1;
                }
            }
            "ip" => {
                stats.blocked_by_ip += 1;
                if let Some(ip) = &context.ip_address {
                    if let Some(ip_stats) = stats.ip_stats.get_mut(ip) {
                        ip_stats.blocked += 1;
                    }
                }
            }
            "api_key" => {
                stats.blocked_by_api_key += 1;
                if let Some(api_key) = &context.api_key {
                    if let Some(key_stats) = stats.api_key_stats.get_mut(api_key) {
                        key_stats.blocked += 1;
                    }
                }
            }
            _ => {}
        }

        debug!("Rate limit exceeded: reason={}, method={}, ip={:?}, api_key={:?}", 
            reason, context.method, context.ip_address, context.api_key);
    }

    async fn get_remaining_requests(&self, context: &RateLimitContext) -> Option<u32> {
        // This is a simplified implementation
        // In practice, you'd want to check the actual limiter state
        if let Some(global_limiter) = &self.global_limiter {
            // Return a rough estimate based on global limiter
            // Note: governor doesn't provide direct access to remaining tokens
            return Some(10); // Placeholder
        }
        None
    }

    pub async fn get_stats(&self) -> Value {
        let stats = self.rate_limit_stats.read().await;
        
        let block_rate = if stats.total_requests > 0 {
            stats.blocked_requests as f64 / stats.total_requests as f64
        } else {
            0.0
        };

        let method_stats: HashMap<String, Value> = stats.method_stats.iter()
            .map(|(method, method_stat)| {
                let method_block_rate = if method_stat.requests > 0 {
                    method_stat.blocked as f64 / method_stat.requests as f64
                } else {
                    0.0
                };
                
                (method.clone(), json!({
                    "requests": method_stat.requests,
                    "blocked": method_stat.blocked,
                    "block_rate": method_block_rate,
                    "last_request_ago_seconds": method_stat.last_request.elapsed().as_secs(),
                }))
            })
            .collect();

        let ip_stats: HashMap<String, Value> = stats.ip_stats.iter()
            .map(|(ip, ip_stat)| {
                let ip_block_rate = if ip_stat.requests > 0 {
                    ip_stat.blocked as f64 / ip_stat.requests as f64
                } else {
                    0.0
                };
                
                (ip.clone(), json!({
                    "requests": ip_stat.requests,
                    "blocked": ip_stat.blocked,
                    "block_rate": ip_block_rate,
                    "last_request_ago_seconds": ip_stat.last_request.elapsed().as_secs(),
                    "first_seen_ago_seconds": ip_stat.first_seen.elapsed().as_secs(),
                }))
            })
            .collect();

        json!({
            "enabled": self.config.enabled,
            "global": {
                "total_requests": stats.total_requests,
                "blocked_requests": stats.blocked_requests,
                "block_rate": block_rate,
                "blocked_by": {
                    "global": stats.blocked_by_global,
                    "method": stats.blocked_by_method,
                    "ip": stats.blocked_by_ip,
                    "api_key": stats.blocked_by_api_key,
                }
            },
            "method_stats": method_stats,
            "ip_stats": ip_stats,
            "active_limiters": {
                "methods": self.method_limiters.read().await.len(),
                "ips": self.ip_limiters.read().await.len(),
                "api_keys": self.api_key_limiters.read().await.len(),
            },
            "config": {
                "default_rate": self.config.default_rate,
                "default_burst": self.config.default_burst,
                "method_limits_count": self.config.per_method_limits.len(),
                "ip_limits_count": self.config.per_ip_limits.len(),
            }
        })
    }

    pub async fn clear_stats(&self) {
        let mut stats = self.rate_limit_stats.write().await;
        *stats = RateLimitStats::default();
        debug!("Rate limiting stats cleared");
    }

    pub async fn update_limits(&self, method: Option<String>, new_limit: RateLimit) {
        if let Some(method_name) = method {
            // Update method-specific limit
            let mut limiters = self.method_limiters.write().await;
            let quota = Quota::per_second(NonZeroU32::new(new_limit.rate).unwrap_or(NonZeroU32::new(1).unwrap()))
                .allow_burst(NonZeroU32::new(new_limit.burst).unwrap_or(NonZeroU32::new(1).unwrap()));
            let limiter = Arc::new(RateLimiter::direct(quota));
            limiters.insert(method_name, limiter);
        }
        // Could also update IP or API key limits here
    }

    pub async fn whitelist_ip(&self, ip: &str) -> Result<(), AppError> {
        // Remove IP from rate limiting
        let mut limiters = self.ip_limiters.write().await;
        limiters.remove(ip);
        
        let mut stats = self.rate_limit_stats.write().await;
        stats.ip_stats.remove(ip);
        
        debug!("IP {} whitelisted (removed from rate limiting)", ip);
        Ok(())
    }

    pub async fn blacklist_ip(&self, ip: &str) -> Result<(), AppError> {
        // Create a very restrictive rate limit for this IP
        let restrictive_limit = RateLimit {
            rate: 1,
            burst: 1,
            window_seconds: 3600,
        };
        
        let quota = Quota::per_second(NonZeroU32::new(restrictive_limit.rate).unwrap_or(NonZeroU32::new(1).unwrap()))
            .allow_burst(NonZeroU32::new(restrictive_limit.burst).unwrap_or(NonZeroU32::new(1).unwrap()));
        let limiter = Arc::new(RateLimiter::direct(quota));
        
        let mut limiters = self.ip_limiters.write().await;
        limiters.insert(ip.to_string(), limiter);
        
        warn!("IP {} blacklisted (severely rate limited)", ip);
        Ok(())
    }

    pub async fn get_top_ips_by_requests(&self, limit: usize) -> Vec<(String, u64)> {
        let stats = self.rate_limit_stats.read().await;
        let mut ip_requests: Vec<(String, u64)> = stats.ip_stats.iter()
            .map(|(ip, stat)| (ip.clone(), stat.requests))
            .collect();
        
        ip_requests.sort_by(|a, b| b.1.cmp(&a.1));
        ip_requests.truncate(limit);
        ip_requests
    }

    pub async fn get_top_methods_by_requests(&self, limit: usize) -> Vec<(String, u64)> {
        let stats = self.rate_limit_stats.read().await;
        let mut method_requests: Vec<(String, u64)> = stats.method_stats.iter()
            .map(|(method, stat)| (method.clone(), stat.requests))
            .collect();
        
        method_requests.sort_by(|a, b| b.1.cmp(&a.1));
        method_requests.truncate(limit);
        method_requests
    }

    pub async fn cleanup_old_limiters(&self) {
        let cleanup_threshold = Duration::from_secs(3600); // 1 hour
        let now = Instant::now();
        
        // Cleanup IP limiters for IPs that haven't been seen recently
        {
            let stats = self.rate_limit_stats.read().await;
            let mut ip_limiters = self.ip_limiters.write().await;
            
            let ips_to_remove: Vec<String> = stats.ip_stats.iter()
                .filter(|(_, stat)| now.duration_since(stat.last_request) > cleanup_threshold)
                .map(|(ip, _)| ip.clone())
                .collect();
            
            for ip in ips_to_remove {
                ip_limiters.remove(&ip);
            }
        }
        
        // Could also cleanup method and API key limiters similarly
        debug!("Cleaned up old rate limiters");
    }

    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    pub async fn emergency_disable(&self) {
        // In an emergency, you might want to disable rate limiting
        // This would require making config mutable or using an atomic flag
        warn!("Emergency rate limiting disable requested");
    }
}