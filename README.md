# Multi-RPC: Enterprise Solana RPC Aggregation System

A minimal but robust Solana RPC aggregation system that provides high availability and performance by intelligently routing requests across multiple RPC endpoints.

## 🚀 Features

- **Multiple RPC Endpoint Support**: Automatically manages and routes requests across multiple Solana RPC providers
- **Intelligent Load Balancing**: Health-based, round-robin, weighted, and latency-based routing strategies
- **Automatic Failover**: Seamless failover to healthy endpoints when others fail
- **Health Monitoring**: Continuous health checking with automatic endpoint status updates
- **Full Solana RPC Compatibility**: Drop-in replacement for any Solana RPC endpoint
- **Retry Logic**: Automatic retry with exponential backoff for failed requests
- **Performance Metrics**: Real-time statistics and performance monitoring
- **Batch Request Support**: Handle multiple RPC requests in a single call

## 📋 Prerequisites

- Rust 1.70+
- Internet connection for RPC endpoint access

## 🛠️ Installation & Setup

### 1. Clone and Build

```bash
git clone <repository-url>
cd multi-rpc
cargo build --release
```

### 2. Configuration

Create a `config.toml` file (example provided) or set environment variables:

```bash
# Using environment variables
export BIND_ADDRESS="0.0.0.0:8080"
export RPC_ENDPOINTS="https://api.mainnet-beta.solana.com,https://rpc.ankr.com/solana"
```

### 3. Run the Server

```bash
# Using config file
cargo run --release

# Or using environment variables
BIND_ADDRESS="0.0.0.0:8080" cargo run --release
```

## 🔧 Configuration

### File-based Configuration (config.toml)

```toml
bind_address = "0.0.0.0:8080"
health_check_interval = 30
request_timeout = 10
max_retries = 3

[[endpoints]]
url = "https://api.mainnet-beta.solana.com"
name = "Solana Labs"
weight = 100
priority = 1

[[endpoints]]
url = "https://rpc.ankr.com/solana"
name = "Ankr"
weight = 85
priority = 2
```

### Environment Variables

- `BIND_ADDRESS`: Server bind address (default: "0.0.0.0:8080")
- `RPC_ENDPOINTS`: Comma-separated list of RPC endpoint URLs

## 📡 API Endpoints

### RPC Proxy
- **POST** `/` - Main RPC endpoint (Solana JSON-RPC 2.0 compatible)

### Management Endpoints
- **GET** `/health` - System health status
- **GET** `/endpoints` - List of configured endpoints with status
- **GET** `/stats` - Performance statistics

## 🔍 Usage Examples

### Basic RPC Request

```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getSlot"
  }'
```

### Health Check

```bash
curl http://localhost:8080/health
```

### Get Endpoint Status

```bash
curl http://localhost:8080/endpoints
```

### Batch Request

```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '[
    {"jsonrpc": "2.0", "id": 1, "method": "getSlot"},
    {"jsonrpc": "2.0", "id": 2, "method": "getBlockHeight"}
  ]'
```

## 🏗️ Architecture

### Core Components

1. **Endpoint Manager**: Manages RPC endpoints, health status, and performance metrics
2. **RPC Router**: Routes requests using configurable load balancing strategies
3. **Health Service**: Continuous monitoring of endpoint health and performance
4. **Request Handler**: Processes incoming RPC requests with retry logic

### Load Balancing Strategies

- **Health-Based** (default): Routes to healthiest endpoints first
- **Round-Robin**: Evenly distributes requests across healthy endpoints
- **Weighted**: Uses endpoint weights for request distribution
- **Least-Latency**: Routes to fastest responding endpoints

## 📊 Monitoring

### Health Status Response

```json
{
  "status": "healthy",
  "uptime_seconds": 3600,
  "endpoints": {
    "total": 3,
    "healthy": 2,
    "degraded": 1,
    "unhealthy": 0
  },
  "statistics": {
    "total_requests": 1500,
    "success_rate": 99.2,
    "avg_response_time_ms": 145
  }
}
```

### Endpoint Information

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://api.mainnet-beta.solana.com",
    "name": "Solana Labs",
    "status": "Healthy",
    "score": {
      "overall_grade": "A+",
      "success_rate": 99.8,
      "avg_response_time": 120.5,
      "uptime_percentage": 99.9
    },
    "weight": 100,
    "priority": 1
  }
]
```

## 🚦 Error Handling

The system provides comprehensive error handling:

- **Automatic Retry**: Failed requests are automatically retried with exponential backoff
- **Circuit Breaker**: Unhealthy endpoints are temporarily removed from rotation
- **Graceful Degradation**: System continues operating even if some endpoints fail
- **Error Propagation**: Original RPC errors are preserved and returned to clients

## 🔒 Security Considerations

- All RPC communication uses HTTPS
- No sensitive data is logged
- Rate limiting can be implemented at the reverse proxy level
- Input validation for all RPC requests

## 🧪 Testing

```bash
# Run tests
cargo test

# Run with output
cargo test -- --nocapture

# Integration tests
cargo test --test integration
```

## 📈 Performance

- **Throughput**: Handles thousands of requests per second
- **Latency**: Sub-200ms response times for 95% of requests
- **Uptime**: 99.9%+ availability with multiple healthy endpoints
- **Failover**: <100ms automatic failover to backup endpoints

## 🔧 Development

### Project Structure

```
src/
├── main.rs          # Application entry point
├── config.rs        # Configuration management
├── endpoints.rs     # Endpoint management
├── router.rs        # Request routing logic
├── health.rs        # Health monitoring
├── rpc.rs          # RPC utilities
├── types.rs        # Data structures
└── error.rs        # Error handling
```

### Adding New Features

1. **New Load Balancing Strategy**: Extend `LoadBalancingStrategy` enum and implement in `endpoints.rs`
2. **Caching**: Add caching layer in `router.rs` using Redis or in-memory cache
3. **Metrics**: Integrate Prometheus metrics collection
4. **Authentication**: Add API key validation middleware

## 🐳 Docker Deployment

```dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/multi-rpc /usr/local/bin/
EXPOSE 8080
CMD ["multi-rpc"]
```

```bash
docker build -t multi-rpc .
docker run -p 8080:8080 -e RPC_ENDPOINTS="https://api.mainnet-beta.solana.com" multi-rpc
```

## 🚀 Roadmap

### Phase 1 (Current)
- ✅ Basic RPC proxy functionality
- ✅ Multiple endpoint management
- ✅ Health monitoring
- ✅ Load balancing strategies

### Phase 2 (Next)
- [ ] WebSocket subscriptions
- [ ] Response caching with Redis
- [ ] Prometheus metrics
- [ ] API authentication

### Phase 3 (Future)
- [ ] Response validation and consensus
- [ ] Geographic routing
- [ ] Auto-discovery of new endpoints
- [ ] Admin dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Create an issue for bug reports
- Join our Discord for discussions
- Check the documentation for common issues

---

**Multi-RPC** - Enterprise-grade Solana RPC aggregation for maximum reliability and performance.