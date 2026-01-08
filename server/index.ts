// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isProduction = process.env.NODE_ENV === 'production';

const log = (...args: any[]) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const logError = (...args: any[]) => {
  if (isProduction) {
    console.error(...args);
  } else {
    console.error(...args);
  }
};

const logWarn = (...args: any[]) => {
  if (isProduction) {
    console.warn(...args);
  } else {
    console.warn(...args);
  }
};

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import { analyzeFeedback, generateRoadmapSummary, comprehensiveAnalyze, getModelConfig, getGitHubToken, getGroqApiKey } from '../api/_aiService.js';
import authRoutes from './auth.js';
import { authenticateUser, authenticateUserFromCookie, requireAdmin, handleAuthError } from './auth-middleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Protected routes middleware
app.get('/api/user/me', authenticateUserFromCookie, (req, res) => {
  res.json(req.user);
});

// Get all feedback
app.get('/api/feedback', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM feedback_items WHERE 1=1';
    const params: any[] = [];

    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }

    if (search) {
      query += ' AND (title ILIKE $2 OR description ILIKE $3)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY votes DESC, createdAt DESC';

    const result = await pool.query(query, params.length > 0 ? params : undefined);
    res.json(result.rows);
  } catch (error) {
    logError('Error fetching feedback:', error);
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
    logError('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM feedback_items ORDER BY category');
    res.json(result.rows.map((row: any) => row.category));
  } catch (error) {
    logError('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create feedback
app.post('/api/feedback', async (req, res) => {
  try {
    logError('Request body:', req.body);
    const { title, description, category, sentiment, aiInsight, screenshot, status } = req.body;
    
    const result = await pool.query(
      `INSERT INTO feedback_items (title, description, category, votes, status, sentiment, aiInsight, screenshot, createdAt, updatedAt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [title, description, category || 'General', 1, status || 'open', sentiment, aiInsight, screenshot]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logError('Error creating feedback:', error);
    logError('Error details:', (error as any).message);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

// Update feedback
app.put('/api/feedback/:id', async (req, res) => {
  try {
    const { title, description, category, status, sentiment, aiInsight } = req.body;
    const result = await pool.query(
      `UPDATE feedback_items 
       SET title = $1, description = $2, category = $3, status = $4, sentiment = $5, aiInsight = $6, updatedAt = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, description, category, status, sentiment, aiInsight, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logError('Error updating feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// Vote on feedback
app.post('/api/feedback/:id/vote', async (req, res) => {
  try {
    const { userId, vote } = req.body;
    const feedbackId = req.params.id;

    // Check if user already voted
    const existingVote = await pool.query(
      'SELECT * FROM user_votes WHERE "userId" = $1 AND "feedbackId" = $2',
      [userId, feedbackId]
    );

    if (existingVote.rows.length > 0) {
      // Remove vote if toggling off
      if (vote === false) {
        await pool.query('DELETE FROM user_votes WHERE "userId" = $1 AND "feedbackId" = $2', [userId, feedbackId]);
        await pool.query('UPDATE feedback_items SET votes = votes - 1 WHERE id = $1', [feedbackId]);
      }
      return res.json({ message: 'Vote toggled' });
    }

    // Add new vote
    await pool.query(
      'INSERT INTO user_votes ("userId", "feedbackId", "votedAt") VALUES ($1, $2, NOW())',
      [userId, feedbackId]
    );
    await pool.query('UPDATE feedback_items SET votes = votes + 1 WHERE id = $1', [feedbackId]);

    res.json({ message: 'Vote recorded' });
  } catch (error) {
    logError('Error voting:', { message: (error as any).message, code: (error as any).code });
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Delete feedback
app.delete('/api/feedback/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM feedback_items WHERE id = $1', [req.params.id]);
    res.json({ message: 'Feedback deleted' });
  } catch (error) {
    logError('Error deleting feedback:', error);
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
    logError('Error fetching user votes:', error);
    res.status(500).json({ error: 'Failed to fetch user votes' });
  }
});

// AI Analysis (GitHub Models + Groq)
app.post('/api/analyze', async (req, res) => {
  try {
    const { title, description, screenshot } = req.body;
    log('📝 Analyze request:', { title, hasScreenshot: !!screenshot });
    const result = await analyzeFeedback(title, description, screenshot);
    log('✅ Analyze result:', result ? 'Success' : 'Null');
    res.json(result);
  } catch (error) {
    logError('❌ Error analyzing feedback:', error);
    res.status(500).json({ error: 'Failed to analyze feedback', details: (error as Error).message });
  }
});

// Generate Roadmap (GitHub Models + Groq)
app.post('/api/roadmap', async (req, res) => {
  try {
    const { feedbacks } = req.body;
    const summary = await generateRoadmapSummary(feedbacks);
    res.json({ summary });
  } catch (error) {
    logError('Error generating roadmap:', error);
    res.status(500).json({ error: 'Failed to generate roadmap' });
  }
});

// Comprehensive AI Analysis Endpoint
app.post('/api/ai/comprehensive-analyze', async (req, res) => {
  try {
    const { subject, details, images, language } = req.body;

    if (!subject || !details) {
      return res.status(400).json({ error: 'Subject and details are required' });
    }

    log('🤖 Calling comprehensiveAnalyze...');
    const result = await comprehensiveAnalyze(subject, details, images, language);

    log('✅ Sending successful response');
    return res.status(200).json(result);
  } catch (error) {
    logError('❌ Error in comprehensive AI analysis:', error);
    logError('Error stack:', (error as Error).stack);
    return res.status(500).json({ error: 'Failed to analyze feedback', details: (error as Error).message });
  }
});

// Protected feedback endpoints (require authentication)
app.post('/api/feedback/protected', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { title, description, category, sentiment, aiInsight, screenshot } = req.body;
    
    const result = await pool.query(
      `INSERT INTO feedback_items (title, description, category, votes, status, sentiment, aiInsight, screenshot, createdAt, updatedAt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [title, description, category, 1, 'open', sentiment, aiInsight, screenshot]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logError('Error creating protected feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

// Audit findings endpoints
app.get('/api/audit/findings', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_findings ORDER BY "createdAt" DESC');
    res.json(result.rows);
  } catch (error) {
    logError('Error fetching audit findings:', error);
    res.status(500).json({ error: 'Failed to fetch audit findings' });
  }
});

app.post('/api/audit/findings', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { title, description, severity, status } = req.body;
    const result = await pool.query(
      `INSERT INTO audit_findings (title, description, severity, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [title, description, severity, status || 'open']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logError('Error creating audit finding:', error);
    res.status(500).json({ error: 'Failed to create audit finding' });
  }
});

app.put('/api/audit/findings/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { title, description, severity, status } = req.body;
    const result = await pool.query(
      `UPDATE audit_findings 
       SET title = $1, description = $2, severity = $3, status = $4, "updatedAt" = NOW()
       WHERE id = $5
       RETURNING *`,
      [title, description, severity, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logError('Error updating audit finding:', error);
    res.status(500).json({ error: 'Failed to update audit finding' });
  }
});

app.delete('/api/audit/findings/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM audit_findings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Audit finding deleted' });
  } catch (error) {
    logError('Error deleting audit finding:', error);
    res.status(500).json({ error: 'Failed to delete audit finding' });
  }
});

app.get('/api/audit/metrics', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        severity,
        status,
        COUNT(*) as count
      FROM audit_findings
      GROUP BY severity, status
      ORDER BY severity, status
    `);
    res.json(result.rows);
  } catch (error) {
    logError('Error fetching audit metrics:', error);
    res.status(500).json({ error: 'Failed to fetch audit metrics' });
  }
});

// Discussion comments endpoint
app.get('/api/feedback/:id/discussions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM discussion_comments WHERE "feedbackId" = $1 ORDER BY "createdAt" ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    logError('Error fetching discussions:', error);
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
});

app.post('/api/feedback/:id/discussions', async (req, res) => {
  try {
    const { userId, username, content } = req.body;
    const result = await pool.query(
      `INSERT INTO discussion_comments ("feedbackId", "userId", username, content, "createdAt")
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [req.params.id, userId, username || 'Anonymous', content]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logError('Error adding discussion comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

app.delete('/api/discussions/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM discussion_comments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    logError('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Initialize database tables
const initDb = async () => {
  try {
    // Create feedback_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        votes INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'open',
        sentiment VARCHAR(20),
        aiInsight TEXT,
        screenshot TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user_votes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        userId VARCHAR(100),
        feedbackId UUID,
        votedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(userId, feedbackId),
        FOREIGN KEY (feedbackId) REFERENCES feedback_items(id) ON DELETE CASCADE
      )
    `);

    // Create audit_findings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_findings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        severity VARCHAR(50),
        status VARCHAR(20) DEFAULT 'open',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create discussion_comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS discussion_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feedbackId UUID,
        userId VARCHAR(100),
        username VARCHAR(100),
        content TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (feedbackId) REFERENCES feedback_items(id) ON DELETE CASCADE
      )
    `);

    log('✅ Database tables initialized');
  } catch (error) {
    logError('❌ Database initialization error:', error);
    throw error;
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  log('\n👋 Shutting down gracefully...');
  pool.end(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('\n👋 Shutting down gracefully...');
  pool.end(() => {
    process.exit(0);
  });
});

// Start server
initDb().then(() => {
  app.listen(PORT, () => {
    log(`🚀 Backend server running on http://localhost:${PORT}`);
    log(`🤖 AI Providers: ${getGitHubToken() ? '✅ GitHub' : '❌ GitHub'} | ${getGroqApiKey() ? '✅ Groq' : '❌ Groq'}`);
  });
});
