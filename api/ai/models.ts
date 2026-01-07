import { VercelRequest, VercelResponse } from '@vercel/node';
import { getModelConfig } from '../../services/chutesService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json(getModelConfig());
  } catch (error) {
    console.error('Error getting model config:', error);
    return res.status(500).json({ error: 'Failed to get model configuration' });
  }
}
