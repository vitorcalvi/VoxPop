import { VercelRequest, VercelResponse } from '@vercel/node';

const CHUTES_API_BASE = 'https://api.chutes.ai';
const API_KEY = process.env.CHUTES_API_KEY || '';
const CHUTE_ID = process.env.CHUTE_ID || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, description, screenshot } = req.body;

    if (!CHUTE_ID) {
      return res.status(200).json({
        category: 'General',
        sentiment: 'neutral',
        suggestedTags: [],
        impactScore: 5,
        aiInsight: 'AI analysis not configured. Please set CHUTE_ID in environment variables.'
      });
    }

    const prompt = `Analyze this customer feedback and respond with JSON containing:
{
  "category": "Feature | Bug | UI/UX | Performance | Mobile | Security",
  "sentiment": "positive | neutral | negative",
  "suggestedTags": ["tag1", "tag2"],
  "impactScore": 1-10,
  "aiInsight": "concise insight"
}

Feedback Title: ${title}
Feedback Description: ${description}`;

    // Create a job to invoke the chute
    const createJobResponse = await fetch(`${CHUTES_API_BASE}/jobs/${CHUTE_ID}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        job_args: {
          messages: [
            {
              role: 'system',
              content: 'You are a feedback analysis AI. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        }
      })
    });

    if (!createJobResponse.ok) {
      const errorText = await createJobResponse.text();
      console.error('Chutes AI Job Creation Failed:', errorText);
      return res.status(200).json({
        category: 'General',
        sentiment: 'neutral',
        suggestedTags: [],
        impactScore: 5,
        aiInsight: 'Unable to analyze feedback at this time.'
      });
    }

    const job = await createJobResponse.json();
    const jobId = job.job_id;

    if (!jobId) {
      return res.status(200).json({
        category: 'General',
        sentiment: 'neutral',
        suggestedTags: [],
        impactScore: 5,
        aiInsight: 'Unable to analyze feedback at this time.'
      });
    }

    // Poll for job completion
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`${CHUTES_API_BASE}/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const statusData = await statusResponse.json();

      if (statusData.active === false && statusData.result) {
        const resultContent = statusData.result;
        
        // Try to parse JSON from the response
        const jsonMatch = resultContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return res.status(200).json(parsed);
          } catch (e) {
            // Continue to fallback
          }
        }
        
        return res.status(200).json({
          category: 'General',
          sentiment: 'neutral',
          suggestedTags: [],
          impactScore: 5,
          aiInsight: resultContent
        });
      }

      attempts++;
    }

    return res.status(200).json({
      category: 'General',
      sentiment: 'neutral',
      suggestedTags: [],
      impactScore: 5,
      aiInsight: 'Analysis timed out. Please try again.'
    });
  } catch (error) {
    console.error('Analysis Error:', error);
    return res.status(200).json({
      category: 'General',
      sentiment: 'neutral',
      suggestedTags: [],
      impactScore: 5,
      aiInsight: 'An error occurred during analysis.'
    });
  }
}
