# Vercel Deployment Guide for Feedback

## Prerequisites

- Vercel account ([vercel.com](https://vercel.com))
- GitHub repository with Feedback code
- Node.js 18+ (engines field ensures compatibility)
- Neon PostgreSQL database ([neon.tech](https://neon.tech))

## Step 1: Prepare Environment Variables

Set these environment variables in your project:

1. **DATABASE_URL** - Get from Neon console

## Step 2: Deploy to Vercel

### Option A: via Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel
```

### Important: Fix for "Runtimes must have a valid version" Error

If you encounter error: `Runtimes must have a valid version, for example now-php@1.0.0`, follow these steps:

1. **Clear Vercel CLI cache** (removes stale configuration):
```bash
rm -rf ~/.vercel
rm -rf .vercel
```

2. **Reinstall Vercel CLI** (ensures latest version):
```bash
npm uninstall -g vercel
npm install -g vercel
```

3. **Login to Vercel**
```bash
vercel login
```

4. **Deploy**
```bash
vercel
```

### Important: Fix for "Runtimes must have a valid version" Error

If you encounter error: `Runtimes must have a valid version, for example now-php@1.0.0`, follow these steps:

1. **Clear Vercel CLI cache** (removes stale configuration):
```bash
rm -rf ~/.vercel
rm -rf .vercel
```

2. **Reinstall Vercel CLI** (ensures latest version):
```bash
npm uninstall -g vercel
npm install -g vercel
```

3. **Login to Vercel**
```bash
vercel login
```

4. **Deploy**
```bash
vercel
```

### Option B: via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project settings
4. Add environment variables in Environment Variables section
5. Click **Deploy**

## Step 3: Configure Environment Variables

Add these in Vercel dashboard (Project Settings → Environment Variables):

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Your Neon connection string | Production, Preview, Development |

|**Important:** Add `DATABASE_URL` from Neon's connection string format:
```
postgresql://username:password@ep-host-name-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Important: Fix for "Runtimes must have a valid version" Error

If you encounter error: `Runtimes must have a valid version, for example now-php@1.0.0`, follow these steps:

1. **Clear Vercel CLI cache** (removes stale configuration):
```bash
rm -rf ~/.vercel
rm -rf .vercel
```

2. **Reinstall Vercel CLI** (ensures latest version):
```bash
npm uninstall -g vercel
npm install -g vercel
```

3. **Login to Vercel**
```bash
vercel login
```

4. **Deploy**
```bash
vercel
```

## Step 4: Verify Deployment

After deployment:

1. Visit your Vercel URL (e.g., `https://voxpop.vercel.app`)
2. Check health endpoint: `https://your-domain.vercel.app/api/health`
3. Submit a test feedback to verify the application works

## Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed by Vercel

## Troubleshooting

### "Database connection failed"
- Verify `DATABASE_URL` is correct
- Ensure SSL mode is enabled: `sslmode=require`

### Build errors
- Check Vercel build logs in dashboard
- Ensure all dependencies are in package.json

## Architecture Notes

- **Frontend:** Vite builds to `/dist` and serves as static files
- **Backend:** Express app in `api/index.ts` runs as Vercel serverless functions
- **API Routes:** All `/api/*` routes route to backend
- **Static Files:** All other routes serve from `/dist`

## Monitoring

- Check Vercel Analytics for performance
- Use Vercel Logs for debugging errors
- Monitor Neon database usage

## CI/CD

Every push to your main branch triggers automatic deployment on Vercel.
