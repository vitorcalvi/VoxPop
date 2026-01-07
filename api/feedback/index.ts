import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize database tables
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        votes INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'open',
        sentiment VARCHAR(20),
        "aiInsight" TEXT,
        screenshot TEXT,
        screenshots JSONB DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE feedback_items
      ADD COLUMN IF NOT EXISTS screenshots JSONB DEFAULT '[]'::jsonb
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_votes (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" VARCHAR(100),
        "feedbackId" VARCHAR(36) REFERENCES feedback_items(id) ON DELETE CASCADE,
        "votedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("userId", "feedbackId")
      )
    `);
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

initDb();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { method, query, body } = req;

    // Get all feedback with optional filters
    if (method === 'GET') {
      const { category, search } = query;
      let queryStr = 'SELECT * FROM feedback_items';
      const params: string[] = [];
      const conditions: string[] = [];

      if (category && category !== 'All') {
        conditions.push('category = $1');
        params.push(category as string);
      }

      if (search) {
        const paramIndex = params.length + 1;
        conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex + 1})`);
        params.push(`%${search}%`, `%${search}%`);
      }

      if (conditions.length > 0) {
        queryStr += ' WHERE ' + conditions.join(' AND ');
      }

      queryStr += ' ORDER BY votes DESC';

      const result = await pool.query(queryStr, params);
      return res.status(200).json(result.rows);
    }

    // Create feedback
    if (method === 'POST') {
      const { title, description, category, sentiment, aiInsight, screenshot, screenshots, status = 'open' } = body;
      const id = Math.random().toString(36).substr(2, 9);

      const screenshotsArray = screenshots || (screenshot ? [screenshot] : []);

      const result = await pool.query(
        `INSERT INTO feedback_items (id, title, description, category, sentiment, "aiInsight", screenshot, screenshots, status, votes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
         RETURNING *`,
        [id, title, description, category, sentiment, aiInsight, screenshot || null, JSON.stringify(screenshotsArray), status]
      );

      return res.status(201).json(result.rows[0]);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
