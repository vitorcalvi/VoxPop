# AI Service Migration Guide

## Summary
Successfully migrated from Chutes.AI to GitHub Models + Groq API with intelligent provider routing.

## What Changed
- **Removed**: Chutes.AI integration
- **Added**: GitHub Models API integration
- **Added**: Groq API integration
- **Added**: Smart provider routing based on task type

## New AI Provider Configuration

### Required Environment Variables
Add one or both of these to your `.env` file:

```bash
# GitHub Models (for complex reasoning and vision tasks)
# Get token from: https://github.com/settings/tokens
GITHUB_TOKEN="your_github_personal_access_token"

# Groq API (for fast, cost-effective general tasks)
# Get API key from: https://console.groq.com/keys
GROQ_API_KEY="your_groq_api_key"
```

### Provider Routing Strategy
The AI service automatically routes requests to the optimal provider:

| Task Type | Preferred Provider | Why |
|-----------|------------------|------|
| Vision/Screenshot Analysis | GitHub Models (GPT-4o) | Best visual understanding |
| Complex Reasoning | GitHub Models (Claude 3.5 Sonnet) | Deep reasoning capabilities |
| Code Analysis | GitHub Models (Claude 3.5 Sonnet) | Specialized for code |
| General Analysis | Groq (Llama 3.3) | Fast and cost-effective |
| Simple/Quick Tasks | Groq (Mixtral) | Ultra-fast response |

### Fallback Behavior
- If both providers configured: Uses optimal routing
- If only GitHub configured: Uses GitHub for all tasks
- If only Groq configured: Uses Groq for all tasks
- If none configured: Returns error messages

## API Endpoints (Unchanged)
All endpoint signatures remain the same for backward compatibility:

- `POST /api/analyze` - Analyze feedback with AI
- `POST /api/roadmap` - Generate roadmap from feedbacks
- `POST /api/ai/comprehensive-analyze` - Comprehensive AI analysis

## Files Changed
- `api/_aiService.ts` - New multi-provider AI service
- `api/analyze.ts` - Updated to use new service
- `api/roadmap.ts` - Updated to use new service
- `api/ai/comprehensive-analyze.ts` - Updated to use new service
- `server/index.ts` - Updated to use new service
- `api/debug.ts` - Updated to check new API keys
- `.env.example` - Updated with new environment variables

## Files Removed
- `api/_chutesService.ts` - Old Chutes.AI service
- `services/chutesService.ts` - Duplicate old service

## Testing
To test the new AI integration:

1. Add API keys to `.env` (see above)
2. Restart development server: `npm run dev`
3. Test endpoints:
   ```bash
   curl -X POST http://localhost:5000/api/analyze \
     -H "Content-Type: application/json" \
     -d '{"title":"Test","description":"Test feedback"}'
   ```

4. Check debug endpoint: `http://localhost:5000/api/debug`

## Benefits of New Integration

### Performance
- **Groq**: Ultra-fast response times (100-500ms for simple tasks)
- **GitHub Models**: High-quality responses for complex tasks

### Cost
- **Groq**: Very cost-effective for high-volume tasks
- **GitHub Models**: Competitive pricing, included in GitHub plans

### Capabilities
- **Vision**: GPT-4o with superior image understanding
- **Reasoning**: Claude 3.5 Sonnet with deep analytical capabilities
- **Routing**: Automatic selection based on task requirements

### Reliability
- **Multi-provider**: Fallback options if one provider has issues
- **Auto-routing**: Optimal provider selection without manual configuration

## Migration Notes
- All existing API endpoints continue to work
- No breaking changes for frontend
- Response format remains the same
- Error handling improved with fallback logic

## Next Steps
1. Add API keys to `.env` file
2. Test all AI endpoints
3. Monitor provider performance in logs
4. Adjust routing logic if needed (in `_aiService.ts`)
