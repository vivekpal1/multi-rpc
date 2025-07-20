use crate::{
    config::{Config, EndpointConfig},
    error::AppError,
    types::{EndpointInfo, EndpointScore, EndpointStats, EndpointStatus, LoadBalancingStrategy},
};
use chrono::Utc;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{sync::RwLock, time::interval};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Debug)]
pub struct EndpointManager {
    config: Arc<RwLock<Config>>,
    endpoints: Arc<RwLock<HashMap<Uuid, Endpoint>>>,
    strategy: LoadBalancingStrategy,
    next_round_robin: Arc<RwLock<usize>>,
    circuit_breakers: Arc<RwLock<HashMap<Uuid, CircuitBreaker>>>,
    discovery_cache: Arc<RwLock<HashMap<String, DiscoveredEndpoint>>>,
}

#[derive(Debug, Clone)]
struct Endpoint {
    info: EndpointInfo,
    stats: EndpointStats,
    client: reqwest::Client,
    config: EndpointConfig,
    connection_pool: ConnectionPool,
}

#[derive(Debug, Clone)]
struct ConnectionPool {
    active_connections: u32,
    max_connections: u32,
    last_activity: Instant,
}

#[derive(Debug, Clone)]
struct CircuitBreaker {
    state: CircuitBreakerState,
    failure_count: u32,
    last_failure: Option<Instant>,
    failure_threshold: u32,
    timeout_duration: Duration,
    half_open_timeout: Duration,
}

#[derive(Debug, Clone, PartialEq)]
enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug, Clone)]
struct DiscoveredEndpoint {
    url: String,
    score: f64,
    features: Vec<String>,
    latency: Duration,
    last_tested: Instant,
    test_results: TestResults,
}

#[derive(Debug, Clone)]
struct TestResults {
    health_check: bool,
    version_check: bool,
    method_support: HashMap<String, bool>,
    response_times: HashMap<String, Duration>,
}

impl Default for ConnectionPool {
    fn default() -> Self {
        Self {
            active_connections: 0,
            max_connections: 100,
            last_activity: Instant::now(),
        }
    }
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self {
            state: CircuitBreakerState::Closed,
            failure_count: 0,
            last_failure: None,
            failure_threshold: 5,
            timeout_duration: Duration::from_secs(30),
            half_open_timeout: Duration::from_secs(60),
        }
    }
}

impl CircuitBreaker {
    fn record_success(&mut self) {
        self.failure_count = 0;
        self.state = CircuitBreakerState::Closed;
        self.last_failure = None;
    }

    fn record_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure = Some(Instant::now());
        
        if self.failure_count >= self.failure_threshold {
            self.state = CircuitBreakerState::Open;
        }
    }

    fn can_attempt(&mut self) -> bool {
        match self.state {
            CircuitBreakerState::Closed => true,
            CircuitBreakerState::Open => {
                if let Some(last_failure) = self.last_failure {
                    if last_failure.elapsed() > self.timeout_duration {
                        self.state = CircuitBreakerState::HalfOpen;
                        return true;
                    }
                }
                false
            }
            CircuitBreakerState::HalfOpen => true,
        }
    }
}

impl EndpointManager {
    pub async fn new(configs: Vec<EndpointConfig>, config: Config) -> Result<Self, AppError> {
        let mut endpoints = HashMap::new();
        let mut circuit_breakers = HashMap::new();
        
        for endpoint_config in configs {
            let id = Uuid::new_v4();
            let client = Self::create_client(&endpoint_config)?;
            
            let endpoint = Endpoint {
                info: EndpointInfo {
                    id,
                    url: endpoint_config.url.clone(),
                    name: endpoint_config.name.clone(),
                    status: EndpointStatus::Unknown,
                    score: EndpointScore::default(),
                    last_checked: Utc::now(),
                    weight: endpoint_config.weight,
                    priority: endpoint_config.priority,
                    latitude: endpoint_config.latitude,
                    longitude: endpoint_config.longitude,
                    region: endpoint_config.region.clone(),
                },
                stats: EndpointStats::default(),
                client,
                config: endpoint_config,
                connection_pool: ConnectionPool::default(),
            };
            
            circuit_breakers.insert(id, CircuitBreaker::default());
            endpoints.insert(id, endpoint);
        }
        
        info!("Initialized {} endpoints", endpoints.len());
        
        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            endpoints: Arc::new(RwLock::new(endpoints)),
            strategy: LoadBalancingStrategy::HealthBased,
            next_round_robin: Arc::new(RwLock::new(0)),
            circuit_breakers: Arc::new(RwLock::new(circuit_breakers)),
            discovery_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    fn create_client(config: &EndpointConfig) -> Result<reqwest::Client, AppError> {
        let mut builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("Multi-RPC/1.0")
            .pool_max_idle_per_host(config.max_connections.unwrap_or(50) as usize);

        // Add authentication if configured
        if let Some(auth_token) = &config.auth_token {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                reqwest::header::AUTHORIZATION,
                reqwest::header::HeaderValue::from_str(&format!("Bearer {}", auth_token))
                    .map_err(|e| AppError::config(&format!("Invalid auth token: {}", e)))?,
            );
            builder = builder.default_headers(headers);
        }

        builder.build()
            .map_err(|e| AppError::config(&format!("Failed to create HTTP client: {}", e)))
    }
    
    pub async fn get_endpoint_info(&self) -> Vec<EndpointInfo> {
        let endpoints = self.endpoints.read().await;
        endpoints.values()
            .map(|endpoint| endpoint.info.clone())
            .collect()
    }
    
    pub async fn get_stats(&self) -> serde_json::Value {
        let endpoints = self.endpoints.read().await;
        let circuit_breakers = self.circuit_breakers.read().await;
        
        let mut total_requests = 0u64;
        let mut total_successful = 0u64;
        let mut total_failed = 0u64;
        let mut response_times = Vec::new();
        let mut endpoint_details = Vec::new();
        
        for endpoint in endpoints.values() {
            total_requests += endpoint.stats.total_requests;
            total_successful += endpoint.stats.successful_requests;
            total_failed += endpoint.stats.failed_requests;
            
            if endpoint.stats.avg_response_time > 0.0 {
                response_times.push(endpoint.stats.avg_response_time);
            }

            let circuit_breaker = circuit_breakers.get(&endpoint.info.id);
            
            endpoint_details.push(json!({
                "id": endpoint.info.id,
                "name": endpoint.info.name,
                "url": endpoint.info.url,
                "status": endpoint.info.status,
                "weight": endpoint.info.weight,
                "priority": endpoint.info.priority,
                "region": endpoint.info.region,
                "stats": {
                    "total_requests": endpoint.stats.total_requests,
                    "successful_requests": endpoint.stats.successful_requests,
                    "failed_requests": endpoint.stats.failed_requests,
                    "success_rate": if endpoint.stats.total_requests > 0 {
                        endpoint.stats.successful_requests as f64 / endpoint.stats.total_requests as f64
                    } else { 0.0 },
                    "avg_response_time_ms": endpoint.stats.avg_response_time,
                    "last_success": endpoint.stats.last_success,
                    "last_failure": endpoint.stats.last_failure,
                },
                "circuit_breaker": circuit_breaker.map(|cb| json!({
                    "state": match cb.state {
                        CircuitBreakerState::Closed => "closed",
                        CircuitBreakerState::Open => "open",
                        CircuitBreakerState::HalfOpen => "half_open",
                    },
                    "failure_count": cb.failure_count,
                    "last_failure_secs_ago": cb.last_failure.map(|t| t.elapsed().as_secs()),
                })),
                "connection_pool": {
                    "active_connections": endpoint.connection_pool.active_connections,
                    "max_connections": endpoint.connection_pool.max_connections,
                },
                "features": endpoint.config.features,
            }));
        }
        
        let avg_response_time = if !response_times.is_empty() {
            response_times.iter().sum::<f64>() / response_times.len() as f64
        } else {
            0.0
        };
        
        let success_rate = if total_requests > 0 {
            (total_successful as f64 / total_requests as f64) * 100.0
        } else {
            0.0
        };
        
        json!({
            "total_requests": total_requests,
            "successful_requests": total_successful,
            "failed_requests": total_failed,
            "success_rate": success_rate,
            "avg_response_time_ms": avg_response_time,
            "endpoint_count": endpoints.len(),
            "healthy_endpoints": endpoints.values()
                .filter(|e| e.info.status == EndpointStatus::Healthy)
                .count(),
            "degraded_endpoints": endpoints.values()
                .filter(|e| e.info.status == EndpointStatus::Degraded)
                .count(),
            "unhealthy_endpoints": endpoints.values()
                .filter(|e| e.info.status == EndpointStatus::Unhealthy)
                .count(),
            "load_balancing_strategy": match self.strategy {
                LoadBalancingStrategy::RoundRobin => "round_robin",
                LoadBalancingStrategy::HealthBased => "health_based",
                LoadBalancingStrategy::LeastLatency => "least_latency",
                LoadBalancingStrategy::Weighted => "weighted",
            },
            "endpoints": endpoint_details,
        })
    }
    
    pub async fn select_endpoint(&self) -> Result<(Uuid, reqwest::Client), AppError> {
        // Check circuit breakers first
        {
            let mut breakers = self.circuit_breakers.write().await;
            breakers.retain(|_, breaker| {
                breaker.can_attempt()
            });
        }

        match self.strategy {
            LoadBalancingStrategy::RoundRobin => self.select_round_robin().await,
            LoadBalancingStrategy::HealthBased => self.select_by_health().await,
            LoadBalancingStrategy::LeastLatency => self.select_by_latency().await,
            LoadBalancingStrategy::Weighted => self.select_weighted().await,
        }
    }
    
    async fn select_round_robin(&self) -> Result<(Uuid, reqwest::Client), AppError> {
        let endpoints = self.endpoints.read().await;
        let healthy_endpoints: Vec<_> = endpoints.values()
            .filter(|e| self.is_endpoint_available(e))
            .collect();
        
        if healthy_endpoints.is_empty() {
            return Err(AppError::AllEndpointsUnhealthy);
        }
        
        let mut next_idx = self.next_round_robin.write().await;
        *next_idx = (*next_idx + 1) % healthy_endpoints.len();
        let selected = &healthy_endpoints[*next_idx];
        
        Ok((selected.info.id, selected.client.clone()))
    }
    
    async fn select_by_health(&self) -> Result<(Uuid, reqwest::Client), AppError> {
        let endpoints = self.endpoints.read().await;
        let circuit_breakers = self.circuit_breakers.read().await;
        
        let best_endpoint = endpoints.values()
            .filter(|e| self.is_endpoint_available(e))
            .filter(|e| {
                circuit_breakers.get(&e.info.id)
                    .map(|cb| cb.state != CircuitBreakerState::Open)
                    .unwrap_or(true)
            })
            .min_by_key(|e| {
                let health_score = match e.info.status {
                    EndpointStatus::Healthy => 0,
                    EndpointStatus::Degraded => 1,
                    EndpointStatus::Unknown => 2,
                    EndpointStatus::Unhealthy => 3,
                };
                (health_score, e.info.priority, (e.stats.avg_response_time * 100.0) as u64)
            });
        
        match best_endpoint {
            Some(endpoint) => Ok((endpoint.info.id, endpoint.client.clone())),
            None => Err(AppError::AllEndpointsUnhealthy),
        }
    }
    
    async fn select_by_latency(&self) -> Result<(Uuid, reqwest::Client), AppError> {
        let endpoints = self.endpoints.read().await;
        
        let best_endpoint = endpoints.values()
            .filter(|e| self.is_endpoint_available(e))
            .min_by(|a, b| {
                a.stats.avg_response_time
                    .partial_cmp(&b.stats.avg_response_time)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        
        match best_endpoint {
            Some(endpoint) => Ok((endpoint.info.id, endpoint.client.clone())),
            None => Err(AppError::AllEndpointsUnhealthy),
        }
    }
    
    async fn select_weighted(&self) -> Result<(Uuid, reqwest::Client), AppError> {
        let endpoints = self.endpoints.read().await;
        
        let healthy_endpoints: Vec<_> = endpoints.values()
            .filter(|e| self.is_endpoint_available(e))
            .collect();
        
        if healthy_endpoints.is_empty() {
            return Err(AppError::AllEndpointsUnhealthy);
        }
        
        let total_weight: u32 = healthy_endpoints.iter()
            .map(|e| e.info.weight)
            .sum();
        
        if total_weight == 0 {
            return self.select_round_robin().await;
        }
        
        let random_weight = (Instant::now().elapsed().as_nanos() % total_weight as u128) as u32;
        let mut current_weight = 0;
        
        for endpoint in healthy_endpoints {
            current_weight += endpoint.info.weight;
            if random_weight < current_weight {
                return Ok((endpoint.info.id, endpoint.client.clone()));
            }
        }
        
        // Fallback to first endpoint
        let endpoint = &endpoints.values().find(|e| self.is_endpoint_available(e))
            .ok_or(AppError::AllEndpointsUnhealthy)?;
        Ok((endpoint.info.id, endpoint.client.clone()))
    }

    fn is_endpoint_available(&self, endpoint: &Endpoint) -> bool {
        matches!(endpoint.info.status, 
            EndpointStatus::Healthy | EndpointStatus::Degraded | EndpointStatus::Unknown) &&
        endpoint.connection_pool.active_connections < endpoint.connection_pool.max_connections
    }
    
    pub async fn update_endpoint_stats(&self, 
        endpoint_id: Uuid, 
        success: bool, 
        response_time: std::time::Duration
    ) {
        let mut endpoints = self.endpoints.write().await;
        let mut circuit_breakers = self.circuit_breakers.write().await;
        
        if let Some(endpoint) = endpoints.get_mut(&endpoint_id) {
            endpoint.stats.total_requests += 1;
            
            if success {
                endpoint.stats.successful_requests += 1;
                endpoint.stats.last_success = Some(Utc::now());
                
                // Update circuit breaker
                if let Some(breaker) = circuit_breakers.get_mut(&endpoint_id) {
                    breaker.record_success();
                }
            } else {
                endpoint.stats.failed_requests += 1;
                endpoint.stats.last_failure = Some(Utc::now());
                
                // Update circuit breaker
                if let Some(breaker) = circuit_breakers.get_mut(&endpoint_id) {
                    breaker.record_failure();
                }
            }
            
            // Update rolling average response time
            let current_avg = endpoint.stats.avg_response_time;
            let new_time = response_time.as_millis() as f64;
            let total_requests = endpoint.stats.total_requests as f64;
            
            endpoint.stats.avg_response_time = if current_avg == 0.0 {
                new_time
            } else {
                (current_avg * (total_requests - 1.0) + new_time) / total_requests
            };
            
            // Update endpoint score
            self.calculate_endpoint_score(endpoint);
            
            debug!("Updated stats for endpoint {}: success={}, response_time={}ms, score={}", 
                endpoint.info.name, success, new_time, endpoint.info.score.overall_grade);
        }
    }

    fn calculate_endpoint_score(&self, endpoint: &mut Endpoint) {
        let success_rate = if endpoint.stats.total_requests > 0 {
            (endpoint.stats.successful_requests as f64 / endpoint.stats.total_requests as f64) * 100.0
        } else {
            0.0
        };

        // Calculate overall grade based on multiple factors
        let mut score = 100.0;
        
        // Success rate impact (0-40 points)
        score *= success_rate / 100.0;
        
        // Response time impact (penalty for slow responses)
        if endpoint.stats.avg_response_time > 0.0 {
            let time_penalty = (endpoint.stats.avg_response_time / 1000.0).min(20.0); // Max 20 point penalty
            score -= time_penalty;
        }
        
        // Recency impact (prefer recently successful endpoints)
        if let Some(last_success) = endpoint.stats.last_success {
            let time_since_success = Utc::now().signed_duration_since(last_success).num_minutes();
            if time_since_success > 60 {
                score *= 0.8; // 20% penalty for old success
            }
        }
        
        // Determine grade letter
        let grade = match score {
            s if s >= 95.0 => "A+",
            s if s >= 90.0 => "A",
            s if s >= 85.0 => "A-",
            s if s >= 80.0 => "B+",
            s if s >= 75.0 => "B",
            s if s >= 70.0 => "B-",
            s if s >= 65.0 => "C+",
            s if s >= 60.0 => "C",
            s if s >= 55.0 => "C-",
            s if s >= 50.0 => "D",
            _ => "F",
        };

        endpoint.info.score = EndpointScore {
            overall_grade: grade.to_string(),
            success_rate,
            avg_response_time: endpoint.stats.avg_response_time,
            uptime_percentage: success_rate, // Simplified calculation
            feature_support: endpoint.config.features.len() as u8,
            last_updated: Utc::now(),
        };
    }
    
    pub async fn update_endpoint_status(&self, endpoint_id: Uuid, status: EndpointStatus) {
        let mut endpoints = self.endpoints.write().await;
        if let Some(endpoint) = endpoints.get_mut(&endpoint_id) {
            if endpoint.info.status != status {
                info!("Endpoint {} status changed: {:?} -> {:?}", 
                    endpoint.info.name, endpoint.info.status, status);
                endpoint.info.status = status;
                endpoint.info.last_checked = Utc::now();
            }
        }
    }
    
    pub async fn get_endpoint_url(&self, endpoint_id: Uuid) -> Option<String> {
        let endpoints = self.endpoints.read().await;
        endpoints.get(&endpoint_id).map(|e| e.info.url.clone())
    }

    pub async fn start_auto_discovery(&self) {
        let config = self.config.read().await;
        if !config.discovery.enabled {
            return;
        }

        let discovery_interval = config.discovery.discovery_interval;
        let cluster_urls = config.discovery.cluster_rpc_urls.clone();
        let test_methods = config.discovery.test_methods.clone();
        drop(config);

        info!("Starting auto-discovery service");
        
        let mut interval = interval(Duration::from_secs(discovery_interval));
        
        loop {
            interval.tick().await;
            
            for cluster_url in &cluster_urls {
                match self.discover_endpoints_from_cluster(cluster_url, &test_methods).await {
                    Ok(discovered) => {
                        info!("Discovered {} new endpoints from {}", discovered, cluster_url);
                    }
                    Err(e) => {
                        warn!("Discovery failed for {}: {}", cluster_url, e);
                    }
                }
            }
            
            // Cleanup old discovered endpoints
            self.cleanup_discovery_cache().await;
        }
    }

    async fn discover_endpoints_from_cluster(&self, cluster_url: &str, test_methods: &[String]) -> Result<usize, AppError> {
        // Query cluster for getClusterNodes
        let client = reqwest::Client::new();
        let request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getClusterNodes"
        });

        let response = client.post(cluster_url)
            .json(&request)
            .send()
            .await?;

        let result: Value = response.json().await?;
        
        if let Some(nodes) = result.get("result").and_then(|r| r.as_array()) {
            let mut discovered_count = 0;
            
            for node in nodes {
                if let Some(rpc_url) = node.get("rpc").and_then(|r| r.as_str()) {
                    if rpc_url.starts_with("http") {
                        match self.test_discovered_endpoint(rpc_url, test_methods).await {
                            Ok(endpoint_info) => {
                                self.add_discovered_endpoint(rpc_url.to_string(), endpoint_info).await;
                                discovered_count += 1;
                            }
                            Err(e) => {
                                debug!("Failed to test endpoint {}: {}", rpc_url, e);
                            }
                        }
                    }
                }
            }
            
            Ok(discovered_count)
        } else {
            Err(AppError::DiscoveryError("Invalid cluster response".to_string()))
        }
    }

    async fn test_discovered_endpoint(&self, url: &str, test_methods: &[String]) -> Result<DiscoveredEndpoint, AppError> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()?;

        let mut test_results = TestResults {
            health_check: false,
            version_check: false,
            method_support: HashMap::new(),
            response_times: HashMap::new(),
        };

        let mut total_score = 0.0;
        let mut test_count = 0;

        // Test each method
        for method in test_methods {
            let start = Instant::now();
            let request = json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": method
            });

            let response_result = client.post(url)
                .json(&request)
                .send()
                .await;

            let response_time = start.elapsed();
            test_results.response_times.insert(method.clone(), response_time);

            match response_result {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.json::<Value>().await {
                            Ok(json_response) => {
                                let success = json_response.get("result").is_some();
                                test_results.method_support.insert(method.clone(), success);
                                
                                if success {
                                    total_score += 1.0;
                                    
                                    if method == "getHealth" {
                                        test_results.health_check = true;
                                    } else if method == "getVersion" {
                                        test_results.version_check = true;
                                    }
                                }
                            }
                            Err(_) => {
                                test_results.method_support.insert(method.clone(), false);
                            }
                        }
                    } else {
                        test_results.method_support.insert(method.clone(), false);
                    }
                }
                Err(_) => {
                    test_results.method_support.insert(method.clone(), false);
                }
            }
            
            test_count += 1;
        }

        let score = if test_count > 0 {
            total_score / test_count as f64
        } else {
            0.0
        };

        // Calculate average latency
        let avg_latency = if !test_results.response_times.is_empty() {
            let total_ms: u128 = test_results.response_times.values()
                .map(|d| d.as_millis())
                .sum();
            Duration::from_millis((total_ms / test_results.response_times.len() as u128) as u64)
        } else {
            Duration::from_millis(5000) // Default high latency for failed tests
        };

        // Determine supported features
        let mut features = Vec::new();
        if test_results.health_check {
            features.push("health".to_string());
        }
        if test_results.version_check {
            features.push("version".to_string());
        }
        if test_results.method_support.values().any(|&supported| supported) {
            features.push("rpc".to_string());
        }

        Ok(DiscoveredEndpoint {
            url: url.to_string(),
            score,
            features,
            latency: avg_latency,
            last_tested: Instant::now(),
            test_results,
        })
    }

    async fn add_discovered_endpoint(&self, url: String, endpoint_info: DiscoveredEndpoint) {
        let config = self.config.read().await;
        
        // Check if we should auto-add this endpoint
        if config.discovery.auto_add_endpoints && 
           endpoint_info.score >= config.discovery.min_score_threshold {
            
            // Check if endpoint already exists
            let endpoints = self.endpoints.read().await;
            let exists = endpoints.values().any(|e| e.info.url == url);
            drop(endpoints);
            
            if !exists {
                let endpoint_config = EndpointConfig {
                    url: url.clone(),
                    name: format!("Auto-discovered-{}", url.split("://").nth(1).unwrap_or("unknown")),
                    weight: 50, // Lower weight for auto-discovered endpoints
                    priority: 10, // Lower priority
                    region: None,
                    latitude: None,
                    longitude: None,
                    features: endpoint_info.features.clone(),
                    max_connections: Some(25),
                    auth_token: None,
                };
                
                if let Err(e) = self.add_endpoint(endpoint_config).await {
                    warn!("Failed to add auto-discovered endpoint {}: {}", url, e);
                }
            }
        }
        
        // Always cache the discovery results
        let mut cache = self.discovery_cache.write().await;
        cache.insert(url, endpoint_info);
    }

    async fn cleanup_discovery_cache(&self) {
        let mut cache = self.discovery_cache.write().await;
        let cutoff = Instant::now() - Duration::from_secs(3600); // 1 hour
        
        cache.retain(|_, endpoint| endpoint.last_tested > cutoff);
    }

    pub async fn add_endpoint(&self, config: EndpointConfig) -> Result<Uuid, AppError> {
        let id = Uuid::new_v4();
        let client = Self::create_client(&config)?;
        
        let endpoint_name = config.name.clone();
        let endpoint_url = config.url.clone();
        
        let endpoint = Endpoint {
            info: EndpointInfo {
                id,
                url: config.url.clone(),
                name: config.name.clone(),
                status: EndpointStatus::Unknown,
                score: EndpointScore::default(),
                last_checked: Utc::now(),
                weight: config.weight,
                priority: config.priority,
                latitude: config.latitude,
                longitude: config.longitude,
                region: config.region.clone(),
            },
            stats: EndpointStats::default(),
            client,
            config,
            connection_pool: ConnectionPool::default(),
        };
        
        let mut endpoints = self.endpoints.write().await;
        let mut circuit_breakers = self.circuit_breakers.write().await;
        
        endpoints.insert(id, endpoint);
        circuit_breakers.insert(id, CircuitBreaker::default());
        
        info!("Added new endpoint: {} ({})", endpoint_name, endpoint_url);
        Ok(id)
    }

    pub async fn remove_endpoint(&self, endpoint_id: Uuid) -> Result<(), AppError> {
        let mut endpoints = self.endpoints.write().await;
        let mut circuit_breakers = self.circuit_breakers.write().await;
        
        if let Some(endpoint) = endpoints.remove(&endpoint_id) {
            circuit_breakers.remove(&endpoint_id);
            info!("Removed endpoint: {} ({})", endpoint.info.name, endpoint.info.url);
            Ok(())
        } else {
            Err(AppError::EndpointError("Endpoint not found".to_string()))
        }
    }

    pub async fn update_config(&self, new_config: Value) -> Result<(), AppError> {
        // This is a simplified version - in practice you'd want more sophisticated config updates
        info!("Config update requested: {}", new_config);
        Ok(())
    }

    pub async fn reload_config(&self) -> Result<(), AppError> {
        let mut config = self.config.write().await;
        config.reload().await?;
        info!("Configuration reloaded");
        Ok(())
    }

    pub async fn get_config(&self) -> Value {
        let config = self.config.read().await;
        json!({
            "endpoints": config.endpoints,
            "health_check_interval": config.health_check_interval,
            "request_timeout": config.request_timeout,
            "max_retries": config.max_retries,
            "discovery": config.discovery,
        })
    }

    pub async fn get_discovery_stats(&self) -> Value {
        let cache = self.discovery_cache.read().await;
        
        let mut by_score = HashMap::new();
        let mut total_tested = 0;
        let mut avg_latency = 0.0;
        
        for endpoint in cache.values() {
            total_tested += 1;
            avg_latency += endpoint.latency.as_millis() as f64;
            
            let score_bucket = ((endpoint.score * 10.0) as u32).min(10);
            *by_score.entry(format!("{}0-{}9%", score_bucket, score_bucket)).or_insert(0) += 1;
        }
        
        if total_tested > 0 {
            avg_latency /= total_tested as f64;
        }
        
        json!({
            "total_discovered": cache.len(),
            "total_tested": total_tested,
            "avg_latency_ms": avg_latency,
            "score_distribution": by_score,
            "recent_discoveries": cache.values()
                .filter(|e| e.last_tested.elapsed() < Duration::from_secs(300))
                .count(),
        })
    }
}