use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointInfo {
    pub id: Uuid,
    pub url: String,
    pub name: String,
    pub status: EndpointStatus,
    pub score: EndpointScore,
    pub last_checked: DateTime<Utc>,
    pub weight: u32,
    pub priority: u8,
    pub region: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EndpointStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

impl std::fmt::Display for EndpointStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EndpointStatus::Healthy => write!(f, "healthy"),
            EndpointStatus::Degraded => write!(f, "degraded"),
            EndpointStatus::Unhealthy => write!(f, "unhealthy"),
            EndpointStatus::Unknown => write!(f, "unknown"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointScore {
    pub overall_grade: String,
    pub success_rate: f64,
    pub avg_response_time: f64,
    pub uptime_percentage: f64,
    pub feature_support: u8,
    pub last_updated: DateTime<Utc>,
}

impl Default for EndpointScore {
    fn default() -> Self {
        Self {
            overall_grade: "C".to_string(),
            success_rate: 0.0,
            avg_response_time: 0.0,
            uptime_percentage: 0.0,
            feature_support: 0,
            last_updated: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub endpoint_id: Uuid,
    pub success: bool,
    pub response_time: Duration,
    pub error: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcRequest {
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
    pub jsonrpc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub id: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub error: Option<RpcError>,
    pub jsonrpc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointStats {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub avg_response_time: f64,
    pub last_success: Option<DateTime<Utc>>,
    pub last_failure: Option<DateTime<Utc>>,
}

impl Default for EndpointStats {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            avg_response_time: 0.0,
            last_success: None,
            last_failure: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub status: String,
    pub uptime: Duration,
    pub total_endpoints: usize,
    pub healthy_endpoints: usize,
    pub degraded_endpoints: usize,
    pub unhealthy_endpoints: usize,
    pub total_requests: u64,
    pub success_rate: f64,
    pub avg_response_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoadBalancingStrategy {
    RoundRobin,
    Weighted,
    LeastLatency,
    HealthBased,
}

// WebSocket specific types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub message_type: WebSocketMessageType,
    pub subscription_id: Option<String>,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebSocketMessageType {
    Subscribe,
    Unsubscribe,
    Notification,
    Error,
    Ping,
    Pong,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: String,
    pub method: String,
    pub params: serde_json::Value,
    pub connection_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub last_notification: Option<DateTime<Utc>>,
}

// Authentication types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub key: String,
    pub name: String,
    pub permissions: Vec<String>,
    pub rate_limit: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub token: String,
    pub user_id: String,
    pub scopes: Vec<String>,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

// Rate limiting types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitInfo {
    pub requests_remaining: u32,
    pub reset_time: DateTime<Utc>,
    pub limit: u32,
    pub window_seconds: u64,
}

// Metrics types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricPoint {
    pub name: String,
    pub value: f64,
    pub timestamp: DateTime<Utc>,
    pub labels: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub requests_per_second: f64,
    pub avg_response_time: f64,
    pub error_rate: f64,
    pub cache_hit_rate: f64,
    pub active_connections: u64,
    pub uptime_seconds: u64,
}

// Consensus types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusResult {
    pub method: String,
    pub consensus_achieved: bool,
    pub confidence_score: f64,
    pub participating_endpoints: Vec<Uuid>,
    pub response_time: Duration,
    pub final_response: serde_json::Value,
}

// Geographic types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoLocation {
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeographicPreference {
    pub client_ip: String,
    pub preferred_regions: Vec<String>,
    pub latency_tolerance: Duration,
    pub location: Option<GeoLocation>,
}

// Cache types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub key: String,
    pub value: serde_json::Value,
    pub ttl: Duration,
    pub created_at: DateTime<Utc>,
    pub access_count: u64,
    pub last_accessed: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_entries: u64,
    pub total_hits: u64,
    pub total_misses: u64,
    pub hit_rate: f64,
    pub memory_usage: u64,
    pub evictions: u64,
}

// Discovery types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredEndpoint {
    pub url: String,
    pub discovered_at: DateTime<Utc>,
    pub test_results: EndpointTestResults,
    pub auto_added: bool,
    pub confidence_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointTestResults {
    pub health_check: bool,
    pub version_response: Option<String>,
    pub supported_methods: Vec<String>,
    pub average_latency: Duration,
    pub reliability_score: f64,
    pub feature_flags: Vec<String>,
}

// Admin dashboard types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardData {
    pub system_overview: SystemOverview,
    pub endpoint_summary: EndpointSummary,
    pub performance_metrics: PerformanceMetrics,
    pub recent_alerts: Vec<Alert>,
    pub top_methods: Vec<MethodUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemOverview {
    pub status: String,
    pub uptime: Duration,
    pub version: String,
    pub total_requests: u64,
    pub requests_per_minute: f64,
    pub error_rate: f64,
    pub active_connections: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointSummary {
    pub total_endpoints: usize,
    pub healthy_count: usize,
    pub degraded_count: usize,
    pub unhealthy_count: usize,
    pub average_response_time: f64,
    pub fastest_endpoint: Option<String>,
    pub slowest_endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: Uuid,
    pub level: AlertLevel,
    pub title: String,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub source: String,
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertLevel {
    Info,
    Warning,
    Error,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MethodUsage {
    pub method_name: String,
    pub request_count: u64,
    pub average_response_time: f64,
    pub error_rate: f64,
    pub cache_hit_rate: f64,
}

// Configuration types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationUpdate {
    pub section: String,
    pub changes: serde_json::Value,
    pub applied_by: String,
    pub applied_at: DateTime<Utc>,
    pub validation_errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureFlag {
    pub name: String,
    pub enabled: bool,
    pub description: String,
    pub updated_at: DateTime<Utc>,
    pub updated_by: String,
}

// Circuit breaker types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerStatus {
    pub endpoint_id: Uuid,
    pub state: CircuitBreakerState,
    pub failure_count: u32,
    pub success_count: u32,
    pub last_failure: Option<DateTime<Utc>>,
    pub next_attempt_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

// Load balancer types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBalancerStats {
    pub strategy: LoadBalancingStrategy,
    pub total_selections: u64,
    pub selections_by_endpoint: std::collections::HashMap<Uuid, u64>,
    pub average_selection_time: Duration,
    pub last_rebalance: DateTime<Utc>,
}

// Health check types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckConfig {
    pub interval: Duration,
    pub timeout: Duration,
    pub failure_threshold: u32,
    pub recovery_threshold: u32,
    pub methods_to_test: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub overall_status: ServiceStatus,
    pub components: std::collections::HashMap<String, ComponentHealth>,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServiceStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Maintenance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentHealth {
    pub status: ServiceStatus,
    pub message: Option<String>,
    pub last_check: DateTime<Utc>,
    pub response_time: Option<Duration>,
}

// Logging types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub message: String,
    pub module: String,
    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

// Batch operation types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchRequest {
    pub requests: Vec<RpcRequest>,
    pub batch_id: Uuid,
    pub parallel_execution: bool,
    pub timeout: Option<Duration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResponse {
    pub responses: Vec<RpcResponse>,
    pub batch_id: Uuid,
    pub execution_time: Duration,
    pub success_count: usize,
    pub failure_count: usize,
}

// Error tracking types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorReport {
    pub error_id: Uuid,
    pub error_type: String,
    pub message: String,
    pub endpoint_id: Option<Uuid>,
    pub method: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub context: std::collections::HashMap<String, serde_json::Value>,
    pub stack_trace: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorStats {
    pub total_errors: u64,
    pub errors_by_type: std::collections::HashMap<String, u64>,
    pub errors_by_endpoint: std::collections::HashMap<Uuid, u64>,
    pub errors_by_method: std::collections::HashMap<String, u64>,
    pub error_rate: f64,
    pub recent_errors: Vec<ErrorReport>,
}