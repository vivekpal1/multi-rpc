# Multi-RPC Web UI Production Deployment Guide

## Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL database (optional - will use mock data if not configured)
- Multi-RPC backend running and accessible

## Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Configure required environment variables:**
   - `NEXT_PUBLIC_PRIVY_APP_ID` - Create app at https://dashboard.privy.io
   - `PRIVY_APP_SECRET` - From Privy dashboard
   - `NEXT_PUBLIC_RPC_URL` - Your Multi-RPC backend URL
   - `RPC_ADMIN_KEY` - Admin API key for backend access (if required)

3. **Configure optional services:**
   - Database: Set `DATABASE_URL` for persistent storage
   - Stripe: Add payment keys for billing features

## Deployment Options

### Option 1: Docker Deployment (Recommended)

1. **Build the Docker image:**
   ```bash
   docker build -t multi-rpc-ui .
   ```

2. **Run with Docker Compose:**
   ```bash
   # From the root multi-rpc directory
   docker-compose up -d web-ui
   ```

3. **Or run standalone:**
   ```bash
   docker run -p 3000:3000 \
     --env-file .env.local \
     -e NEXT_PUBLIC_RPC_URL=http://your-backend:8080 \
     multi-rpc-ui
   ```

### Option 2: Vercel Deployment

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Configure environment variables in Vercel dashboard**

### Option 3: Traditional Node.js Deployment

1. **Install dependencies:**
   ```bash
   npm ci --only=production
   ```

2. **Build the application:**
   ```bash
   npm run build
   ```

3. **Run database migrations (if using database):**
   ```bash
   npm run prisma:migrate:prod
   ```

4. **Start the production server:**
   ```bash
   npm start
   ```

## Production Configuration

### 1. Security Headers

The application automatically sets security headers via middleware:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

### 2. CORS Configuration

Update the Multi-RPC backend to allow requests from your web UI domain:

```toml
# config.toml
[server]
cors_origins = ["https://your-domain.com"]
```

### 3. SSL/TLS

For production, always use HTTPS. If using Docker, put an Nginx reverse proxy in front:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Database Setup

If using PostgreSQL:

```bash
# Run migrations
npm run prisma:migrate:prod

# Create database backup
pg_dump -U postgres multirpc > backup.sql
```

### 5. Performance Optimization

1. **Enable caching:**
   ```bash
   # Set cache headers in next.config.js
   ```

2. **Use CDN for static assets:**
   - Configure Cloudflare or similar CDN
   - Point to `/_next/static/*` paths

3. **Enable compression:**
   - Gzip/Brotli compression via reverse proxy

## Monitoring

### 1. Health Checks

- Application health: `GET /api/health`
- Multi-RPC backend: `GET http://backend:8080/health`

### 2. Metrics

The application exposes performance metrics:
- Page load time
- Time to first byte
- WebSocket connection status
- RPC request latency

### 3. Error Tracking

Configure Sentry (optional):
```bash
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

## Scaling

### Horizontal Scaling

1. **Run multiple instances:**
   ```bash
   docker-compose up -d --scale web-ui=3
   ```

2. **Configure load balancer:**
   - Use Nginx, HAProxy, or cloud load balancer
   - Enable sticky sessions for WebSocket connections

### Vertical Scaling

Adjust resource limits in docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '2.0'
```

## Troubleshooting

### Common Issues

1. **WebSocket connection failures:**
   - Check CORS configuration
   - Ensure WebSocket upgrade headers are passed through proxy
   - Verify `NEXT_PUBLIC_RPC_URL` includes correct protocol (ws:// or wss://)

2. **Database connection errors:**
   - Verify `DATABASE_URL` format
   - Check network connectivity between containers
   - Ensure migrations have been run

3. **Authentication issues:**
   - Verify Privy configuration
   - Check that all required environment variables are set
   - Clear browser cookies and try again

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm start
```

### Container Logs

```bash
# View logs
docker logs multi-rpc-web-ui

# Follow logs
docker logs -f multi-rpc-web-ui

# Last 100 lines
docker logs --tail 100 multi-rpc-web-ui
```

## Backup and Recovery

### Database Backup

```bash
# Automated daily backup
0 2 * * * pg_dump -U postgres multirpc | gzip > /backups/multirpc_$(date +\%Y\%m\%d).sql.gz
```

### Application State

- API keys are hashed and stored in database
- User sessions managed by Privy
- Custom endpoints stored per user

## Security Best Practices

1. **Keep dependencies updated:**
   ```bash
   npm audit
   npm update
   ```

2. **Rotate secrets regularly:**
   - Database passwords
   - JWT secrets
   - API keys

3. **Enable rate limiting:**
   - Configure in Multi-RPC backend
   - Add Cloudflare rate limiting

4. **Monitor for vulnerabilities:**
   - Use GitHub Dependabot
   - Regular security audits

## Support

- GitHub Issues: https://github.com/your-org/multi-rpc/issues
- Documentation: https://docs.your-domain.com
- Email: support@your-domain.com