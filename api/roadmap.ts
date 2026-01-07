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
    const { feedbacks } = req.body;

    if (!feedbacks || feedbacks.length === 0) {
      return res.status(200).json({ summary: 'No feedback to generate roadmap from.' });
    }

    if (!CHUTE_ID) {
      return res.status(200).json({ 
        summary: 'AI Roadmap Generation\n\nPlease configure CHUTE_ID in environment variables to enable AI-powered roadmap generation.\n\nIn the meantime, here are the feedback categories:\n' + 
          feedbacks.map((f: any) => `- [${f.category}] ${f.title}`).join('\n')
      });
    }

    const feedbackText = feedbacks
      .map((f: any) => `- [${f.category}] ${f.title}: ${f.description}`)
      .join('\n');

    const prompt = `As a senior product manager, generate a brief, professional roadmap summary with key themes and prioritization based on this feedback:\n${feedbackText}`;

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
              content: 'You are a senior product manager generating roadmap summaries.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 800
        }
      })
    });

    if (!createJobResponse.ok) {
      return res.status(200).json({ 
        summary: 'Unable to generate roadmap summary at this time.\n\nFeedback Overview:\n' + 
          feedbacks.map((f: any) => `- [${f.category}] ${f.title}`).join('\n')
      });
    }

    const job = await createJobResponse.json();
    const jobId = job.job_id;

    // Poll for completion
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
        return res.status(200).json({ summary: statusData.result });
      }

      attempts++;
    }

    return res.status(200).json({ 
      summary: 'Unable to generate roadmap summary. Please try again.\n\nFeedback Overview:\n' + 
        feedbacks.map((f: any) => `- [${f.category}] ${f.title}`).join('\n')
    });
  } catch (error) {
    console.error('Roadmap Error:', error);
    return res.status(200).json({ summary: 'Unable to generate roadmap summary.' });
  }
}
