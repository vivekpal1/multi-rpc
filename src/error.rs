use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;
use std::fmt;
use std::sync::Arc;
use std::time::SystemTime;
use tracing::{error, warn};

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
    
    // Retry errors
    #[error("Max retries exceeded: {0}")]
    MaxRetriesExceeded(String),
    
    #[error("Backoff limit reached")]
    BackoffLimitReached,
    
    // Bulkhead errors
    #[error("Bulkhead full: {0}")]
    BulkheadFull(String),
    
    // Timeout errors
    #[error("Connect timeout")]
    ConnectTimeout,
    
    #[error("Read timeout")]
    ReadTimeout,
    
    #[error("Write timeout")]
    WriteTimeout,
    
    // Recovery errors
    #[error("Recovery in progress")]
    RecoveryInProgress,
    
    #[error("Recovery failed: {0}")]
    RecoveryFailed(String),
    
    // Chain errors for context
    #[error("{message}")]
    WithContext {
        message: String,
        #[source]
        source: Box<AppError>,
    },
}

// Error context for tracking error propagation
#[derive(Debug, Clone)]
pub struct ErrorContext {
    pub request_id: String,
    pub endpoint_url: Option<String>,
    pub method: Option<String>,
    pub timestamp: SystemTime,
    pub retry_count: u32,
    pub user_id: Option<String>,
    pub api_key_id: Option<String>,
}

impl ErrorContext {
    pub fn new(request_id: String) -> Self {
        Self {
            request_id,
            endpoint_url: None,
            method: None,
            timestamp: SystemTime::now(),
            retry_count: 0,
            user_id: None,
            api_key_id: None,
        }
    }
    
    pub fn with_endpoint(mut self, url: String) -> Self {
        self.endpoint_url = Some(url);
        self
    }
    
    pub fn with_method(mut self, method: String) -> Self {
        self.method = Some(method);
        self
    }
    
    pub fn with_retry_count(mut self, count: u32) -> Self {
        self.retry_count = count;
        self
    }
    
    pub fn with_user(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }
    
    pub fn with_api_key(mut self, api_key_id: String) -> Self {
        self.api_key_id = Some(api_key_id);
        self
    }
}

// Error details for production error handling
#[derive(Debug)]
pub struct DetailedError {
    pub error: AppError,
    pub context: ErrorContext,
    pub stack_trace: Option<String>,
    pub is_retryable: bool,
    pub suggested_action: Option<String>,
}

impl DetailedError {
    pub fn new(error: AppError, context: ErrorContext) -> Self {
        let is_retryable = error.is_retryable();
        let suggested_action = error.suggested_action();
        
        Self {
            error,
            context,
            stack_trace: None,
            is_retryable,
            suggested_action,
        }
    }
    
    pub fn with_stack_trace(mut self) -> Self {
        if cfg!(debug_assertions) {
            self.stack_trace = Some(std::backtrace::Backtrace::capture().to_string());
        }
        self
    }
}

impl AppError {
    // Determine if error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(self,
            AppError::NetworkError(_) |
            AppError::RequestTimeout |
            AppError::EndpointError(_) |
            AppError::AllEndpointsUnhealthy |
            AppError::EndpointOverloaded |
            AppError::ConnectTimeout |
            AppError::ReadTimeout |
            AppError::WriteTimeout |
            AppError::RecoveryInProgress |
            AppError::BulkheadFull(_)
        )
    }
    
    // Get suggested action for the error
    pub fn suggested_action(&self) -> Option<String> {
        match self {
            AppError::RateLimitExceeded => Some("Reduce request frequency or upgrade your plan".to_string()),
            AppError::AllEndpointsUnhealthy => Some("Wait for endpoints to recover or contact support".to_string()),
            AppError::CircuitBreakerOpen => Some("Service is temporarily unavailable, please retry later".to_string()),
            AppError::InvalidAuthToken => Some("Refresh your authentication token".to_string()),
            AppError::ExpiredAuthToken => Some("Renew your authentication token".to_string()),
            AppError::BulkheadFull(_) => Some("System is under heavy load, please retry later".to_string()),
            AppError::MaxRetriesExceeded(_) => Some("Check service status or contact support".to_string()),
            _ => None,
        }
    }
    
    // Get error severity for logging
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            // Critical errors that need immediate attention
            AppError::ConfigError(_) |
            AppError::DatabaseError(_) |
            AppError::InternalError(_) => ErrorSeverity::Critical,
            
            // Errors that indicate service degradation
            AppError::AllEndpointsUnhealthy |
            AppError::CircuitBreakerOpen |
            AppError::RecoveryFailed(_) => ErrorSeverity::Error,
            
            // Warnings that might need investigation
            AppError::EndpointOverloaded |
            AppError::RateLimitExceeded |
            AppError::BulkheadFull(_) => ErrorSeverity::Warning,
            
            // Info level errors (user errors, expected conditions)
            AppError::InvalidRpcRequest(_) |
            AppError::ValidationError(_) |
            AppError::InvalidCredentials => ErrorSeverity::Info,
            
            // Default to error
            _ => ErrorSeverity::Error,
        }
    }
    
    // Chain errors with context
    pub fn with_context(self, message: impl Into<String>) -> Self {
        AppError::WithContext {
            message: message.into(),
            source: Box::new(self),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum ErrorSeverity {
    Critical,
    Error,
    Warning,
    Info,
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
            
            // Retry errors
            AppError::MaxRetriesExceeded(_) => (StatusCode::SERVICE_UNAVAILABLE, "MAX_RETRIES_EXCEEDED", "Maximum retries exceeded"),
            AppError::BackoffLimitReached => (StatusCode::SERVICE_UNAVAILABLE, "BACKOFF_LIMIT_REACHED", "Backoff limit reached"),
            
            // Bulkhead errors
            AppError::BulkheadFull(_) => (StatusCode::SERVICE_UNAVAILABLE, "BULKHEAD_FULL", "Service capacity exceeded"),
            
            // Timeout errors
            AppError::ConnectTimeout => (StatusCode::GATEWAY_TIMEOUT, "CONNECT_TIMEOUT", "Connection timeout"),
            AppError::ReadTimeout => (StatusCode::GATEWAY_TIMEOUT, "READ_TIMEOUT", "Read timeout"),
            AppError::WriteTimeout => (StatusCode::GATEWAY_TIMEOUT, "WRITE_TIMEOUT", "Write timeout"),
            
            // Recovery errors
            AppError::RecoveryInProgress => (StatusCode::SERVICE_UNAVAILABLE, "RECOVERY_IN_PROGRESS", "Service recovery in progress"),
            AppError::RecoveryFailed(_) => (StatusCode::INTERNAL_SERVER_ERROR, "RECOVERY_FAILED", "Service recovery failed"),
            
            // Context errors
            AppError::WithContext { message, source } => {
                // Use the source error's response but with custom message
                let (status, code, _) = get_error_tuple(source);
                (status, code, message.as_str())
            }
            
            // Generic errors
            AppError::IoError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "IO_ERROR", "IO error"),
            AppError::InternalError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal error"),
            AppError::TemplateError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "TEMPLATE_ERROR", "Template rendering error"),
        };
        
        // Log error based on severity
        match self.severity() {
            ErrorSeverity::Critical => error!("Critical error: {:?}", self),
            ErrorSeverity::Error => error!("Error: {:?}", self),
            ErrorSeverity::Warning => warn!("Warning: {:?}", self),
            ErrorSeverity::Info => {},
        }

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
            AppError::MetricsError(msg) |
            AppError::MaxRetriesExceeded(msg) |
            AppError::BulkheadFull(msg) |
            AppError::RecoveryFailed(msg) => {
                if cfg!(debug_assertions) {
                    Some(msg.clone())
                } else {
                    Some("See logs for details".to_string())
                }
            }
            
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
                "retryable": self.is_retryable(),
                "suggested_action": self.suggested_action(),
            }
        }));

        (status, body).into_response()
    }
}

// Helper function to get error tuple
fn get_error_tuple(error: &AppError) -> (StatusCode, &'static str, &'static str) {
    match error {
        AppError::ConfigError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "CONFIG_ERROR", "Configuration error"),
        AppError::NetworkError(_) => (StatusCode::BAD_GATEWAY, "NETWORK_ERROR", "Network error"),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal error"),
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
    
    pub fn max_retries(msg: &str) -> Self {
        AppError::MaxRetriesExceeded(msg.to_string())
    }
    
    pub fn bulkhead(msg: &str) -> Self {
        AppError::BulkheadFull(msg.to_string())
    }
    
    pub fn recovery_failed(msg: &str) -> Self {
        AppError::RecoveryFailed(msg.to_string())
    }
}

// Result type alias
pub type AppResult<T> = Result<T, AppError>;

// Extension trait for adding context to Results
pub trait ResultExt<T> {
    fn with_context(self, msg: impl Into<String>) -> AppResult<T>;
}

impl<T> ResultExt<T> for AppResult<T> {
    fn with_context(self, msg: impl Into<String>) -> AppResult<T> {
        self.map_err(|e| e.with_context(msg))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_error_retryability() {
        assert!(AppError::NetworkError(reqwest::Error::new()).is_retryable());
        assert!(AppError::RequestTimeout.is_retryable());
        assert!(!AppError::InvalidCredentials.is_retryable());
        assert!(!AppError::RateLimitExceeded.is_retryable());
    }
    
    #[test]
    fn test_error_severity() {
        assert!(matches!(AppError::ConfigError("test".to_string()).severity(), ErrorSeverity::Critical));
        assert!(matches!(AppError::AllEndpointsUnhealthy.severity(), ErrorSeverity::Error));
        assert!(matches!(AppError::RateLimitExceeded.severity(), ErrorSeverity::Warning));
        assert!(matches!(AppError::InvalidRpcRequest("test".to_string()).severity(), ErrorSeverity::Info));
        }
    
    #[test]
    fn test_error_context_chaining() {
        let error = AppError::NetworkError(reqwest::Error::new())
            .with_context("Failed to connect to primary endpoint");
        
        match error {
            AppError::WithContext { message, source } => {
                assert_eq!(message, "Failed to connect to primary endpoint");
                assert!(matches!(*source, AppError::NetworkError(_)));
            }
            _ => panic!("Expected WithContext error"),
        }
    }
}