# Vercel Deployment Guide for VoxPop

## Prerequisites

- Vercel account ([vercel.com](https://vercel.com))
- GitHub repository with VoxPop code
- Neon PostgreSQL database ([neon.tech](https://neon.tech))
- Chutes AI account with deployed model ([chutes.ai](https://chutes.ai))

## Step 1: Prepare Environment Variables

Set these environment variables in your project:

1. **DATABASE_URL** - Get from Neon console
2. **CHUTES_API_KEY** - Get from Chutes AI console
3. **CHUTE_ID** - Your deployed model's chute ID from Chutes AI

## Step 2: Deploy to Vercel

### Option A: via Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
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
|----------|--------|-------------|
| `DATABASE_URL` | Your Neon connection string | Production, Preview, Development |
| `CHUTES_API_KEY` | Your Chutes AI API key | Production, Preview, Development |
| `CHUTE_ID` | Your Chute ID | Production, Preview, Development |

**Important:** Add `DATABASE_URL` from Neon's connection string format:
```
postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

## Step 4: Verify Deployment

After deployment:

1. Visit your Vercel URL (e.g., `https://voxpop.vercel.app`)
2. Check health endpoint: `https://your-domain.vercel.app/api/health`
3. Submit a test feedback to verify AI analysis works

## Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed by Vercel

## Troubleshooting

### "Failed to analyze feedback"
- Check `CHUTES_API_KEY` and `CHUTE_ID` are set correctly
- Verify your model is deployed on Chutes AI

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
- Track Chutes AI API quota

## CI/CD

Every push to your main branch triggers automatic deployment on Vercel.
