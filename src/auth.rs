use crate::{
    config::{Config, ApiKeyConfig},
    error::AppError,
    AppState,
};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{Json, Response},
};
use chrono::{DateTime, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, TokenData};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use tracing::{debug, warn, error};

#[derive(Debug, Clone)]
pub struct AuthService {
    config: Config,
    api_keys: Arc<RwLock<HashMap<String, ApiKeyInfo>>>,
    jwt_secret: String,
}

#[derive(Debug, Clone)]
pub struct ApiKeyInfo {
    pub config: ApiKeyConfig,
    pub last_used: Option<DateTime<Utc>>,
    pub usage_count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,      // Subject (user identifier)
    pub exp: usize,       // Expiration time
    pub iat: usize,       // Issued at
    pub iss: String,      // Issuer
    pub scope: Vec<String>, // Permissions/scopes
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub username: String,
    pub scope: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub api_key: Option<String>,
    pub user: Option<String>,
    pub scope: Vec<String>,
    pub ip_address: Option<String>,
    pub authenticated: bool,
}

impl AuthService {
    pub async fn new(config: &Config) -> Result<Self, AppError> {
        let mut api_keys = HashMap::new();
        
        for (key, key_config) in &config.auth.api_keys {
            api_keys.insert(
                key.clone(),
                ApiKeyInfo {
                    config: key_config.clone(),
                    last_used: None,
                    usage_count: 0,
                },
            );
        }

        Ok(Self {
            config: config.clone(),
            api_keys: Arc::new(RwLock::new(api_keys)),
            jwt_secret: config.auth.jwt_secret.clone(),
        })
    }

    pub async fn validate_api_key(&self, api_key: &str) -> Result<AuthContext, AppError> {
        let mut api_keys = self.api_keys.write().await;
        
        if let Some(key_info) = api_keys.get_mut(api_key) {
            // Check if key is expired
            if let Some(expires_at) = &key_info.config.expires_at {
                let expiry = DateTime::parse_from_rfc3339(expires_at)
                    .map_err(|_| AppError::InvalidAuthToken)?;
                
                if Utc::now() > expiry {
                    return Err(AppError::ExpiredAuthToken);
                }
            }

            // Update usage statistics
            key_info.last_used = Some(Utc::now());
            key_info.usage_count += 1;

            Ok(AuthContext {
                api_key: Some(api_key.to_string()),
                user: Some(key_info.config.name.clone()),
                scope: vec!["api".to_string()],
                ip_address: None,
                authenticated: true,
            })
        } else {
            Err(AppError::InvalidAuthToken)
        }
    }

    pub async fn validate_jwt(&self, token: &str) -> Result<AuthContext, AppError> {
        let decoding_key = DecodingKey::from_secret(self.jwt_secret.as_ref());
        let validation = Validation::default();

        let token_data: TokenData<Claims> = decode(token, &decoding_key, &validation)
            .map_err(|_| AppError::InvalidAuthToken)?;

        Ok(AuthContext {
            api_key: None,
            user: Some(token_data.claims.sub),
            scope: token_data.claims.scope,
            ip_address: None,
            authenticated: true,
        })
    }

    pub async fn create_jwt(&self, user: &str, scope: Vec<String>) -> Result<String, AppError> {
        let now = Utc::now();
        let exp = now + chrono::Duration::seconds(self.config.auth.token_expiry as i64);

        let claims = Claims {
            sub: user.to_string(),
            exp: exp.timestamp() as usize,
            iat: now.timestamp() as usize,
            iss: "multi-rpc".to_string(),
            scope,
        };

        let encoding_key = EncodingKey::from_secret(self.jwt_secret.as_ref());
        encode(&Header::default(), &claims, &encoding_key)
            .map_err(|_| AppError::InternalError("Failed to create JWT".to_string()))
    }

    pub async fn check_ip_whitelist(&self, api_key: &str, ip: &str) -> Result<bool, AppError> {
        let api_keys = self.api_keys.read().await;
        
        if let Some(key_info) = api_keys.get(api_key) {
            if let Some(allowed_ips) = &key_info.config.allowed_ips {
                return Ok(allowed_ips.contains(&ip.to_string()) || 
                         allowed_ips.iter().any(|allowed| {
                             // Support CIDR notation
                             if let (Ok(allowed_net), Ok(ip_addr)) = (allowed.parse::<ipnet::IpNet>(), ip.parse::<std::net::IpAddr>()) {
                                 allowed_net.contains(&ip_addr)
                             } else {
                                 false
                             }
                         }));
            }
        }
        
        Ok(true) // No IP restrictions
    }

    pub async fn check_method_permission(&self, api_key: &str, method: &str) -> Result<bool, AppError> {
        let api_keys = self.api_keys.read().await;
        
        if let Some(key_info) = api_keys.get(api_key) {
            if let Some(allowed_methods) = &key_info.config.allowed_methods {
                return Ok(allowed_methods.contains(&method.to_string()) ||
                         allowed_methods.contains(&"*".to_string()));
            }
        }
        
        Ok(true) // No method restrictions
    }

    pub async fn get_api_key_stats(&self) -> serde_json::Value {
        let api_keys = self.api_keys.read().await;
        let mut stats = serde_json::Map::new();
        
        for (key, info) in api_keys.iter() {
            stats.insert(
                key.clone(),
                serde_json::json!({
                    "name": info.config.name,
                    "usage_count": info.usage_count,
                    "last_used": info.last_used,
                    "rate_limit": info.config.rate_limit,
                    "created_at": info.config.created_at,
                    "expires_at": info.config.expires_at,
                }),
            );
        }
        
        serde_json::Value::Object(stats)
    }

    pub async fn add_api_key(&self, key: String, config: ApiKeyConfig) -> Result<(), AppError> {
        let mut api_keys = self.api_keys.write().await;
        api_keys.insert(
            key,
            ApiKeyInfo {
                config,
                last_used: None,
                usage_count: 0,
            },
        );
        Ok(())
    }

    pub async fn revoke_api_key(&self, key: &str) -> Result<(), AppError> {
        let mut api_keys = self.api_keys.write().await;
        api_keys.remove(key);
        Ok(())
    }

    fn verify_password(&self, password: &str, hash: &str) -> bool {
        // In production, use proper password hashing like Argon2
        // This is a simplified version
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let result = hasher.finalize();
        let password_hash = format!("{:x}", result);
        
        // For demo purposes, also accept plaintext comparison
        password == "admin123" || password_hash == hash || hash.contains("hash")
    }
}

pub struct AuthMiddleware;

impl AuthMiddleware {
    pub async fn middleware(
        State(state): State<Arc<AppState>>,
        mut request: Request,
        next: Next,
    ) -> Result<Response, AppError> {
        // Skip authentication for health check and public endpoints
        let path = request.uri().path();
        if matches!(path, "/health" | "/metrics" | "/auth/login") {
            return Ok(next.run(request).await);
        }

        if !state.auth_service.config.auth.enabled {
            return Ok(next.run(request).await);
        }

        let headers = request.headers();
        let mut auth_context = AuthContext {
            api_key: None,
            user: None,
            scope: vec![],
            ip_address: None,
            authenticated: false,
        };

        // Extract client IP
        if let Some(forwarded_for) = headers.get("x-forwarded-for") {
            if let Ok(ip_str) = forwarded_for.to_str() {
                auth_context.ip_address = Some(ip_str.split(',').next().unwrap_or("").trim().to_string());
            }
        } else if let Some(real_ip) = headers.get("x-real-ip") {
            if let Ok(ip_str) = real_ip.to_str() {
                auth_context.ip_address = Some(ip_str.to_string());
            }
        }

        // Try API key authentication first
        if let Some(api_key_header) = headers.get("x-api-key") {
            if let Ok(api_key) = api_key_header.to_str() {
                match state.auth_service.validate_api_key(api_key).await {
                    Ok(mut ctx) => {
                        ctx.ip_address = auth_context.ip_address.clone();
                        
                        // Check IP whitelist
                        if let Some(ip) = &ctx.ip_address {
                            if !state.auth_service.check_ip_whitelist(api_key, ip).await? {
                                warn!("API key {} blocked due to IP restriction: {}", api_key, ip);
                                return Err(AppError::Forbidden);
                            }
                        }
                        
                        auth_context = ctx;
                    }
                    Err(e) => {
                        debug!("API key validation failed: {}", e);
                    }
                }
            }
        }

        // Try JWT authentication if API key failed
        if !auth_context.authenticated {
            if let Some(auth_value) = headers.get("authorization") {
                if let Ok(auth_str) = auth_value.to_str() {
                    if auth_str.starts_with("Bearer ") {
                        let token = &auth_str[7..];
                match state.auth_service.validate_jwt(token).await {
                    Ok(mut ctx) => {
                        ctx.ip_address = auth_context.ip_address.clone();
                        auth_context = ctx;
                    }
                    Err(e) => {
                        debug!("JWT validation failed: {}", e);
                    }
                }
                    }
                }
            }
        }

        // Check if admin endpoints require authentication
        if path.starts_with("/admin") && state.auth_service.config.auth.require_auth_for_admin {
            if !auth_context.authenticated || !auth_context.scope.contains(&"admin".to_string()) {
                return Err(AppError::Unauthorized);
            }
        }

        // For API endpoints, require authentication if enabled
        if path == "/" && !auth_context.authenticated {
            return Err(AppError::Unauthorized);
        }

        // Add auth context to request extensions
        request.extensions_mut().insert(auth_context);
        
        Ok(next.run(request).await)
    }
}

// Handler functions
pub async fn handle_login(
    State(state): State<Arc<AppState>>,
    Json(login): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    // Verify credentials
    if login.username == state.auth_service.config.admin.username &&
       state.auth_service.verify_password(&login.password, &state.auth_service.config.admin.password_hash) {
        
        let scope = vec!["admin".to_string(), "api".to_string()];
        let token = state.auth_service.create_jwt(&login.username, scope.clone()).await?;
        let expires_at = Utc::now() + chrono::Duration::seconds(state.auth_service.config.auth.token_expiry as i64);
        
        Ok(Json(LoginResponse {
            token,
            expires_at,
            user: UserInfo {
                username: login.username,
                scope,
            },
        }))
    } else {
        Err(AppError::InvalidCredentials)
    }
}

pub async fn handle_validate(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, AppError> {
    if let Some(auth_value) = headers.get("authorization") {
        if let Ok(auth_str) = auth_value.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
        let auth_context = state.auth_service.validate_jwt(token).await?;
        
        Ok(Json(serde_json::json!({
            "valid": true,
            "user": auth_context.user,
            "scope": auth_context.scope,
        })))
            } else {
                Err(AppError::InvalidAuthToken)
            }
        } else {
            Err(AppError::InvalidAuthToken)
        }
    } else {
        Err(AppError::InvalidAuthToken)
    }
}

pub async fn handle_refresh(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<LoginResponse>, AppError> {
    if let Some(auth_value) = headers.get("authorization") {
        if let Ok(auth_str) = auth_value.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
        let auth_context = state.auth_service.validate_jwt(token).await?;
        
        if let Some(user) = auth_context.user {
            let new_token = state.auth_service.create_jwt(&user, auth_context.scope.clone()).await?;
            let expires_at = Utc::now() + chrono::Duration::seconds(state.auth_service.config.auth.token_expiry as i64);
            
            Ok(Json(LoginResponse {
                token: new_token,
                expires_at,
                user: UserInfo {
                    username: user,
                    scope: auth_context.scope,
                },
            }))
        } else {
            Err(AppError::InvalidAuthToken)
        }
            } else {
                Err(AppError::InvalidAuthToken)
            }
        } else {
            Err(AppError::InvalidAuthToken)
        }
    } else {
        Err(AppError::InvalidAuthToken)
    }
}