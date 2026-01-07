import { VercelRequest, VercelResponse } from '@vercel/node';
import { comprehensiveAnalyze } from '../../services/chutesService';

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
    console.log('📝 comprehensive-analyze request received');
    const { subject, details, images } = req.body;

    console.log('📦 Request data:', {
      subject,
      details: details?.substring(0, 100),
      imagesCount: images?.length
    });

    if (!subject || !details) {
      console.warn('⚠️ Missing required fields');
      return res.status(400).json({ error: 'Subject and details are required' });
    }

    // Use Chutes Plus AI for comprehensive analysis
    console.log('🤖 Calling comprehensiveAnalyze...');
    const result = await comprehensiveAnalyze(subject, details, images);

    console.log('✅ Sending successful response');
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error in comprehensive AI analysis:', error);
    console.error('Error stack:', (error as Error).stack);
    return res.status(500).json({ error: 'Failed to analyze feedback', details: (error as Error).message });
  }
}
