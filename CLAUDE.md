# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-RPC is an enterprise-grade Solana RPC aggregation system written in Rust that provides high availability and intelligent request routing across multiple RPC endpoints.

## Essential Commands

### Build and Run
```bash
# Development build
cargo build

# Production build
cargo build --release

# Run with default config
cargo run --release

# Run with Docker
docker build -t multi-rpc .
docker run -p 8080:8080 -e RPC_ENDPOINTS="https://api.mainnet-beta.solana.com" multi-rpc

# Run full stack (includes Redis, PostgreSQL, monitoring)
docker-compose up -d
```

### Testing
```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

### Linting and Formatting
```bash
# Format code
cargo fmt

# Check formatting
cargo fmt -- --check

# Run clippy linter
cargo clippy -- -D warnings
```

## Architecture Overview

The codebase follows a modular architecture with clear separation of concerns:

- **Core Request Flow**: `main.rs` → `router.rs` → `endpoints.rs` → RPC providers
- **Health Monitoring**: Background service in `health.rs` continuously checks endpoint availability
- **Load Balancing**: Multiple strategies implemented in `router.rs` (health-based, round-robin, weighted, latency-based)
- **WebSocket Support**: Handled separately in `websocket.rs` for subscription management
- **Caching Layer**: Redis integration in `cache.rs` for response caching
- **Authentication**: JWT-based auth in `auth.rs` with role-based access control
- **Metrics**: Prometheus metrics exposed via `metrics.rs`

### Key Dependencies
- **Web Framework**: Axum 0.7 (async web framework)
- **Async Runtime**: Tokio
- **Database**: SQLx with PostgreSQL
- **Caching**: Redis
- **Serialization**: Serde/serde_json

## Configuration

The system can be configured via `config.toml` or environment variables:

```toml
[server]
bind_address = "0.0.0.0:8080"

[[endpoints]]
url = "https://api.mainnet-beta.solana.com"
weight = 1
priority = 1
```

Environment variables take precedence over config file.

## Development Patterns

1. **Error Handling**: Uses `anyhow` for error propagation with `Result<T>` returns
2. **Async/Await**: All network operations are async using Tokio
3. **State Management**: Shared state via `Arc<RwLock<T>>` for thread-safe access
4. **Request Routing**: Implements various load balancing algorithms based on endpoint health scores
5. **Testing**: Integration tests in `tests/integration_test.rs` cover all major functionality

## Current Development Phase

The project is in Phase 1 with core functionality complete. Phase 2 features (WebSocket subscriptions, caching, metrics) are partially implemented and being actively developed.