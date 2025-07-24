# Multi-RPC Web UI

Production-ready web interface for Multi-RPC - an enterprise-grade Solana RPC aggregation service.

## Features

- **User Authentication**: Solana wallet and social login via Privy
- **API Key Management**: Create and manage multiple API keys  
- **Real-time Monitoring**: Live RPC statistics and endpoint health
- **Custom Endpoints**: Add your own RPC endpoints
- **Usage Analytics**: Track requests, latency, and error rates
- **Billing Integration**: Stripe integration for subscription management
- **Dashboard**: Comprehensive dashboard with usage metrics
- **RPC Proxy**: Authenticated proxy to the Multi-RPC backend

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Privy (Solana wallet + social logins)
- **Payments**: Stripe
- **Styling**: Tailwind CSS
- **UI Components**: Custom components
- **Deployment**: Vercel/Docker

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in all required environment variables.

3. **Set up database:**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

### Database
- `DATABASE_URL`: PostgreSQL connection string (optional - uses mock data if not set)

### Authentication (Privy)
- `NEXT_PUBLIC_PRIVY_APP_ID`: Your Privy application ID
- `PRIVY_APP_SECRET`: Your Privy application secret
- `NEXT_PUBLIC_SOLANA_RPC_URL`: Solana RPC URL for wallet connections

### Stripe
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook endpoint secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key

### Multi-RPC Backend
- `NEXT_PUBLIC_RPC_URL`: Multi-RPC backend URL (default: http://localhost:8080)
- `RPC_ADMIN_KEY`: Admin API key for accessing backend metrics

## Database Schema

The application uses PostgreSQL with the following main tables:
- **User**: User accounts with authentication
- **ApiKey**: API keys for RPC access
- **Usage**: Usage tracking per user/day
- **Subscription**: Stripe subscription data
- **Invoice**: Billing history

## API Endpoints

### Authentication
- `POST /api/auth/privy`: Privy authentication callback

### API Keys
- `GET /api/keys`: List user's API keys
- `POST /api/keys`: Create new API key
- `DELETE /api/keys/[id]`: Delete API key

### RPC Monitoring
- `GET /api/rpc/health`: Get RPC endpoint health status
- `GET /api/rpc/stats`: Get RPC usage statistics
- `GET /api/rpc/endpoints`: Get custom endpoints
- `POST /api/rpc/endpoints`: Add custom endpoint
- `DELETE /api/rpc/endpoints`: Remove custom endpoint

### Billing
- `POST /api/billing/create-checkout-session`: Create Stripe checkout
- `POST /api/webhooks/stripe`: Handle Stripe webhooks

## Deployment

### Vercel Deployment

1. **Push to GitHub**

2. **Import to Vercel:**
   - Connect your GitHub repository
   - Set root directory to `web-ui`
   - Configure environment variables

3. **Set up database:**
   - Use Vercel Postgres or external PostgreSQL
   - Run migrations: `npx prisma migrate deploy`

4. **Configure Stripe webhooks:**
   - Add webhook endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

### Production Checklist

- [ ] Set strong `NEXTAUTH_SECRET`
- [ ] Configure proper CORS for RPC endpoint
- [ ] Set up monitoring (Vercel Analytics)
- [ ] Configure rate limiting
- [ ] Set up error tracking (Sentry)
- [ ] Enable Vercel Edge Config for dynamic configuration
- [ ] Set up custom domain
- [ ] Configure SSL certificates

## Connecting to Multi-RPC Backend

The web UI connects to the Multi-RPC backend to fetch real-time metrics. Make sure:

1. **Multi-RPC backend is running:**
   ```bash
   # In the multi-rpc directory
   cargo run --release
   ```

2. **Backend endpoints are accessible:**
   - Health: `http://localhost:8080/health`
   - Endpoints: `http://localhost:8080/endpoints`
   - Stats: `http://localhost:8080/stats`
   - Metrics: `http://localhost:8080/metrics`

3. **CORS is enabled** on the backend (already configured in the provided code)

4. **Admin API key** is set if backend requires authentication

The UI will automatically fall back to mock data if the backend is unavailable.

## Development

### Adding new features:

1. **Database changes:**
   ```bash
   # Edit prisma/schema.prisma
   npx prisma migrate dev --name your-migration-name
   ```

2. **API routes:**
   Create new route in `src/app/api/`

3. **UI components:**
   Add to `src/components/`

### Testing:

```bash
npm run test        # Run tests
npm run type-check  # TypeScript checking
npm run lint        # ESLint
```

## Security

- API keys are hashed and stored securely
- All endpoints require authentication except public pages
- Rate limiting based on subscription tier
- CORS configured for RPC endpoint
- Webhook signature verification for Stripe

## Support

For issues or questions:
- GitHub Issues: [your-repo/issues]
- Documentation: [your-docs-url]
- Email: support@multirpc.com