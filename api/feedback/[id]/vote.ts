import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
    const { body, query } = req;
    const { userId, vote } = body || {};
    const { id } = query;

    // Validate required fields
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid feedback ID' });
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }

    // Verify feedback item exists before processing vote
    const feedbackCheck = await pool.query(
      'SELECT id FROM feedback_items WHERE id = $1',
      [id]
    );

    if (feedbackCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback item not found', feedbackId: id });
    }

    // Check if user already voted
    const existingVote = await pool.query(
      'SELECT * FROM user_votes WHERE "userId" = $1 AND "feedbackId" = $2',
      [userId, id]
    );

    if (existingVote.rows.length > 0) {
      // User already voted - remove vote
      await pool.query(
        'DELETE FROM user_votes WHERE id = $1',
        [existingVote.rows[0].id]
      );
      // Decrement votes when removing
      await pool.query(
        'UPDATE feedback_items SET votes = votes - 1 WHERE id = $1',
        [id]
      );
    } else if (vote) {
      // User hasn't voted and wants to upvote - add vote
      const voteId = Math.random().toString(36).substring(2, 11);
      await pool.query(
        'INSERT INTO user_votes (id, "userId", "feedbackId") VALUES ($1, $2, $3)',
        [voteId, userId, id]
      );
      // Increment votes when adding
      await pool.query(
        'UPDATE feedback_items SET votes = votes + 1 WHERE id = $1',
        [id]
      );
    }
    // If vote is false and user hasn't voted, do nothing

    const result = await pool.query('SELECT * FROM feedback_items WHERE id = $1', [id]);
    return res.status(200).json(result.rows[0]);
  } catch (error: unknown) {
    const err = error as Error & { code?: string; detail?: string };
    console.error('Vote API Error:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });

    // Return more helpful error in development
    return res.status(500).json({
      error: 'Vote operation failed',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      code: err.code
    });
  }
}
