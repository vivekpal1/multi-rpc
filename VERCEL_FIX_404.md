# Fix Vercel 404 Error

The deployment succeeds but shows 404 because Vercel is looking in the wrong directory for your Next.js app.

## Solution: Configure Root Directory in Vercel Dashboard

1. **Go to your Vercel project settings**
   - Navigate to: https://vercel.com/[your-username]/multi-rpc/settings/general

2. **Find "Root Directory" setting**
   - Look for the "Root Directory" field
   - Change it from `.` (or empty) to: `web-ui`
   - Click "Save"

3. **Redeploy**
   - Go to the Deployments tab
   - Click the three dots on your latest deployment
   - Select "Redeploy"
   - Or push a new commit to trigger a deployment

## Alternative: Using Vercel CLI

If you prefer using the CLI:

```bash
vercel --cwd web-ui
```

This tells Vercel that the current working directory for the deployment is `web-ui`.

## Why This Happens

Your project structure is:
```
multi-rpc/
├── src/           # Rust backend code
├── web-ui/        # Next.js frontend
│   ├── package.json
│   ├── next.config.js
│   └── ...
└── ...
```

Vercel needs to know that the Next.js app is in the `web-ui` subdirectory, not at the root.

## Environment Variables

Make sure these are set in Vercel (Settings → Environment Variables):

```
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
NEXTAUTH_SECRET=<any-random-string>
```

## After Fixing

Your app should be accessible at:
- Production: `https://multi-rpc.vercel.app`
- Preview: `https://multi-rpc-[branch-name].vercel.app`