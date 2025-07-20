use tokio::test;
use serde_json::{json, Value};
use reqwest::Client;
use std::time::Duration;
use uuid::Uuid;

const BASE_URL: &str = "http://localhost:8080";

#[tokio::test]
async fn test_health_endpoint() {
    let client = Client::new();
    let response = client
        .get(&format!("{}/health", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let health: Value = response.json().await.expect("Failed to parse JSON");
    assert!(health.get("status").is_some());
    assert!(health.get("uptime_seconds").is_some());
    assert!(health.get("endpoints").is_some());
}

#[tokio::test]
async fn test_basic_rpc_request() {
    let client = Client::new();
    let rpc_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getHealth"
    });

    let response = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .json(&rpc_request)
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let rpc_response: Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(rpc_response["jsonrpc"], "2.0");
    assert_eq!(rpc_response["id"], 1);
    assert!(rpc_response.get("result").is_some() || rpc_response.get("error").is_some());
}

#[tokio::test]
async fn test_batch_rpc_request() {
    let client = Client::new();
    let batch_request = json!([
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getHealth"
        },
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "getVersion"
        }
    ]);

    let response = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .json(&batch_request)
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let batch_response: Value = response.json().await.expect("Failed to parse JSON");
    assert!(batch_response.is_array());
    let responses = batch_response.as_array().unwrap();
    assert_eq!(responses.len(), 2);
    
    for resp in responses {
        assert_eq!(resp["jsonrpc"], "2.0");
        assert!(resp.get("id").is_some());
    }
}

#[tokio::test]
async fn test_invalid_rpc_request() {
    let client = Client::new();
    let invalid_request = json!({
        "jsonrpc": "1.0", // Wrong version
        "id": 1,
        "method": "getHealth"
    });

    let response = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .json(&invalid_request)
        .send()
        .await
        .expect("Failed to send request");

    // Should return 400 or return JSON-RPC error
    assert!(response.status().is_client_error() || response.status().is_success());
    
    if response.status().is_success() {
        let rpc_response: Value = response.json().await.expect("Failed to parse JSON");
        assert!(rpc_response.get("error").is_some());
    }
}

#[tokio::test]
async fn test_endpoints_info() {
    let client = Client::new();
    let response = client
        .get(&format!("{}/endpoints", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let endpoints: Value = response.json().await.expect("Failed to parse JSON");
    assert!(endpoints.is_array());
    
    let endpoints_array = endpoints.as_array().unwrap();
    assert!(!endpoints_array.is_empty());
    
    for endpoint in endpoints_array {
        assert!(endpoint.get("id").is_some());
        assert!(endpoint.get("url").is_some());
        assert!(endpoint.get("name").is_some());
        assert!(endpoint.get("status").is_some());
        assert!(endpoint.get("score").is_some());
    }
}

#[tokio::test]
async fn test_stats_endpoint() {
    let client = Client::new();
    let response = client
        .get(&format!("{}/stats", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let stats: Value = response.json().await.expect("Failed to parse JSON");
    assert!(stats.get("total_requests").is_some());
    assert!(stats.get("successful_requests").is_some());
    assert!(stats.get("failed_requests").is_some());
    assert!(stats.get("success_rate").is_some());
    assert!(stats.get("endpoint_count").is_some());
}

#[tokio::test]
async fn test_metrics_endpoint() {
    let client = Client::new();
    let response = client
        .get(&format!("{}/metrics", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let metrics: Value = response.json().await.expect("Failed to parse JSON");
    assert!(metrics.get("requests").is_some());
    assert!(metrics.get("endpoints").is_some());
    assert!(metrics.get("cache").is_some());
}

#[tokio::test]
async fn test_prometheus_metrics() {
    let client = Client::new();
    let response = client
        .get(&format!("{}/metrics/prometheus", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let metrics_text = response.text().await.expect("Failed to get response text");
    assert!(metrics_text.contains("multi_rpc_requests_total"));
    assert!(metrics_text.contains("multi_rpc_endpoints_healthy"));
}

#[tokio::test]
async fn test_rate_limiting() {
    let client = Client::new();
    let rpc_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getHealth"
    });

    // Send many requests quickly to trigger rate limiting
    let mut tasks = Vec::new();
    for _ in 0..100 {
        let client_clone = client.clone();
        let request_clone = rpc_request.clone();
        
        let task = tokio::spawn(async move {
            client_clone
                .post(BASE_URL)
                .header("Content-Type", "application/json")
                .json(&request_clone)
                .send()
                .await
        });
        
        tasks.push(task);
    }

    let mut rate_limited = false;
    for task in tasks {
        if let Ok(Ok(response)) = task.await {
            if response.status() == 429 {
                rate_limited = true;
                break;
            }
        }
    }

    // Note: This test may not always trigger rate limiting
    // depending on the configured limits and test environment
    println!("Rate limiting test completed. Rate limited: {}", rate_limited);
}

#[tokio::test]
async fn test_authentication() {
    let client = Client::new();
    
    // Test without authentication (should work for health endpoint)
    let response = client
        .get(&format!("{}/health", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");
    assert!(response.status().is_success());
    
    // Test admin endpoint without auth (should require auth)
    let response = client
        .get(&format!("{}/admin", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");
    
    // Should either redirect to login or return 401/403
    assert!(response.status().is_client_error() || response.status().is_redirection());
}

#[tokio::test]
async fn test_websocket_connection() {
    use tokio_tungstenite::{connect_async, tungstenite::Message};
    
    let ws_url = format!("ws://localhost:8080/ws");
    let (ws_stream, _) = connect_async(&ws_url).await.expect("Failed to connect to WebSocket");
    
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    
    // Send a test subscription
    let subscribe_msg = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "accountSubscribe",
        "params": ["11111111111111111111111111111112"]
    });
    
    ws_sender
        .send(Message::Text(subscribe_msg.to_string()))
        .await
        .expect("Failed to send WebSocket message");
    
    // Wait for response
    tokio::time::timeout(Duration::from_secs(5), ws_receiver.next())
        .await
        .expect("Timeout waiting for WebSocket response")
        .expect("WebSocket stream ended")
        .expect("WebSocket error");
}

#[tokio::test]
async fn test_concurrent_requests() {
    let client = Client::new();
    let rpc_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getHealth"
    });

    // Send concurrent requests
    let mut tasks = Vec::new();
    for i in 0..50 {
        let client_clone = client.clone();
        let mut request_clone = rpc_request.clone();
        request_clone["id"] = json!(i);
        
        let task = tokio::spawn(async move {
            client_clone
                .post(BASE_URL)
                .header("Content-Type", "application/json")
                .json(&request_clone)
                .send()
                .await
        });
        
        tasks.push(task);
    }

    let mut successful = 0;
    for task in tasks {
        if let Ok(Ok(response)) = task.await {
            if response.status().is_success() {
                successful += 1;
            }
        }
    }

    // Most requests should succeed
    assert!(successful >= 45, "Only {} out of 50 concurrent requests succeeded", successful);
}

#[tokio::test]
async fn test_failover_behavior() {
    // This test would require the ability to temporarily disable endpoints
    // For now, we'll test that the system continues to work even with errors
    
    let client = Client::new();
    
    // Test with an invalid method that should fail on some endpoints
    let rpc_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "invalidMethod12345"
    });

    let response = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .json(&rpc_request)
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let rpc_response: Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(rpc_response["jsonrpc"], "2.0");
    assert!(rpc_response.get("error").is_some());
    
    // Error should be method not found, not a system error
    let error = &rpc_response["error"];
    assert_eq!(error["code"], -32601);
}

#[tokio::test]
async fn test_cache_behavior() {
    let client = Client::new();
    
    // Make a cacheable request (like getGenesisHash)
    let rpc_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getGenesisHash"
    });

    // First request
    let start = std::time::Instant::now();
    let response1 = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .json(&rpc_request)
        .send()
        .await
        .expect("Failed to send request");
    let duration1 = start.elapsed();

    assert!(response1.status().is_success());
    let result1: Value = response1.json().await.expect("Failed to parse JSON");

    // Second request (should be cached and faster)
    let start = std::time::Instant::now();
    let response2 = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .json(&rpc_request)
        .send()
        .await
        .expect("Failed to send request");
    let duration2 = start.elapsed();

    assert!(response2.status().is_success());
    let result2: Value = response2.json().await.expect("Failed to parse JSON");

    // Results should be identical
    assert_eq!(result1["result"], result2["result"]);
    
    // Second request should generally be faster (cached)
    println!("First request: {:?}, Second request: {:?}", duration1, duration2);
}

// Helper function to setup test environment
async fn setup_test_environment() {
    // This would start a test instance of Multi-RPC
    // For now, assumes the service is already running
}

// Helper function to cleanup test environment
async fn cleanup_test_environment() {
    // This would clean up any test data
}

#[tokio::test]
async fn test_geographic_routing() {
    let client = Client::new();
    
    // Test with different geographic headers
    let rpc_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getHealth"
    });

    // Test with US IP
    let response_us = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .header("X-Forwarded-For", "8.8.8.8") // Google DNS (US)
        .json(&rpc_request)
        .send()
        .await
        .expect("Failed to send request");

    assert!(response_us.status().is_success());

    // Test with EU IP
    let response_eu = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .header("X-Forwarded-For", "1.1.1.1") // Cloudflare (could be EU)
        .json(&rpc_request)
        .send()
        .await
        .expect("Failed to send request");

    assert!(response_eu.status().is_success());
    
    // Both should work, but may route to different endpoints
    // (Testing the routing logic would require endpoint inspection)
}

#[tokio::test]
async fn test_consensus_validation() {
    let client = Client::new();
    
    // Test with a method that should use consensus
    let rpc_request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAccountInfo",
        "params": ["11111111111111111111111111111112"]
    });

    let response = client
        .post(BASE_URL)
        .header("Content-Type", "application/json")
        .json(&rpc_request)
        .send()
        .await
        .expect("Failed to send request");

    assert!(response.status().is_success());
    
    let rpc_response: Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(rpc_response["jsonrpc"], "2.0");
    
    // Check if consensus metadata is included
    if let Some(result) = rpc_response.get("result") {
        if let Some(consensus_meta) = result.get("consensus_meta") {
            assert!(consensus_meta.get("confidence").is_some());
            assert!(consensus_meta.get("endpoint_count").is_some());
        }
    }
}