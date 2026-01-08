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
        status VARCHAR(20) DEFAULT 'OPEN',
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

    // Create audit_findings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_findings (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        "issueType" VARCHAR(50) NOT NULL CHECK ("issueType" IN ('usability', 'accessibility', 'visual_design', 'information_architecture', 'interaction_design')),
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
        status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
        screenshot TEXT,
        hotspots JSONB DEFAULT '[]'::jsonb,
        "suggestedImprovement" TEXT,
        "pageUrl" VARCHAR(500) NOT NULL,
        browser VARCHAR(100),
        device VARCHAR(100),
        "responsiveView" VARCHAR(20) CHECK ("responsiveView" IN ('mobile', 'tablet', 'desktop')),
        "userPersonas" TEXT[],
        "wcagReference" VARCHAR(200),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create audit_discussions table for threaded comments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_discussions (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        "auditId" VARCHAR(36) NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
        author VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// Debug endpoint for database diagnostics
app.get('/api/debug', async (req, res) => {
  try {
    const dbTest = await pool.query('SELECT NOW() as time');
    const feedbackCount = await pool.query('SELECT COUNT(*) as count FROM feedback_items');
    const votesCount = await pool.query('SELECT COUNT(*) as count FROM user_votes');

    // Check table schema
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_votes'
      ORDER BY ordinal_position
    `);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        time: dbTest.rows[0].time,
        feedbackCount: feedbackCount.rows[0].count,
        votesCount: votesCount.rows[0].count
      },
      userVotesSchema: tableInfo.rows
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
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
    const { title, description, category, sentiment, aiInsight, screenshot, screenshots, status = 'OPEN' } = req.body;
    const id = Math.random().toString(36).substr(2, 9);

    // Handle both legacy single screenshot and new screenshots array
    const screenshotsArray = screenshots || (screenshot ? [screenshot] : []);

    const result = await pool.query(
      `INSERT INTO feedback_items (id, title, description, category, sentiment, "aiInsight", screenshot, screenshots, status, votes, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
    const { userId, vote } = req.body || {}; // vote: true (upvote) or false (toggle off)
    const feedbackId = req.params.id;

    // Validate required fields
    if (!feedbackId) {
      return res.status(400).json({ error: 'Missing feedback ID' });
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }

    // Verify feedback item exists before processing vote
    const feedbackCheck = await pool.query(
      'SELECT id FROM feedback_items WHERE id = $1',
      [feedbackId]
    );

    if (feedbackCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback item not found', feedbackId });
    }

    // Check if user already voted
    const existingVote = await pool.query(
      'SELECT * FROM user_votes WHERE "userId" = $1 AND "feedbackId" = $2',
      [userId, feedbackId]
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
        [feedbackId]
      );
    } else if (vote) {
      // User hasn't voted and wants to upvote - add the vote
      const voteId = Math.random().toString(36).substring(2, 11);
      await pool.query(
        'INSERT INTO user_votes (id, "userId", "feedbackId") VALUES ($1, $2, $3)',
        [voteId, userId, feedbackId]
      );
      // Increment votes when adding
      await pool.query(
        'UPDATE feedback_items SET votes = votes + 1 WHERE id = $1',
        [feedbackId]
      );
    }
    // If vote is false and user hasn't voted, do nothing

    const result = await pool.query('SELECT * FROM feedback_items WHERE id = $1', [feedbackId]);
    res.json(result.rows[0]);
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error('Error voting:', { message: err.message, code: err.code });
    res.status(500).json({ error: 'Failed to vote', code: err.code });
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

// === AUDIT FINDINGS API ===

// Get all audit findings with filters
app.get('/api/audits', async (req, res) => {
  try {
    const { issueType, severity, status, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let query = 'SELECT * FROM audit_findings';
    const params: any[] = [];
    const conditions: string[] = [];

    if (issueType && issueType !== 'all') {
      conditions.push('"issueType" = $' + (params.length + 1));
      params.push(issueType);
    }

    if (severity && severity !== 'all') {
      conditions.push('severity = $' + (params.length + 1));
      params.push(severity);
    }

    if (status && status !== 'all') {
      conditions.push('status = $' + (params.length + 1));
      params.push(status);
    }

    if (search) {
      const paramIndex = params.length + 1;
      conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex + 1} OR "pageUrl" ILIKE $${paramIndex + 2})`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY CASE ' +
      'WHEN severity = \'critical\' THEN 1 ' +
      'WHEN severity = \'high\' THEN 2 ' +
      'WHEN severity = \'medium\' THEN 3 ' +
      'WHEN severity = \'low\' THEN 4 ' +
      'END, "createdAt" DESC';

    query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM audit_findings';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      findings: result.rows,
      total: Number(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(countResult.rows[0].count) / Number(limit))
    });
  } catch (error) {
    console.error('Error fetching audit findings:', error);
    res.status(500).json({ error: 'Failed to fetch audit findings' });
  }
});

// Get audit metrics for dashboard
app.get('/api/audits/metrics', async (req, res) => {
  try {
    const [byType, bySeverity, byStatus, byPage] = await Promise.all([
      pool.query('SELECT "issueType", COUNT(*) as count FROM audit_findings GROUP BY "issueType"'),
      pool.query('SELECT severity, COUNT(*) as count FROM audit_findings GROUP BY severity'),
      pool.query('SELECT status, COUNT(*) as count FROM audit_findings GROUP BY status'),
      pool.query('SELECT "pageUrl", COUNT(*) as count FROM audit_findings GROUP BY "pageUrl" ORDER BY count DESC LIMIT 10')
    ]);

    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const severityMap = new Map(bySeverity.rows.map((r: any) => [r.severity, Number(r.count)]));

    res.json({
      byIssueType: byType.rows.map((r: any) => ({ issueType: r.issueType, count: Number(r.count) })),
      bySeverity: severityOrder.map(severity => ({
        severity,
        count: severityMap.get(severity) || 0
      })),
      byStatus: byStatus.rows.map((r: any) => ({ status: r.status, count: Number(r.count) })),
      byPage: byPage.rows.map((r: any) => ({ pageUrl: r.pageUrl, count: Number(r.count) }))
    });
  } catch (error) {
    console.error('Error fetching audit metrics:', error);
    res.status(500).json({ error: 'Failed to fetch audit metrics' });
  }
});

// Get single audit finding with discussions
app.get('/api/audits/:id', async (req, res) => {
  try {
    const findingResult = await pool.query('SELECT * FROM audit_findings WHERE id = $1', [req.params.id]);
    if (findingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Audit finding not found' });
    }

    const discussionsResult = await pool.query(
      'SELECT * FROM audit_discussions WHERE "auditId" = $1 ORDER BY "createdAt" ASC',
      [req.params.id]
    );

    res.json({
      finding: findingResult.rows[0],
      discussions: discussionsResult.rows
    });
  } catch (error) {
    console.error('Error fetching audit finding:', error);
    res.status(500).json({ error: 'Failed to fetch audit finding' });
  }
});

// Create audit finding
app.post('/api/audits', async (req, res) => {
  try {
    const {
      title,
      description,
      issueType,
      severity,
      status = 'open',
      screenshot,
      hotspots,
      suggestedImprovement,
      pageUrl,
      browser,
      device,
      responsiveView,
      userPersonas,
      wcagReference
    } = req.body;

    const id = Math.random().toString(36).substr(2, 9);

    const result = await pool.query(
      `INSERT INTO audit_findings (
        id, title, description, "issueType", severity, status,
        screenshot, hotspots, "suggestedImprovement", "pageUrl",
        browser, device, "responsiveView", "userPersonas", "wcagReference", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        id,
        title,
        description,
        issueType,
        severity,
        status,
        screenshot || null,
        JSON.stringify(hotspots || []),
        suggestedImprovement || null,
        pageUrl,
        browser || null,
        device || null,
        responsiveView || null,
        userPersonas || [],
        wcagReference || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating audit finding:', error);
    res.status(500).json({ error: 'Failed to create audit finding' });
  }
});

// Update audit finding
app.put('/api/audits/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      issueType,
      severity,
      status,
      screenshot,
      hotspots,
      suggestedImprovement,
      pageUrl,
      browser,
      device,
      responsiveView,
      userPersonas,
      wcagReference
    } = req.body;

    const result = await pool.query(
      `UPDATE audit_findings
       SET title = $1, description = $2, "issueType" = $3, severity = $4, status = $5,
           screenshot = $6, hotspots = $7, "suggestedImprovement" = $8, "pageUrl" = $9,
           browser = $10, device = $11, "responsiveView" = $12, "userPersonas" = $13, "wcagReference" = $14, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $15
       RETURNING *`,
      [
        title,
        description,
        issueType,
        severity,
        status,
        screenshot || null,
        JSON.stringify(hotspots || []),
        suggestedImprovement || null,
        pageUrl,
        browser || null,
        device || null,
        responsiveView || null,
        userPersonas || [],
        wcagReference || null,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit finding not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating audit finding:', error);
    res.status(500).json({ error: 'Failed to update audit finding' });
  }
});

// Delete audit finding
app.delete('/api/audits/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM audit_findings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Audit finding deleted' });
  } catch (error) {
    console.error('Error deleting audit finding:', error);
    res.status(500).json({ error: 'Failed to delete audit finding' });
  }
});

// Add comment to audit discussion
app.post('/api/audits/:id/discussions', async (req, res) => {
  try {
    const { author, content } = req.body;
    const id = Math.random().toString(36).substr(2, 9);

    const result = await pool.query(
      `INSERT INTO audit_discussions (id, "auditId", author, content, "createdAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, req.params.id, author, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding discussion comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete discussion comment
app.delete('/api/audits/:auditId/discussions/:commentId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM audit_discussions WHERE id = $1 AND "auditId" = $2',
      [req.params.commentId, req.params.auditId]
    );
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
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
