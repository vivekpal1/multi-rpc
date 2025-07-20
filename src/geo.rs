use crate::{
    config::{Config, GeoConfig},
    error::AppError,
    types::EndpointInfo,
};
use maxminddb::{geoip2, Reader};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    net::IpAddr,
    sync::Arc,
    time::Duration,
};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

#[derive(Debug, Clone)]
pub struct GeoService {
    config: GeoConfig,
    geoip_reader: Option<Arc<Reader<Vec<u8>>>>,
    region_cache: Arc<RwLock<HashMap<String, GeoLocation>>>,
    endpoint_distances: Arc<RwLock<HashMap<String, HashMap<String, f64>>>>, // client_region -> endpoint_id -> distance
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GeoLocation {
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone)]
pub struct GeoSortedEndpoint {
    pub endpoint: EndpointInfo,
    pub distance_km: Option<f64>,
    pub latency_penalty_ms: f64,
    pub region_weight: f64,
    pub score: f64,
}

impl GeoService {
    pub async fn new(config: &Config) -> Result<Self, AppError> {
        let geo_config = config.geo.clone();
        
        let geoip_reader = if geo_config.enabled {
            match Self::load_geoip_database(&geo_config.geoip_database_path).await {
                Ok(reader) => {
                    info!("GeoIP database loaded successfully");
                    Some(Arc::new(reader))
                }
                Err(e) => {
                    warn!("Failed to load GeoIP database: {}", e);
                    None
                }
            }
        } else {
            None
        };

        Ok(Self {
            config: geo_config,
            geoip_reader,
            region_cache: Arc::new(RwLock::new(HashMap::new())),
            endpoint_distances: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    async fn load_geoip_database(path: &str) -> Result<Reader<Vec<u8>>, AppError> {
        let data = tokio::fs::read(path).await
            .map_err(|e| AppError::GeoIpError(format!("Failed to read GeoIP database: {}", e)))?;
        
        Reader::from_source(data)
            .map_err(|e| AppError::GeoIpError(format!("Failed to parse GeoIP database: {}", e)))
    }

    pub async fn get_client_location(&self, ip: Option<&str>) -> Option<GeoLocation> {
        if !self.config.enabled {
            return None;
        }

        let ip_str = ip?;
        let ip_addr: IpAddr = ip_str.parse().ok()?;
        
        // Check cache first
        {
            let cache = self.region_cache.read().await;
            if let Some(location) = cache.get(ip_str) {
                return Some(location.clone());
            }
        }

        // Query GeoIP database
        if let Some(reader) = &self.geoip_reader {
            match reader.lookup::<geoip2::City>(ip_addr) {
                Ok(city) => {
                    let location = GeoLocation {
                        country: city.country
                            .and_then(|c| c.iso_code)
                            .map(|s| s.to_string()),
                        region: city.subdivisions
                            .as_ref()
                            .and_then(|subs| subs.get(0))
                            .and_then(|s| s.iso_code)
                            .map(|s| s.to_string()),
                        city: city.city
                            .as_ref()
                            .and_then(|c| c.names.as_ref())
                            .and_then(|names| names.get("en"))
                            .map(|s| s.to_string()),
                        latitude: city.location.as_ref()
                            .and_then(|l| l.latitude)
                            .map(|f| f as f64),
                        longitude: city.location.as_ref()
                            .and_then(|l| l.longitude)
                            .map(|f| f as f64),
                        timezone: city.location.as_ref()
                            .and_then(|l| l.time_zone.as_ref())
                            .map(|s| s.to_string()),
                    };

                    // Cache the result
                    {
                        let mut cache = self.region_cache.write().await;
                        cache.insert(ip_str.to_string(), location.clone());
                    }

                    debug!("GeoIP lookup for {}: {:?}", ip_str, location);
                    Some(location)
                }
                Err(e) => {
                    debug!("GeoIP lookup failed for {}: {}", ip_str, e);
                    None
                }
            }
        } else {
            None
        }
    }

    pub async fn get_geo_sorted_endpoints(&self, client_ip: Option<&str>) -> Value {
        let client_location = self.get_client_location(client_ip).await;
        
        // This would typically get endpoints from the endpoint manager
        // For now, we'll return a placeholder response
        json!({
            "client_location": client_location,
            "sorted_endpoints": [],
            "geo_routing_enabled": self.config.enabled,
        })
    }

    pub async fn sort_endpoints_by_proximity(
        &self,
        endpoints: Vec<EndpointInfo>,
        client_ip: Option<&str>,
    ) -> Vec<GeoSortedEndpoint> {
        if !self.config.enabled {
            // If geo routing is disabled, return endpoints sorted by priority
            return endpoints
                .into_iter()
                .map(|endpoint| GeoSortedEndpoint {
                    score: 100.0 - endpoint.priority as f64,
                    distance_km: None,
                    latency_penalty_ms: 0.0,
                    region_weight: 1.0,
                    endpoint,
                })
                .collect();
        }

        let client_location = self.get_client_location(client_ip).await;
        let mut sorted_endpoints = Vec::new();

        for endpoint in endpoints {
            let geo_endpoint = self.calculate_endpoint_score(&endpoint, &client_location).await;
            sorted_endpoints.push(geo_endpoint);
        }

        // Sort by score (highest first)
        sorted_endpoints.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

        sorted_endpoints
    }

    async fn calculate_endpoint_score(
        &self,
        endpoint: &EndpointInfo,
        client_location: &Option<GeoLocation>,
    ) -> GeoSortedEndpoint {
        let mut score = 100.0 - endpoint.priority as f64; // Base score from priority
        let mut distance_km = None;
        let mut latency_penalty_ms = 0.0;
        let mut region_weight = 1.0;

        // Calculate distance if both client and endpoint have coordinates
        if let (Some(client_loc), Some(ep_lat), Some(ep_lon)) = (
            client_location,
            endpoint.latitude,
            endpoint.longitude,
        ) {
            if let (Some(client_lat), Some(client_lon)) = (client_loc.latitude, client_loc.longitude) {
                let distance = self.calculate_distance(client_lat, client_lon, ep_lat, ep_lon);
                distance_km = Some(distance);

                // Apply distance penalty
                let distance_penalty = (distance / 1000.0).min(10.0); // Max 10 points penalty
                score -= distance_penalty;

                // Calculate latency penalty based on distance
                // Rough estimate: 1ms per 100km
                latency_penalty_ms = distance / 100.0;
                if latency_penalty_ms > self.config.max_latency_penalty_ms as f64 {
                    latency_penalty_ms = self.config.max_latency_penalty_ms as f64;
                }
            }
        }

        // Apply region weight
        if let Some(endpoint_region) = &endpoint.region {
            region_weight = self.config.region_weights
                .get(endpoint_region)
                .copied()
                .unwrap_or(1.0);
            score *= region_weight;
        }

        // Prefer local endpoints if enabled
        if self.config.prefer_local_endpoints {
            if let (Some(client_loc), Some(endpoint_region)) = (client_location, &endpoint.region) {
                if let Some(client_region) = &client_loc.region {
                    if client_region == endpoint_region {
                        score += 20.0; // Bonus for same region
                    }
                }
                if let Some(client_country) = &client_loc.country {
                    if endpoint_region.contains(client_country) {
                        score += 10.0; // Bonus for same country
                    }
                }
            }
        }

        // Apply endpoint weight
        score *= endpoint.weight as f64 / 100.0;

        GeoSortedEndpoint {
            endpoint: endpoint.clone(),
            distance_km,
            latency_penalty_ms,
            region_weight,
            score,
        }
    }

    fn calculate_distance(&self, lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
        // Haversine formula for calculating distance between two points on Earth
        let r = 6371.0; // Earth's radius in kilometers
        
        let dlat = (lat2 - lat1).to_radians();
        let dlon = (lon2 - lon1).to_radians();
        
        let a = (dlat / 2.0).sin().powi(2) +
                lat1.to_radians().cos() *
                lat2.to_radians().cos() *
                (dlon / 2.0).sin().powi(2);
        
        let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
        
        r * c
    }

    pub async fn get_region_stats(&self) -> Value {
        let cache = self.region_cache.read().await;
        let mut region_counts: HashMap<String, u32> = HashMap::new();
        let mut country_counts: HashMap<String, u32> = HashMap::new();

        for location in cache.values() {
            if let Some(region) = &location.region {
                *region_counts.entry(region.clone()).or_insert(0) += 1;
            }
            if let Some(country) = &location.country {
                *country_counts.entry(country.clone()).or_insert(0) += 1;
            }
        }

        json!({
            "enabled": self.config.enabled,
            "cached_locations": cache.len(),
            "region_distribution": region_counts,
            "country_distribution": country_counts,
            "config": {
                "prefer_local_endpoints": self.config.prefer_local_endpoints,
                "max_latency_penalty_ms": self.config.max_latency_penalty_ms,
                "region_weights": self.config.region_weights,
            }
        })
    }

    pub async fn update_endpoint_region_mapping(&self, endpoints: &[EndpointInfo]) {
        let mut distances = self.endpoint_distances.write().await;
        
        // Pre-calculate distances between all regions and endpoints
        for endpoint in endpoints {
            if let (Some(ep_lat), Some(ep_lon)) = (endpoint.latitude, endpoint.longitude) {
                for (region, _) in &self.config.region_weights {
                    // This is a simplified example - in practice you'd have
                    // a mapping of regions to coordinates
                    let region_coords = self.get_region_coordinates(region);
                    if let Some((reg_lat, reg_lon)) = region_coords {
                        let distance = self.calculate_distance(reg_lat, reg_lon, ep_lat, ep_lon);
                        
                        distances
                            .entry(region.clone())
                            .or_insert_with(HashMap::new)
                            .insert(endpoint.id.to_string(), distance);
                    }
                }
            }
        }
    }

    fn get_region_coordinates(&self, region: &str) -> Option<(f64, f64)> {
        // Approximate coordinates for major regions
        match region {
            "us-east" => Some((39.0458, -76.6413)), // Washington DC area
            "us-west" => Some((37.7749, -122.4194)), // San Francisco
            "eu" => Some((50.1109, 8.6821)), // Frankfurt
            "asia" => Some((35.6762, 139.6503)), // Tokyo
            "us-central" => Some((41.8781, -87.6298)), // Chicago
            "eu-west" => Some((51.5074, -0.1278)), // London
            "asia-pacific" => Some((1.3521, 103.8198)), // Singapore
            _ => None,
        }
    }

    pub async fn get_latency_estimates(&self, endpoint_ids: &[String], client_ip: Option<&str>) -> HashMap<String, f64> {
        let mut estimates = HashMap::new();
        let client_location = self.get_client_location(client_ip).await;

        if let Some(client_loc) = client_location {
            if let (Some(client_lat), Some(client_lon)) = (client_loc.latitude, client_loc.longitude) {
                let distances = self.endpoint_distances.read().await;
                
                for endpoint_id in endpoint_ids {
                    // Try to find pre-calculated distance
                    let mut found_distance = None;
                    for region_distances in distances.values() {
                        if let Some(&distance) = region_distances.get(endpoint_id) {
                            found_distance = Some(distance);
                            break;
                        }
                    }
                    
                    if let Some(distance) = found_distance {
                        // Estimate latency: base latency + distance penalty
                        let base_latency = 10.0; // Base latency in ms
                        let distance_latency = distance / 100.0; // 1ms per 100km
                        let estimated_latency = base_latency + distance_latency;
                        
                        estimates.insert(endpoint_id.clone(), estimated_latency);
                    }
                }
            }
        }

        estimates
    }

    pub async fn clear_cache(&self) {
        let mut cache = self.region_cache.write().await;
        cache.clear();
        
        let mut distances = self.endpoint_distances.write().await;
        distances.clear();
        
        info!("Geographic cache cleared");
    }

    pub async fn get_debug_info(&self) -> Value {
        let cache = self.region_cache.read().await;
        let distances = self.endpoint_distances.read().await;
        
        json!({
            "enabled": self.config.enabled,
            "geoip_database_loaded": self.geoip_reader.is_some(),
            "cached_locations": cache.len(),
            "region_distance_mappings": distances.len(),
            "config": {
                "database_path": self.config.geoip_database_path,
                "prefer_local_endpoints": self.config.prefer_local_endpoints,
                "max_latency_penalty_ms": self.config.max_latency_penalty_ms,
                "region_weights": self.config.region_weights,
            },
            "cache_summary": {
                "total_ips": cache.len(),
                "countries": cache.values()
                    .filter_map(|loc| loc.country.as_ref())
                    .collect::<std::collections::HashSet<_>>()
                    .len(),
                "regions": cache.values()
                    .filter_map(|loc| loc.region.as_ref())
                    .collect::<std::collections::HashSet<_>>()
                    .len(),
            }
        })
    }

    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    pub async fn get_client_region_preference(&self, client_ip: Option<&str>) -> Option<String> {
        if let Some(location) = self.get_client_location(client_ip).await {
            // Determine preferred region based on client location
            if let Some(country) = &location.country {
                return match country.as_str() {
                    "US" => {
                        // Determine US region based on longitude
                        if let Some(lon) = location.longitude {
                            if lon > -100.0 {
                                Some("us-east".to_string())
                            } else {
                                Some("us-west".to_string())
                            }
                        } else {
                            Some("us-east".to_string()) // Default to east
                        }
                    }
                    "CA" => Some("us-east".to_string()), // Canada -> US East
                    "GB" | "FR" | "DE" | "NL" | "IT" | "ES" => Some("eu".to_string()),
                    "JP" | "KR" | "CN" | "SG" | "AU" | "IN" => Some("asia".to_string()),
                    _ => None,
                };
            }
        }
        None
    }
}