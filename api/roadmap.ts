import { VercelRequest, VercelResponse } from '@vercel/node';

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

    // AI roadmap disabled - return placeholder with feedback overview
    return res.status(200).json({
      summary: 'AI Roadmap Generation\n\nPlease configure an AI provider to enable AI-powered roadmap generation.\n\nIn the meantime, here are the feedback categories:\n' +
        feedbacks.map((f: any) => `- [${f.category}] ${f.title}`).join('\n')
    });
  } catch (error) {
    console.error('Roadmap Error:', error);
    return res.status(200).json({ summary: 'Unable to generate roadmap summary.' });
  }
}
