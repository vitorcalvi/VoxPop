import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import { getModelConfig } from './_aiService.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
      GITHUB_TOKEN: process.env.GITHUB_TOKEN ? `✅ Set (${process.env.GITHUB_TOKEN.substring(0, 10)}...)` : '❌ NOT SET',
      GROQ_API_KEY: process.env.GROQ_API_KEY ? `✅ Set (${process.env.GROQ_API_KEY.substring(0, 10)}...)` : '❌ NOT SET',
      DATABASE_URL: process.env.DATABASE_URL ? `✅ Set (${process.env.DATABASE_URL.substring(0, 30)}...)` : '❌ NOT SET',
    },
    tests: {}
  };

  // Test 1: Check if aiService can be imported
  try {
    diagnostics.tests.aiServiceImport = '✅ Success';
    diagnostics.tests.modelConfig = getModelConfig();
  } catch (error) {
    diagnostics.tests.aiServiceImport = `❌ Failed: ${(error as Error).message}`;
  }

  // Test 2: Check if fetch is available
  try {
    diagnostics.tests.fetchAvailable = typeof fetch === 'function' ? '✅ Available' : '❌ Not available';
  } catch (error) {
    diagnostics.tests.fetchAvailable = `❌ Error: ${(error as Error).message}`;
  }

  // Test 3: Quick API connectivity test (no actual call, just check key format)
  if (process.env.GITHUB_TOKEN) {
    const key = process.env.GITHUB_TOKEN;
    diagnostics.tests.githubTokenFormat = key.startsWith('ghp_') || key.startsWith('github_pat_') ? '✅ Valid format' : `⚠️ Unexpected format: ${key.substring(0, 8)}...`;
  }
  if (process.env.GROQ_API_KEY) {
    const key = process.env.GROQ_API_KEY;
    diagnostics.tests.groqApiKeyFormat = key.startsWith('gsk_') ? '✅ Valid format (gsk_...)' : `⚠️ Unexpected format: ${key.substring(0, 5)}...`;
  }

  // Test 4: Database connectivity
  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    diagnostics.tests.databaseConnection = '✅ Connected';
    diagnostics.tests.databaseTime = result.rows[0].time;
    diagnostics.tests.databaseName = result.rows[0].db;
  } catch (error) {
    diagnostics.tests.databaseConnection = `❌ Failed: ${(error as Error).message}`;
  }

  // Test 5: Check feedback_items table
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM feedback_items');
    diagnostics.tests.feedbackItemsTable = `✅ Exists (${result.rows[0].count} items)`;
  } catch (error) {
    diagnostics.tests.feedbackItemsTable = `❌ Error: ${(error as Error).message}`;
  }

  // Test 6: Check user_votes table
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM user_votes');
    diagnostics.tests.userVotesTable = `✅ Exists (${result.rows[0].count} votes)`;
  } catch (error) {
    diagnostics.tests.userVotesTable = `❌ Error: ${(error as Error).message}`;
  }

  return res.status(200).json(diagnostics);
}
