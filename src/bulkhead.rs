use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Semaphore, SemaphorePermit};
use tokio::time::timeout;
use dashmap::DashMap;
use tracing::{debug, warn, error, instrument};
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct BulkheadConfig {
    pub max_concurrent_calls: usize,
    pub max_wait_duration: Duration,
    pub metrics_window: Duration,
}

impl Default for BulkheadConfig {
    fn default() -> Self {
        Self {
            max_concurrent_calls: 10,
            max_wait_duration: Duration::from_secs(5),
            metrics_window: Duration::from_secs(60),
        }
    }
}

pub struct Bulkhead {
    name: String,
    semaphore: Arc<Semaphore>,
    config: BulkheadConfig,
    metrics: Arc<BulkheadMetrics>,
}

#[derive(Debug)]
struct BulkheadMetrics {
    accepted_count: std::sync::atomic::AtomicU64,
    rejected_count: std::sync::atomic::AtomicU64,
    active_count: std::sync::atomic::AtomicU32,
    total_duration: std::sync::atomic::AtomicU64,
    last_reset: std::sync::RwLock<Instant>,
}

impl BulkheadMetrics {
    fn new() -> Self {
        Self {
            accepted_count: std::sync::atomic::AtomicU64::new(0),
            rejected_count: std::sync::atomic::AtomicU64::new(0),
            active_count: std::sync::atomic::AtomicU32::new(0),
            total_duration: std::sync::atomic::AtomicU64::new(0),
            last_reset: std::sync::RwLock::new(Instant::now()),
        }
    }

    fn reset_if_needed(&self, window: Duration) {
        let last_reset = *self.last_reset.read().unwrap();
        if last_reset.elapsed() > window {
            if let Ok(mut guard) = self.last_reset.write() {
                if guard.elapsed() > window {
                    self.accepted_count.store(0, std::sync::atomic::Ordering::Relaxed);
                    self.rejected_count.store(0, std::sync::atomic::Ordering::Relaxed);
                    self.total_duration.store(0, std::sync::atomic::Ordering::Relaxed);
                    *guard = Instant::now();
                }
            }
        }
    }
}

impl Bulkhead {
    pub fn new(name: String, config: BulkheadConfig) -> Self {
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent_calls));
        Self {
            name,
            semaphore,
            config,
            metrics: Arc::new(BulkheadMetrics::new()),
        }
    }

    #[instrument(skip(self, operation), fields(bulkhead = %self.name))]
    pub async fn execute<F, Fut, T>(&self, operation: F) -> AppResult<T>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
    {
        // Reset metrics if needed
        self.metrics.reset_if_needed(self.config.metrics_window);

        // Try to acquire permit with timeout
        let permit = match timeout(
            self.config.max_wait_duration,
            self.semaphore.clone().acquire_owned()
        ).await {
            Ok(Ok(permit)) => permit,
            Ok(Err(_)) => {
                self.metrics.rejected_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                return Err(AppError::bulkhead(&format!("Bulkhead '{}' semaphore closed", self.name)));
            }
            Err(_) => {
                self.metrics.rejected_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                warn!(
                    bulkhead = %self.name,
                    max_wait_ms = self.config.max_wait_duration.as_millis(),
                    "Bulkhead wait timeout exceeded"
                );
                return Err(AppError::bulkhead(&format!(
                    "Bulkhead '{}' is full, wait timeout exceeded",
                    self.name
                )));
            }
        };

        // Execute operation with permit
        let _guard = BulkheadGuard::new(permit, self.metrics.clone());
        
        self.metrics.accepted_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        self.metrics.active_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        
        let start = Instant::now();
        debug!(
            bulkhead = %self.name,
            active = self.metrics.active_count.load(std::sync::atomic::Ordering::Relaxed),
            available = self.semaphore.available_permits(),
            "Executing operation in bulkhead"
        );
        
        let result = operation().await;
        
        let duration = start.elapsed();
        self.metrics.total_duration.fetch_add(
            duration.as_millis() as u64,
            std::sync::atomic::Ordering::Relaxed
        );
        
        result
    }

    pub fn available_permits(&self) -> usize {
        self.semaphore.available_permits()
    }

    pub fn is_full(&self) -> bool {
        self.semaphore.available_permits() == 0
    }

    pub fn active_calls(&self) -> u32 {
        self.metrics.active_count.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn get_metrics(&self) -> BulkheadStats {
        BulkheadStats {
            name: self.name.clone(),
            accepted_count: self.metrics.accepted_count.load(std::sync::atomic::Ordering::Relaxed),
            rejected_count: self.metrics.rejected_count.load(std::sync::atomic::Ordering::Relaxed),
            active_count: self.metrics.active_count.load(std::sync::atomic::Ordering::Relaxed),
            available_permits: self.semaphore.available_permits(),
            avg_duration_ms: {
                let total = self.metrics.total_duration.load(std::sync::atomic::Ordering::Relaxed);
                let count = self.metrics.accepted_count.load(std::sync::atomic::Ordering::Relaxed);
                if count > 0 {
                    total / count
                } else {
                    0
                }
            },
        }
    }
}

// RAII guard to ensure metrics are updated when operation completes
struct BulkheadGuard {
    _permit: tokio::sync::OwnedSemaphorePermit,
    metrics: Arc<BulkheadMetrics>,
}

impl BulkheadGuard {
    fn new(permit: tokio::sync::OwnedSemaphorePermit, metrics: Arc<BulkheadMetrics>) -> Self {
        Self {
            _permit: permit,
            metrics,
        }
    }
}

impl Drop for BulkheadGuard {
    fn drop(&mut self) {
        self.metrics.active_count.fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
    }
}

#[derive(Debug, Clone)]
pub struct BulkheadStats {
    pub name: String,
    pub accepted_count: u64,
    pub rejected_count: u64,
    pub active_count: u32,
    pub available_permits: usize,
    pub avg_duration_ms: u64,
}

// Thread pool bulkhead for CPU-bound operations
pub struct ThreadPoolBulkhead {
    name: String,
    pool: tokio::runtime::Runtime,
    semaphore: Arc<Semaphore>,
    config: BulkheadConfig,
    metrics: Arc<BulkheadMetrics>,
}

impl ThreadPoolBulkhead {
    pub fn new(name: String, config: BulkheadConfig) -> AppResult<Self> {
        let pool = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(config.max_concurrent_calls)
            .thread_name(&format!("bulkhead-{}", name))
            .enable_all()
            .build()
            .map_err(|e| AppError::internal(&format!("Failed to create thread pool: {}", e)))?;

        Ok(Self {
            name,
            pool,
            semaphore: Arc::new(Semaphore::new(config.max_concurrent_calls)),
            config,
            metrics: Arc::new(BulkheadMetrics::new()),
        })
    }

    pub async fn execute<F, T>(&self, operation: F) -> AppResult<T>
    where
        F: FnOnce() -> T + Send + 'static,
        T: Send + 'static,
    {
        // Try to acquire permit
        let permit = match timeout(
            self.config.max_wait_duration,
            self.semaphore.clone().acquire_owned()
        ).await {
            Ok(Ok(permit)) => permit,
            _ => {
                self.metrics.rejected_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                return Err(AppError::bulkhead(&format!("Thread pool bulkhead '{}' is full", self.name)));
            }
        };

        self.metrics.accepted_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        self.metrics.active_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

        let metrics = self.metrics.clone();
        let result = self.pool.spawn_blocking(move || {
            let _guard = BulkheadGuard::new(permit, metrics);
            operation()
        }).await
        .map_err(|e| AppError::internal(&format!("Thread pool execution failed: {}", e)))?;

        Ok(result)
    }
}

// Bulkhead manager for managing multiple bulkheads
pub struct BulkheadManager {
    bulkheads: DashMap<String, Arc<Bulkhead>>,
    default_config: BulkheadConfig,
}

impl BulkheadManager {
    pub fn new(default_config: BulkheadConfig) -> Self {
        Self {
            bulkheads: DashMap::new(),
            default_config,
        }
    }

    pub fn get_or_create(&self, name: &str) -> Arc<Bulkhead> {
        self.bulkheads
            .entry(name.to_string())
            .or_insert_with(|| {
                Arc::new(Bulkhead::new(name.to_string(), self.default_config.clone()))
            })
            .clone()
    }

    pub fn get_or_create_with_config(&self, name: &str, config: BulkheadConfig) -> Arc<Bulkhead> {
        self.bulkheads
            .entry(name.to_string())
            .or_insert_with(|| {
                Arc::new(Bulkhead::new(name.to_string(), config))
            })
            .clone()
    }

    pub fn remove(&self, name: &str) -> Option<Arc<Bulkhead>> {
        self.bulkheads.remove(name).map(|(_, v)| v)
    }

    pub fn get_all_stats(&self) -> Vec<BulkheadStats> {
        self.bulkheads
            .iter()
            .map(|entry| entry.value().get_metrics())
            .collect()
    }

    pub fn is_healthy(&self) -> bool {
        self.bulkheads.iter().all(|entry| {
            let bulkhead = entry.value();
            bulkhead.available_permits() > 0 || 
            bulkhead.active_calls() < bulkhead.config.max_concurrent_calls as u32
        })
    }
}

// Adaptive bulkhead that adjusts capacity based on performance
pub struct AdaptiveBulkhead {
    base_bulkhead: Arc<Bulkhead>,
    min_capacity: usize,
    max_capacity: usize,
    adjustment_interval: Duration,
    last_adjustment: std::sync::RwLock<Instant>,
    performance_history: std::sync::RwLock<Vec<f64>>,
}

impl AdaptiveBulkhead {
    pub fn new(
        name: String,
        min_capacity: usize,
        max_capacity: usize,
        initial_capacity: usize,
    ) -> Self {
        let config = BulkheadConfig {
            max_concurrent_calls: initial_capacity,
            ..Default::default()
        };
        
        Self {
            base_bulkhead: Arc::new(Bulkhead::new(name, config)),
            min_capacity,
            max_capacity,
            adjustment_interval: Duration::from_secs(30),
            last_adjustment: std::sync::RwLock::new(Instant::now()),
            performance_history: std::sync::RwLock::new(Vec::new()),
        }
    }

    pub async fn execute<F, Fut, T>(&self, operation: F) -> AppResult<T>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
    {
        self.adjust_capacity_if_needed();
        
        let start = Instant::now();
        let result = self.base_bulkhead.execute(operation).await;
        let duration = start.elapsed();
        
        // Record performance
        if let Ok(mut history) = self.performance_history.write() {
            history.push(duration.as_secs_f64());
            if history.len() > 100 {
                history.remove(0);
            }
        }
        
        result
    }

    fn adjust_capacity_if_needed(&self) {
        let should_adjust = {
            let last_adjustment = self.last_adjustment.read().unwrap();
            last_adjustment.elapsed() > self.adjustment_interval
        };

        if !should_adjust {
            return;
        }

        let (avg_duration, rejection_rate) = {
            let stats = self.base_bulkhead.get_metrics();
            let history = self.performance_history.read().unwrap();
            
            let avg_duration = if !history.is_empty() {
                history.iter().sum::<f64>() / history.len() as f64
            } else {
                0.0
            };
            
            let total = stats.accepted_count + stats.rejected_count;
            let rejection_rate = if total > 0 {
                stats.rejected_count as f64 / total as f64
            } else {
                0.0
            };
            
            (avg_duration, rejection_rate)
        };

        // Adjust capacity based on performance
        let current_capacity = self.base_bulkhead.config.max_concurrent_calls;
        let new_capacity = if rejection_rate > 0.1 {
            // High rejection rate: increase capacity
            (current_capacity + 1).min(self.max_capacity)
        } else if rejection_rate < 0.01 && avg_duration < 0.1 {
            // Low rejection rate and fast operations: decrease capacity
            (current_capacity.saturating_sub(1)).max(self.min_capacity)
        } else {
            current_capacity
        };

        if new_capacity != current_capacity {
            debug!(
                "Adjusting bulkhead capacity from {} to {} (rejection_rate: {:.2}%, avg_duration: {:.2}s)",
                current_capacity, new_capacity, rejection_rate * 100.0, avg_duration
            );
            // Note: In a real implementation, we'd need to recreate the bulkhead with new capacity
        }

        *self.last_adjustment.write().unwrap() = Instant::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_bulkhead_basic() {
        let config = BulkheadConfig {
            max_concurrent_calls: 2,
            ..Default::default()
        };
        let bulkhead = Bulkhead::new("test".to_string(), config);

        // Execute within capacity
        let result = bulkhead.execute(|| async { Ok::<_, AppError>(42) }).await;
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_bulkhead_rejection() {
        let config = BulkheadConfig {
            max_concurrent_calls: 1,
            max_wait_duration: Duration::from_millis(10),
            ..Default::default()
        };
        let bulkhead = Arc::new(Bulkhead::new("test".to_string(), config));

        // Fill the bulkhead
        let bulkhead_clone = bulkhead.clone();
        let long_task = tokio::spawn(async move {
            bulkhead_clone.execute(|| async {
                tokio::time::sleep(Duration::from_millis(100)).await;
                Ok::<_, AppError>(1)
            }).await
        });

        // Wait a bit to ensure first task has acquired the permit
        tokio::time::sleep(Duration::from_millis(5)).await;

        // This should be rejected
        let result = bulkhead.execute(|| async { Ok::<_, AppError>(2) }).await;
        assert!(matches!(result, Err(AppError::BulkheadFull(_))));

        // Wait for the first task to complete
        let _ = long_task.await;
    }

    #[tokio::test]
    async fn test_bulkhead_manager() {
        let manager = BulkheadManager::new(BulkheadConfig::default());

        let bulkhead1 = manager.get_or_create("service1");
        let bulkhead2 = manager.get_or_create("service1");

        // Should return the same bulkhead
        assert!(Arc::ptr_eq(&bulkhead1, &bulkhead2));

        let bulkhead3 = manager.get_or_create("service2");
        assert!(!Arc::ptr_eq(&bulkhead1, &bulkhead3));

        let stats = manager.get_all_stats();
        assert_eq!(stats.len(), 2);
    }
}