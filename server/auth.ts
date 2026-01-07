import express from 'express';
import axios from 'axios';
import { prisma } from './prisma';
import { generateToken, findOrCreateUser, generateCSRFToken, verifyCSRFToken } from './auth-utils';
import { validateEnv } from './config';

const router = express.Router();

// Store CSRF tokens in memory (in production, use Redis)
const csrfStore = new Map<string, { token: string; timestamp: number }>();

/**
 * Step 1: Initiate GitHub OAuth flow
 * GET /api/auth/github/login
 */
router.get('/github/login', (req, res) => {
  try {
    validateEnv();

    // Generate and store CSRF token
    const state = generateCSRFToken();
    csrfStore.set(state, { token: state, timestamp: Date.now() });

    // Build GitHub OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: process.env.GITHUB_CALLBACK_URL!,
      scope: 'user:email',
      state: state,
      allow_signup: 'true',
    });

    const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    res.json({ githubAuthUrl, state });
  } catch (error) {
    console.error('GitHub login init error:', error);
    res.status(500).json({
      error: 'Failed to initiate GitHub login',
      message: 'Please ensure GITHUB_CLIENT_ID and GITHUB_CALLBACK_URL are configured',
    });
  }
});

/**
 * Step 2: Handle GitHub OAuth callback
 * GET /api/auth/github/callback
 */
router.get('/github/callback', async (req, res) => {
  try {
    validateEnv();

    const { code, state } = req.query;

    // Validate state to prevent CSRF attacks
    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'Missing state parameter' });
    }

    const storedCSRF = csrfStore.get(state);
    if (!storedCSRF) {
      return res.status(400).json({ error: 'Invalid or expired state. Please try again.' });
    }

    // Remove used CSRF token
    csrfStore.delete(state);

    // Check if state is expired (5 minutes)
    if (Date.now() - storedCSRF.timestamp > 5 * 60 * 1000) {
      return res.status(400).json({ error: 'State expired. Please try again.' });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({ error: 'Failed to obtain access token from GitHub' });
    }

    // Get user profile from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const githubUser = userResponse.data;

    // Get user email (private by default)
    let primaryEmail = githubUser.email;
    if (!primaryEmail) {
      const emailsResponse = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const primaryEmailObj = emailsResponse.data.find((e: any) => e.primary);
      primaryEmail = primaryEmailObj?.email;
    }

    if (!primaryEmail) {
      return res.status(400).json({
        error: 'Email is required but not available. Please ensure your GitHub email is public.',
      });
    }

    // Find or create user
    const user = await findOrCreateUser({
      id: githubUser.id.toString(),
      login: githubUser.login,
      email: primaryEmail,
      avatar_url: githubUser.avatar_url,
    });

    // Update access token
    await prisma.user.update({
      where: { id: user.id },
      data: { accessToken: access_token },
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      githubId: user.githubId,
      email: user.email,
      role: user.role,
    });

    // Set httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Return user info and token
    res.json({
      message: 'Authentication successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      token,
    });
  } catch (error: any) {
    console.error('GitHub callback error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify token
    const { verifyToken } = await import('./auth-utils');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        githubId: true,
        username: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

/**
 * Logout user
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  try {
    // Clear auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * Refresh token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { verifyToken } = await import('./auth-utils');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get fresh user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new token
    const { generateToken } = await import('./auth-utils');
    const newToken = generateToken({
      userId: user.id,
      githubId: user.githubId,
      email: user.email,
      role: user.role,
    });

    // Update cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.json({ token: newToken, user: { ...user, accessToken: undefined } });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Clean up expired CSRF tokens periodically
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(csrfStore.entries());
  for (const [state, data] of entries) {
    if (now - data.timestamp > 5 * 60 * 1000) {
      csrfStore.delete(state);
    }
  }
}, 60 * 1000); // Clean every minute

export default router;
