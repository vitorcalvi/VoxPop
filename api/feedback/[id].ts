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
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { method, body, query } = req;
    const { id } = query;

    // Get single feedback
    if (method === 'GET') {
      const result = await pool.query('SELECT * FROM feedback_items WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      return res.status(200).json(result.rows[0]);
    }

    // Update feedback
    if (method === 'PUT') {
      const { title, description, category, status, sentiment, aiInsight } = body;
      const result = await pool.query(
        `UPDATE feedback_items
         SET title = $1, description = $2, category = $3, status = $4, sentiment = $5, "aiInsight" = $6, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [title, description, category, status, sentiment, aiInsight, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      return res.status(200).json(result.rows[0]);
    }

    // Delete feedback
    if (method === 'DELETE') {
      await pool.query('DELETE FROM feedback_items WHERE id = $1', [id]);
      return res.status(200).json({ message: 'Feedback deleted' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
