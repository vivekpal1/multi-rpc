use crate::{
    AppState,
    error::AppError,
    types::{EndpointInfo, LoadBalancerStats},
};
use askama::Template;
use axum::{
    extract::State,
    response::Html,
};
use std::sync::Arc;
use tracing::info;

#[derive(Template)]
#[template(path = "dashboard.html")]
struct DashboardTemplate {
    title: String,
    endpoints_count: usize,
    total_requests: u64,
    uptime: String,
}

#[derive(Template)]
#[template(path = "endpoints.html")]
struct EndpointsTemplate {
    title: String,
    endpoints: Vec<EndpointInfo>,
}

#[derive(Template)]
#[template(path = "config.html")]
struct ConfigTemplate {
    title: String,
    config_json: String,
}

#[derive(Template)]
#[template(path = "logs.html")]
struct LogsTemplate {
    title: String,
    logs: Vec<String>,
}

pub async fn dashboard(State(state): State<Arc<AppState>>) -> Result<Html<String>, AppError> {
    let endpoints = state.endpoint_manager.get_endpoint_info().await;
    let stats = state.metrics_service.get_metrics().await;
    
    let template = DashboardTemplate {
        title: "Multi-RPC Dashboard".to_string(),
        endpoints_count: endpoints.len(),
        total_requests: stats["request_metrics"]["total_requests"].as_u64().unwrap_or(0),
        uptime: format!("{} hours", state.metrics_service.get_uptime().as_secs() / 3600),
    };
    
    Ok(Html(template.render()?))
}

pub async fn endpoints_page(State(state): State<Arc<AppState>>) -> Result<Html<String>, AppError> {
    let endpoints = state.endpoint_manager.get_endpoint_info().await;
    
    let template = EndpointsTemplate {
        title: "Endpoints Management".to_string(),
        endpoints,
    };
    
    Ok(Html(template.render()?))
}

pub async fn config_page(State(state): State<Arc<AppState>>) -> Result<Html<String>, AppError> {
    let config = state.endpoint_manager.get_config().await;
    let config_json = serde_json::to_string_pretty(&config)?;
    
    let template = ConfigTemplate {
        title: "Configuration".to_string(),
        config_json,
    };
    
    Ok(Html(template.render()?))
}

pub async fn logs_page(_state: State<Arc<AppState>>) -> Result<Html<String>, AppError> {
    // In a real implementation, this would fetch logs from a logging service
    let logs = vec![
        "2024-01-01 10:00:00 INFO Starting Multi-RPC service".to_string(),
        "2024-01-01 10:00:01 INFO Loaded 5 RPC endpoints".to_string(),
        "2024-01-01 10:00:02 INFO Health monitoring started".to_string(),
    ];
    
    let template = LogsTemplate {
        title: "System Logs".to_string(),
        logs,
    };
    
    Ok(Html(template.render()?))
}