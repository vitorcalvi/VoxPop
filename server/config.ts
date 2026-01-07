/**
 * Configuration validation for authentication
 */

export function validateEnv(): void {
  const requiredEnvVars = [
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GITHUB_CALLBACK_URL',
    'JWT_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }

  // Validate GitHub callback URL format
  if (!process.env.GITHUB_CALLBACK_URL?.startsWith('http')) {
    throw new Error(
      'GITHUB_CALLBACK_URL must be a valid URL (http:// or https://)'
    );
  }

  // Validate JWT secret (at least 32 characters for security)
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn(
      'WARNING: JWT_SECRET is less than 32 characters. Please use a stronger secret.'
    );
  }
}

export const config = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackUrl: process.env.GITHUB_CALLBACK_URL!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  app: {
    url: process.env.APP_URL || 'http://localhost:5000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
};
