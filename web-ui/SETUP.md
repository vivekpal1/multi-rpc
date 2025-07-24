# Multi-RPC Web UI Setup Guide

## Prerequisites
- Node.js 20.18.0 or higher (required for Solana packages)
- PostgreSQL database
- Privy account for authentication

## Installation Steps

1. **Clean install dependencies:**
```bash
# Remove any existing installations
rm -rf node_modules package-lock.json yarn.lock

# Install with npm (use --force if needed)
npm install --force

# Or with yarn
yarn install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your actual values:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_PRIVY_APP_ID` - Your Privy App ID
- `PRIVY_APP_SECRET` - Your Privy App Secret
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint
- Stripe keys for billing

3. **Set up the database:**
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Or push the schema (for development)
npm run prisma:push
```

4. **Run the development server:**
```bash
npm run dev
# or
yarn dev
```

## Features Implemented

✅ **Privy Authentication**
- Solana wallet login
- Google login  
- Twitter/X login
- Automatic user creation on first login

✅ **Dashboard**
- API key management
- Usage analytics
- Billing integration
- Profile management

✅ **Database Schema**
- User model with wallet support
- API keys with usage tracking
- Subscription management
- Linked accounts for social logins

## Troubleshooting

### Module not found errors
If you get "Module not found" errors, ensure:
1. All dependencies are installed: `npm install --force`
2. Prisma client is generated: `npm run prisma:generate`

### Node version issues
The Solana packages require Node.js 20.18.0+. If you see warnings about engine compatibility, consider upgrading Node.js.

### Database connection issues
1. Ensure PostgreSQL is running
2. Check your `DATABASE_URL` in `.env`
3. Run `npm run prisma:push` to create tables

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/privy/     # Privy auth sync
│   │   ├── user/           # User endpoints
│   │   └── billing/        # Stripe integration
│   ├── auth/               # Auth page
│   └── dashboard/          # Dashboard pages
├── hooks/
│   └── use-auth.ts         # Auth hook
├── providers/
│   └── privy-provider.tsx  # Privy provider
└── middleware.ts           # Auth middleware
```