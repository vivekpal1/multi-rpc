use crate::error::AppError;
use prometheus::{
    register_counter, register_gauge, register_histogram, register_int_counter, register_int_gauge,
    Counter, Encoder, Gauge, Histogram, IntCounter, IntGauge, Registry, TextEncoder,
};
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
use tracing::{debug, error};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct MetricsService {
    registry: Registry,
    
    // Request metrics
    requests_total: IntCounter,
    requests_duration: Histogram,
    requests_by_method: Arc<RwLock<HashMap<String, IntCounter>>>,
    requests_by_endpoint: Arc<RwLock<HashMap<String, IntCounter>>>,
    
    // Endpoint metrics
    endpoints_healthy: IntGauge,
    endpoints_total: IntGauge,
    endpoint_response_time: Arc<RwLock<HashMap<String, Gauge>>>,
    endpoint_success_rate: Arc<RwLock<HashMap<String, Gauge>>>,
    
    // Cache metrics
    cache_hits: IntCounter,
    cache_misses: IntCounter,
    cache_size: IntGauge,
    
    // WebSocket metrics
    websocket_connections: IntGauge,
    websocket_subscriptions: IntGauge,
    websocket_messages: IntCounter,
    
    // Consensus metrics
    consensus_requests: IntCounter,
    consensus_successes: IntCounter,
    consensus_failures: IntCounter,
    consensus_duration: Histogram,
    
    // Error metrics
    errors_total: IntCounter,
    errors_by_type: Arc<RwLock<HashMap<String, IntCounter>>>,
    
    // Authentication metrics
    auth_requests: IntCounter,
    auth_successes: IntCounter,
    auth_failures: IntCounter,
    
    // Rate limiting metrics
    rate_limited_requests: IntCounter,
    
    // Custom metrics storage
    custom_metrics: Arc<RwLock<HashMap<String, CustomMetric>>>,
    
    // Service start time for uptime calculation
    start_time: Instant,
}

#[derive(Debug, Clone)]
pub struct CustomMetric {
    pub value: f64,
    pub timestamp: Instant,
    pub labels: HashMap<String, String>,
    pub metric_type: CustomMetricType,
}

#[derive(Debug, Clone)]
pub enum CustomMetricType {
    Counter,
    Gauge,
    Histogram { buckets: Vec<f64> },
}

impl MetricsService {
    pub fn new() -> Self {
        let registry = Registry::new();
        
        let requests_total = register_int_counter!(
            "multi_rpc_requests_total",
            "Total number of RPC requests"
        ).expect("Failed to create requests_total metric");
        
        let requests_duration = register_histogram!(
            "multi_rpc_request_duration_seconds",
            "Duration of RPC requests in seconds",
            vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
        ).expect("Failed to create requests_duration metric");
        
        let endpoints_healthy = register_int_gauge!(
            "multi_rpc_endpoints_healthy",
            "Number of healthy endpoints"
        ).expect("Failed to create endpoints_healthy metric");
        
        let endpoints_total = register_int_gauge!(
            "multi_rpc_endpoints_total",
            "Total number of configured endpoints"
        ).expect("Failed to create endpoints_total metric");
        
        let cache_hits = register_int_counter!(
            "multi_rpc_cache_hits_total",
            "Total number of cache hits"
        ).expect("Failed to create cache_hits metric");
        
        let cache_misses = register_int_counter!(
            "multi_rpc_cache_misses_total",
            "Total number of cache misses"
        ).expect("Failed to create cache_misses metric");
        
        let cache_size = register_int_gauge!(
            "multi_rpc_cache_size",
            "Current cache size in entries"
        ).expect("Failed to create cache_size metric");
        
        let websocket_connections = register_int_gauge!(
            "multi_rpc_websocket_connections",
            "Current number of WebSocket connections"
        ).expect("Failed to create websocket_connections metric");
        
        let websocket_subscriptions = register_int_gauge!(
            "multi_rpc_websocket_subscriptions",
            "Current number of WebSocket subscriptions"
        ).expect("Failed to create websocket_subscriptions metric");
        
        let websocket_messages = register_int_counter!(
            "multi_rpc_websocket_messages_total",
            "Total number of WebSocket messages"
        ).expect("Failed to create websocket_messages metric");
        
        let consensus_requests = register_int_counter!(
            "multi_rpc_consensus_requests_total",
            "Total number of consensus requests"
        ).expect("Failed to create consensus_requests metric");
        
        let consensus_successes = register_int_counter!(
            "multi_rpc_consensus_successes_total",
            "Total number of successful consensus operations"
        ).expect("Failed to create consensus_successes metric");
        
        let consensus_failures = register_int_counter!(
            "multi_rpc_consensus_failures_total",
            "Total number of failed consensus operations"
        ).expect("Failed to create consensus_failures metric");
        
        let consensus_duration = register_histogram!(
            "multi_rpc_consensus_duration_seconds",
            "Duration of consensus operations in seconds",
            vec![0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0]
        ).expect("Failed to create consensus_duration metric");
        
        let errors_total = register_int_counter!(
            "multi_rpc_errors_total",
            "Total number of errors"
        ).expect("Failed to create errors_total metric");
        
        let auth_requests = register_int_counter!(
            "multi_rpc_auth_requests_total",
            "Total number of authentication requests"
        ).expect("Failed to create auth_requests metric");
        
        let auth_successes = register_int_counter!(
            "multi_rpc_auth_successes_total",
            "Total number of successful authentications"
        ).expect("Failed to create auth_successes metric");
        
        let auth_failures = register_int_counter!(
            "multi_rpc_auth_failures_total",
            "Total number of failed authentications"
        ).expect("Failed to create auth_failures metric");
        
        let rate_limited_requests = register_int_counter!(
            "multi_rpc_rate_limited_requests_total",
            "Total number of rate limited requests"
        ).expect("Failed to create rate_limited_requests metric");

        Self {
            registry,
            requests_total,
            requests_duration,
            requests_by_method: Arc::new(RwLock::new(HashMap::new())),
            requests_by_endpoint: Arc::new(RwLock::new(HashMap::new())),
            endpoints_healthy,
            endpoints_total,
            endpoint_response_time: Arc::new(RwLock::new(HashMap::new())),
            endpoint_success_rate: Arc::new(RwLock::new(HashMap::new())),
            cache_hits,
            cache_misses,
            cache_size,
            websocket_connections,
            websocket_subscriptions,
            websocket_messages,
            consensus_requests,
            consensus_successes,
            consensus_failures,
            consensus_duration,
            errors_total,
            errors_by_type: Arc::new(RwLock::new(HashMap::new())),
            auth_requests,
            auth_successes,
            auth_failures,
            rate_limited_requests,
            custom_metrics: Arc::new(RwLock::new(HashMap::new())),
            start_time: Instant::now(),
        }
    }

    // Request metrics
    pub async fn record_request(&self, method: &str, endpoint_id: Option<Uuid>, duration: Duration) {
        self.requests_total.inc();
        self.requests_duration.observe(duration.as_secs_f64());
        
        // Track by method
        {
            let mut methods = self.requests_by_method.write().await;
            let counter = methods.entry(method.to_string()).or_insert_with(|| {
                register_int_counter!(
                    format!("multi_rpc_requests_method_{}", method.replace(":", "_")),
                    format!("Requests for method {}", method)
                ).unwrap_or_else(|_| IntCounter::new("fallback", "fallback").unwrap())
            });
            counter.inc();
        }
        
        // Track by endpoint
        if let Some(id) = endpoint_id {
            let mut endpoints = self.requests_by_endpoint.write().await;
            let counter = endpoints.entry(id.to_string()).or_insert_with(|| {
                register_int_counter!(
                    format!("multi_rpc_requests_endpoint_{}", id.to_string().replace("-", "_")),
                    format!("Requests for endpoint {}", id)
                ).unwrap_or_else(|_| IntCounter::new("fallback", "fallback").unwrap())
            });
            counter.inc();
        }
        
        debug!("Recorded request: method={}, duration={:?}", method, duration);
    }

    // Endpoint metrics
    pub async fn update_endpoint_health(&self, healthy_count: usize, total_count: usize) {
        self.endpoints_healthy.set(healthy_count as i64);
        self.endpoints_total.set(total_count as i64);
    }

    pub async fn record_endpoint_stats(&self, endpoint_id: Uuid, endpoint_name: &str, response_time: Duration, success: bool) {
        let sanitized_name = endpoint_name
            .replace("https://", "")
            .replace("http://", "")
            .replace("/", "_")
            .replace(":", "_")
            .replace(".", "_")
            .replace("-", "_")
            .replace(" ", "_");
        let endpoint_key = format!("{}_{}", sanitized_name, endpoint_id.to_string()[..8].to_string());
        
        // Response time
        {
            let mut response_times = self.endpoint_response_time.write().await;
            let gauge = response_times.entry(endpoint_key.clone()).or_insert_with(|| {
                register_gauge!(
                    format!("multi_rpc_endpoint_response_time_{}", endpoint_key),
                    format!("Response time for endpoint {}", endpoint_name)
                ).unwrap_or_else(|_| Gauge::new("fallback", "fallback").unwrap())
            });
            gauge.set(response_time.as_millis() as f64);
        }
        
        // Success rate (simplified - in practice you'd track this over time)
        {
            let mut success_rates = self.endpoint_success_rate.write().await;
            let gauge = success_rates.entry(endpoint_key.clone()).or_insert_with(|| {
                register_gauge!(
                    format!("multi_rpc_endpoint_success_rate_{}", endpoint_key),
                    format!("Success rate for endpoint {}", endpoint_name)
                ).unwrap_or_else(|_| Gauge::new("fallback", "fallback").unwrap())
            });
            // This is a simplified version - you'd want to track this as a rolling average
            gauge.set(if success { 1.0 } else { 0.0 });
        }
    }

    // Cache metrics
    pub fn record_cache_hit(&self) {
        self.cache_hits.inc();
    }

    pub fn record_cache_miss(&self) {
        self.cache_misses.inc();
    }

    pub fn update_cache_size(&self, size: usize) {
        self.cache_size.set(size as i64);
    }

    // WebSocket metrics
    pub fn update_websocket_connections(&self, count: usize) {
        self.websocket_connections.set(count as i64);
    }

    pub fn update_websocket_subscriptions(&self, count: usize) {
        self.websocket_subscriptions.set(count as i64);
    }

    pub fn record_websocket_message(&self) {
        self.websocket_messages.inc();
    }

    // Consensus metrics
    pub fn record_consensus_request(&self, duration: Duration, success: bool) {
        self.consensus_requests.inc();
        self.consensus_duration.observe(duration.as_secs_f64());
        
        if success {
            self.consensus_successes.inc();
        } else {
            self.consensus_failures.inc();
        }
    }

    // Error metrics
    pub async fn record_error(&self, error_type: &str) {
        self.errors_total.inc();
        
        let mut errors = self.errors_by_type.write().await;
        let counter = errors.entry(error_type.to_string()).or_insert_with(|| {
            register_int_counter!(
                format!("multi_rpc_errors_{}", error_type.replace(" ", "_").to_lowercase()),
                format!("Errors of type {}", error_type)
            ).unwrap_or_else(|_| IntCounter::new("fallback", "fallback").unwrap())
        });
        counter.inc();
    }

    // Authentication metrics
    pub fn record_auth_request(&self, success: bool) {
        self.auth_requests.inc();
        if success {
            self.auth_successes.inc();
        } else {
            self.auth_failures.inc();
        }
    }

    // Rate limiting metrics
    pub fn record_rate_limited_request(&self) {
        self.rate_limited_requests.inc();
    }

    // Custom metrics
    pub async fn record_custom_metric(&self, name: &str, value: f64, labels: HashMap<String, String>, metric_type: CustomMetricType) {
        let mut metrics = self.custom_metrics.write().await;
        metrics.insert(name.to_string(), CustomMetric {
            value,
            timestamp: Instant::now(),
            labels,
            metric_type,
        });
    }

    // Get metrics in various formats
    pub async fn get_metrics(&self) -> Value {
        let uptime = self.start_time.elapsed();
        
        let requests_by_method = self.get_method_stats().await;
        let errors_by_type = self.get_error_stats().await;
        
        json!({
            "uptime_seconds": uptime.as_secs(),
            "requests": {
                "total": self.requests_total.get(),
                "by_method": requests_by_method,
            },
            "endpoints": {
                "healthy": self.endpoints_healthy.get(),
                "total": self.endpoints_total.get(),
            },
            "cache": {
                "hits": self.cache_hits.get(),
                "misses": self.cache_misses.get(),
                "size": self.cache_size.get(),
                "hit_rate": self.calculate_cache_hit_rate(),
            },
            "websocket": {
                "connections": self.websocket_connections.get(),
                "subscriptions": self.websocket_subscriptions.get(),
                "messages": self.websocket_messages.get(),
            },
            "consensus": {
                "requests": self.consensus_requests.get(),
                "successes": self.consensus_successes.get(),
                "failures": self.consensus_failures.get(),
                "success_rate": self.calculate_consensus_success_rate(),
            },
            "errors": {
                "total": self.errors_total.get(),
                "by_type": errors_by_type,
            },
            "authentication": {
                "requests": self.auth_requests.get(),
                "successes": self.auth_successes.get(),
                "failures": self.auth_failures.get(),
                "success_rate": self.calculate_auth_success_rate(),
            },
            "rate_limiting": {
                "blocked_requests": self.rate_limited_requests.get(),
            },
            "custom_metrics": self.get_custom_metrics_summary().await,
        })
    }

    async fn get_method_stats(&self) -> HashMap<String, i64> {
        let methods = self.requests_by_method.read().await;
        methods.iter()
            .map(|(method, counter)| (method.clone(), counter.get() as i64))
            .collect()
    }

    async fn get_error_stats(&self) -> HashMap<String, i64> {
        let errors = self.errors_by_type.read().await;
        errors.iter()
            .map(|(error_type, counter)| (error_type.clone(), counter.get() as i64))
            .collect()
    }

    async fn get_custom_metrics_summary(&self) -> HashMap<String, Value> {
        let metrics = self.custom_metrics.read().await;
        let mut summary = HashMap::new();
        
        for (name, metric) in metrics.iter() {
            summary.insert(name.clone(), json!({
                "value": metric.value,
                "age_seconds": metric.timestamp.elapsed().as_secs(),
                "labels": metric.labels,
                "type": match metric.metric_type {
                    CustomMetricType::Counter => "counter",
                    CustomMetricType::Gauge => "gauge",
                    CustomMetricType::Histogram { .. } => "histogram",
                }
            }));
        }
        
        summary
    }

    fn calculate_cache_hit_rate(&self) -> f64 {
        let hits = self.cache_hits.get() as f64;
        let misses = self.cache_misses.get() as f64;
        let total = hits + misses;
        
        if total > 0.0 {
            hits / total
        } else {
            0.0
        }
    }

    fn calculate_consensus_success_rate(&self) -> f64 {
        let successes = self.consensus_successes.get() as f64;
        let total = self.consensus_requests.get() as f64;
        
        if total > 0.0 {
            successes / total
        } else {
            0.0
        }
    }

    fn calculate_auth_success_rate(&self) -> f64 {
        let successes = self.auth_successes.get() as f64;
        let total = self.auth_requests.get() as f64;
        
        if total > 0.0 {
            successes / total
        } else {
            0.0
        }
    }

    pub async fn get_prometheus_metrics(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        
        match encoder.encode_to_string(&metric_families) {
            Ok(output) => output,
            Err(e) => {
                error!("Failed to encode Prometheus metrics: {}", e);
                String::new()
            }
        }
    }

    pub async fn reset_metrics(&self) {
        // Reset counters and gauges to zero
        // Note: This is a simplified implementation
        // In practice, you might want to preserve some metrics
        
        // Clear method-specific counters
        {
            let mut methods = self.requests_by_method.write().await;
            methods.clear();
        }
        
        // Clear endpoint-specific counters
        {
            let mut endpoints = self.requests_by_endpoint.write().await;
            endpoints.clear();
        }
        
        // Clear error counters
        {
            let mut errors = self.errors_by_type.write().await;
            errors.clear();
        }
        
        // Clear custom metrics
        {
            let mut custom = self.custom_metrics.write().await;
            custom.clear();
        }
        
        debug!("Metrics reset completed");
    }

    pub async fn get_health_metrics(&self) -> Value {
        json!({
            "healthy_endpoints": self.endpoints_healthy.get(),
            "total_endpoints": self.endpoints_total.get(),
            "endpoint_health_ratio": if self.endpoints_total.get() > 0 {
                self.endpoints_healthy.get() as f64 / self.endpoints_total.get() as f64
            } else {
                0.0
            },
            "error_rate": if self.requests_total.get() > 0 {
                self.errors_total.get() as f64 / self.requests_total.get() as f64
            } else {
                0.0
            },
            "uptime_seconds": self.start_time.elapsed().as_secs(),
        })
    }

    pub fn get_uptime(&self) -> Duration {
        self.start_time.elapsed()
    }

    pub async fn export_metrics_to_file(&self, path: &str) -> Result<(), AppError> {
        let metrics = self.get_prometheus_metrics().await;
        tokio::fs::write(path, metrics).await
            .map_err(|e| AppError::internal(&format!("Failed to write metrics to file: {}", e)))?;
        Ok(())
    }
}