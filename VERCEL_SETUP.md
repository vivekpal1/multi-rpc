# Vercel Deployment Setup

## Quick Deploy

### 1. Set up in Vercel Dashboard

When importing the project in Vercel:

1. **Import your Git repository**
2. **Configure Build Settings:**
   - Framework Preset: `Other`
   - Build Command: `cd web-ui && npm install && npm run build`
   - Output Directory: `web-ui/.next`
   - Install Command: `cd web-ui && npm install`

3. **Add Environment Variables:**
   ```
   NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
   DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
   NEXTAUTH_SECRET=<generate-random-secret>
   ```

4. **Deploy**

## Alternative: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# When prompted:
# - Set up and deploy: Y
# - Which scope: (select your account)
# - Link to existing project: N
# - Project name: multi-rpc-web
# - Directory: ./ (current directory)
# - Override settings: N
```

## Post-Deployment

After deployment, you'll need to:

1. **Set Environment Variables in Vercel Dashboard:**
   - Go to your project settings
   - Navigate to Environment Variables
   - Add the required variables

2. **Redeploy to apply environment variables:**
   ```bash
   vercel --prod
   ```

## Troubleshooting

### If you see 404 errors:
- Check that build succeeded in Vercel dashboard
- Verify environment variables are set
- Check the Functions tab for any API route errors

### If build fails:
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Try building locally first: `cd web-ui && npm run build`

## Important Notes

- The Rust backend needs to be deployed separately (Cloud Run, Railway, etc.)
- Update `NEXT_PUBLIC_RPC_URL` to point to your deployed backend
- Database is optional for basic functionality