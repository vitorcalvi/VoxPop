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
        status VARCHAR(20) DEFAULT 'OPEN',
        sentiment VARCHAR(20),
        "aiInsight" TEXT,
        screenshot TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
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
      const { title, description, category, sentiment, aiInsight, screenshot, status = 'OPEN' } = body;
      const id = Math.random().toString(36).substr(2, 9);
      
      const result = await pool.query(
        `INSERT INTO feedback_items (id, title, description, category, sentiment, "aiInsight", screenshot, status, votes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
         RETURNING *`,
        [id, title, description, category, sentiment, aiInsight, screenshot, status]
      );

      return res.status(201).json(result.rows[0]);
    }

    // Vote on feedback
    if (method === 'POST' && query.vote !== undefined) {
      const feedbackId = query.id as string;
      const { userId, vote } = body;
      
      const existingVote = await pool.query(
        'SELECT * FROM user_votes WHERE "userId" = $1 AND "feedbackId" = $2',
        [userId, feedbackId]
      );

      if (existingVote.rows.length > 0) {
        await pool.query('DELETE FROM user_votes WHERE id = $1', [existingVote.rows[0].id]);
        await pool.query('UPDATE feedback_items SET votes = votes - 1 WHERE id = $1', [feedbackId]);
      } else if (vote) {
        await pool.query('INSERT INTO user_votes ("userId", "feedbackId") VALUES ($1, $2)', [userId, feedbackId]);
        await pool.query('UPDATE feedback_items SET votes = votes + 1 WHERE id = $1', [feedbackId]);
      }

      const result = await pool.query('SELECT * FROM feedback_items WHERE id = $1', [feedbackId]);
      return res.status(200).json(result.rows[0]);
    }

    // Delete feedback
    if (method === 'DELETE' && query.id) {
      await pool.query('DELETE FROM feedback_items WHERE id = $1', [query.id]);
      return res.status(200).json({ message: 'Feedback deleted' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
