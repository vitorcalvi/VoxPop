import { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeFeedback } from './_aiService.js';

const isProduction = process.env.NODE_ENV === 'production';

const logError = (...args: any[]) => {
  if (isProduction) {
    console.error(...args);
  } else {
    console.error(...args);
  }
};

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
    const result = await analyzeFeedback(title, description, screenshot);
    return res.status(200).json(result);
  } catch (error) {
    logError('Analysis Error:', error);
    return res.status(500).json({ error: 'Failed to analyze feedback' });
  }
}
