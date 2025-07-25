use std::future::Future;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use tracing::{debug, warn, error, instrument};
use rand::{thread_rng, Rng};
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub exponential_base: f64,
    pub jitter_factor: f64,
    pub timeout: Duration,
    pub circuit_breaker_threshold: u32,
    pub circuit_breaker_duration: Duration,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(30),
            exponential_base: 2.0,
            jitter_factor: 0.1,
            timeout: Duration::from_secs(30),
            circuit_breaker_threshold: 5,
            circuit_breaker_duration: Duration::from_secs(60),
        }
    }
}

pub enum RetryStrategy {
    Exponential,
    Linear,
    Fixed,
    Fibonacci,
    Custom(Box<dyn Fn(u32) -> Duration + Send + Sync>),
}

impl std::fmt::Debug for RetryStrategy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Exponential => write!(f, "Exponential"),
            Self::Linear => write!(f, "Linear"),
            Self::Fixed => write!(f, "Fixed"),
            Self::Fibonacci => write!(f, "Fibonacci"),
            Self::Custom(_) => write!(f, "Custom"),
        }
    }
}

impl Clone for RetryStrategy {
    fn clone(&self) -> Self {
        match self {
            Self::Exponential => Self::Exponential,
            Self::Linear => Self::Linear,
            Self::Fixed => Self::Fixed,
            Self::Fibonacci => Self::Fibonacci,
            Self::Custom(_) => panic!("Cannot clone Custom retry strategy"),
        }
    }
}

pub struct RetryPolicy {
    config: RetryConfig,
    strategy: RetryStrategy,
    current_attempt: u32,
    start_time: Instant,
    last_error: Option<String>,
    circuit_breaker_failures: u32,
    circuit_breaker_opened_at: Option<Instant>,
}

impl RetryPolicy {
    pub fn new(config: RetryConfig, strategy: RetryStrategy) -> Self {
        Self {
            config,
            strategy,
            current_attempt: 0,
            start_time: Instant::now(),
            last_error: None,
            circuit_breaker_failures: 0,
            circuit_breaker_opened_at: None,
        }
    }

    pub fn exponential() -> Self {
        Self::new(RetryConfig::default(), RetryStrategy::Exponential)
    }

    pub fn linear() -> Self {
        Self::new(RetryConfig::default(), RetryStrategy::Linear)
    }

    pub fn fixed() -> Self {
        Self::new(RetryConfig::default(), RetryStrategy::Fixed)
    }

    pub fn with_config(mut self, config: RetryConfig) -> Self {
        self.config = config;
        self
    }

    fn calculate_delay(&self, attempt: u32) -> Duration {
        let base_delay = match &self.strategy {
            RetryStrategy::Exponential => {
                let multiplier = self.config.exponential_base.powi(attempt as i32 - 1);
                Duration::from_secs_f64(
                    self.config.initial_delay.as_secs_f64() * multiplier
                )
            }
            RetryStrategy::Linear => {
                self.config.initial_delay * attempt
            }
            RetryStrategy::Fixed => {
                self.config.initial_delay
            }
            RetryStrategy::Fibonacci => {
                let fib = fibonacci(attempt);
                self.config.initial_delay * fib
            }
            RetryStrategy::Custom(f) => f(attempt),
        };

        // Apply jitter
        let jitter = if self.config.jitter_factor > 0.0 {
            let mut rng = thread_rng();
            let jitter_range = base_delay.as_secs_f64() * self.config.jitter_factor;
            let jitter = rng.gen_range(-jitter_range..=jitter_range);
            Duration::from_secs_f64(jitter)
        } else {
            Duration::from_secs(0)
        };

        // Apply max delay cap
        let final_delay = base_delay + jitter;
        if final_delay > self.config.max_delay {
            self.config.max_delay
        } else if final_delay < Duration::from_millis(0) {
            Duration::from_millis(0)
        } else {
            final_delay
        }
    }

    fn should_retry(&self, error: &AppError) -> bool {
        // Check if error is retryable
        if !error.is_retryable() {
            return false;
        }

        // Check max attempts
        if self.current_attempt >= self.config.max_attempts {
            return false;
        }

        // Check timeout
        if self.start_time.elapsed() > self.config.timeout {
            return false;
        }

        // Check circuit breaker
        if let Some(opened_at) = self.circuit_breaker_opened_at {
            if opened_at.elapsed() < self.config.circuit_breaker_duration {
                return false;
            }
        }

        true
    }

    pub async fn execute<F, Fut, T>(&mut self, mut operation: F) -> AppResult<T>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = AppResult<T>>,
    {
        loop {
            self.current_attempt += 1;

            // Check circuit breaker before attempting
            if let Some(opened_at) = self.circuit_breaker_opened_at {
                if opened_at.elapsed() < self.config.circuit_breaker_duration {
                    return Err(AppError::CircuitBreakerOpen);
                } else {
                    // Reset circuit breaker
                    self.circuit_breaker_opened_at = None;
                    self.circuit_breaker_failures = 0;
                }
            }

            debug!(
                attempt = self.current_attempt,
                max_attempts = self.config.max_attempts,
                "Executing operation"
            );

            match operation().await {
                Ok(result) => {
                    // Reset circuit breaker on success
                    self.circuit_breaker_failures = 0;
                    return Ok(result);
                }
                Err(error) => {
                    self.last_error = Some(error.to_string());
                    
                    if !self.should_retry(&error) {
                        warn!(
                            attempt = self.current_attempt,
                            error = ?error,
                            "Operation failed, not retrying"
                        );
                        return Err(error);
                    }

                    // Update circuit breaker
                    self.circuit_breaker_failures += 1;
                    if self.circuit_breaker_failures >= self.config.circuit_breaker_threshold {
                        warn!("Circuit breaker opened due to {} consecutive failures", self.circuit_breaker_failures);
                        self.circuit_breaker_opened_at = Some(Instant::now());
                        return Err(AppError::CircuitBreakerOpen);
                    }

                    let delay = self.calculate_delay(self.current_attempt);
                    warn!(
                        attempt = self.current_attempt,
                        delay_ms = delay.as_millis(),
                        error = ?error,
                        "Operation failed, retrying after delay"
                    );

                    sleep(delay).await;
                }
            }
        }
    }
}

// Hedged requests - send multiple requests and use the first successful response
#[derive(Debug)]
pub struct HedgedRequest {
    pub primary_delay: Duration,
    pub hedge_delay: Duration,
    pub max_hedges: usize,
}

impl HedgedRequest {
    pub fn new(primary_delay: Duration, hedge_delay: Duration, max_hedges: usize) -> Self {
        Self {
            primary_delay,
            hedge_delay,
            max_hedges,
        }
    }

    #[instrument(skip(operations))]
    pub async fn execute<F, Fut, T>(&self, operations: Vec<F>) -> AppResult<T>
    where
        F: Fn() -> Fut + Send + 'static,
        Fut: Future<Output = AppResult<T>> + Send + 'static,
        T: Send + 'static,
    {
        use tokio::select;
        use tokio::time::timeout;

        if operations.is_empty() {
            return Err(AppError::internal("No operations provided for hedged request"));
        }

        let mut futures: Vec<std::pin::Pin<Box<dyn Future<Output = Result<AppResult<T>, tokio::time::error::Elapsed>> + Send>>> = Vec::new();
        let mut hedge_count = 0;

        // Start primary request
        let primary = operations[0]();
        futures.push(Box::pin(timeout(self.primary_delay, primary)) as std::pin::Pin<Box<dyn Future<Output = Result<AppResult<T>, tokio::time::error::Elapsed>> + Send>>);

        loop {
            // Wait for any future to complete
            let (result, _index, mut remaining) = select_any(futures).await;

            match result {
                Ok(Ok(value)) => {
                    debug!(hedge_count, "Hedged request succeeded");
                    return Ok(value);
                }
                Ok(Err(timeout_err)) => {
                    // Timeout occurred, start a hedge if available
                    if hedge_count < self.max_hedges && hedge_count < operations.len() - 1 {
                        hedge_count += 1;
                        let hedge = operations[hedge_count]();
                        remaining.push(Box::pin(timeout(self.hedge_delay, hedge)) as std::pin::Pin<Box<dyn Future<Output = Result<AppResult<T>, tokio::time::error::Elapsed>> + Send>>);
                        futures = remaining;
                        debug!(hedge_count, "Starting hedge request");
                    } else if remaining.is_empty() {
                        return Err(AppError::RequestTimeout);
                    } else {
                        futures = remaining;
                    }
                }
                Err(elapsed) => {
                    warn!("Request timed out after {:?}", elapsed);
                    if hedge_count < self.max_hedges && hedge_count < operations.len() - 1 {
                        hedge_count += 1;
                        let hedge = operations[hedge_count]();
                        remaining.push(Box::pin(timeout(self.hedge_delay, hedge)) as std::pin::Pin<Box<dyn Future<Output = Result<AppResult<T>, tokio::time::error::Elapsed>> + Send>>);
                        futures = remaining;
                    } else if remaining.is_empty() {
                        return Err(AppError::RequestTimeout);
                    } else {
                        futures = remaining;
                    }
                }
            }
        }
    }
}

// Helper function to select the first completed future
async fn select_any<T>(
    futures: Vec<std::pin::Pin<Box<dyn Future<Output = T> + Send>>>,
) -> (T, usize, Vec<std::pin::Pin<Box<dyn Future<Output = T> + Send>>>) {
    use futures::future::select_all;
    
    let (result, index, remaining) = select_all(futures).await;
    (result, index, remaining)
}

// Fibonacci sequence generator
fn fibonacci(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        _ => {
            let mut a = 0;
            let mut b = 1;
            for _ in 2..=n {
                let temp = a + b;
                a = b;
                b = temp;
            }
            b
        }
    }
}

// Retry with fallback
pub struct RetryWithFallback {
    primary_policy: RetryPolicy,
    fallback_policy: RetryPolicy,
}

impl RetryWithFallback {
    pub fn new(primary_policy: RetryPolicy, fallback_policy: RetryPolicy) -> Self {
        Self {
            primary_policy,
            fallback_policy,
        }
    }

    pub async fn execute<F1, F2, Fut1, Fut2, T>(
        mut self,
        mut primary: F1,
        mut fallback: F2,
    ) -> AppResult<T>
    where
        F1: FnMut() -> Fut1,
        Fut1: Future<Output = AppResult<T>>,
        F2: FnMut() -> Fut2,
        Fut2: Future<Output = AppResult<T>>,
    {
        match self.primary_policy.execute(&mut primary).await {
            Ok(result) => Ok(result),
            Err(primary_error) => {
                warn!("Primary operation failed, attempting fallback: {:?}", primary_error);
                self.fallback_policy.execute(&mut fallback).await
                    .map_err(|fallback_error| {
                        error!("Both primary and fallback operations failed");
                        AppError::internal(&format!(
                            "Primary: {:?}, Fallback: {:?}", 
                            primary_error, 
                            fallback_error
                        ))
                    })
            }
        }
    }
}

// Adaptive retry that adjusts strategy based on error patterns
pub struct AdaptiveRetry {
    base_config: RetryConfig,
    success_count: u32,
    failure_count: u32,
    last_adjustment: Instant,
    adjustment_interval: Duration,
}

impl AdaptiveRetry {
    pub fn new(base_config: RetryConfig) -> Self {
        Self {
            base_config,
            success_count: 0,
            failure_count: 0,
            last_adjustment: Instant::now(),
            adjustment_interval: Duration::from_secs(60),
        }
    }

    fn adjust_config(&mut self) -> RetryConfig {
        if self.last_adjustment.elapsed() < self.adjustment_interval {
            return self.base_config.clone();
        }

        let total = self.success_count + self.failure_count;
        if total == 0 {
            return self.base_config.clone();
        }

        let failure_rate = self.failure_count as f64 / total as f64;
        let mut config = self.base_config.clone();

        // Adjust retry parameters based on failure rate
        if failure_rate > 0.5 {
            // High failure rate: be more aggressive
            config.max_attempts = (config.max_attempts + 1).min(10);
            config.initial_delay = config.initial_delay * 2;
            config.jitter_factor = (config.jitter_factor + 0.1).min(0.5);
        } else if failure_rate < 0.1 {
            // Low failure rate: be less aggressive
            config.max_attempts = (config.max_attempts - 1).max(1);
            config.initial_delay = config.initial_delay / 2;
            config.jitter_factor = (config.jitter_factor - 0.05).max(0.0);
        }

        // Reset counters
        self.success_count = 0;
        self.failure_count = 0;
        self.last_adjustment = Instant::now();

        debug!(
            failure_rate,
            max_attempts = config.max_attempts,
            initial_delay_ms = config.initial_delay.as_millis(),
            "Adjusted retry configuration"
        );

        config
    }

    pub async fn execute<F, Fut, T>(&mut self, operation: F) -> AppResult<T>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = AppResult<T>>,
    {
        let config = self.adjust_config();
        let mut policy = RetryPolicy::new(config, RetryStrategy::Exponential);
        
        match policy.execute(operation).await {
            Ok(result) => {
                self.success_count += 1;
                Ok(result)
            }
            Err(error) => {
                self.failure_count += 1;
                Err(error)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_exponential_retry() {
        let mut attempt = 0;
        let mut policy = RetryPolicy::exponential()
            .with_config(RetryConfig {
                max_attempts: 3,
                initial_delay: Duration::from_millis(100),
                ..Default::default()
            });

        let result = policy.execute(|| async {
            attempt += 1;
            if attempt < 3 {
                Err(AppError::NetworkError(reqwest::Error::new()))
            } else {
                Ok(42)
            }
        }).await;

        assert_eq!(result.unwrap(), 42);
        assert_eq!(attempt, 3);
    }

    #[test]
    fn test_fibonacci_sequence() {
        assert_eq!(fibonacci(0), 0);
        assert_eq!(fibonacci(1), 1);
        assert_eq!(fibonacci(2), 1);
        assert_eq!(fibonacci(3), 2);
        assert_eq!(fibonacci(4), 3);
        assert_eq!(fibonacci(5), 5);
        assert_eq!(fibonacci(6), 8);
    }

    #[tokio::test]
    async fn test_circuit_breaker() {
        let mut policy = RetryPolicy::exponential()
            .with_config(RetryConfig {
                max_attempts: 10,
                circuit_breaker_threshold: 3,
                circuit_breaker_duration: Duration::from_millis(100),
                ..Default::default()
            });

        let mut attempt = 0;
        let result = policy.execute(|| async {
            attempt += 1;
            Err(AppError::NetworkError(reqwest::Error::new()))
        }).await;

        assert!(matches!(result, Err(AppError::CircuitBreakerOpen)));
        assert_eq!(attempt, 3); // Should stop after circuit breaker threshold
    }
}