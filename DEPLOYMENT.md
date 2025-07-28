# Google Cloud Deployment Guide for Multi-RPC

This guide walks you through deploying the Multi-RPC project (Rust backend + Next.js frontend) to Google Cloud Platform using Cloud Build and Cloud Run.

## Prerequisites

1. **Google Cloud Account**: Active GCP account with billing enabled
2. **gcloud CLI**: Install from https://cloud.google.com/sdk/docs/install
3. **Docker**: For local testing (optional)
4. **Environment Variables**: Copy `.env.production.example` to `.env.production` and fill in values

## Quick Start

```bash
# 1. Set your project ID
export PROJECT_ID="your-gcp-project-id"

# 2. Run the deployment script
./deploy.sh

# 3. Follow the prompts to set up resources
```

## Manual Deployment Steps

### 1. Initial Setup

```bash
# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Service Account

```bash
gcloud iam service-accounts create multi-rpc-sa \
    --description="Service account for Multi-RPC" \
    --display-name="Multi-RPC Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:multi-rpc-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.admin"
```

### 3. Set Up Secrets

```bash
# Create secrets in Secret Manager
echo -n "your-database-url" | gcloud secrets create database-url --data-file=-
echo -n "your-redis-url" | gcloud secrets create redis-url --data-file=-
echo -n "your-nextauth-secret" | gcloud secrets create nextauth-secret --data-file=-
# ... repeat for all secrets
```

### 4. Deploy with Cloud Build

```bash
# Submit build
gcloud builds submit . --config=cloudbuild.yaml
```

### 5. Custom Domain (Optional)

```bash
# Map custom domain to Cloud Run service
gcloud run domain-mappings create \
    --service=multi-rpc-frontend \
    --domain=your-domain.com \
    --region=us-central1
```

## Configuration

### Environment Variables

#### Backend (Rust)
- `RUST_LOG`: Logging level (info, debug, error)
- `RPC_ENDPOINTS`: Comma-separated list of Solana RPC endpoints
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

#### Frontend (Next.js)
- `NEXT_PUBLIC_RPC_BACKEND_URL`: Backend API URL
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Random string for session encryption
- `PRIVY_APP_ID`: Privy authentication app ID
- `STRIPE_SECRET_KEY`: Stripe API secret key

### Cloud SQL Setup

```bash
# Create instance
gcloud sql instances create multi-rpc-db \
    --database-version=POSTGRES_14 \
    --tier=db-f1-micro \
    --region=us-central1

# Create database
gcloud sql databases create multirpc --instance=multi-rpc-db

# Get connection name
gcloud sql instances describe multi-rpc-db --format='value(connectionName)'
```

### Redis Setup

```bash
# Create Redis instance
gcloud redis instances create multi-rpc-redis \
    --size=1 \
    --region=us-central1 \
    --redis-version=redis_6_x
```

## Monitoring

### View Logs

```bash
# Backend logs
gcloud run services logs read multi-rpc-backend --region=us-central1

# Frontend logs
gcloud run services logs read multi-rpc-frontend --region=us-central1
```

### Metrics

Access metrics in Google Cloud Console:
- Cloud Run metrics: CPU, memory, request count
- Cloud SQL metrics: Connections, CPU, storage
- Redis metrics: Memory usage, operations

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Cloud Build logs: `gcloud builds list`
   - Verify Docker images build locally

2. **Service Not Starting**
   - Check Cloud Run logs for startup errors
   - Verify all environment variables are set
   - Check service account permissions

3. **Database Connection Issues**
   - Ensure Cloud SQL proxy is enabled
   - Verify connection string format
   - Check VPC/network settings

4. **Authentication Errors**
   - Verify all auth-related secrets are correct
   - Check CORS settings in backend
   - Ensure frontend URL is in allowed origins

## Production Checklist

- [ ] All environment variables configured
- [ ] Secrets stored in Secret Manager
- [ ] Database backups configured
- [ ] Monitoring and alerting set up
- [ ] Custom domain configured
- [ ] SSL certificates verified
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Health checks passing
- [ ] Auto-scaling configured

## Cost Optimization

1. **Cloud Run**: Set appropriate min/max instances
2. **Cloud SQL**: Use appropriate tier for workload
3. **Redis**: Right-size memory allocation
4. **Container Registry**: Clean up old images regularly

## Security Best Practices

1. Use Secret Manager for all sensitive data
2. Enable VPC connector for internal communication
3. Configure Cloud Armor for DDoS protection
4. Enable audit logs
5. Use least-privilege IAM roles
6. Regular security scans with Container Analysis

## Support

For issues:
1. Check Cloud Run logs
2. Review Cloud Build history
3. Verify all secrets are correctly set
4. Check service health endpoints