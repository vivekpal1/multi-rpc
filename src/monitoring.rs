use std::sync::Arc;
use std::time::{Duration, Instant};
use opentelemetry::{
    global,
    trace::{Span, SpanKind, Status, TraceContextExt, Tracer, TracerProvider},
    Context, KeyValue,
};
use opentelemetry_sdk::{
    propagation::TraceContextPropagator,
    trace::{self, RandomIdGenerator, Sampler},
    Resource,
};
use opentelemetry_otlp::{ExportConfig, WithExportConfig};
use prometheus::{
    Encoder, Histogram, HistogramOpts, IntCounter, IntGauge, Registry, TextEncoder,
};
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, warn};
use tracing_opentelemetry::OpenTelemetryLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub enable_tracing: bool,
    pub enable_metrics: bool,
    pub otlp_endpoint: Option<String>,
    pub service_name: String,
    pub service_version: String,
    pub environment: String,
    pub sample_rate: f64,
    pub metrics_port: u16,
    pub export_interval: Duration,
    pub export_timeout: Duration,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            enable_tracing: true,
            enable_metrics: true,
            otlp_endpoint: None,
            service_name: "multi-rpc".to_string(),
            service_version: env!("CARGO_PKG_VERSION").to_string(),
            environment: "production".to_string(),
            sample_rate: 0.1,
            metrics_port: 9090,
            export_interval: Duration::from_secs(10),
            export_timeout: Duration::from_secs(5),
        }
    }
}

pub struct MonitoringService {
    config: MonitoringConfig,
    tracer: Option<opentelemetry_sdk::trace::Tracer>,
    metrics_registry: Registry,
    
    // HTTP metrics
    http_requests_total: IntCounter,
    http_request_duration: Histogram,
    http_request_size: Histogram,
    http_response_size: Histogram,
    http_active_requests: IntGauge,
    
    // RPC metrics
    rpc_requests_total: IntCounter,
    rpc_request_duration: Histogram,
    rpc_errors_total: IntCounter,
    rpc_retry_total: IntCounter,
    
    // Endpoint metrics
    endpoint_health_score: IntGauge,
    endpoint_request_total: IntCounter,
    endpoint_error_total: IntCounter,
    endpoint_latency: Histogram,
    
    // Cache metrics
    cache_hits_total: IntCounter,
    cache_misses_total: IntCounter,
    cache_evictions_total: IntCounter,
    cache_size_bytes: IntGauge,
    
    // Circuit breaker metrics
    circuit_breaker_state: IntGauge,
    circuit_breaker_opens_total: IntCounter,
    circuit_breaker_success_total: IntCounter,
    circuit_breaker_failure_total: IntCounter,
    
    // Rate limit metrics
    rate_limit_hits_total: IntCounter,
    rate_limit_exceeded_total: IntCounter,
    
    // System metrics
    system_cpu_usage: IntGauge,
    system_memory_usage: IntGauge,
    system_goroutines: IntGauge,
}

impl MonitoringService {
    pub fn new(config: MonitoringConfig) -> anyhow::Result<Self> {
        let registry = Registry::new();
        
        // Initialize metrics
        let http_requests_total = IntCounter::new(
            "http_requests_total",
            "Total number of HTTP requests",
        )?;
        registry.register(Box::new(http_requests_total.clone()))?;
        
        let http_request_duration = Histogram::with_opts(
            HistogramOpts::new(
                "http_request_duration_seconds",
                "HTTP request latency in seconds",
            )
            .buckets(vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0]),
        )?;
        registry.register(Box::new(http_request_duration.clone()))?;
        
        let http_request_size = Histogram::with_opts(
            HistogramOpts::new(
                "http_request_size_bytes",
                "HTTP request size in bytes",
            )
            .buckets(vec![100.0, 1000.0, 10000.0, 100000.0, 1000000.0]),
        )?;
        registry.register(Box::new(http_request_size.clone()))?;
        
        let http_response_size = Histogram::with_opts(
            HistogramOpts::new(
                "http_response_size_bytes",
                "HTTP response size in bytes",
            )
            .buckets(vec![100.0, 1000.0, 10000.0, 100000.0, 1000000.0]),
        )?;
        registry.register(Box::new(http_response_size.clone()))?;
        
        let http_active_requests = IntGauge::new(
            "http_active_requests",
            "Number of active HTTP requests",
        )?;
        registry.register(Box::new(http_active_requests.clone()))?;
        
        let rpc_requests_total = IntCounter::new(
            "rpc_requests_total",
            "Total number of RPC requests",
        )?;
        registry.register(Box::new(rpc_requests_total.clone()))?;
        
        let rpc_request_duration = Histogram::with_opts(
            HistogramOpts::new(
                "rpc_request_duration_seconds",
                "RPC request latency in seconds",
            )
            .buckets(vec![0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0]),
        )?;
        registry.register(Box::new(rpc_request_duration.clone()))?;
        
        let rpc_errors_total = IntCounter::new(
            "rpc_errors_total",
            "Total number of RPC errors",
        )?;
        registry.register(Box::new(rpc_errors_total.clone()))?;
        
        let rpc_retry_total = IntCounter::new(
            "rpc_retry_total",
            "Total number of RPC retries",
        )?;
        registry.register(Box::new(rpc_retry_total.clone()))?;
        
        let endpoint_health_score = IntGauge::new(
            "endpoint_health_score",
            "Health score of endpoints (0-100)",
        )?;
        registry.register(Box::new(endpoint_health_score.clone()))?;
        
        let endpoint_request_total = IntCounter::new(
            "endpoint_request_total",
            "Total requests to endpoints",
        )?;
        registry.register(Box::new(endpoint_request_total.clone()))?;
        
        let endpoint_error_total = IntCounter::new(
            "endpoint_error_total",
            "Total errors from endpoints",
        )?;
        registry.register(Box::new(endpoint_error_total.clone()))?;
        
        let endpoint_latency = Histogram::with_opts(
            HistogramOpts::new(
                "endpoint_latency_seconds",
                "Endpoint response latency in seconds",
            )
            .buckets(vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]),
        )?;
        registry.register(Box::new(endpoint_latency.clone()))?;
        
        let cache_hits_total = IntCounter::new(
            "cache_hits_total",
            "Total number of cache hits",
        )?;
        registry.register(Box::new(cache_hits_total.clone()))?;
        
        let cache_misses_total = IntCounter::new(
            "cache_misses_total",
            "Total number of cache misses",
        )?;
        registry.register(Box::new(cache_misses_total.clone()))?;
        
        let cache_evictions_total = IntCounter::new(
            "cache_evictions_total",
            "Total number of cache evictions",
        )?;
        registry.register(Box::new(cache_evictions_total.clone()))?;
        
        let cache_size_bytes = IntGauge::new(
            "cache_size_bytes",
            "Current cache size in bytes",
        )?;
        registry.register(Box::new(cache_size_bytes.clone()))?;
        
        let circuit_breaker_state = IntGauge::new(
            "circuit_breaker_state",
            "Circuit breaker state (0=closed, 1=open, 2=half-open)",
        )?;
        registry.register(Box::new(circuit_breaker_state.clone()))?;
        
        let circuit_breaker_opens_total = IntCounter::new(
            "circuit_breaker_opens_total",
            "Total number of circuit breaker opens",
        )?;
        registry.register(Box::new(circuit_breaker_opens_total.clone()))?;
        
        let circuit_breaker_success_total = IntCounter::new(
            "circuit_breaker_success_total",
            "Total successful calls through circuit breaker",
        )?;
        registry.register(Box::new(circuit_breaker_success_total.clone()))?;
        
        let circuit_breaker_failure_total = IntCounter::new(
            "circuit_breaker_failure_total",
            "Total failed calls through circuit breaker",
        )?;
        registry.register(Box::new(circuit_breaker_failure_total.clone()))?;
        
        let rate_limit_hits_total = IntCounter::new(
            "rate_limit_hits_total",
            "Total number of rate limit checks",
        )?;
        registry.register(Box::new(rate_limit_hits_total.clone()))?;
        
        let rate_limit_exceeded_total = IntCounter::new(
            "rate_limit_exceeded_total",
            "Total number of rate limit exceeded",
        )?;
        registry.register(Box::new(rate_limit_exceeded_total.clone()))?;
        
        let system_cpu_usage = IntGauge::new(
            "system_cpu_usage_percent",
            "System CPU usage percentage",
        )?;
        registry.register(Box::new(system_cpu_usage.clone()))?;
        
        let system_memory_usage = IntGauge::new(
            "system_memory_usage_bytes",
            "System memory usage in bytes",
        )?;
        registry.register(Box::new(system_memory_usage.clone()))?;
        
        let system_goroutines = IntGauge::new(
            "system_goroutines",
            "Number of goroutines",
        )?;
        registry.register(Box::new(system_goroutines.clone()))?;
        
        // Initialize tracing if enabled
        let tracer = if config.enable_tracing {
            Some(init_tracer(&config)?)
        } else {
            None
        };
        
        Ok(Self {
            config,
            tracer,
            metrics_registry: registry,
            http_requests_total,
            http_request_duration,
            http_request_size,
            http_response_size,
            http_active_requests,
            rpc_requests_total,
            rpc_request_duration,
            rpc_errors_total,
            rpc_retry_total,
            endpoint_health_score,
            endpoint_request_total,
            endpoint_error_total,
            endpoint_latency,
            cache_hits_total,
            cache_misses_total,
            cache_evictions_total,
            cache_size_bytes,
            circuit_breaker_state,
            circuit_breaker_opens_total,
            circuit_breaker_success_total,
            circuit_breaker_failure_total,
            rate_limit_hits_total,
            rate_limit_exceeded_total,
            system_cpu_usage,
            system_memory_usage,
            system_goroutines,
        })
    }
    
    // HTTP metrics
    pub fn record_http_request(&self, method: &str, path: &str, status: u16, duration: Duration, request_size: usize, response_size: usize) {
        self.http_requests_total.inc();
        self.http_request_duration.observe(duration.as_secs_f64());
        self.http_request_size.observe(request_size as f64);
        self.http_response_size.observe(response_size as f64);
        
        debug!(
            method = %method,
            path = %path,
            status = status,
            duration_ms = duration.as_millis(),
            request_size = request_size,
            response_size = response_size,
            "HTTP request recorded"
        );
    }
    
    pub fn inc_active_requests(&self) {
        self.http_active_requests.inc();
    }
    
    pub fn dec_active_requests(&self) {
        self.http_active_requests.dec();
    }
    
    // RPC metrics
    pub fn record_rpc_request(&self, method: &str, endpoint: &str, success: bool, duration: Duration, retries: u32) {
        self.rpc_requests_total.inc();
        self.rpc_request_duration.observe(duration.as_secs_f64());
        
        if !success {
            self.rpc_errors_total.inc();
        }
        
        if retries > 0 {
            self.rpc_retry_total.inc_by(retries as u64);
        }
        
        debug!(
            method = %method,
            endpoint = %endpoint,
            success = success,
            duration_ms = duration.as_millis(),
            retries = retries,
            "RPC request recorded"
        );
    }
    
    // Endpoint metrics
    pub fn update_endpoint_health(&self, endpoint: &str, health_score: u8) {
        self.endpoint_health_score.set(health_score as i64);
    }
    
    pub fn record_endpoint_request(&self, endpoint: &str, success: bool, latency: Duration) {
        self.endpoint_request_total.inc();
        self.endpoint_latency.observe(latency.as_secs_f64());
        
        if !success {
            self.endpoint_error_total.inc();
        }
    }
    
    // Cache metrics
    pub fn record_cache_hit(&self) {
        self.cache_hits_total.inc();
    }
    
    pub fn record_cache_miss(&self) {
        self.cache_misses_total.inc();
    }
    
    pub fn record_cache_eviction(&self) {
        self.cache_evictions_total.inc();
    }
    
    pub fn update_cache_size(&self, size_bytes: usize) {
        self.cache_size_bytes.set(size_bytes as i64);
    }
    
    // Circuit breaker metrics
    pub fn update_circuit_breaker_state(&self, name: &str, state: CircuitBreakerState) {
        let state_value = match state {
            CircuitBreakerState::Closed => 0,
            CircuitBreakerState::Open => 1,
            CircuitBreakerState::HalfOpen => 2,
        };
        self.circuit_breaker_state.set(state_value);
        
        if state == CircuitBreakerState::Open {
            self.circuit_breaker_opens_total.inc();
        }
    }
    
    pub fn record_circuit_breaker_result(&self, name: &str, success: bool) {
        if success {
            self.circuit_breaker_success_total.inc();
        } else {
            self.circuit_breaker_failure_total.inc();
        }
    }
    
    // Rate limit metrics
    pub fn record_rate_limit_check(&self, exceeded: bool) {
        self.rate_limit_hits_total.inc();
        if exceeded {
            self.rate_limit_exceeded_total.inc();
        }
    }
    
    // System metrics
    pub fn update_system_metrics(&self) {
        // Get CPU usage
        if let Ok(cpu_usage) = get_cpu_usage() {
            self.system_cpu_usage.set(cpu_usage as i64);
        }
        
        // Get memory usage
        if let Ok(mem_usage) = get_memory_usage() {
            self.system_memory_usage.set(mem_usage as i64);
        }
        
        // Get goroutine count (simulated for Rust)
        self.system_goroutines.set(get_thread_count() as i64);
    }
    
    // Export metrics in Prometheus format
    pub fn export_metrics(&self) -> anyhow::Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = self.metrics_registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }
    
    // Create a new span for tracing
    pub fn create_span(&self, name: &str, kind: SpanKind) -> Option<opentelemetry::Context> {
        self.tracer.as_ref().map(|tracer| {
            let span = tracer
                .span_builder(name.to_owned())
                .with_kind(kind)
                .start(tracer);
            Context::current().with_span(span)
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

// Initialize OpenTelemetry tracer
fn init_tracer(config: &MonitoringConfig) -> anyhow::Result<opentelemetry_sdk::trace::Tracer> {
    global::set_text_map_propagator(TraceContextPropagator::new());
    
    let resource = Resource::new(vec![
        KeyValue::new("service.name", config.service_name.clone()),
        KeyValue::new("service.version", config.service_version.clone()),
        KeyValue::new("deployment.environment", config.environment.clone()),
    ]);
    
    let sampler = if config.sample_rate >= 1.0 {
        Sampler::AlwaysOn
    } else if config.sample_rate <= 0.0 {
        Sampler::AlwaysOff
    } else {
        Sampler::TraceIdRatioBased(config.sample_rate)
    };
    
    let tracer = if let Some(endpoint) = &config.otlp_endpoint {
        let tracer = opentelemetry_otlp::new_pipeline()
            .tracing()
            .with_exporter(
                opentelemetry_otlp::new_exporter()
                    .tonic()
                    .with_endpoint(endpoint)
                    .with_timeout(config.export_timeout),
            )
            .with_trace_config(
                trace::config()
                    .with_sampler(sampler)
                    .with_id_generator(RandomIdGenerator::default())
                    .with_resource(resource),
            )
            .install_batch(opentelemetry_sdk::runtime::Tokio)?;
        tracer
    } else {
        let provider = opentelemetry_sdk::trace::TracerProvider::builder()
            .with_config(
                trace::config()
                    .with_sampler(sampler)
                    .with_id_generator(RandomIdGenerator::default())
                    .with_resource(resource),
            )
            .build();
        provider.tracer(config.service_name.clone())
    };
    
    Ok(tracer)
}

// System metrics helpers
fn get_cpu_usage() -> anyhow::Result<f64> {
    // This is a simplified implementation
    // In production, use proper system metrics libraries
    Ok(0.0)
}

fn get_memory_usage() -> anyhow::Result<usize> {
    // This is a simplified implementation
    // In production, use proper system metrics libraries
    Ok(0)
}

fn get_thread_count() -> usize {
    // Get approximate thread count
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1)
}

// Health check data
#[derive(Debug, Clone, Serialize)]
pub struct HealthMetrics {
    pub uptime_seconds: u64,
    pub requests_per_second: f64,
    pub error_rate: f64,
    pub average_latency_ms: f64,
    pub active_connections: u64,
    pub cache_hit_rate: f64,
    pub endpoints_healthy: usize,
    pub endpoints_total: usize,
}

// SLA monitoring
pub struct SlaMonitor {
    target_availability: f64,
    target_latency_p99: Duration,
    measurement_window: Duration,
    violations: Vec<SlaViolation>,
}

#[derive(Debug, Clone)]
pub struct SlaViolation {
    pub timestamp: Instant,
    pub violation_type: SlaViolationType,
    pub severity: ViolationSeverity,
    pub details: String,
}

#[derive(Debug, Clone)]
pub enum SlaViolationType {
    Availability,
    Latency,
    ErrorRate,
}

#[derive(Debug, Clone)]
pub enum ViolationSeverity {
    Warning,
    Critical,
}

impl SlaMonitor {
    pub fn new(target_availability: f64, target_latency_p99: Duration) -> Self {
        Self {
            target_availability,
            target_latency_p99,
            measurement_window: Duration::from_secs(300), // 5 minutes
            violations: Vec::new(),
        }
    }
    
    pub fn check_sla(&mut self, metrics: &HealthMetrics) {
        let availability = 1.0 - metrics.error_rate;
        
        if availability < self.target_availability {
            self.violations.push(SlaViolation {
                timestamp: Instant::now(),
                violation_type: SlaViolationType::Availability,
                severity: if availability < self.target_availability * 0.9 {
                    ViolationSeverity::Critical
                } else {
                    ViolationSeverity::Warning
                },
                details: format!(
                    "Availability {:.2}% below target {:.2}%",
                    availability * 100.0,
                    self.target_availability * 100.0
                ),
            });
        }
        
        let latency = Duration::from_millis(metrics.average_latency_ms as u64);
        if latency > self.target_latency_p99 {
            self.violations.push(SlaViolation {
                timestamp: Instant::now(),
                violation_type: SlaViolationType::Latency,
                severity: if latency > self.target_latency_p99 * 2 {
                    ViolationSeverity::Critical
                } else {
                    ViolationSeverity::Warning
                },
                details: format!(
                    "Latency {:?} exceeds target {:?}",
                    latency,
                    self.target_latency_p99
                ),
            });
        }
        
        // Clean up old violations
        let cutoff = Instant::now() - self.measurement_window;
        self.violations.retain(|v| v.timestamp > cutoff);
    }
    
    pub fn get_violations(&self) -> &[SlaViolation] {
        &self.violations
    }
    
    pub fn is_sla_met(&self) -> bool {
        self.violations.iter().all(|v| matches!(v.severity, ViolationSeverity::Warning))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_monitoring_service_creation() {
        let config = MonitoringConfig::default();
        let service = MonitoringService::new(config).unwrap();
        
        service.record_http_request("GET", "/api/test", 200, Duration::from_millis(100), 1024, 2048);
        service.record_cache_hit();
        service.record_cache_miss();
        
        let metrics = service.export_metrics().unwrap();
        assert!(metrics.contains("http_requests_total"));
        assert!(metrics.contains("cache_hits_total"));
    }
    
    #[test]
    fn test_sla_monitor() {
        let mut monitor = SlaMonitor::new(0.99, Duration::from_millis(100));
        
        let metrics = HealthMetrics {
            uptime_seconds: 3600,
            requests_per_second: 100.0,
            error_rate: 0.05, // 95% availability
            average_latency_ms: 150.0,
            active_connections: 50,
            cache_hit_rate: 0.8,
            endpoints_healthy: 9,
            endpoints_total: 10,
        };
        
        monitor.check_sla(&metrics);
        assert!(!monitor.is_sla_met());
        assert_eq!(monitor.get_violations().len(), 2);
    }
}