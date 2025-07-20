use crate::{
    endpoints::EndpointManager,
    types::{EndpointStatus, HealthCheckResult, SystemHealth},
};
use chrono::Utc;
use serde_json::json;
use std::{sync::Arc, time::{Duration, Instant}};
use tokio::time::{interval, sleep};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub struct HealthService {
    endpoint_manager: Arc<EndpointManager>,
    start_time: Instant,
}

impl HealthService {
    pub fn new(endpoint_manager: Arc<EndpointManager>) -> Self {
        Self {
            endpoint_manager,
            start_time: Instant::now(),
        }
    }
    
    pub async fn start_monitoring(&self) {
        info!("Starting health monitoring service");
        
        let mut interval = interval(Duration::from_secs(30));
        
        loop {
            interval.tick().await;
            self.check_all_endpoints().await;
        }
    }
    
    async fn check_all_endpoints(&self) {
        let endpoints = self.endpoint_manager.get_endpoint_info().await;
        let mut check_tasks = Vec::new();
        
        for endpoint_info in endpoints {
            let endpoint_manager = self.endpoint_manager.clone();
            let task = tokio::spawn(async move {
                Self::check_endpoint_health(&endpoint_manager, endpoint_info.id, &endpoint_info.url).await
            });
            check_tasks.push(task);
        }
        
        // Wait for all health checks to complete
        for task in check_tasks {
            if let Err(e) = task.await {
                error!("Health check task failed: {}", e);
            }
        }
    }
    
    async fn check_endpoint_health(
        endpoint_manager: &EndpointManager,
        endpoint_id: Uuid,
        url: &str,
    ) -> HealthCheckResult {
        let start_time = Instant::now();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("Failed to create health check client");
        
        // Use getHealth method for Solana RPC health check
        let health_request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getHealth"
        });
        
        let result = match client.post(url).json(&health_request).send().await {
            Ok(response) => {
                let response_time = start_time.elapsed();
                
                match response.status().is_success() {
                    true => {
                        // Try to parse the response to ensure it's valid
                        match response.json::<serde_json::Value>().await {
                            Ok(json_response) => {
                                debug!("Health check successful for {}: {:?}", url, json_response);
                                
                                let status = if json_response.get("result").is_some() {
                                    EndpointStatus::Healthy
                                } else if json_response.get("error").is_some() {
                                    EndpointStatus::Degraded
                                } else {
                                    EndpointStatus::Unknown
                                };
                                
                                endpoint_manager.update_endpoint_status(endpoint_id, status).await;
                                endpoint_manager.update_endpoint_stats(endpoint_id, true, response_time).await;
                                
                                HealthCheckResult {
                                    endpoint_id,
                                    success: true,
                                    response_time,
                                    error: None,
                                    timestamp: Utc::now(),
                                }
                            }
                            Err(e) => {
                                warn!("Health check JSON parse error for {}: {}", url, e);
                                endpoint_manager.update_endpoint_status(endpoint_id, EndpointStatus::Degraded).await;
                                endpoint_manager.update_endpoint_stats(endpoint_id, false, response_time).await;
                                
                                HealthCheckResult {
                                    endpoint_id,
                                    success: false,
                                    response_time,
                                    error: Some(format!("JSON parse error: {}", e)),
                                    timestamp: Utc::now(),
                                }
                            }
                        }
                    }
                    false => {
                        let status_code = response.status();
                        warn!("Health check HTTP error for {}: {}", url, status_code);
                        endpoint_manager.update_endpoint_status(endpoint_id, EndpointStatus::Unhealthy).await;
                        endpoint_manager.update_endpoint_stats(endpoint_id, false, start_time.elapsed()).await;
                        
                        HealthCheckResult {
                            endpoint_id,
                            success: false,
                            response_time: start_time.elapsed(),
                            error: Some(format!("HTTP {}", status_code)),
                            timestamp: Utc::now(),
                        }
                    }
                }
            }
            Err(e) => {
                error!("Health check request failed for {}: {}", url, e);
                endpoint_manager.update_endpoint_status(endpoint_id, EndpointStatus::Unhealthy).await;
                endpoint_manager.update_endpoint_stats(endpoint_id, false, start_time.elapsed()).await;
                
                HealthCheckResult {
                    endpoint_id,
                    success: false,
                    response_time: start_time.elapsed(),
                    error: Some(e.to_string()),
                    timestamp: Utc::now(),
                }
            }
        };
        
        result
    }
    
    pub async fn get_system_health(&self) -> serde_json::Value {
        let endpoints = self.endpoint_manager.get_endpoint_info().await;
        let stats = self.endpoint_manager.get_stats().await;
        
        let total_endpoints = endpoints.len();
        let healthy_endpoints = endpoints.iter()
            .filter(|e| e.status == EndpointStatus::Healthy)
            .count();
        let degraded_endpoints = endpoints.iter()
            .filter(|e| e.status == EndpointStatus::Degraded)
            .count();
        let unhealthy_endpoints = endpoints.iter()
            .filter(|e| e.status == EndpointStatus::Unhealthy)
            .count();
        
        let overall_status = match (healthy_endpoints, degraded_endpoints, unhealthy_endpoints) {
            (h, _, _) if h > 0 => "healthy",
            (0, d, _) if d > 0 => "degraded", 
            _ => "unhealthy",
        };
        
        let uptime = self.start_time.elapsed();
        
        json!({
            "status": overall_status,
            "uptime_seconds": uptime.as_secs(),
            "endpoints": {
                "total": total_endpoints,
                "healthy": healthy_endpoints,
                "degraded": degraded_endpoints,
                "unhealthy": unhealthy_endpoints,
            },
            "statistics": stats,
            "timestamp": Utc::now().to_rfc3339(),
        })
    }
    
    pub async fn force_health_check(&self, endpoint_id: Option<Uuid>) {
        match endpoint_id {
            Some(id) => {
                if let Some(url) = self.endpoint_manager.get_endpoint_url(id).await {
                    Self::check_endpoint_health(&self.endpoint_manager, id, &url).await;
                }
            }
            None => {
                self.check_all_endpoints().await;
            }
        }
    }
}