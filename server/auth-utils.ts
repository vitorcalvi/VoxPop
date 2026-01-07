import { prisma } from './prisma';
import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  githubId: string;
  email: string;
  role: string;
}

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'voxpop',
    audience: 'voxpop-users',
  } as jwt.SignOptions);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const decoded = jwt.verify(token, secret, {
      issuer: 'voxpop',
      audience: 'voxpop-users',
    }) as TokenPayload;

    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Extract JWT token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Find or create user from GitHub profile
 */
export async function findOrCreateUser(profile: {
  id: string;
  login: string;
  email: string | null;
  avatar_url: string | null;
}) {
  // Check if user exists by GitHub ID
  let user = await prisma.user.findUnique({
    where: { githubId: profile.id },
  });

  if (user) {
    // Update user info if changed
    user = await prisma.user.update({
      where: { githubId: profile.id },
      data: {
        username: profile.login,
        email: profile.email || user.email,
        avatarUrl: profile.avatar_url,
        updatedAt: new Date(),
      },
    });

    return user;
  }

  // Determine role - admin if email matches
  const role = profile.email === 'vcalvi@gmail.com' ? 'ADMIN' : 'USER';

  // Create new user
  user = await prisma.user.create({
    data: {
      githubId: profile.id,
      username: profile.login,
      email: profile.email || `${profile.login}@github.local`,
      avatarUrl: profile.avatar_url,
      role: role,
    },
  });

  return user;
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: { role: string }): boolean {
  return user.role === 'ADMIN';
}

/**
 * Get CSRF token for OAuth state
 */
export function generateCSRFToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(providedToken: string, storedToken: string): boolean {
  return providedToken === storedToken;
}
