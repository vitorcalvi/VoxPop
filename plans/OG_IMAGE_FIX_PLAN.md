# Open Graph (og:image) Fix Plan

## Problem Summary

The Open Graph social media sharing preview is not displaying when the URL is shared on platforms like Facebook, Twitter/X, LinkedIn, and WhatsApp.

## Root Cause Analysis

Based on the investigation, the following issues were identified:

### 1. Static URL Configuration
- **Issue**: [`index.html:17`](index.html:17) has hardcoded `og:image` URL as `https://feedback.app/og-image.png`
- **Problem**: The meta tags are statically configured and cannot dynamically adapt to different deployment environments

### 2. Missing Dynamic OG Image Generation
- **Issue**: No dynamic OG image generation endpoint exists
- **Problem**: Social platforms require unique, dynamic OG images for better engagement (e.g., showing feedback statistics, recent items)

### 3. Static Image File Concerns
- **Issue**: [`public/og-image.png`](public/og-image.png) exists but dimensions and format need verification
- **Problem**: Could be missing, incorrect size, or not properly served

### 4. Vercel Configuration Gaps
- **Issue**: [`vercel.json`](vercel.json) doesn't have specific OG image handling
- **Problem**: No custom headers for og-image.png MIME type and caching

## Proposed Solution

### Phase 1: Quick Fix (Static OG Image)

**Option A: Verify and Fix Static Image**
1. Ensure `public/og-image.png` is 1200x630 pixels, PNG format, under 8MB
2. Add proper MIME type headers in `vercel.json`
3. Update `vercel.json` with explicit static file handling for og-image.png

**Option B: Use Vercel OG for Dynamic Images** (Recommended)
1. Install `@vercel/og` package
2. Create an API route `/api/og` that generates dynamic OG images
3. Update meta tags to use the dynamic OG image URL

### Phase 2: Enhanced Solution (Dynamic OG Image)

Create a dynamic OG image API route that generates images showing:
- Application name: "VoxPop - Community Feedback"
- Current feedback statistics (e.g., "150 feedback items", "85% resolved")
- Call-to-action: "Share your feedback"

## Implementation Plan

### Step 1: Add Vercel OG Package
```bash
npm install @vercel/og
```

### Step 2: Create Dynamic OG Image API Route
File: `api/og.ts`

```typescript
import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default async function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1200px',
          height: '630px',
          backgroundColor: '#4f46e5',
          color: 'white',
          fontSize: '60px',
          padding: '40px',
        }}
      >
        <h1 style={{ marginBottom: '20px' }}>VoxPop - Community Feedback</h1>
        <p style={{ fontSize: '30px' }}>Share your feedback, shape the product</p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
```

### Step 3: Update vercel.json for OG Image Headers
```json
{
  "headers": [
    {
      "source": "/og-image.png",
      "headers": [
        {
          "key": "Content-Type",
          "value": "image/png"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/api/og",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, s-maxage=3600"
        }
      ]
    }
  ]
}
```

### Step 4: Update index.html Meta Tags
Update the OG image URL to use the dynamic endpoint:
```html
<meta property="og:image" content="https://feedback.app/api/og">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

## Testing Instructions

### 1. Facebook Sharing Debugger
- URL: https://developers.facebook.com/tools/debug/
- Enter: `https://feedback.app`
- Click "Scrape Again" to force cache refresh

### 2. Twitter Card Validator
- URL: https://cards-dev.twitter.com/validator
- Enter: `https://feedback.app`
- Click "Preview card"

### 3. LinkedIn Post Inspector
- URL: https://www.linkedin.com/post-inspector/inspect
- Enter: `https://feedback.app`

### 4. WhatsApp Link Preview
- Test by sharing the link in WhatsApp
- The OG image should appear in the link preview

## Verification Checklist

- [ ] `og-image.png` exists in `public/` folder with correct dimensions (1200x630)
- [ ] OG image is accessible at `https://feedback.app/og-image.png`
- [ ] Meta tags are present in HTML source with absolute HTTPS URLs
- [ ] Dynamic OG image API route returns proper image response
- [ ] Social platform crawlers can access the OG image
- [ ] Caching headers are properly configured
- [ ] No mixed content warnings (all resources use HTTPS)

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `@vercel/og` dependency |
| `api/og.ts` | Create new dynamic OG image API route |
| `vercel.json` | Add OG image MIME type and cache headers |
| `index.html` | Update og:image URL to dynamic endpoint (optional) |

## Estimated Effort

- Phase 1 (Static Fix): ~15-30 minutes
- Phase 2 (Dynamic OG): ~1-2 hours

## Next Steps

1. **Approve this plan** - Switch to Code mode to implement the solution
2. **Run local tests** - Verify build works locally
3. **Deploy to Vercel** - Test on production URL
4. **Validate with social crawlers** - Use debugging tools
5. **Monitor and iterate** - Check for any issues
