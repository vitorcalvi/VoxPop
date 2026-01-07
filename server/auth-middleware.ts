import { Request, Response, NextFunction } from 'express';
import { verifyToken, isAdmin } from './auth-utils';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        githubId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate user using JWT token
 * Checks Authorization header for Bearer token
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      res.status(401).json({ error: 'Authentication required. No token provided.' });
      return;
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
}

/**
 * Middleware to authenticate user using httpOnly cookie
 * Reads JWT from cookie instead of Authorization header
 */
export async function authenticateUserFromCookie(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      res.status(401).json({ error: 'Authentication required. No token cookie found.' });
      return;
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
}

/**
 * Middleware to ensure user has admin role
 * Must be used after authenticateUser or authenticateUserFromCookie
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!isAdmin(req.user)) {
      res.status(403).json({
        error: 'Access denied. Admin privileges required.',
        message: 'Your account does not have admin permissions.',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    res.status(500).json({ error: 'Authorization failed.' });
  }
}

/**
 * Middleware to check for token but don't fail if missing
 * Useful for optional authentication
 */
export async function optionalAuthentication(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next(); // Continue without authentication on error
  }
}

/**
 * Error handler for authentication errors
 */
export function handleAuthError(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Invalid authentication credentials.' });
  } else if (error.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Invalid token format.' });
  } else if (error.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Token has expired. Please login again.' });
  } else {
    next(error);
  }
}
