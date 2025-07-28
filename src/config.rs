use serde::{Deserialize, Serialize};
use std::time::Duration;
use crate::error::AppError;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub bind_address: String,
    pub endpoints: Vec<EndpointConfig>,
    pub health_check_interval: u64,
    pub request_timeout: u64,
    pub max_retries: usize,
    pub auth: AuthConfig,
    pub cache: CacheConfig,
    pub consensus: ConsensusConfig,
    pub geo: GeoConfig,
    pub metrics: MetricsConfig,
    pub rate_limiting: RateLimitConfig,
    pub websocket: WebSocketConfig,
    pub admin: AdminConfig,
    pub discovery: DiscoveryConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointConfig {
    pub url: String,
    pub name: String,
    pub weight: u32,
    pub priority: u8,
    pub region: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub features: Vec<String>,
    pub max_connections: Option<u32>,
    pub auth_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub enabled: bool,
    pub jwt_secret: String,
    pub token_expiry: u64,
    pub api_keys: HashMap<String, ApiKeyConfig>,
    pub require_auth_for_admin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyConfig {
    pub name: String,
    pub rate_limit: u32,
    pub allowed_methods: Option<Vec<String>>,
    pub allowed_ips: Option<Vec<String>>,
    pub created_at: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub enabled: bool,
    pub redis_url: String,
    pub default_ttl: u64,
    pub max_cache_size: u64,
    pub cluster_mode: bool,
    pub method_ttls: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusConfig {
    pub enabled: bool,
    pub min_confirmations: u32,
    pub timeout_ms: u64,
    pub critical_methods: Vec<String>,
    pub consensus_threshold: f64,
    pub max_deviation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoConfig {
    pub enabled: bool,
    pub geoip_database_path: String,
    pub prefer_local_endpoints: bool,
    pub max_latency_penalty_ms: u64,
    pub region_weights: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    pub enabled: bool,
    pub prometheus_enabled: bool,
    pub detailed_logging: bool,
    pub retention_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub enabled: bool,
    pub default_rate: u32,
    pub default_burst: u32,
    pub per_method_limits: HashMap<String, RateLimit>,
    pub per_ip_limits: HashMap<String, RateLimit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimit {
    pub rate: u32,
    pub burst: u32,
    pub window_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketConfig {
    pub enabled: bool,
    pub max_connections: u32,
    pub ping_interval: u64,
    pub connection_timeout: u64,
    pub max_subscriptions_per_connection: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminConfig {
    pub enabled: bool,
    pub bind_address: Option<String>,
    pub username: String,
    pub password_hash: String,
    pub session_timeout: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryConfig {
    pub enabled: bool,
    pub discovery_interval: u64,
    pub test_methods: Vec<String>,
    pub min_score_threshold: f64,
    pub auto_add_endpoints: bool,
    pub cluster_rpc_urls: Vec<String>,
}

impl Default for Config {
    fn default() -> Self {
        let mut api_keys = HashMap::new();
        api_keys.insert(
            "demo_key_123".to_string(),
            ApiKeyConfig {
                name: "Demo API Key".to_string(),
                rate_limit: 1000,
                allowed_methods: None,
                allowed_ips: None,
                created_at: chrono::Utc::now().to_rfc3339(),
                expires_at: None,
            },
        );

        let mut method_ttls = HashMap::new();
        method_ttls.insert("getGenesisHash".to_string(), 3600);
        method_ttls.insert("getAccountInfo".to_string(), 10);
        method_ttls.insert("getBalance".to_string(), 5);
        method_ttls.insert("getBlockHeight".to_string(), 2);

        let mut per_method_limits = HashMap::new();
        per_method_limits.insert(
            "sendTransaction".to_string(),
            RateLimit {
                rate: 100,
                burst: 10,
                window_seconds: 60,
            },
        );

        let mut region_weights = HashMap::new();
        region_weights.insert("us-east".to_string(), 1.0);
        region_weights.insert("us-west".to_string(), 1.0);
        region_weights.insert("eu".to_string(), 0.8);
        region_weights.insert("asia".to_string(), 0.7);

        Self {
            bind_address: "0.0.0.0:8080".to_string(),
            endpoints: vec![
                EndpointConfig {
                    url: "https://api.mainnet-beta.solana.com".to_string(),
                    name: "Solana Labs".to_string(),
                    weight: 100,
                    priority: 1,
                    region: Some("us-east".to_string()),
                    latitude: Some(40.7128),
                    longitude: Some(-74.0060),
                    features: vec!["full".to_string(), "websocket".to_string()],
                    max_connections: Some(100),
                    auth_token: None,
                },
                EndpointConfig {
                    url: "https://rpc.ankr.com/solana".to_string(),
                    name: "Ankr".to_string(),
                    weight: 85,
                    priority: 3,
                    region: Some("global".to_string()),
                    latitude: None,
                    longitude: None,
                    features: vec!["full".to_string()],
                    max_connections: Some(50),
                    auth_token: None,
                },
            ],
            health_check_interval: 30,
            request_timeout: 10,
            max_retries: 3,
            auth: AuthConfig {
                enabled: false,  // Disabled by default for easier deployment
                jwt_secret: "your_jwt_secret_here_change_in_production".to_string(),
                token_expiry: 3600,
                api_keys,
                require_auth_for_admin: false,  // Disabled by default
            },
            cache: CacheConfig {
                enabled: false,  // Disabled by default - enable when Redis is available
                redis_url: "redis://localhost:6379".to_string(),
                default_ttl: 60,
                max_cache_size: 1024 * 1024 * 100, // 100MB
                cluster_mode: false,
                method_ttls,
            },
            consensus: ConsensusConfig {
                enabled: true,
                min_confirmations: 2,
                timeout_ms: 5000,
                critical_methods: vec![
                    "sendTransaction".to_string(),
                    "getAccountInfo".to_string(),
                    "getBalance".to_string(),
                ],
                consensus_threshold: 0.67,
                max_deviation: 0.1,
            },
            geo: GeoConfig {
                enabled: false,  // Disabled by default - enable when GeoIP database is available
                geoip_database_path: "./GeoLite2-City.mmdb".to_string(),
                prefer_local_endpoints: true,
                max_latency_penalty_ms: 200,
                region_weights,
            },
            metrics: MetricsConfig {
                enabled: true,
                prometheus_enabled: true,
                detailed_logging: false,
                retention_days: 30,
            },
            rate_limiting: RateLimitConfig {
                enabled: true,
                default_rate: 1000,
                default_burst: 100,
                per_method_limits,
                per_ip_limits: HashMap::new(),
            },
            websocket: WebSocketConfig {
                enabled: true,
                max_connections: 1000,
                ping_interval: 30,
                connection_timeout: 300,
                max_subscriptions_per_connection: 100,
            },
            admin: AdminConfig {
                enabled: true,
                bind_address: None,
                username: "admin".to_string(),
                password_hash: "$argon2id$v=19$m=65536,t=3,p=4$hash".to_string(), // password: admin123
                session_timeout: 3600,
            },
            discovery: DiscoveryConfig {
                enabled: true,
                discovery_interval: 300,
                test_methods: vec![
                    "getHealth".to_string(),
                    "getSlot".to_string(),
                    "getVersion".to_string(),
                ],
                min_score_threshold: 0.7,
                auto_add_endpoints: false,
                cluster_rpc_urls: vec![
                    "https://api.mainnet-beta.solana.com".to_string(),
                ],
            },
        }
    }
}

impl Config {
    pub async fn load() -> Result<Self, AppError> {
        // Try to load from config file first
        if let Ok(content) = tokio::fs::read_to_string("config.toml").await {
            let config: Config = toml::from_str(&content)
                .map_err(|e| AppError::ConfigError(format!("Failed to parse config.toml: {}", e)))?;
            
            // Validate configuration
            config.validate()?;
            return Ok(config);
        }

        // Try environment variables
        let mut config = Config::default();
        
        // Support Cloud Run's PORT environment variable
        if let Ok(port) = std::env::var("PORT") {
            config.bind_address = format!("0.0.0.0:{}", port);
        } else if let Ok(bind_addr) = std::env::var("BIND_ADDRESS") {
            config.bind_address = bind_addr;
        }
        
        if let Ok(endpoints_env) = std::env::var("RPC_ENDPOINTS") {
            config.endpoints = Self::parse_endpoints_from_env(&endpoints_env)?;
        }

        if let Ok(redis_url) = std::env::var("REDIS_URL") {
            config.cache.redis_url = redis_url;
        }

        if let Ok(jwt_secret) = std::env::var("JWT_SECRET") {
            config.auth.jwt_secret = jwt_secret;
        }

        config.validate()?;
        Ok(config)
    }
    
    fn validate(&self) -> Result<(), AppError> {
        if self.endpoints.is_empty() {
            eprintln!("WARNING: No endpoints configured. The server will start but won't be able to proxy requests.");
            eprintln!("Set RPC_ENDPOINTS environment variable with comma-separated RPC URLs.");
        }

        if self.auth.enabled && self.auth.jwt_secret.len() < 32 {
            return Err(AppError::ConfigError("JWT secret must be at least 32 characters".to_string()));
        }

        if self.consensus.enabled && self.consensus.min_confirmations < 2 {
            return Err(AppError::ConfigError("Consensus requires at least 2 confirmations".to_string()));
        }

        if self.consensus.consensus_threshold < 0.5 || self.consensus.consensus_threshold > 1.0 {
            return Err(AppError::ConfigError("Consensus threshold must be between 0.5 and 1.0".to_string()));
        }

        for endpoint in &self.endpoints {
            if endpoint.url.is_empty() {
                return Err(AppError::ConfigError("Endpoint URL cannot be empty".to_string()));
            }
            
            if !endpoint.url.starts_with("http://") && !endpoint.url.starts_with("https://") {
                return Err(AppError::ConfigError(format!("Invalid endpoint URL: {}", endpoint.url)));
            }
        }

        Ok(())
    }
    
    fn parse_endpoints_from_env(endpoints_str: &str) -> Result<Vec<EndpointConfig>, AppError> {
        let mut endpoints = Vec::new();
        
        for (i, url) in endpoints_str.split(',').enumerate() {
            let url = url.trim();
            if !url.is_empty() {
                endpoints.push(EndpointConfig {
                    url: url.to_string(),
                    name: format!("Endpoint-{}", i + 1),
                    weight: 100,
                    priority: (i + 1) as u8,
                    region: None,
                    latitude: None,
                    longitude: None,
                    features: vec!["full".to_string()],
                    max_connections: Some(50),
                    auth_token: None,
                });
            }
        }
        
        if endpoints.is_empty() {
            return Err(AppError::ConfigError("No valid endpoints found".to_string()));
        }
        
        Ok(endpoints)
    }
    
    pub fn health_check_duration(&self) -> Duration {
        Duration::from_secs(self.health_check_interval)
    }
    
    pub fn request_timeout_duration(&self) -> Duration {
        Duration::from_secs(self.request_timeout)
    }

    pub async fn reload(&mut self) -> Result<(), AppError> {
        let new_config = Self::load().await?;
        *self = new_config;
        Ok(())
    }

    pub async fn save(&self) -> Result<(), AppError> {
        let toml_content = toml::to_string_pretty(self)
            .map_err(|e| AppError::ConfigError(format!("Failed to serialize config: {}", e)))?;
        
        tokio::fs::write("config.toml", toml_content).await
            .map_err(|e| AppError::ConfigError(format!("Failed to write config file: {}", e)))?;
        
        Ok(())
    }
}