use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    #[error("Network error: {0}")]
    NetworkError(#[from] reqwest::Error),
    
    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("All endpoints are unhealthy")]
    AllEndpointsUnhealthy,
    
    #[error("Request timeout")]
    RequestTimeout,
    
    #[error("Invalid RPC request: {0}")]
    InvalidRpcRequest(String),
    
    #[error("Endpoint error: {0}")]
    EndpointError(String),
    
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    
    #[error("Internal server error: {0}")]
    InternalError(String),
    
    // Authentication errors
    #[error("Unauthorized")]
    Unauthorized,
    
    #[error("Forbidden")]
    Forbidden,
    
    #[error("Invalid authentication token")]
    InvalidAuthToken,
    
    #[error("Expired authentication token")]
    ExpiredAuthToken,
    
    #[error("Invalid credentials")]
    InvalidCredentials,
    
    #[error("API key not found")]
    ApiKeyNotFound,
    
    // Cache errors
    #[error("Cache error: {0}")]
    CacheError(String),
    
    #[error("Redis error: {0}")]
    RedisError(#[from] redis::RedisError),
    
    // Consensus errors
    #[error("Consensus failed: {0}")]
    ConsensusError(String),
    
    #[error("Insufficient confirmations")]
    InsufficientConfirmations,
    
    #[error("Response validation failed: {0}")]
    ValidationError(String),
    
    // Geographic errors
    #[error("GeoIP error: {0}")]
    GeoIpError(String),
    
    #[error("No endpoints available in region")]
    NoEndpointsInRegion,
    
    // WebSocket errors
    #[error("WebSocket error: {0}")]
    WebSocketError(String),
    
    #[error("Connection limit exceeded")]
    ConnectionLimitExceeded,
    
    #[error("Subscription limit exceeded")]
    SubscriptionLimitExceeded,
    
    // Database errors
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    
    // Discovery errors
    #[error("Discovery error: {0}")]
    DiscoveryError(String),
    
    #[error("Auto-discovery disabled")]
    AutoDiscoveryDisabled,
    
    // Metrics errors
    #[error("Metrics error: {0}")]
    MetricsError(String),
    
    // Admin errors
    #[error("Admin access required")]
    AdminAccessRequired,
    
    #[error("Configuration validation failed: {0}")]
    ConfigValidationError(String),
    
    // Method-specific errors
    #[error("Method not allowed")]
    MethodNotAllowed,
    
    #[error("Feature not available")]
    FeatureNotAvailable,
    
    #[error("Endpoint overloaded")]
    EndpointOverloaded,
    
    #[error("Circuit breaker open")]
    CircuitBreakerOpen,
    
    #[error("Template error: {0}")]
    TemplateError(#[from] askama::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_code, error_message) = match &self {
            // Configuration errors
            AppError::ConfigError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "CONFIG_ERROR", "Configuration error"),
            AppError::ConfigValidationError(_) => (StatusCode::BAD_REQUEST, "CONFIG_VALIDATION_ERROR", "Configuration validation failed"),
            
            // Network errors
            AppError::NetworkError(_) => (StatusCode::BAD_GATEWAY, "NETWORK_ERROR", "Network error"),
            AppError::EndpointError(_) => (StatusCode::BAD_GATEWAY, "ENDPOINT_ERROR", "Endpoint error"),
            AppError::AllEndpointsUnhealthy => (StatusCode::SERVICE_UNAVAILABLE, "ALL_ENDPOINTS_UNHEALTHY", "All endpoints unhealthy"),
            AppError::RequestTimeout => (StatusCode::GATEWAY_TIMEOUT, "REQUEST_TIMEOUT", "Request timeout"),
            AppError::EndpointOverloaded => (StatusCode::SERVICE_UNAVAILABLE, "ENDPOINT_OVERLOADED", "Endpoint overloaded"),
            AppError::CircuitBreakerOpen => (StatusCode::SERVICE_UNAVAILABLE, "CIRCUIT_BREAKER_OPEN", "Circuit breaker open"),
            
            // Request errors
            AppError::JsonError(_) => (StatusCode::BAD_REQUEST, "JSON_ERROR", "Invalid JSON"),
            AppError::InvalidRpcRequest(_) => (StatusCode::BAD_REQUEST, "INVALID_RPC_REQUEST", "Invalid RPC request"),
            AppError::MethodNotAllowed => (StatusCode::METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "Method not allowed"),
            
            // Authentication errors
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", "Authentication required"),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "FORBIDDEN", "Access forbidden"),
            AppError::InvalidAuthToken => (StatusCode::UNAUTHORIZED, "INVALID_TOKEN", "Invalid authentication token"),
            AppError::ExpiredAuthToken => (StatusCode::UNAUTHORIZED, "EXPIRED_TOKEN", "Authentication token expired"),
            AppError::InvalidCredentials => (StatusCode::UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid credentials"),
            AppError::ApiKeyNotFound => (StatusCode::UNAUTHORIZED, "API_KEY_NOT_FOUND", "API key not found"),
            AppError::AdminAccessRequired => (StatusCode::FORBIDDEN, "ADMIN_ACCESS_REQUIRED", "Admin access required"),
            
            // Rate limiting
            AppError::RateLimitExceeded => (StatusCode::TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded"),
            
            // Cache errors
            AppError::CacheError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "CACHE_ERROR", "Cache error"),
            AppError::RedisError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "REDIS_ERROR", "Redis error"),
            
            // Consensus errors
            AppError::ConsensusError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "CONSENSUS_ERROR", "Consensus error"),
            AppError::InsufficientConfirmations => (StatusCode::SERVICE_UNAVAILABLE, "INSUFFICIENT_CONFIRMATIONS", "Insufficient confirmations"),
            AppError::ValidationError(_) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", "Response validation failed"),
            
            // Geographic errors
            AppError::GeoIpError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "GEOIP_ERROR", "GeoIP error"),
            AppError::NoEndpointsInRegion => (StatusCode::SERVICE_UNAVAILABLE, "NO_ENDPOINTS_IN_REGION", "No endpoints available in region"),
            
            // WebSocket errors
            AppError::WebSocketError(_) => (StatusCode::BAD_REQUEST, "WEBSOCKET_ERROR", "WebSocket error"),
            AppError::ConnectionLimitExceeded => (StatusCode::SERVICE_UNAVAILABLE, "CONNECTION_LIMIT_EXCEEDED", "Connection limit exceeded"),
            AppError::SubscriptionLimitExceeded => (StatusCode::BAD_REQUEST, "SUBSCRIPTION_LIMIT_EXCEEDED", "Subscription limit exceeded"),
            
            // Database errors
            AppError::DatabaseError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR", "Database error"),
            
            // Discovery errors
            AppError::DiscoveryError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "DISCOVERY_ERROR", "Discovery error"),
            AppError::AutoDiscoveryDisabled => (StatusCode::SERVICE_UNAVAILABLE, "AUTO_DISCOVERY_DISABLED", "Auto-discovery disabled"),
            
            // Metrics errors
            AppError::MetricsError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "METRICS_ERROR", "Metrics error"),
            
            // Feature errors
            AppError::FeatureNotAvailable => (StatusCode::NOT_IMPLEMENTED, "FEATURE_NOT_AVAILABLE", "Feature not available"),
            
            // Generic errors
            AppError::IoError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "IO_ERROR", "IO error"),
            AppError::InternalError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal error"),
            AppError::TemplateError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "TEMPLATE_ERROR", "Template rendering error"),
        };

        let error_details = match &self {
            // Include detailed error information for debugging (sanitized for production)
            AppError::ConfigError(msg) | 
            AppError::ConfigValidationError(msg) |
            AppError::InternalError(msg) |
            AppError::EndpointError(msg) |
            AppError::InvalidRpcRequest(msg) |
            AppError::CacheError(msg) |
            AppError::ConsensusError(msg) |
            AppError::ValidationError(msg) |
            AppError::GeoIpError(msg) |
            AppError::WebSocketError(msg) |
            AppError::DiscoveryError(msg) |
            AppError::MetricsError(msg) => Some(msg.clone()),
            
            // For network and external service errors, provide generic message
            AppError::NetworkError(_) |
            AppError::RedisError(_) |
            AppError::DatabaseError(_) => Some("External service error".to_string()),
            
            // Don't expose internal details for security-related errors
            _ => None,
        };

        let body = Json(json!({
            "error": {
                "code": error_code,
                "message": error_message,
                "details": error_details,
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "request_id": uuid::Uuid::new_v4().to_string(),
            }
        }));

        (status, body).into_response()
    }
}

// Helper functions for creating specific errors
impl AppError {
    pub fn config(msg: &str) -> Self {
        AppError::ConfigError(msg.to_string())
    }
    
    pub fn internal(msg: &str) -> Self {
        AppError::InternalError(msg.to_string())
    }
    
    pub fn endpoint(msg: &str) -> Self {
        AppError::EndpointError(msg.to_string())
    }
    
    pub fn invalid_request(msg: &str) -> Self {
        AppError::InvalidRpcRequest(msg.to_string())
    }
    
    pub fn cache(msg: &str) -> Self {
        AppError::CacheError(msg.to_string())
    }
    
    pub fn consensus(msg: &str) -> Self {
        AppError::ConsensusError(msg.to_string())
    }
    
    pub fn validation(msg: &str) -> Self {
        AppError::ValidationError(msg.to_string())
    }
    
    pub fn websocket(msg: &str) -> Self {
        AppError::WebSocketError(msg.to_string())
    }
}