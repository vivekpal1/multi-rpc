use crate::{
    endpoints::EndpointManager,
    error::AppError,
    types::RpcRequest,
};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{
    stream::{SplitSink, SplitStream},
    SinkExt, StreamExt,
};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::{
    sync::{RwLock, broadcast, mpsc},
    time::{interval, timeout},
    select,
};
use tokio_tungstenite::{connect_async, tungstenite::Message as TungsteniteMessage};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct WebSocketService {
    endpoint_manager: Arc<EndpointManager>,
    connections: Arc<RwLock<HashMap<Uuid, ConnectionInfo>>>,
    subscriptions: Arc<RwLock<HashMap<String, SubscriptionInfo>>>,
    connection_counter: Arc<AtomicU64>,
    broadcast_tx: broadcast::Sender<BroadcastMessage>,
}

#[derive(Debug, Clone)]
struct ConnectionInfo {
    id: Uuid,
    subscriptions: Vec<String>,
    last_ping: chrono::DateTime<chrono::Utc>,
    client_ip: Option<String>,
}

#[derive(Debug, Clone)]
struct SubscriptionInfo {
    id: String,
    connection_id: Uuid,
    method: String,
    params: Value,
    endpoint_subscriptions: HashMap<Uuid, String>, // endpoint_id -> subscription_id
}

#[derive(Debug, Clone)]
struct BroadcastMessage {
    subscription_id: String,
    data: Value,
}

#[derive(Debug, Clone)]
pub struct EndpointWebSocket {
    endpoint_id: Uuid,
    url: String,
    subscriptions: Arc<RwLock<HashMap<String, String>>>, // our_sub_id -> endpoint_sub_id
    tx: mpsc::UnboundedSender<TungsteniteMessage>,
}

impl WebSocketService {
    pub fn new(endpoint_manager: Arc<EndpointManager>) -> Self {
        let (broadcast_tx, _) = broadcast::channel(10000);
        
        Self {
            endpoint_manager,
            connections: Arc::new(RwLock::new(HashMap::new())),
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            connection_counter: Arc::new(AtomicU64::new(0)),
            broadcast_tx,
        }
    }

    pub async fn handle_connection(self: Arc<Self>, mut socket: WebSocket) {
        let connection_id = Uuid::new_v4();
        let count = self.connection_counter.fetch_add(1, Ordering::Relaxed) + 1;
        
        info!("New WebSocket connection: {} (total: {})", connection_id, count);

        // Check connection limit
        if count > 1000 { // TODO: make configurable
            warn!("Connection limit exceeded, rejecting connection: {}", connection_id);
            // Send error message directly
            let error_msg = json!({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32000,
                    "message": "Connection limit exceeded"
                },
                "id": null
            });
            let _ = socket.send(Message::Text(error_msg.to_string())).await;
            return;
        }

        let conn_info = ConnectionInfo {
            id: connection_id,
            subscriptions: Vec::new(),
            last_ping: chrono::Utc::now(),
            client_ip: None,
        };

        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_id, conn_info);
        }

        // Split the WebSocket into sender and receiver
        let (mut sender, receiver) = socket.split();
        
        // Create channels for internal communication
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        // Spawn task to handle outgoing messages
        let service_clone = self.clone();
        let sender_task = tokio::spawn(async move {
            let mut broadcast_rx = service_clone.broadcast_tx.subscribe();
            let mut ping_interval = interval(Duration::from_secs(30));
            
            loop {
                select! {
                    // Handle internal messages
                    msg = rx.recv() => {
                        match msg {
                            Some(message) => {
                                if sender.send(message).await.is_err() {
                                    break;
                                }
                            }
                            None => break,
                        }
                    }
                    
                    // Handle broadcast messages
                    broadcast_msg = broadcast_rx.recv() => {
                        match broadcast_msg {
                            Ok(msg) => {
                                let response = json!({
                                    "jsonrpc": "2.0",
                                    "method": "subscription",
                                    "params": {
                                        "subscription": msg.subscription_id,
                                        "result": msg.data
                                    }
                                });
                                
                                let ws_msg = Message::Text(response.to_string());
                                if sender.send(ws_msg).await.is_err() {
                                    break;
                                }
                            }
                            Err(_) => break,
                        }
                    }
                    
                    // Send periodic pings
                    _ = ping_interval.tick() => {
                        let ping_msg = Message::Ping(vec![]);
                        if sender.send(ping_msg).await.is_err() {
                            break;
                        }
                    }
                }
            }
        });

        // Handle incoming messages
        let service_for_incoming = self.clone();
        service_for_incoming.handle_incoming_messages(connection_id, receiver, tx).await;

        // Cleanup
        sender_task.abort();
        self.cleanup_connection(connection_id).await;
        
        let count = self.connection_counter.fetch_sub(1, Ordering::Relaxed) - 1;
        info!("WebSocket connection closed: {} (remaining: {})", connection_id, count);
    }

    async fn handle_incoming_messages(
        self: Arc<Self>,
        connection_id: Uuid,
        mut receiver: SplitStream<WebSocket>,
        tx: mpsc::UnboundedSender<Message>,
    ) {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Err(e) = self.handle_text_message(connection_id, &text, &tx).await {
                        error!("Error handling WebSocket message: {}", e);
                        let error_response = json!({
                            "jsonrpc": "2.0",
                            "id": null,
                            "error": {
                                "code": -32603,
                                "message": "Internal error",
                                "data": e.to_string()
                            }
                        });
                        let _ = tx.send(Message::Text(error_response.to_string()));
                    }
                }
                Ok(Message::Binary(_)) => {
                    warn!("Received binary message, not supported");
                }
                Ok(Message::Ping(data)) => {
                    let _ = tx.send(Message::Pong(data));
                }
                Ok(Message::Pong(_)) => {
                    // Update last ping time
                    if let Ok(mut connections) = self.connections.try_write() {
                        if let Some(conn) = connections.get_mut(&connection_id) {
                            conn.last_ping = chrono::Utc::now();
                        }
                    }
                }
                Ok(Message::Close(_)) => {
                    info!("WebSocket connection closed by client: {}", connection_id);
                    break;
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
            }
        }
    }

    async fn handle_text_message(
        &self,
        connection_id: Uuid,
        text: &str,
        tx: &mpsc::UnboundedSender<Message>,
    ) -> Result<(), AppError> {
        let request: Value = serde_json::from_str(text)?;
        
        // Handle batch requests
        if request.is_array() {
            let responses = self.handle_batch_request(connection_id, request).await?;
            let response_text = serde_json::to_string(&responses)?;
            tx.send(Message::Text(response_text)).map_err(|_| AppError::websocket("Failed to send response"))?;
            return Ok(());
        }

        // Handle single request
        let rpc_request: RpcRequest = serde_json::from_value(request.clone())?;
        
        match rpc_request.method.as_str() {
            // Subscription methods
            method if method.ends_with("Subscribe") => {
                let response = self.handle_subscribe(connection_id, &rpc_request).await?;
                let response_text = serde_json::to_string(&response)?;
                tx.send(Message::Text(response_text)).map_err(|_| AppError::websocket("Failed to send response"))?;
            }
            
            method if method.ends_with("Unsubscribe") => {
                let response = self.handle_unsubscribe(connection_id, &rpc_request).await?;
                let response_text = serde_json::to_string(&response)?;
                tx.send(Message::Text(response_text)).map_err(|_| AppError::websocket("Failed to send response"))?;
            }
            
            // Regular RPC methods - proxy to endpoints
            _ => {
                let response = self.handle_rpc_request(&rpc_request).await?;
                let response_text = serde_json::to_string(&response)?;
                tx.send(Message::Text(response_text)).map_err(|_| AppError::websocket("Failed to send response"))?;
            }
        }

        Ok(())
    }

    async fn handle_subscribe(
        &self,
        connection_id: Uuid,
        request: &RpcRequest,
    ) -> Result<Value, AppError> {
        let subscription_id = Uuid::new_v4().to_string();
        
        // Create subscription info
        let sub_info = SubscriptionInfo {
            id: subscription_id.clone(),
            connection_id,
            method: request.method.clone(),
            params: request.params.clone().unwrap_or(Value::Null),
            endpoint_subscriptions: HashMap::new(),
        };

        // Add to connection's subscription list
        {
            let mut connections = self.connections.write().await;
            if let Some(conn) = connections.get_mut(&connection_id) {
                conn.subscriptions.push(subscription_id.clone());
            }
        }

        // Store subscription
        {
            let mut subscriptions = self.subscriptions.write().await;
            subscriptions.insert(subscription_id.clone(), sub_info);
        }

        // Subscribe to multiple endpoints for redundancy
        self.create_endpoint_subscriptions(&subscription_id, request).await?;

        Ok(json!({
            "jsonrpc": "2.0",
            "id": request.id,
            "result": subscription_id
        }))
    }

    async fn handle_unsubscribe(
        &self,
        connection_id: Uuid,
        request: &RpcRequest,
    ) -> Result<Value, AppError> {
        let subscription_id = request.params
            .as_ref()
            .and_then(|p| p.as_array())
            .and_then(|arr| arr.first())
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::invalid_request("Missing subscription ID"))?;

        // Remove subscription
        let removed = {
            let mut subscriptions = self.subscriptions.write().await;
            subscriptions.remove(subscription_id).is_some()
        };

        // Remove from connection
        {
            let mut connections = self.connections.write().await;
            if let Some(conn) = connections.get_mut(&connection_id) {
                conn.subscriptions.retain(|id| id != subscription_id);
            }
        }

        // Cleanup endpoint subscriptions
        self.cleanup_endpoint_subscriptions(subscription_id).await;

        Ok(json!({
            "jsonrpc": "2.0",
            "id": request.id,
            "result": removed
        }))
    }

    async fn handle_rpc_request(&self, request: &RpcRequest) -> Result<Value, AppError> {
        // Use the main RPC router for non-subscription methods
        // This is a simplified version - in practice, you'd use the router
        let (endpoint_id, client) = self.endpoint_manager.select_endpoint().await?;
        
        let response = client
            .post(self.endpoint_manager.get_endpoint_url(endpoint_id).await.unwrap())
            .json(&json!({
                "jsonrpc": request.jsonrpc,
                "id": request.id,
                "method": request.method,
                "params": request.params
            }))
            .send()
            .await?;

        let response_json: Value = response.json().await?;
        Ok(response_json)
    }

    async fn handle_batch_request(
        &self,
        connection_id: Uuid,
        batch: Value,
    ) -> Result<Vec<Value>, AppError> {
        let requests = batch.as_array()
            .ok_or_else(|| AppError::invalid_request("Invalid batch request"))?;

        let mut responses = Vec::new();
        
        for request_value in requests {
            let request: RpcRequest = serde_json::from_value(request_value.clone())?;
            
            let response = match request.method.as_str() {
                method if method.ends_with("Subscribe") => {
                    self.handle_subscribe(connection_id, &request).await?
                }
                method if method.ends_with("Unsubscribe") => {
                    self.handle_unsubscribe(connection_id, &request).await?
                }
                _ => {
                    self.handle_rpc_request(&request).await?
                }
            };
            
            responses.push(response);
        }

        Ok(responses)
    }

    async fn create_endpoint_subscriptions(
        &self,
        subscription_id: &str,
        request: &RpcRequest,
    ) -> Result<(), AppError> {
        // Get healthy endpoints that support WebSocket
        let endpoints = self.endpoint_manager.get_endpoint_info().await;
        let ws_endpoints: Vec<_> = endpoints
            .into_iter()
            .filter(|e| e.status == crate::types::EndpointStatus::Healthy)
            .filter(|e| e.url.starts_with("wss://") || e.url.starts_with("ws://")) // WebSocket endpoints
            .take(3) // Subscribe to top 3 endpoints
            .collect();

        if ws_endpoints.is_empty() {
            return Err(AppError::websocket("No WebSocket endpoints available"));
        }

        for endpoint in ws_endpoints {
            self.create_single_endpoint_subscription(subscription_id, &endpoint.url, request).await?;
        }

        Ok(())
    }

    async fn create_single_endpoint_subscription(
        &self,
        _subscription_id: &str,
        endpoint_url: &str,
        _request: &RpcRequest,
    ) -> Result<(), AppError> {
        // Convert HTTP(S) URL to WebSocket URL
        let ws_url = endpoint_url.replace("https://", "wss://").replace("http://", "ws://");
        
        // This is a simplified implementation
        // In practice, you'd maintain persistent connections to endpoints
        debug!("Would create subscription to endpoint: {}", ws_url);
        
        Ok(())
    }

    async fn cleanup_endpoint_subscriptions(&self, _subscription_id: &str) {
        // Cleanup subscriptions on all endpoints
        debug!("Cleaning up endpoint subscriptions");
    }

    async fn cleanup_connection(&self, connection_id: Uuid) {
        // Remove connection
        let subscriptions = {
            let mut connections = self.connections.write().await;
            connections.remove(&connection_id)
                .map(|conn| conn.subscriptions)
                .unwrap_or_default()
        };

        // Cleanup all subscriptions for this connection
        {
            let mut subs = self.subscriptions.write().await;
            for sub_id in subscriptions {
                subs.remove(&sub_id);
                self.cleanup_endpoint_subscriptions(&sub_id).await;
            }
        }
    }

    async fn send_error(
        &self,
        _socket: &WebSocket,
        id: Option<Value>,
        code: i32,
        message: &str,
    ) -> Result<(), AppError> {
        let error_response = json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": {
                "code": code,
                "message": message
            }
        });
        
        // In practice, you'd send this through the socket
        debug!("Would send error: {}", error_response);
        Ok(())
    }

    pub async fn get_connection_stats(&self) -> serde_json::Value {
        let connections = self.connections.read().await;
        let subscriptions = self.subscriptions.read().await;
        
        json!({
            "total_connections": connections.len(),
            "total_subscriptions": subscriptions.len(),
            "connections_by_subscription_count": {
                // Group connections by number of subscriptions
            }
        })
    }
}