import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { analyzeFeedback, generateRoadmapSummary, listChutes } from '../services/chutesService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger payloads for base64 images

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize database tables
const initDb = async () => {
  try {
    // Create feedback_items table
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

    // Add screenshots column if it doesn't exist (migration for existing tables)
    await pool.query(`
      ALTER TABLE feedback_items 
      ADD COLUMN IF NOT EXISTS screenshots JSONB DEFAULT '[]'::jsonb
    `);

    // Create user_votes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_votes (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" VARCHAR(100),
        "feedbackId" VARCHAR(36) REFERENCES feedback_items(id) ON DELETE CASCADE,
        "votedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("userId", "feedbackId")
      )
    `);

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

// Routes

// Health check
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// List available Chutes AI models
app.get('/api/chutes', async (req, res) => {
  try {
    const chutes = await listChutes();
    res.json(chutes);
  } catch (error) {
    console.error('Error listing chutes:', error);
    res.status(500).json({ error: 'Failed to list chutes' });
  }
});

// Get all feedback with optional filters
app.get('/api/feedback', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM feedback_items';
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
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY votes DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get single feedback
app.get('/api/feedback/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM feedback_items WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM feedback_items');
    res.json(result.rows.map((row: any) => row.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create feedback
app.post('/api/feedback', async (req, res) => {
  try {
    const { title, description, category, sentiment, aiInsight, screenshot, screenshots, status = 'open' } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    
    // Handle both legacy single screenshot and new screenshots array
    const screenshotsArray = screenshots || (screenshot ? [screenshot] : []);
    
    const result = await pool.query(
      `INSERT INTO feedback_items (id, title, description, category, sentiment, "aiInsight", screenshot, screenshots, status, votes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
       RETURNING *`,
      [id, title, description, category, sentiment, aiInsight, screenshot || null, JSON.stringify(screenshotsArray), status]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

// Update feedback
app.put('/api/feedback/:id', async (req, res) => {
  try {
    const { title, description, category, status, sentiment, aiInsight } = req.body;
    const result = await pool.query(
      `UPDATE feedback_items
       SET title = $1, description = $2, category = $3, status = $4, sentiment = $5, "aiInsight" = $6, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [title, description, category, status, sentiment, aiInsight, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// Vote on feedback
app.post('/api/feedback/:id/vote', async (req, res) => {
  try {
    const { userId, vote } = req.body; // vote: true (upvote) or false (toggle off)
    
    // Check if user already voted
    const existingVote = await pool.query(
      'SELECT * FROM user_votes WHERE "userId" = $1 AND "feedbackId" = $2',
      [userId, req.params.id]
    );

    if (existingVote.rows.length > 0) {
      // User already voted - remove the vote
      await pool.query(
        'DELETE FROM user_votes WHERE id = $1',
        [existingVote.rows[0].id]
      );
      // Decrement votes when removing
      await pool.query(
        'UPDATE feedback_items SET votes = votes - 1 WHERE id = $1',
        [req.params.id]
      );
    } else if (vote) {
      // User hasn't voted and wants to upvote - add the vote
      await pool.query(
        'INSERT INTO user_votes ("userId", "feedbackId") VALUES ($1, $2)',
        [userId, req.params.id]
      );
      // Increment votes when adding
      await pool.query(
        'UPDATE feedback_items SET votes = votes + 1 WHERE id = $1',
        [req.params.id]
      );
    }
    // If vote is false and user hasn't voted, do nothing

    const result = await pool.query('SELECT * FROM feedback_items WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// AI Analysis
app.post('/api/analyze', async (req, res) => {
  try {
    const { title, description, screenshot } = req.body;
    const analysis = await analyzeFeedback(title, description, screenshot);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing feedback:', error);
    res.status(500).json({ error: 'Failed to analyze feedback' });
  }
});

// Generate Roadmap
app.post('/api/roadmap', async (req, res) => {
  try {
    const { feedbacks } = req.body;
    const summary = await generateRoadmapSummary(feedbacks);
    res.json({ summary });
  } catch (error) {
    console.error('Error generating roadmap:', error);
    res.status(500).json({ error: 'Failed to generate roadmap' });
  }
});

// Delete feedback
app.delete('/api/feedback/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM feedback_items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Feedback deleted' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  });
});
