use axum::{
    extract::{ws::WebSocketUpgrade, State, Query},
    response::{Json, IntoResponse},
    routing::{get, post},
    Router, middleware,
};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing::{info, error};
use tracing_subscriber;
use std::collections::HashMap;
use serde_json::json;
use chrono::Utc;

mod auth;
mod cache;
mod config;
mod consensus;
mod endpoints;
mod error;
mod geo;
mod health;
mod metrics;
mod rate_limit;
mod router;
mod rpc;
mod types;
mod websocket;
mod admin;
mod retry;
mod bulkhead;
mod logging;
mod monitoring;

use auth::{AuthService, AuthMiddleware};
use cache::CacheService;
use config::Config;
use consensus::ConsensusService;
use endpoints::EndpointManager;
use crate::error::AppError;
use geo::GeoService;
use health::HealthService;
use metrics::MetricsService;
use rate_limit::RateLimitService;
use router::RpcRouter;
use websocket::WebSocketService;

#[derive(Clone)]
pub struct AppState {
    pub endpoint_manager: Arc<EndpointManager>,
    pub rpc_router: Arc<RpcRouter>,
    pub health_service: Arc<HealthService>,
    pub auth_service: Arc<AuthService>,
    pub cache_service: Arc<CacheService>,
    pub consensus_service: Arc<ConsensusService>,
    pub geo_service: Arc<GeoService>,
    pub metrics_service: Arc<MetricsService>,
    pub rate_limit_service: Arc<RateLimitService>,
    pub websocket_service: Arc<WebSocketService>,
}

#[tokio::main]
async fn main() -> Result<(), AppError> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_file(true)
        .with_line_number(true)
        .with_thread_ids(true)
        .init();

    info!("Starting Multi-RPC server...");

    // Load configuration
    let config = match Config::load().await {
        Ok(config) => {
            info!("Loaded configuration with {} endpoints", config.endpoints.len());
            config
        }
        Err(e) => {
            error!("Failed to load configuration: {}", e);
            return Err(e);
        }
    };

    // Initialize services
    let endpoint_manager = Arc::new(EndpointManager::new(config.endpoints.clone(), config.clone()).await?);
    let cache_service = Arc::new(CacheService::new(&config).await?);
    let auth_service = Arc::new(AuthService::new(&config).await?);
    let consensus_service = Arc::new(ConsensusService::new(config.consensus.clone()));
    let geo_service = Arc::new(GeoService::new(&config).await?);
    let metrics_service = Arc::new(MetricsService::new());
    let rate_limit_service = Arc::new(RateLimitService::new(&config));
    let websocket_service = Arc::new(WebSocketService::new(endpoint_manager.clone()));
    
    let rpc_router = Arc::new(RpcRouter::new(
        endpoint_manager.clone(),
        cache_service.clone(),
        consensus_service.clone(),
        geo_service.clone(),
        metrics_service.clone(),
    ));
    
    let health_service = Arc::new(HealthService::new(
        endpoint_manager.clone(),
    ));

    let app_state = Arc::new(AppState {
        endpoint_manager: endpoint_manager.clone(),
        rpc_router,
        health_service: health_service.clone(),
        auth_service: auth_service.clone(),
        cache_service,
        consensus_service,
        geo_service,
        metrics_service: metrics_service.clone(),
        rate_limit_service,
        websocket_service,
    });

    // Start background services
    tokio::spawn({
        let health_service = health_service.clone();
        async move {
            health_service.start_monitoring().await;
        }
    });

    tokio::spawn({
        let endpoint_manager = endpoint_manager.clone();
        async move {
            endpoint_manager.start_auto_discovery().await;
        }
    });

    // Build the application router
    let app = Router::new()
        // Main RPC endpoint
        .route("/", get(handle_root).post(handle_rpc_request))
        
        // WebSocket endpoint
        .route("/ws", get(handle_websocket_upgrade))
        
        // Health and status endpoints
        .route("/health", get(handle_health))
        .route("/endpoints", get(handle_endpoints))
        .route("/stats", get(handle_stats))
        
        // Metrics endpoints
        .route("/metrics", get(handle_metrics))
        .route("/metrics/prometheus", get(handle_prometheus_metrics))
        
        // Admin endpoints
        .route("/admin", get(admin::dashboard))
        .route("/admin/endpoints", get(admin::endpoints_page))
        .route("/admin/config", get(admin::config_page))
        .route("/admin/logs", get(admin::logs_page))
        
        // Configuration endpoints
        .route("/config", get(handle_get_config).post(handle_update_config))
        .route("/config/reload", post(handle_reload_config))
        
        // Authentication endpoints
        .route("/auth/login", post(auth::handle_login))
        .route("/auth/validate", get(auth::handle_validate))
        .route("/auth/refresh", post(auth::handle_refresh))
        
        // Geographic endpoint info
        .route("/geo/endpoints", get(handle_geo_endpoints))
        
        // Debug endpoints (development only)
        .route("/debug/consensus", get(handle_debug_consensus))
        .route("/debug/cache", get(handle_debug_cache))
        
        // Apply middleware
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            AuthMiddleware::middleware,
        ))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start the server
    info!("Attempting to bind to address: {}", config.bind_address);
    let listener = match TcpListener::bind(&config.bind_address).await {
        Ok(listener) => {
            info!("Successfully bound to {}", config.bind_address);
            listener
        }
        Err(e) => {
            error!("Failed to bind to {}: {}", config.bind_address, e);
            return Err(AppError::from(e));
        }
    };
    
    info!("🚀 Multi-RPC Enterprise server starting on {}", config.bind_address);
    info!("📊 Admin dashboard available at http://{}/admin", config.bind_address);
    info!("🔌 WebSocket endpoint available at ws://{}/ws", config.bind_address);
    info!("🏥 Health check available at http://{}/health", config.bind_address);
    
    info!("Server is ready to accept connections");
    
    match axum::serve(listener, app).await {
        Ok(_) => {
            info!("Server shut down gracefully");
            Ok(())
        }
        Err(e) => {
            error!("Server error: {}", e);
            Err(AppError::from(e))
        }
    }
}

async fn handle_rpc_request(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let response = state.rpc_router.route_request(payload, None).await?;
    Ok(Json(response))
}

async fn handle_websocket_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let websocket_service = state.websocket_service.clone();
    ws.on_upgrade(move |socket| websocket_service.handle_connection(socket))
}

async fn handle_health(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Simple health check that doesn't depend on endpoints
    let uptime = state.metrics_service.get_uptime();
    let endpoints_count = state.endpoint_manager.get_endpoint_info().await.len();
    
    Ok(Json(json!({
        "status": "healthy",
        "uptime_seconds": uptime.as_secs(),
        "endpoints_configured": endpoints_count,
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": Utc::now().to_rfc3339()
    })))
}

async fn handle_endpoints(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<types::EndpointInfo>>, AppError> {
    let endpoints = state.endpoint_manager.get_endpoint_info().await;
    Ok(Json(endpoints))
}

async fn handle_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = state.endpoint_manager.get_stats().await;
    Ok(Json(stats))
}

async fn handle_metrics(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let metrics = state.metrics_service.get_metrics().await;
    Ok(Json(metrics))
}

async fn handle_prometheus_metrics(
    State(state): State<Arc<AppState>>,
) -> Result<String, AppError> {
    let metrics = state.metrics_service.get_prometheus_metrics().await;
    Ok(metrics)
}

async fn handle_get_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let config = state.endpoint_manager.get_config().await;
    Ok(Json(config))
}

async fn handle_update_config(
    State(state): State<Arc<AppState>>,
    Json(config): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.endpoint_manager.update_config(config).await?;
    Ok(Json(serde_json::json!({"status": "updated"})))
}

async fn handle_reload_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.endpoint_manager.reload_config().await?;
    Ok(Json(serde_json::json!({"status": "reloaded"})))
}

async fn handle_geo_endpoints(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client_ip = params.get("ip").map(|s| s.as_str());
    let geo_endpoints = state.geo_service.get_geo_sorted_endpoints(client_ip).await;
    Ok(Json(geo_endpoints))
}

async fn handle_debug_consensus(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let consensus_debug = state.consensus_service.get_debug_info().await;
    Ok(Json(consensus_debug))
}

async fn handle_debug_cache(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cache_debug = state.cache_service.get_debug_info().await;
    Ok(Json(cache_debug))
}