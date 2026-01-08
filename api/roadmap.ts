import { VercelRequest, VercelResponse } from '@vercel/node';
import { generateRoadmapSummary } from './_aiService.js';

const isProduction = process.env.NODE_ENV === 'production';

const log = (...args: any[]) => {
  if (!isProduction) {
    console.log(...args);
  }
};

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
    const { feedbacks } = req.body;

    if (!feedbacks || !Array.isArray(feedbacks)) {
      return res.status(400).json({
        error: 'Invalid request',
        summary: 'Feedbacks array is required'
      });
    }

    if (feedbacks.length === 0) {
      return res.status(200).json({ summary: 'No feedback to generate roadmap from.' });
    }

    // Log payload size for monitoring
    const payloadSize = JSON.stringify(req.body).length;
    log(`Roadmap request: ${feedbacks.length} items, ~${(payloadSize / 1024).toFixed(2)} KB`);

    const summary = await generateRoadmapSummary(feedbacks);
    return res.status(200).json({ summary });
  } catch (error) {
    logError('Roadmap Error:', error);
    return res.status(500).json({
      error: 'Failed to generate roadmap',
      details: error instanceof Error ? error.message : 'Unknown error',
      summary: 'An error occurred while generating roadmap. Please try again.'
    });
  }
}
