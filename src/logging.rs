use std::time::Duration;
use tracing::{debug, error, info, warn, Level, Span};
use tracing_subscriber::{
    fmt::{self, format::FmtSpan},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter, Layer,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogConfig {
    pub level: String,
    pub format: LogFormat,
    pub enable_json: bool,
    pub enable_ansi: bool,
    pub enable_timestamps: bool,
    pub enable_thread_ids: bool,
    pub enable_target: bool,
    pub enable_line_numbers: bool,
    pub enable_file_names: bool,
    pub buffer_size: usize,
    pub file_path: Option<String>,
    pub max_file_size: u64,
    pub max_files: usize,
    pub sample_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    Compact,
    Pretty,
    Json,
    Full,
}

impl Default for LogConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            format: LogFormat::Pretty,
            enable_json: false,
            enable_ansi: true,
            enable_timestamps: true,
            enable_thread_ids: false,
            enable_target: true,
            enable_line_numbers: cfg!(debug_assertions),
            enable_file_names: cfg!(debug_assertions),
            buffer_size: 10000,
            file_path: None,
            max_file_size: 100 * 1024 * 1024, // 100MB
            max_files: 10,
            sample_rate: 1.0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RequestContext {
    pub request_id: String,
    pub user_id: Option<String>,
    pub api_key_id: Option<String>,
    pub method: Option<String>,
    pub endpoint_url: Option<String>,
    pub client_ip: Option<String>,
    pub user_agent: Option<String>,
    pub start_time: DateTime<Utc>,
}

impl RequestContext {
    pub fn new() -> Self {
        Self {
            request_id: Uuid::new_v4().to_string(),
            user_id: None,
            api_key_id: None,
            method: None,
            endpoint_url: None,
            client_ip: None,
            user_agent: None,
            start_time: Utc::now(),
        }
    }
    
    pub fn with_user(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }
    
    pub fn with_api_key(mut self, api_key_id: String) -> Self {
        self.api_key_id = Some(api_key_id);
        self
    }
    
    pub fn with_method(mut self, method: String) -> Self {
        self.method = Some(method);
        self
    }
    
    pub fn with_endpoint(mut self, endpoint_url: String) -> Self {
        self.endpoint_url = Some(endpoint_url);
        self
    }
    
    pub fn with_client_ip(mut self, client_ip: String) -> Self {
        self.client_ip = Some(client_ip);
        self
    }
    
    pub fn with_user_agent(mut self, user_agent: String) -> Self {
        self.user_agent = Some(user_agent);
        self
    }
}

// Structured log event
#[derive(Debug, Clone, Serialize)]
pub struct LogEvent {
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub message: String,
    pub target: String,
    pub request_id: Option<String>,
    pub user_id: Option<String>,
    pub api_key_id: Option<String>,
    pub method: Option<String>,
    pub endpoint_url: Option<String>,
    pub duration_ms: Option<u64>,
    pub status_code: Option<u16>,
    pub error_code: Option<String>,
    pub fields: serde_json::Value,
    pub file: Option<String>,
    pub line: Option<u32>,
    pub thread_id: Option<String>,
}

// In-memory log buffer for recent logs
pub struct LogBuffer {
    events: Arc<RwLock<VecDeque<LogEvent>>>,
    max_size: usize,
}

impl LogBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            events: Arc::new(RwLock::new(VecDeque::with_capacity(max_size))),
            max_size,
        }
    }
    
    pub async fn push(&self, event: LogEvent) {
        let mut events = self.events.write().await;
        if events.len() >= self.max_size {
            events.pop_front();
        }
        events.push_back(event);
    }
    
    pub async fn get_recent(&self, count: usize) -> Vec<LogEvent> {
        let events = self.events.read().await;
        events.iter()
            .rev()
            .take(count)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect()
    }
    
    pub async fn search(&self, query: &str, limit: usize) -> Vec<LogEvent> {
        let events = self.events.read().await;
        events.iter()
            .filter(|event| {
                event.message.contains(query) ||
                event.error_code.as_ref().map_or(false, |code| code.contains(query)) ||
                event.request_id.as_ref().map_or(false, |id| id.contains(query))
            })
            .take(limit)
            .cloned()
            .collect()
    }
    
    pub async fn clear(&self) {
        let mut events = self.events.write().await;
        events.clear();
    }
}

// Custom tracing layer for structured logging
pub struct StructuredLoggingLayer {
    buffer: Arc<LogBuffer>,
}

impl StructuredLoggingLayer {
    pub fn new(buffer: Arc<LogBuffer>) -> Self {
        Self { buffer }
    }
}

impl<S> Layer<S> for StructuredLoggingLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        let mut visitor = JsonVisitor::default();
        event.record(&mut visitor);
        
        let metadata = event.metadata();
        let log_event = LogEvent {
            timestamp: Utc::now(),
            level: metadata.level().to_string(),
            message: visitor.message.unwrap_or_default(),
            target: metadata.target().to_string(),
            request_id: visitor.fields.get("request_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            user_id: visitor.fields.get("user_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            api_key_id: visitor.fields.get("api_key_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            method: visitor.fields.get("method")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            endpoint_url: visitor.fields.get("endpoint_url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            duration_ms: visitor.fields.get("duration_ms")
                .and_then(|v| v.as_u64()),
            status_code: visitor.fields.get("status_code")
                .and_then(|v| v.as_u64())
                .map(|v| v as u16),
            error_code: visitor.fields.get("error_code")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            fields: serde_json::Value::Object(visitor.fields),
            file: metadata.file().map(|s| s.to_string()),
            line: metadata.line(),
            thread_id: std::thread::current().name().map(|s| s.to_string()),
        };
        
        let buffer = self.buffer.clone();
        tokio::spawn(async move {
            buffer.push(log_event).await;
        });
    }
}

// Visitor for extracting structured data from events
#[derive(Default)]
struct JsonVisitor {
    message: Option<String>,
    fields: serde_json::Map<String, serde_json::Value>,
}

impl tracing::field::Visit for JsonVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.message = Some(format!("{:?}", value));
        } else {
            self.fields.insert(field.name().to_string(), serde_json::json!(format!("{:?}", value)));
        }
    }
    
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = Some(value.to_string());
        } else {
            self.fields.insert(field.name().to_string(), serde_json::json!(value));
        }
    }
    
    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.fields.insert(field.name().to_string(), serde_json::json!(value));
    }
    
    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.fields.insert(field.name().to_string(), serde_json::json!(value));
    }
    
    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.fields.insert(field.name().to_string(), serde_json::json!(value));
    }
}

// Initialize logging system
pub fn init_logging(config: &LogConfig, buffer: Arc<LogBuffer>) -> anyhow::Result<()> {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&config.level));
    
    let fmt_layer = fmt::layer()
        .with_ansi(config.enable_ansi)
        .with_target(config.enable_target)
        .with_thread_ids(config.enable_thread_ids)
        .with_file(config.enable_file_names)
        .with_line_number(config.enable_line_numbers);
    
    let fmt_layer = match config.format {
        LogFormat::Compact => fmt_layer.compact().boxed(),
        LogFormat::Pretty => fmt_layer.pretty().boxed(),
        LogFormat::Json => fmt_layer.json().boxed(),
        LogFormat::Full => fmt_layer.boxed(),
    };
    
    let structured_layer = StructuredLoggingLayer::new(buffer);
    
    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(structured_layer)
        .init();
    
    Ok(())
}

// Logging middleware for HTTP requests
pub async fn logging_middleware(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> impl axum::response::IntoResponse {
    let method = req.method().to_string();
    let uri = req.uri().to_string();
    let version = format!("{:?}", req.version());
    
    let request_id = Uuid::new_v4().to_string();
    let span = tracing::info_span!(
        "http_request",
        request_id = %request_id,
        method = %method,
        uri = %uri,
        version = %version,
    );
    
    let start = std::time::Instant::now();
    
    let response = span.in_scope(|| next.run(req)).await;
    
    let duration = start.elapsed();
    let status = response.status();
    
    span.in_scope(|| {
        info!(
            status = status.as_u16(),
            duration_ms = duration.as_millis(),
            "Request completed"
        );
    });
    
    response
}

// Macros for structured logging
#[macro_export]
macro_rules! log_event {
    ($level:expr, $msg:expr, $($key:tt = $val:expr),* $(,)?) => {
        match $level {
            tracing::Level::ERROR => tracing::error!($($key = $val,)* "{}", $msg),
            tracing::Level::WARN => tracing::warn!($($key = $val,)* "{}", $msg),
            tracing::Level::INFO => tracing::info!($($key = $val,)* "{}", $msg),
            tracing::Level::DEBUG => tracing::debug!($($key = $val,)* "{}", $msg),
            tracing::Level::TRACE => tracing::trace!($($key = $val,)* "{}", $msg),
        }
    };
}

#[macro_export]
macro_rules! log_error {
    ($err:expr, $($key:tt = $val:expr),* $(,)?) => {
        tracing::error!(
            error = ?$err,
            error_type = std::any::type_name_of_val(&$err),
            $($key = $val,)*
            "Error occurred"
        );
    };
}

#[macro_export]
macro_rules! log_request {
    ($ctx:expr, $msg:expr, $($key:tt = $val:expr),* $(,)?) => {
        tracing::info!(
            request_id = %$ctx.request_id,
            user_id = ?$ctx.user_id,
            api_key_id = ?$ctx.api_key_id,
            method = ?$ctx.method,
            endpoint_url = ?$ctx.endpoint_url,
            $($key = $val,)*
            "{}", $msg
        );
    };
}

// Audit logging for security events
pub struct AuditLogger {
    buffer: Arc<LogBuffer>,
}

impl AuditLogger {
    pub fn new(buffer: Arc<LogBuffer>) -> Self {
        Self { buffer }
    }
    
    pub fn log_auth_attempt(&self, user: &str, success: bool, reason: Option<&str>) {
        info!(
            event_type = "auth_attempt",
            user = %user,
            success = success,
            reason = ?reason,
            timestamp = %Utc::now(),
            "Authentication attempt"
        );
    }
    
    pub fn log_permission_check(&self, user: &str, resource: &str, action: &str, allowed: bool) {
        info!(
            event_type = "permission_check",
            user = %user,
            resource = %resource,
            action = %action,
            allowed = allowed,
            timestamp = %Utc::now(),
            "Permission check"
        );
    }
    
    pub fn log_data_access(&self, user: &str, resource: &str, operation: &str) {
        info!(
            event_type = "data_access",
            user = %user,
            resource = %resource,
            operation = %operation,
            timestamp = %Utc::now(),
            "Data access"
        );
    }
    
    pub fn log_configuration_change(&self, user: &str, setting: &str, old_value: &str, new_value: &str) {
        warn!(
            event_type = "config_change",
            user = %user,
            setting = %setting,
            old_value = %old_value,
            new_value = %new_value,
            timestamp = %Utc::now(),
            "Configuration changed"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_log_buffer() {
        let buffer = LogBuffer::new(10);
        
        for i in 0..15 {
            let event = LogEvent {
                timestamp: Utc::now(),
                level: "INFO".to_string(),
                message: format!("Test message {}", i),
                target: "test".to_string(),
                request_id: Some(format!("req-{}", i)),
                user_id: None,
                api_key_id: None,
                method: None,
                endpoint_url: None,
                duration_ms: None,
                status_code: None,
                error_code: None,
                fields: serde_json::json!({}),
                file: None,
                line: None,
                thread_id: None,
            };
            buffer.push(event).await;
        }
        
        let recent = buffer.get_recent(5).await;
        assert_eq!(recent.len(), 5);
        assert_eq!(recent[0].message, "Test message 10");
        
        let search_results = buffer.search("req-12", 10).await;
        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].message, "Test message 12");
    }
}