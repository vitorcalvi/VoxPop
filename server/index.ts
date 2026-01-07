// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import { analyzeFeedback, generateRoadmapSummary, comprehensiveAnalyze, getModelConfig } from '../services/chutesService.js';
import authRoutes from './auth.js';
import { authenticateUser, authenticateUserFromCookie, requireAdmin, handleAuthError } from './auth-middleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(cookieParser());
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

// AI Model Configuration
app.get('/api/ai/models', async (req, res) => {
  res.json(getModelConfig());
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, title, description, category, sentiment, aiInsight, screenshot || null, JSON.stringify(screenshotsArray), status, 1]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating feedback:', error);
    console.error('Request body:', req.body);
    console.error('Error details:', (error as any).message);
    res.status(500).json({ error: 'Failed to create feedback', details: (error as any).message });
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

// AI Analysis (Chutes Plus)
app.post('/api/analyze', async (req, res) => {
  try {
    const { title, description, screenshot } = req.body;
    const result = await analyzeFeedback(title, description, screenshot);
    res.json(result);
  } catch (error) {
    console.error('Error analyzing feedback:', error);
    res.status(500).json({ error: 'Failed to analyze feedback' });
  }
});

// Generate Roadmap (Chutes Plus)
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

// Get user's votes
app.get('/api/user/votes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT "feedbackId" FROM user_votes WHERE "userId" = $1',
      [userId]
    );
    res.json(result.rows.map((row: any) => row.feedbackId));
  } catch (error) {
    console.error('Error fetching user votes:', error);
    res.status(500).json({ error: 'Failed to fetch user votes' });
  }
});

// Comprehensive AI Analysis Endpoint (Chutes Plus)
app.post('/api/ai/comprehensive-analyze', async (req, res) => {
  try {
    const { subject, details, images } = req.body;

    if (!subject || !details) {
      return res.status(400).json({ error: 'Subject and details are required' });
    }

    // Use Chutes Plus AI for comprehensive analysis
    const result = await comprehensiveAnalyze(subject, details, images);

    if (!result) {
      return res.status(500).json({ error: 'AI analysis failed' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error in comprehensive AI analysis:', error);
    res.status(500).json({ error: 'Failed to analyze feedback' });
  }
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Example protected route - requires authentication
app.get('/api/protected/dashboard', authenticateUserFromCookie, (req, res) => {
  res.json({
    message: 'Welcome to the protected dashboard!',
    user: req.user,
  });
});

// Example admin-only route - requires authentication AND admin role
app.get('/api/admin/users', authenticateUserFromCookie, requireAdmin, (req, res) => {
  res.json({
    message: 'Admin-only route accessed successfully',
    adminUser: req.user,
    // You would fetch actual users here
  });
});

// Example of creating protected feedback (requires authentication)
app.post('/api/protected/feedback', authenticateUserFromCookie, async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const userId = req.user?.userId;

    // Check if authenticated user has role info in request
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await pool.query(
      `INSERT INTO feedback_items (id, title, description, category, votes)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING *`,
      [Math.random().toString(36).substr(2, 9), title, description, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating protected feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

// Example admin-only feedback deletion
app.delete('/api/admin/feedback/:id', authenticateUserFromCookie, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM feedback_items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Feedback deleted by admin' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Error handler for authentication errors
app.use(handleAuthError);

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

    // Check Chutes Plus API status
    if (process.env.CHUTES_API_KEY) {
      console.log('✅ Chutes Plus AI: Configured');
    } else {
      console.log('⚠️  Chutes Plus AI: Not configured (set CHUTES_API_KEY in .env)');
    }
  });
});
