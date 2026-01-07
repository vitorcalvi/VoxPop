import { VercelRequest, VercelResponse } from '@vercel/node';
import { getModelConfig } from './_chutesService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'not set',
    vercel: process.env.VERCEL || 'not set',
    envVars: {
      CHUTES_API_KEY: process.env.CHUTES_API_KEY ? `✅ Set (${process.env.CHUTES_API_KEY.substring(0, 10)}...)` : '❌ NOT SET',
      DATABASE_URL: process.env.DATABASE_URL ? `✅ Set (${process.env.DATABASE_URL.substring(0, 30)}...)` : '❌ NOT SET',
    },
    tests: {}
  };

  // Test 1: Check if chutesService can be imported
  try {
    diagnostics.tests.chutesServiceImport = '✅ Success';
    diagnostics.tests.modelConfig = getModelConfig();
  } catch (error) {
    diagnostics.tests.chutesServiceImport = `❌ Failed: ${(error as Error).message}`;
  }

  // Test 2: Check if fetch is available
  try {
    diagnostics.tests.fetchAvailable = typeof fetch === 'function' ? '✅ Available' : '❌ Not available';
  } catch (error) {
    diagnostics.tests.fetchAvailable = `❌ Error: ${(error as Error).message}`;
  }

  // Test 3: Quick Chutes API connectivity test (no actual call, just check key format)
  if (process.env.CHUTES_API_KEY) {
    const key = process.env.CHUTES_API_KEY;
    diagnostics.tests.apiKeyFormat = key.startsWith('cpk_') ? '✅ Valid format (cpk_...)' : `⚠️ Unexpected format: ${key.substring(0, 5)}...`;
  }

  return res.status(200).json(diagnostics);
}
