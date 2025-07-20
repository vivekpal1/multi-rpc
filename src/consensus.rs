use crate::{
    config::ConsensusConfig,
    error::AppError,
    types::EndpointInfo,
};
use dashmap::DashMap;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::time::timeout;
use tracing::{debug, warn, error};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ConsensusService {
    config: ConsensusConfig,
    response_cache: Arc<DashMap<String, CachedConsensus>>,
    validation_stats: Arc<DashMap<String, ValidationStats>>,
}

#[derive(Debug, Clone)]
struct CachedConsensus {
    response: Value,
    confidence: f64,
    endpoint_count: usize,
    timestamp: Instant,
    ttl: Duration,
}

#[derive(Debug, Clone)]
struct ValidationStats {
    total_requests: u64,
    consensus_achieved: u64,
    consensus_failed: u64,
    avg_response_time: f64,
    last_updated: Instant,
}

#[derive(Debug, Clone)]
pub struct ConsensusRequest {
    pub method: String,
    pub params: Value,
    pub endpoints: Vec<EndpointInfo>,
    pub require_consensus: bool,
}

#[derive(Debug, Clone)]
pub struct ConsensusResponse {
    pub response: Value,
    pub confidence: f64,
    pub endpoint_count: usize,
    pub consensus_achieved: bool,
    pub response_times: HashMap<Uuid, Duration>,
    pub errors: HashMap<Uuid, String>,
}

#[derive(Debug, Clone)]
struct EndpointResponse {
    endpoint_id: Uuid,
    response: Result<Value, String>,
    response_time: Duration,
}

impl ConsensusService {
    pub fn new(config: ConsensusConfig) -> Self {
        Self {
            config,
            response_cache: Arc::new(DashMap::new()),
            validation_stats: Arc::new(DashMap::new()),
        }
    }

    pub async fn validate_response(
        &self,
        request: ConsensusRequest,
        clients: HashMap<Uuid, reqwest::Client>,
    ) -> Result<ConsensusResponse, AppError> {
        let start_time = Instant::now();
        
        // Check if method requires consensus
        if !self.is_critical_method(&request.method) && !request.require_consensus {
            // For non-critical methods, use fastest endpoint
            return self.get_fastest_response(request, clients).await;
        }

        // Check cache first
        let cache_key = self.create_cache_key(&request.method, &request.params);
        if let Some(cached) = self.response_cache.get(&cache_key) {
            if cached.timestamp.elapsed() < cached.ttl {
                return Ok(ConsensusResponse {
                    response: cached.response.clone(),
                    confidence: cached.confidence,
                    endpoint_count: cached.endpoint_count,
                    consensus_achieved: true,
                    response_times: HashMap::new(),
                    errors: HashMap::new(),
                });
            }
        }

        // Execute consensus validation
        let consensus_result = self.execute_consensus(request, clients).await?;
        
        // Cache successful consensus results
        if consensus_result.consensus_achieved {
            let cached = CachedConsensus {
                response: consensus_result.response.clone(),
                confidence: consensus_result.confidence,
                endpoint_count: consensus_result.endpoint_count,
                timestamp: start_time,
                ttl: Duration::from_secs(self.get_cache_ttl(&consensus_result.response)),
            };
            self.response_cache.insert(cache_key.clone(), cached);
        }

        // Update statistics
        self.update_validation_stats(&cache_key, start_time.elapsed(), consensus_result.consensus_achieved);

        Ok(consensus_result)
    }

    async fn execute_consensus(
        &self,
        request: ConsensusRequest,
        clients: HashMap<Uuid, reqwest::Client>,
    ) -> Result<ConsensusResponse, AppError> {
        let timeout_duration = Duration::from_millis(self.config.timeout_ms);
        let min_confirmations = self.config.min_confirmations.min(clients.len() as u32);
        
        debug!("Executing consensus for method: {} with {} endpoints", 
            request.method, clients.len());

        // Execute requests in parallel
        let mut tasks = Vec::new();
        
        for (endpoint_id, client) in clients {
            let endpoint_url = request.endpoints
                .iter()
                .find(|e| e.id == endpoint_id)
                .map(|e| e.url.clone())
                .unwrap_or_default();
            
            let request_payload = json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": request.method,
                "params": request.params
            });

            let task = async move {
                let start = Instant::now();
                let result = timeout(
                    timeout_duration,
                    client.post(&endpoint_url).json(&request_payload).send()
                ).await;

                let response = match result {
                    Ok(Ok(resp)) => {
                        match resp.json::<Value>().await {
                            Ok(json) => Ok(json),
                            Err(e) => Err(format!("JSON parse error: {}", e)),
                        }
                    }
                    Ok(Err(e)) => Err(format!("HTTP error: {}", e)),
                    Err(_) => Err("Request timeout".to_string()),
                };

                EndpointResponse {
                    endpoint_id,
                    response,
                    response_time: start.elapsed(),
                }
            };

            tasks.push(tokio::spawn(task));
        }

        // Collect responses
        let mut responses = Vec::new();
        let mut response_times = HashMap::new();
        let mut errors = HashMap::new();

        for task in tasks {
            match task.await {
                Ok(endpoint_response) => {
                    response_times.insert(endpoint_response.endpoint_id, endpoint_response.response_time);
                    
                    match endpoint_response.response {
                        Ok(response) => responses.push((endpoint_response.endpoint_id, response)),
                        Err(error) => {
                            errors.insert(endpoint_response.endpoint_id, error);
                        }
                    }
                }
                Err(e) => {
                    error!("Task execution error: {}", e);
                }
            }
        }

        // Check if we have minimum confirmations
        if responses.len() < min_confirmations as usize {
            return Err(AppError::InsufficientConfirmations);
        }

        // Perform consensus analysis
        let consensus_result = self.analyze_consensus(&request.method, responses)?;

        Ok(ConsensusResponse {
            response: consensus_result.0,
            confidence: consensus_result.1,
            endpoint_count: response_times.len(),
            consensus_achieved: consensus_result.1 >= self.config.consensus_threshold,
            response_times,
            errors,
        })
    }

    async fn get_fastest_response(
        &self,
        request: ConsensusRequest,
        clients: HashMap<Uuid, reqwest::Client>,
    ) -> Result<ConsensusResponse, AppError> {
        // For non-critical methods, just use the fastest endpoint
        if let Some((endpoint_id, client)) = clients.into_iter().next() {
            let endpoint_url = request.endpoints
                .iter()
                .find(|e| e.id == endpoint_id)
                .map(|e| e.url.clone())
                .unwrap_or_default();

            let request_payload = json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": request.method,
                "params": request.params
            });

            let start = Instant::now();
            let response = client
                .post(&endpoint_url)
                .json(&request_payload)
                .send()
                .await?;

            let response_json: Value = response.json().await?;
            let response_time = start.elapsed();

            let mut response_times = HashMap::new();
            response_times.insert(endpoint_id, response_time);

            Ok(ConsensusResponse {
                response: response_json,
                confidence: 1.0,
                endpoint_count: 1,
                consensus_achieved: false, // Single endpoint, no consensus needed
                response_times,
                errors: HashMap::new(),
            })
        } else {
            Err(AppError::AllEndpointsUnhealthy)
        }
    }

    fn analyze_consensus(
        &self,
        method: &str,
        responses: Vec<(Uuid, Value)>,
    ) -> Result<(Value, f64), AppError> {
        if responses.is_empty() {
            return Err(AppError::InsufficientConfirmations);
        }

        match method {
            // For balance and account info, use exact matching
            "getBalance" | "getAccountInfo" => {
                self.consensus_exact_match(responses)
            }
            
            // For slot-based methods, allow small differences
            "getSlot" | "getBlockHeight" => {
                self.consensus_numeric_tolerance(responses, 2.0) // Allow 2 slot difference
            }
            
            // For transaction status, use majority vote
            "getSignatureStatuses" => {
                self.consensus_majority_vote(responses)
            }
            
            // For block data, use hash comparison
            "getBlock" | "getRecentBlockhash" | "getLatestBlockhash" => {
                self.consensus_hash_based(responses)
            }
            
            // Default: exact match
            _ => {
                self.consensus_exact_match(responses)
            }
        }
    }

    fn consensus_exact_match(&self, responses: Vec<(Uuid, Value)>) -> Result<(Value, f64), AppError> {
        let mut response_counts: HashMap<String, (Value, usize)> = HashMap::new();
        
        for (_, response) in &responses {
            let response_str = serde_json::to_string(response).unwrap_or_default();
            let entry = response_counts.entry(response_str).or_insert((response.clone(), 0));
            entry.1 += 1;
        }

        // Find the most common response
        let (consensus_response, count) = response_counts
            .into_values()
            .max_by_key(|(_, count)| *count)
            .ok_or_else(|| AppError::consensus("No responses to analyze"))?;

        let confidence = count as f64 / responses.len() as f64;
        
        if confidence < self.config.consensus_threshold {
            warn!("Consensus not achieved: {:.2}% agreement", confidence * 100.0);
            return Err(AppError::consensus(&format!(
                "Consensus threshold not met: {:.2}% < {:.2}%",
                confidence * 100.0,
                self.config.consensus_threshold * 100.0
            )));
        }

        Ok((consensus_response, confidence))
    }

    fn consensus_numeric_tolerance(&self, responses: Vec<(Uuid, Value)>, tolerance: f64) -> Result<(Value, f64), AppError> {
        let mut numeric_values = Vec::new();
        
        for (_, response) in &responses {
            if let Some(result) = response.get("result") {
                if let Some(num) = result.as_u64() {
                    numeric_values.push(num as f64);
                } else if let Some(num) = result.as_f64() {
                    numeric_values.push(num);
                }
            }
        }

        if numeric_values.is_empty() {
            return Err(AppError::consensus("No numeric values found"));
        }

        // Calculate median
        numeric_values.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let median = if numeric_values.len() % 2 == 0 {
            (numeric_values[numeric_values.len() / 2 - 1] + numeric_values[numeric_values.len() / 2]) / 2.0
        } else {
            numeric_values[numeric_values.len() / 2]
        };

        // Count values within tolerance of median
        let within_tolerance = numeric_values
            .iter()
            .filter(|&&val| (val - median).abs() <= tolerance)
            .count();

        let confidence = within_tolerance as f64 / numeric_values.len() as f64;
        
        if confidence < self.config.consensus_threshold {
            return Err(AppError::consensus(&format!(
                "Numeric consensus not achieved: {:.2}% within tolerance",
                confidence * 100.0
            )));
        }

        // Return the response with the median value
        let target_value = median.round() as u64;
        let consensus_response = responses
            .into_iter()
            .find(|(_, resp)| {
                resp.get("result")
                    .and_then(|r| r.as_u64())
                    .map(|v| (v as f64 - median).abs() <= tolerance)
                    .unwrap_or(false)
            })
            .map(|(_, resp)| resp)
            .unwrap_or_else(|| json!({"result": target_value}));

        Ok((consensus_response, confidence))
    }

    fn consensus_majority_vote(&self, responses: Vec<(Uuid, Value)>) -> Result<(Value, f64), AppError> {
        // Similar to exact match but with more lenient comparison
        self.consensus_exact_match(responses)
    }

    fn consensus_hash_based(&self, responses: Vec<(Uuid, Value)>) -> Result<(Value, f64), AppError> {
        // For hash-based responses, extract and compare hash values
        let mut hash_counts: HashMap<String, (Value, usize)> = HashMap::new();
        
        for (_, response) in &responses {
            let hash = self.extract_hash_from_response(response);
            let entry = hash_counts.entry(hash).or_insert((response.clone(), 0));
            entry.1 += 1;
        }

        let (consensus_response, count) = hash_counts
            .into_values()
            .max_by_key(|(_, count)| *count)
            .ok_or_else(|| AppError::consensus("No hash responses to analyze"))?;

        let confidence = count as f64 / responses.len() as f64;
        
        if confidence < self.config.consensus_threshold {
            return Err(AppError::consensus(&format!(
                "Hash consensus not achieved: {:.2}% agreement",
                confidence * 100.0
            )));
        }

        Ok((consensus_response, confidence))
    }

    fn extract_hash_from_response(&self, response: &Value) -> String {
        // Extract hash from various response formats
        if let Some(result) = response.get("result") {
            if let Some(hash_str) = result.as_str() {
                return hash_str.to_string();
            } else if let Some(obj) = result.as_object() {
                if let Some(blockhash) = obj.get("blockhash").and_then(|v| v.as_str()) {
                    return blockhash.to_string();
                }
                if let Some(value) = obj.get("value").and_then(|v| v.as_str()) {
                    return value.to_string();
                }
            }
        }
        
        // Fallback: use entire response as hash
        serde_json::to_string(response).unwrap_or_default()
    }

    fn is_critical_method(&self, method: &str) -> bool {
        self.config.critical_methods.contains(&method.to_string())
    }

    fn create_cache_key(&self, method: &str, params: &Value) -> String {
        format!("{}:{}", method, serde_json::to_string(params).unwrap_or_default())
    }

    fn get_cache_ttl(&self, response: &Value) -> u64 {
        // Determine TTL based on response content
        if response.get("result").and_then(|r| r.get("blockhash")).is_some() {
            return 5; // Short TTL for blockhash
        }
        
        if response.get("result").and_then(|r| r.as_u64()).is_some() {
            return 2; // Very short TTL for numeric values like slot
        }
        
        10 // Default TTL
    }

    fn update_validation_stats(&self, key: &str, response_time: Duration, consensus_achieved: bool) {
        let mut stats = self.validation_stats.entry(key.to_string()).or_insert(ValidationStats {
            total_requests: 0,
            consensus_achieved: 0,
            consensus_failed: 0,
            avg_response_time: 0.0,
            last_updated: Instant::now(),
        });

        stats.total_requests += 1;
        if consensus_achieved {
            stats.consensus_achieved += 1;
        } else {
            stats.consensus_failed += 1;
        }
        
        // Update rolling average response time
        let new_time = response_time.as_millis() as f64;
        stats.avg_response_time = (stats.avg_response_time * (stats.total_requests - 1) as f64 + new_time) / stats.total_requests as f64;
        stats.last_updated = Instant::now();
    }

    pub async fn get_debug_info(&self) -> Value {
        let cache_size = self.response_cache.len();
        let stats_count = self.validation_stats.len();
        
        let mut method_stats = serde_json::Map::new();
        for entry in self.validation_stats.iter() {
            let stats = entry.value();
            method_stats.insert(entry.key().clone(), json!({
                "total_requests": stats.total_requests,
                "consensus_achieved": stats.consensus_achieved,
                "consensus_failed": stats.consensus_failed,
                "success_rate": if stats.total_requests > 0 {
                    stats.consensus_achieved as f64 / stats.total_requests as f64
                } else { 0.0 },
                "avg_response_time_ms": stats.avg_response_time,
                "last_updated": stats.last_updated.elapsed().as_secs(),
            }));
        }

        json!({
            "enabled": self.config.enabled,
            "min_confirmations": self.config.min_confirmations,
            "consensus_threshold": self.config.consensus_threshold,
            "timeout_ms": self.config.timeout_ms,
            "cache_size": cache_size,
            "stats_count": stats_count,
            "method_stats": method_stats,
            "critical_methods": self.config.critical_methods,
        })
    }

    pub async fn clear_cache(&self) {
        self.response_cache.clear();
    }

    pub async fn get_cache_stats(&self) -> Value {
        json!({
            "total_entries": self.response_cache.len(),
            "cache_hits": 0, // TODO: implement hit tracking
            "cache_misses": 0, // TODO: implement miss tracking
        })
    }
}