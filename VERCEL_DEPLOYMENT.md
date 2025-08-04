# Vercel Deployment Guide for Multi-RPC

## Architecture Overview

Multi-RPC consists of two main components:
1. **Rust Backend** - The RPC aggregation server (needs to be deployed separately)
2. **Next.js Web UI** - The frontend dashboard (deployed on Vercel)

## Step 1: Deploy the Rust Backend

The Rust backend cannot run on Vercel. Choose one of these platforms:

### Option A: Google Cloud Run
```bash
# Build and push Docker image
docker build -t gcr.io/YOUR_PROJECT/multi-rpc .
docker push gcr.io/YOUR_PROJECT/multi-rpc

# Deploy to Cloud Run
gcloud run deploy multi-rpc \
  --image gcr.io/YOUR_PROJECT/multi-rpc \
  --port 8080 \
  --allow-unauthenticated \
  --set-env-vars "RPC_ENDPOINTS=https://api.mainnet-beta.solana.com"
```

### Option B: Railway.app
1. Connect your GitHub repo to Railway
2. Add environment variable: `RPC_ENDPOINTS=https://api.mainnet-beta.solana.com`
3. Deploy the Rust app

### Option C: Fly.io
```bash
flyctl launch
flyctl secrets set RPC_ENDPOINTS="https://api.mainnet-beta.solana.com"
flyctl deploy
```

## Step 2: Set Up Database (PostgreSQL)

Choose a managed PostgreSQL provider:
- **Neon** (recommended for Vercel): https://neon.tech
- **Supabase**: https://supabase.com
- **Railway PostgreSQL**: https://railway.app

Get your connection string, it should look like:
```
postgresql://user:password@host:5432/database
```

## Step 3: Configure Vercel Environment Variables

In your Vercel dashboard, go to Settings → Environment Variables and add:

### Required Variables
```bash
# Your deployed Rust backend URL from Step 1
NEXT_PUBLIC_RPC_URL=https://your-backend-url.cloudfunctions.net

# Database connection from Step 2
DATABASE_URL=postgresql://user:password@host:5432/database

# Generate a random secret (use: openssl rand -base64 32)
NEXTAUTH_SECRET=your-random-secret-here
```

### Optional Variables (for full functionality)
```bash
# Privy Authentication (get from https://privy.io)
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret

# Stripe Billing (get from https://stripe.com)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

## Step 4: Deploy to Vercel

### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Option B: Using Git
```bash
# Push to your repository
git add .
git commit -m "Configure for Vercel deployment"
git push

# Vercel will automatically deploy
```

### Option C: Manual Import
1. Go to https://vercel.com/new
2. Import your Git repository
3. Vercel will detect Next.js automatically
4. Deploy

## Step 5: Initialize Database

After deployment, run database migrations:

```bash
# Connect to your web-ui directory
cd web-ui

# Set DATABASE_URL environment variable
export DATABASE_URL="your-database-url"

# Run migrations
npx prisma migrate deploy
```

## Troubleshooting

### 404 Error
- Ensure environment variables are set in Vercel dashboard
- Check that the backend is deployed and accessible
- Verify the `NEXT_PUBLIC_RPC_URL` points to your backend

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Ensure database is accessible from Vercel's servers
- Run `npx prisma migrate deploy` to create tables

### Authentication Issues
- If not using Privy, the app will run in "development mode" without auth
- To enable auth, set up Privy and add the required environment variables

## Development vs Production

### Development (Local)
```bash
# .env.local
NEXT_PUBLIC_RPC_URL=http://localhost:8080
DATABASE_URL=postgresql://user:password@localhost:5432/multirpc
```

### Production (Vercel)
```bash
# Set in Vercel Dashboard
NEXT_PUBLIC_RPC_URL=https://your-production-backend.com
DATABASE_URL=postgresql://user:password@production-host:5432/multirpc
```

## Monitoring

- **Backend Health**: Visit `https://your-app.vercel.app/api/health`
- **RPC Health**: Visit `https://your-backend-url.com/health`
- **Logs**: Check Vercel Functions logs in the dashboard

## Next Steps

1. Set up monitoring with Datadog or New Relic
2. Configure rate limiting on the backend
3. Add custom domain in Vercel settings
4. Set up CI/CD with GitHub Actions
5. Enable Vercel Analytics for performance monitoring