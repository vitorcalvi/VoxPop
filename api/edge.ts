import { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'edge',
};

// Enable CORS for all origins
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;

  // Health check
  if (path === '/api/health' || path === '/health') {
    return res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Feedback API is running (Edge)'
    });
  }

  // API info
  if (path === '/api' && req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Feedback API',
      endpoints: {
        health: 'GET /api/health',
        feedback: 'GET /api/feedback',
        create_feedback: 'POST /api/feedback',
        vote: 'POST /api/feedback/:id/vote',
        analyze: 'POST /api/analyze',
        roadmap: 'POST /api/roadmap'
      }
    });
  }

  return res.status(404).json({ error: 'Not found' });
}
