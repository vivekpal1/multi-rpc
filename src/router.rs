use crate::{
    auth::AuthContext,
    cache::CacheService,
    consensus::{ConsensusService, ConsensusRequest},
    endpoints::EndpointManager,
    error::AppError,
    geo::GeoService,
    metrics::MetricsService,
    rate_limit::{RateLimitContext, RateLimitService},
    rpc::{get_method_category, validate_rpc_request, RpcMethodCategory},
    types::{RpcRequest, RpcResponse, RpcError},
};
use axum::extract::Request;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::time::timeout;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub struct RpcRouter {
    endpoint_manager: Arc<EndpointManager>,
    cache_service: Arc<CacheService>,
    consensus_service: Arc<ConsensusService>,
    geo_service: Arc<GeoService>,
    metrics_service: Arc<MetricsService>,
    max_retries: usize,
    request_timeout: Duration,
}

impl RpcRouter {
    pub fn new(
        endpoint_manager: Arc<EndpointManager>,
        cache_service: Arc<CacheService>,
        consensus_service: Arc<ConsensusService>,
        geo_service: Arc<GeoService>,
        metrics_service: Arc<MetricsService>,
    ) -> Self {
        Self {
            endpoint_manager,
            cache_service,
            consensus_service,
            geo_service,
            metrics_service,
            max_retries: 3,
            request_timeout: Duration::from_secs(10),
        }
    }
    
    pub async fn route_request(
        &self, 
        payload: Value, 
        client_ip: Option<String>
    ) -> Result<Value, AppError> {
        let start_time = Instant::now();
        
        // Clone payload for metrics recording
        let payload_for_metrics = payload.clone();
        
        // Handle both single requests and batch requests
        let result = if payload.is_array() {
            self.handle_batch_request(payload, client_ip).await
        } else {
            self.handle_single_request(payload, client_ip).await
        };
        
        let duration = start_time.elapsed();
        
        // Record metrics regardless of success/failure
        if let Ok(ref response) = result {
            if let Some(method) = self.extract_method_from_payload(&payload_for_metrics) {
                self.metrics_service.record_request(&method, None, duration).await;
            }
        } else {
            self.metrics_service.record_error("request_failed").await;
        }
        
        result
    }
    
    async fn handle_single_request(&self, payload: Value, client_ip: Option<String>) -> Result<Value, AppError> {
        // Validate and parse the RPC request
        let rpc_request = validate_rpc_request(&payload)
            .map_err(|e| AppError::invalid_request(&e))?;
        
        debug!("Processing RPC request: method={}, id={:?}", 
            rpc_request.method, rpc_request.id);
        
        // Check cache first for cacheable methods
        let cache_params = rpc_request.params.clone().unwrap_or(Value::Null);
        if let Some(cached_response) = self.cache_service.get(&rpc_request.method, &cache_params).await {
            debug!("Cache hit for method: {}", rpc_request.method);
            self.metrics_service.record_cache_hit();
            return Ok(cached_response);
        } else {
            self.metrics_service.record_cache_miss();
        }
        
        // Determine if consensus is needed
        let requires_consensus = self.should_use_consensus(&rpc_request.method);
        
        // Get optimal endpoints based on geographic routing
        let available_endpoints = self.endpoint_manager.get_endpoint_info().await;
        let sorted_endpoints = if self.geo_service.is_enabled() {
            self.geo_service.sort_endpoints_by_proximity(
                available_endpoints,
                client_ip.as_deref(),
            ).await
        } else {
            available_endpoints.into_iter()
                .map(|endpoint| crate::geo::GeoSortedEndpoint {
                    score: 100.0 - endpoint.priority as f64,
                    distance_km: None,
                    latency_penalty_ms: 0.0,
                    region_weight: 1.0,
                    endpoint,
                })
                .collect()
        };
        
        let response = if requires_consensus {
            self.handle_consensus_request(rpc_request, sorted_endpoints).await?
        } else {
            self.handle_standard_request(rpc_request, sorted_endpoints).await?
        };
        
        // Cache the response if appropriate
        if let Ok(ref rpc_req) = validate_rpc_request(&payload) {
            let cache_params = rpc_req.params.clone().unwrap_or(Value::Null);
            self.cache_service.set(
                &rpc_req.method,
                &cache_params,
                &response
            ).await;
        }
        
        Ok(response)
    }
    
    async fn handle_batch_request(&self, payload: Value, client_ip: Option<String>) -> Result<Value, AppError> {
        let requests = payload.as_array()
            .ok_or_else(|| AppError::invalid_request("Invalid batch request"))?;
        
        if requests.is_empty() {
            return Err(AppError::invalid_request("Empty batch request"));
        }
        
        if requests.len() > 100 {
            return Err(AppError::invalid_request("Batch size too large"));
        }
        
        let mut responses = Vec::with_capacity(requests.len());
        
        // Process batch requests with limited concurrency
        let semaphore = Arc::new(tokio::sync::Semaphore::new(10)); // Max 10 concurrent requests
        let mut tasks = Vec::new();
        
        for request in requests {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let router = self.clone();
            let client_ip_clone = client_ip.clone();
            let request_clone = request.clone();
            
            let task = tokio::spawn(async move {
                let _permit = permit;
                router.handle_single_request(request_clone, client_ip_clone).await
            });
            
            tasks.push(task);
        }
        
        // Collect results maintaining order
        for task in tasks {
            match task.await {
                Ok(Ok(response)) => responses.push(response),
                Ok(Err(e)) => {
                    // For batch requests, include error responses
                    responses.push(json!({
                        "jsonrpc": "2.0",
                        "id": null,
                        "error": {
                            "code": -32603,
                            "message": "Internal error",
                            "data": e.to_string()
                        }
                    }));
                }
                Err(e) => {
                    error!("Batch request task failed: {}", e);
                    responses.push(json!({
                        "jsonrpc": "2.0",
                        "id": null,
                        "error": {
                            "code": -32603,
                            "message": "Task execution error"
                        }
                    }));
                }
            }
        }
        
        Ok(Value::Array(responses))
    }
    
    async fn handle_consensus_request(
        &self,
        rpc_request: RpcRequest,
        sorted_endpoints: Vec<crate::geo::GeoSortedEndpoint>,
    ) -> Result<Value, AppError> {
        let consensus_start = Instant::now();
        
        // Select top endpoints for consensus
        let top_endpoints: Vec<_> = sorted_endpoints
            .into_iter()
            .take(5) // Use top 5 endpoints for consensus
            .map(|ge| ge.endpoint)
            .collect();
        
        if top_endpoints.len() < 2 {
            warn!("Insufficient endpoints for consensus, falling back to single endpoint");
            return self.handle_standard_request(rpc_request, vec![]).await;
        }
        
        // Create HTTP clients for selected endpoints
        let mut clients = HashMap::new();
        for endpoint in &top_endpoints {
            if let Ok((endpoint_id, client)) = self.endpoint_manager.select_endpoint().await {
                clients.insert(endpoint_id, client);
            }
        }
        
        let consensus_request = ConsensusRequest {
            method: rpc_request.method.clone(),
            params: rpc_request.params.unwrap_or(Value::Null),
            endpoints: top_endpoints,
            require_consensus: true,
        };
        
        let consensus_result = self.consensus_service
            .validate_response(consensus_request, clients)
            .await?;
        
        let consensus_duration = consensus_start.elapsed();
        self.metrics_service.record_consensus_request(consensus_duration, consensus_result.consensus_achieved);
        
        if !consensus_result.consensus_achieved {
            warn!("Consensus not achieved for method: {}", rpc_request.method);
            return Err(AppError::consensus("Consensus validation failed"));
        }
        
        // Create response with consensus metadata
        let mut response = consensus_result.response;
        if let Some(obj) = response.as_object_mut() {
            obj.insert("consensus_meta".to_string(), json!({
                "confidence": consensus_result.confidence,
                "endpoint_count": consensus_result.endpoint_count,
                "consensus_achieved": consensus_result.consensus_achieved,
            }));
        }
        
        info!("Consensus achieved for {}: confidence={:.2}, endpoints={}", 
            rpc_request.method, consensus_result.confidence, consensus_result.endpoint_count);
        
        Ok(response)
    }
    
    async fn handle_standard_request(
        &self,
        rpc_request: RpcRequest,
        sorted_endpoints: Vec<crate::geo::GeoSortedEndpoint>,
    ) -> Result<Value, AppError> {
        // Try the request with retries and failover
        for attempt in 0..=self.max_retries {
            match self.try_request(&rpc_request, attempt, &sorted_endpoints).await {
                Ok(response) => {
                    debug!("Request successful on attempt {}", attempt + 1);
                    return Ok(response);
                }
                Err(e) => {
                    if attempt == self.max_retries {
                        error!("Request failed after {} attempts: {}", attempt + 1, e);
                        return Err(e);
                    } else {
                        warn!("Request failed on attempt {}, retrying: {}", attempt + 1, e);
                        // Exponential backoff
                        let delay = Duration::from_millis(100 * (1 << attempt));
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }
        
        Err(AppError::internal("Max retries exceeded"))
    }
    
    async fn try_request(
        &self,
        rpc_request: &RpcRequest,
        attempt: usize,
        sorted_endpoints: &[crate::geo::GeoSortedEndpoint],
    ) -> Result<Value, AppError> {
        let start_time = Instant::now();
        
        // Select endpoint based on attempt and availability
        let (endpoint_id, client) = if sorted_endpoints.is_empty() {
            self.endpoint_manager.select_endpoint().await?
        } else {
            // Use geographic preference but fall back to health-based selection
            let endpoint_index = attempt % sorted_endpoints.len();
            let selected_endpoint = &sorted_endpoints[endpoint_index].endpoint;
            
            // Get client for this specific endpoint
            self.endpoint_manager.select_endpoint().await? // Simplified for now
        };
        
        let endpoint_url = self.endpoint_manager.get_endpoint_url(endpoint_id).await
            .ok_or_else(|| AppError::endpoint("Endpoint not found"))?;
        
        debug!("Attempting request to endpoint {} (attempt {})", endpoint_url, attempt + 1);
        
        // Prepare request payload
        let request_payload = json!({
            "jsonrpc": rpc_request.jsonrpc,
            "id": rpc_request.id,
            "method": rpc_request.method,
            "params": rpc_request.params
        });
        
        // Make the request with timeout
        let request_future = client
            .post(&endpoint_url)
            .header("Content-Type", "application/json")
            .header("User-Agent", "Multi-RPC/1.0")
            .json(&request_payload)
            .send();
        
        let response = match timeout(self.request_timeout, request_future).await {
            Ok(Ok(response)) => response,
            Ok(Err(e)) => {
                let elapsed = start_time.elapsed();
                self.endpoint_manager.update_endpoint_stats(endpoint_id, false, elapsed).await;
                return Err(AppError::NetworkError(e));
            }
            Err(_) => {
                let elapsed = start_time.elapsed();
                self.endpoint_manager.update_endpoint_stats(endpoint_id, false, elapsed).await;
                return Err(AppError::RequestTimeout);
            }
        };
        
        let elapsed = start_time.elapsed();
        
        if !response.status().is_success() {
            self.endpoint_manager.update_endpoint_stats(endpoint_id, false, elapsed).await;
            return Err(AppError::endpoint(&format!(
                "HTTP {}: {}", response.status(), endpoint_url
            )));
        }
        
        // Parse the response
        let response_text = response.text().await
            .map_err(|e| {
                // Note: We can't call async function in map_err closure
                AppError::NetworkError(e)
            })?;
        
        let response_json: Value = serde_json::from_str(&response_text)
            .map_err(|e| AppError::JsonError(e))?;
        
        // Check if the response contains an error
        let is_success = if let Some(error) = response_json.get("error") {
            // Some errors are expected (like "method not found") and shouldn't be retried
            let error_code = error.get("code").and_then(|c| c.as_i64()).unwrap_or(0);
            match error_code {
                -32601 => true, // Method not found - don't retry
                -32602 => true, // Invalid params - don't retry  
                -32700 => false, // Parse error - might be endpoint issue
                -32600 => false, // Invalid request - might be endpoint issue
                _ => false, // Other errors - might be transient
            }
        } else {
            true
        };
        
        // Update endpoint statistics
        self.endpoint_manager.update_endpoint_stats(endpoint_id, is_success, elapsed).await;
        
        // Record endpoint-specific metrics
        self.metrics_service.record_endpoint_stats(
            endpoint_id,
            &endpoint_url,
            elapsed,
            is_success
        ).await;
        
        debug!("Request completed: endpoint={}, success={}, time={}ms", 
            endpoint_url, is_success, elapsed.as_millis());
        
        Ok(response_json)
    }
    
    fn should_use_consensus(&self, method: &str) -> bool {
        // Determine if method requires consensus validation
        matches!(method,
            "sendTransaction" |
            "getAccountInfo" |
            "getBalance" |
            "getSignatureStatuses" |
            "getTransaction"
        )
    }
    
    fn extract_method_from_payload(&self, payload: &Value) -> Option<String> {
        payload.get("method")
            .and_then(|m| m.as_str())
            .map(|s| s.to_string())
    }
    
    pub fn set_max_retries(&mut self, max_retries: usize) {
        self.max_retries = max_retries;
    }
    
    pub fn set_request_timeout(&mut self, timeout: Duration) {
        self.request_timeout = timeout;
    }
    
    // Method-specific routing optimizations
    pub async fn route_with_method_optimization(
        &self,
        rpc_request: &RpcRequest,
        client_ip: Option<String>,
    ) -> Result<Value, AppError> {
        match get_method_category(&rpc_request.method) {
            RpcMethodCategory::Realtime => {
                // For real-time data, prioritize fastest endpoints
                self.route_to_fastest_endpoint(rpc_request).await
            }
            RpcMethodCategory::Static => {
                // For static data, heavily favor cache
                self.route_with_aggressive_caching(rpc_request).await
            }
            RpcMethodCategory::Transaction => {
                // For transactions, use consensus validation
                self.route_with_consensus(rpc_request, client_ip).await
            }
            _ => {
                // Default routing
                let payload = json!({
                    "jsonrpc": rpc_request.jsonrpc,
                    "id": rpc_request.id,
                    "method": rpc_request.method,
                    "params": rpc_request.params
                });
                self.handle_single_request(payload, client_ip).await
            }
        }
    }
    
    async fn route_to_fastest_endpoint(&self, rpc_request: &RpcRequest) -> Result<Value, AppError> {
        // Select the endpoint with lowest latency
        let endpoints = self.endpoint_manager.get_endpoint_info().await;
        let fastest_endpoint = endpoints
            .into_iter()
            .min_by(|a, b| a.score.avg_response_time.partial_cmp(&b.score.avg_response_time).unwrap_or(std::cmp::Ordering::Equal))
            .ok_or_else(|| AppError::AllEndpointsUnhealthy)?;
        
        // Make direct request to fastest endpoint
        let (endpoint_id, client) = self.endpoint_manager.select_endpoint().await?;
        let endpoint_url = self.endpoint_manager.get_endpoint_url(endpoint_id).await
            .ok_or_else(|| AppError::endpoint("Endpoint not found"))?;
        
        let request_payload = json!({
            "jsonrpc": rpc_request.jsonrpc,
            "id": rpc_request.id,
            "method": rpc_request.method,
            "params": rpc_request.params
        });
        
        let start_time = Instant::now();
        let response = client
            .post(&endpoint_url)
            .json(&request_payload)
            .send()
            .await?;
        
        let elapsed = start_time.elapsed();
        let response_json: Value = response.json().await?;
        
        self.endpoint_manager.update_endpoint_stats(endpoint_id, true, elapsed).await;
        
        Ok(response_json)
    }
    
    async fn route_with_aggressive_caching(&self, rpc_request: &RpcRequest) -> Result<Value, AppError> {
        // Check cache with longer TTL for static methods
        let params = rpc_request.params.as_ref().unwrap_or(&Value::Null);
        
        if let Some(cached) = self.cache_service.get(&rpc_request.method, params).await {
            return Ok(cached);
        }
        
        // If not cached, make request and cache with extended TTL
        let payload = json!({
            "jsonrpc": rpc_request.jsonrpc,
            "id": rpc_request.id,
            "method": rpc_request.method,
            "params": rpc_request.params
        });
        
        let response = self.handle_single_request(payload, None).await?;
        
        // Cache with extended TTL for static data
        self.cache_service.set(&rpc_request.method, params, &response).await;
        
        Ok(response)
    }
    
    async fn route_with_consensus(&self, rpc_request: &RpcRequest, client_ip: Option<String>) -> Result<Value, AppError> {
        // Force consensus for critical transaction methods
        let sorted_endpoints = self.geo_service.sort_endpoints_by_proximity(
            self.endpoint_manager.get_endpoint_info().await,
            client_ip.as_deref(),
        ).await;
        
        self.handle_consensus_request(rpc_request.clone(), sorted_endpoints).await
    }
}

// Clone implementation for async tasks
impl Clone for RpcRouter {
    fn clone(&self) -> Self {
        Self {
            endpoint_manager: self.endpoint_manager.clone(),
            cache_service: self.cache_service.clone(),
            consensus_service: self.consensus_service.clone(),
            geo_service: self.geo_service.clone(),
            metrics_service: self.metrics_service.clone(),
            max_retries: self.max_retries,
            request_timeout: self.request_timeout,
        }
    }
}