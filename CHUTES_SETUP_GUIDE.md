# Chutes AI Setup Guide for VoxPop

This guide will help you set up Chutes AI for VoxPop's AI-powered feedback analysis.

## Overview

VoxPop uses Chutes AI to deploy and run LLM models for:
- **Feedback Analysis** - Categorize, detect sentiment, and generate insights
- **Roadmap Generation** - Summarize feedback into actionable roadmaps

## Step 1: Create Chutes AI Account

1. Visit [chutes.ai](https://chutes.ai)
2. Sign up for an account
3. Go to account settings or API keys section
4. Copy your API key

## Step 2: Deploy an LLM Model

### Choose a Model
For best results, deploy one of these models:
- **Llama 3.1 8B** - Fast, good general purpose
- **Mistral 7B** - Excellent for text analysis
- **Qwen 2.5** - Strong reasoning capabilities

### Deployment Process

1. Go to Chutes AI console/dashboard
2. Click "Deploy New Chute" or similar button
3. Choose your model from the model library
4. Configure:
   - **Model**: Select Llama 3.1, Mistral, etc.
   - **GPU**: Choose H100, A100, or similar (recommend A100 for faster inference)
   - **Scale**: 1 GPU instance (sufficient for analysis)
   - **Endpoint**: Use the default chat/completion endpoint
5. Deploy the model (this may take a few minutes)

### Get Your Chute ID

After deployment completes:
1. Navigate to your deployed chute details
2. Look for the **chute_id** field
3. Copy this ID (it looks like: `chute_abc123xyz`)

## Step 3: Configure VoxPop

Update your `.env` file:

```bash
# Chutes AI Configuration
CHUTES_API_KEY=cpk_baee7a2deb56498aa5c1e7f83cd6ea35.89c85babdb2f5fee845af071220bfcc3.f3Gw21b2zXjfyeW1hncDgmLGjrffksfs

# IMPORTANT: Replace this with your actual chute_id from Step 2
CHUTE_ID=your-deployed-chute-id-here

# Keep existing config
DATABASE_URL="postgresql://neondb_owner:npg_bvmCiRpey5k4@ep-wandering-tree-a49v7ppb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

PORT=5000
```

## Step 4: Test the Integration

1. Start the backend server:
   ```bash
   npm run dev
   ```

2. Check server logs for:
   - "✅ Database tables initialized" - Database is working
   - No connection errors to Chutes AI

3. Test the `/api/health` endpoint:
   ```bash
   curl http://localhost:5000/api/health
   ```

4. Test the `/api/chutes` endpoint to list your deployed model:
   ```bash
   curl http://localhost:5000/api/chutes
   ```

5. Test AI analysis by submitting feedback through the UI

## Step 5: Verify Features

### Feedback Analysis

1. Open VoxPop in browser (http://localhost:5173)
2. Submit a new feedback item with a title and description
3. Wait for AI analysis (job creation + polling)
4. Verify that:
   - Category is correctly assigned (Feature, Bug, UI/UX, etc.)
   - Sentiment is detected (positive, neutral, negative)
   - Tags are suggested
   - Impact score (1-10) is assigned
   - AI insight is generated

### Roadmap Generation

1. Add a few feedback items to test
2. Click "AI Roadmap Vision" button
3. Wait for analysis to complete
4. Verify that:
   - Roadmap summary appears
   - Themes are identified
   - Prioritization is suggested

## Troubleshooting

### "CHUTE_ID not set" Error

**Problem**: Server logs show "CHUTE_ID not set"

**Solution**:
1. Verify `CHUTE_ID` is in `.env` file
2. Ensure it's not the placeholder `your-deployed-chute-id-here`
3. Restart the backend server

### "Job Creation Failed" Error

**Problem**: Chutes AI returns error when creating job

**Solutions**:
1. Verify `CHUTES_API_KEY` is correct
2. Check API key has permissions for job creation
3. Verify `CHUTE_ID` corresponds to an active chute
4. Check Chutes AI console for model status (should be "active")

### "Job Timed Out" Error

**Problem**: Job doesn't complete within 30 seconds

**Solutions**:
1. Check model is active in Chutes AI console
2. Verify GPU instance is running (not scaled down to 0)
3. Try deploying on a faster GPU (H100 > A100 > etc.)
4. Increase timeout in `services/chutesService.ts` (change `maxAttempts`)

### Analysis Returns Null

**Problem**: AI analysis returns null/empty

**Solutions**:
1. Check server logs for specific error messages
2. Verify model supports chat/completion format
3. Test model directly in Chutes AI console playground
4. Ensure deployed model has sufficient tokens/credits

### Model Takes Too Long

**Problem**: Feedback submission takes >30 seconds

**Solutions**:
1. Scale GPU instance (upgrade to faster GPU)
2. Reduce `max_tokens` in job_args (currently 500)
3. Choose a smaller/faster model (7B instead of 70B)
4. Use model quantization (e.g., 4-bit instead of 16-bit)

## Chutes AI Pricing & Resources

### GPU Instance Costs

- **A100**: ~$1-2/hour - Best performance
- **H100**: ~$2-3/hour - Fastest inference
- **L40S**: ~$0.5-1/hour - Budget option

### Recommendations

For VoxPop feedback analysis:
- **GPU**: A100 or H100 for fast response
- **Model**: 7B-8B parameter models (Llama 3.1, Mistral 7B)
- **Scale**: 1 GPU instance is sufficient
- **Estimated Cost**: $1-2/day (with occasional analysis)

## Alternative: Using Multiple Models

You can deploy different models for different tasks:

1. **Analysis Model**: Fast model (Llama 3.1 8B)
   - Set as `CHUTE_ID_ANALYSIS` in `.env`
   - Update `services/chutesService.ts` to use this ID

2. **Roadmap Model**: Larger model with better reasoning
   - Set as `CHUTE_ID_ROADMAP` in `.env`
   - Use this ID for roadmap generation

### Implementation

Update `.env`:
```bash
CHUTES_API_KEY=cpk_...

# For feedback analysis (fast)
CHUTE_ID_ANALYSIS=chute_analysis_id

# For roadmap generation (smarter)
CHUTE_ID_ROADMAP=chute_roadmap_id

# Default (will be overridden by specific functions)
CHUTE_ID=chute_analysis_id
```

Update `services/chutesService.ts` to read different CHUTE_IDs based on the function.

## Support

- **Chutes AI Docs**: [docs.chutes.ai](https://docs.chutes.ai)
- **Chutes AI Console**: [console.chutes.ai](https://console.chutes.ai)
- **Community**: Discord or support channels on Chutes AI website

## Success Checklist

Before considering the setup complete, verify:

- [ ] Chutes AI account created
- [ ] API key copied and added to `.env`
- [ ] LLM model deployed on Chutes AI
- [ ] Chute ID copied and added to `.env`
- [ ] Backend server starts without errors
- [ ] `/api/health` endpoint returns OK
- [ ] `/api/chutes` lists your deployed model
- [ ] Feedback submission triggers AI analysis
- [ ] Analysis returns valid category, sentiment, insights
- [ ] Roadmap generation works
- [ ] No console errors related to Chutes AI

Once all items are checked, your Chutes AI integration is complete! 🎉
