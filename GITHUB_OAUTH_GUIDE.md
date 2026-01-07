# GitHub OAuth 2.0 Authentication System

Complete implementation guide for secure GitHub OAuth 2.0 authentication with admin-only access control for VoxPop.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Setup Instructions](#setup-instructions)
5. [GitHub OAuth App Configuration](#github-oauth-app-configuration)
6. [Environment Variables](#environment-variables)
7. [Authentication Flow](#authentication-flow)
8. [Frontend Integration](#frontend-integration)
9. [Protected Routes](#protected-routes)
10. [Security Best Practices](#security-best-practices)
11. [Testing Guide](#testing-guide)
12. [Troubleshooting](#troubleshooting)
13. [Next.js Adaptation](#nextjs-adaptation)

---

## Overview

This authentication system provides:

- **GitHub OAuth 2.0** login flow
- **JWT-based** session management with httpOnly cookies
- **Role-based access control** (USER vs ADMIN)
- **CSRF protection** for OAuth flow
- **Admin-only routes** protected by middleware
- **Automatic admin role** assignment for email `vcalvi@gmail.com`
- **Secure token management** with automatic expiration

### Key Features

✅ **Secure OAuth Flow**: CSRF-protected GitHub authentication
✅ **JWT Sessions**: Tokens stored in httpOnly cookies, not accessible to JavaScript
✅ **Role Management**: Admin role automatically assigned to specific email
✅ **Middleware Protection**: Easy-to-use authentication and authorization middleware
✅ **Automatic Token Refresh**: Users stay logged in for 7 days
✅ **Error Handling**: Comprehensive error handling for all authentication scenarios

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                        │
│  ┌────────────────┐    ┌──────────────────────────────┐ │
│  │ LoginButton.tsx │────▶│ ProtectedDashboard.tsx      │ │
│  └────────────────┘    └──────────────────────────────┘ │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Express.js + Prisma)                  │
│  ┌──────────────┐    ┌─────────────┐    ┌─────────┐ │
│  │   auth.ts    │────▶│auth-utils.ts│────▶│ Prisma  │ │
│  │  OAuth Routes │    │ JWT Helpers │    │  ORM    │ │
│  └──────────────┘    └─────────────┘    └─────────┘ │
│  ┌────────────────────┐                                  │
│  │ auth-middleware.ts│───▶ Protect Routes                │
│  └────────────────────┘                                  │
└───────────┬────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              users table                             │   │
│  │  • id (UUID, PRIMARY KEY)                          │   │
│  │  • githubId (UNIQUE)                                │   │
│  │  • username                                          │   │
│  │  • email (UNIQUE)                                    │   │
│  │  • avatarUrl                                         │   │
│  │  • role (USER | ADMIN)                                │   │
│  │  • accessToken                                        │   │
│  │  • createdAt, updatedAt                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Login Request**: Frontend calls `/api/auth/github/login`
2. **Redirect**: User redirected to GitHub with CSRF state
3. **Callback**: GitHub redirects to `/api/auth/github/callback?code=...`
4. **Token Exchange**: Server exchanges code for access token
5. **User Data**: Server fetches user profile from GitHub
6. **Database**: User created/fetched from database
7. **JWT Generation**: Server generates JWT and sets httpOnly cookie
8. **Protected Access**: User can now access protected routes
9. **Verification**: Middleware validates JWT on each request

---

## Database Schema

### User Model

```prisma
model User {
  id            String    @id @default(uuid())
  githubId      String    @unique
  username      String
  email         String    @unique
  avatarUrl     String?
  role          UserRole  @default(USER)
  accessToken   String?
  refreshToken  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("users")
}

enum UserRole {
  USER
  ADMIN
}
```

### Admin Role Assignment

The system automatically assigns `ADMIN` role if:
- User's GitHub email matches `vcalvi@gmail.com`

All other users receive `USER` role.

---

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Neon or local)
- GitHub account

### Step 1: Install Dependencies

```bash
npm install jsonwebtoken cookie-parser axios
npm install --save-dev @types/jsonwebtoken @types/cookie-parser @types/axios
```

### Step 2: Database Setup

Generate and apply Prisma schema:

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

This will create the `users` table in your PostgreSQL database.

### Step 3: Configure GitHub OAuth App

See [GitHub OAuth App Configuration](#github-oauth-app-configuration) section below.

### Step 4: Set Environment Variables

Create or update `.env` file:

```bash
# GitHub OAuth
GITHUB_CLIENT_ID="your_client_id"
GITHUB_CLIENT_SECRET="your_client_secret"
GITHUB_CALLBACK_URL="http://localhost:5000/api/auth/github/callback"

# JWT Configuration
JWT_SECRET="your_secret_minimum_32_characters"
JWT_EXPIRES_IN="7d"

# Application URLs
APP_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:5173"

# Environment
NODE_ENV="development"
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Start Server

```bash
npm run dev:server
```

The server will start on port 5000.

---

## GitHub OAuth App Configuration

### Step 1: Create GitHub OAuth App

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the form:

**Application name**: VoxPop Auth
**Homepage URL**: http://localhost:5173
**Application description**: VoxPop Feedback Management
**Authorization callback URL**: `http://localhost:5000/api/auth/github/callback`

4. Click "Register application"

### Step 2: Get Client ID and Secret

After registration, you'll see:
- **Client ID**: Copy to `GITHUB_CLIENT_ID`
- **Client Secret**: Click "Generate a new client secret" and copy to `GITHUB_CLIENT_SECRET`

### Step 3: Production Configuration

For production deployment:

1. Update URLs to use your domain:
   - **Homepage URL**: `https://yourdomain.com`
   - **Callback URL**: `https://your-api-domain.com/api/auth/github/callback`

2. Update environment variables:
   ```bash
   GITHUB_CALLBACK_URL="https://your-api-domain.com/api/auth/github/callback"
   APP_URL="https://your-api-domain.com"
   FRONTEND_URL="https://yourdomain.com"
   NODE_ENV="production"
   ```

### Required GitHub Permissions

The OAuth app requests:
- `user:email` - Access to user's primary email

Ensure your GitHub profile has a public email or enable email access in GitHub settings.

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|----------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | `ghp_xxxxxxxx` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret | `ghs_xxxxxxxx` |
| `GITHUB_CALLBACK_URL` | OAuth callback endpoint | `http://localhost:5000/api/auth/github/callback` |
| `JWT_SECRET` | Secret for signing JWT tokens | Minimum 32 characters, use crypto to generate |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|----------|
| `JWT_EXPIRES_IN` | Token expiration time | `7d` |
| `APP_URL` | Backend API URL | `http://localhost:5000` |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:5173` |
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5000` |

---

## Authentication Flow

### Complete User Journey

```
┌─────────────┐
│ 1. User     │
│    Clicks    │
│ "Login with  │
│  GitHub"    │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 2. Frontend calls               │
│    GET /api/auth/github/login      │
│                                 │
│ Response: {                      │
│   githubAuthUrl: "...",          │
│   state: "csrf_token"            │
│ }                              │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 3. Frontend redirects to GitHub  │
│    with state parameter            │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 4. User authorizes on GitHub     │
│    (Signs in with credentials)    │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 5. GitHub redirects to callback   │
│    with code and state            │
│    GET /api/auth/github/callback  │
│    ?code=xxx&state=xxx          │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 6. Server validates CSRF state    │
│    (Prevents CSRF attacks)        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 7. Server exchanges code for       │
│    access token from GitHub         │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 8. Server fetches user profile    │
│    and email from GitHub API       │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 9. Server creates/fetches user   │
│    in database                    │
│    (Admin if email matches)        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 10. Server generates JWT token    │
│     with user data                │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 11. Server sets httpOnly cookie   │
│     with JWT token                │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 12. Frontend receives user data   │
│     and displays dashboard          │
└──────────────────────────────────────┘
```

### Token Generation

JWT tokens include:

```json
{
  "userId": "user_uuid",
  "githubId": "github_user_id",
  "email": "user@example.com",
  "role": "USER",
  "iat": 1234567890,
  "exp": 1235172690,
  "iss": "voxpop",
  "aud": "voxpop-users"
}
```

### Cookie Configuration

```javascript
{
  httpOnly: true,        // Not accessible via JavaScript (XSS protection)
  secure: true,          // HTTPS only (in production)
  sameSite: 'lax',      // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  path: '/'
}
```

---

## Frontend Integration

### Using LoginButton Component

```tsx
import React from 'react';
import { LoginButton } from './components/LoginButton';

export const App: React.FC = () => {
  const handleLoginSuccess = (user) => {
    console.log('User logged in:', user);
    // Store user in state, redirect to dashboard, etc.
  };

  const handleLogout = () => {
    console.log('User logged out');
    // Clear user state, redirect to home, etc.
  };

  return (
    <div>
      <h1>VoxPop</h1>
      <LoginButton
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    </div>
  );
};
```

### Using ProtectedDashboard Component

```tsx
import React from 'react';
import { ProtectedDashboard } from './components/ProtectedDashboard';

export const App: React.FC = () => {
  return (
    <div>
      <ProtectedDashboard />
    </div>
  );
};
```

### Custom Authentication Hook

Create a custom hook for managing authentication state:

```tsx
import { useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, isAuthenticated, checkAuth };
};
```

---

## Protected Routes

### Server-Side Middleware

#### 1. Authentication Middleware

```typescript
import { authenticateUser } from './server/auth-middleware';

// Protect route - requires valid JWT token
app.get('/api/profile', authenticateUser, (req, res) => {
  res.json({ user: req.user });
});
```

#### 2. Admin-Only Middleware

```typescript
import { authenticateUserFromCookie, requireAdmin } from './server/auth-middleware';

// Protect route - requires valid JWT + admin role
app.get('/api/admin/users', authenticateUserFromCookie, requireAdmin, (req, res) => {
  res.json({ message: 'Admin access granted' });
});
```

#### 3. Optional Authentication

```typescript
import { optionalAuthentication } from './server/auth-middleware';

// Optional auth - user info available if logged in
app.get('/api/feedback', optionalAuthentication, (req, res) => {
  const feedbacks = await getFeedbacks();
  res.json({ feedbacks, user: req.user || null });
});
```

### Frontend Protected Components

```tsx
import { useAuth } from './hooks/useAuth';

export const AdminPanel: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user || user.role !== 'ADMIN') {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div>
      <h1>Admin Panel</h1>
      {/* Admin-only content */}
    </div>
  );
};
```

---

## Security Best Practices

### 1. JWT Security

✅ **Strong Secrets**: Use minimum 32-character secrets generated with crypto
✅ **Token Expiration**: Set reasonable expiration (7 days default)
✅ **Secure Cookies**: Use `httpOnly` and `secure` flags in production
✅ **SameSite**: Use `lax` for CSRF protection

### 2. CSRF Protection

✅ **State Parameter**: Unique CSRF token for each OAuth request
✅ **State Validation**: Verify state parameter in callback
✅ **State Expiration**: Expire CSRF tokens after 5 minutes

### 3. Environment Variables

✅ **Never Commit Secrets**: Never commit `.env` file
✅ **Use .env.example**: Document required variables
✅ **Production Secrets**: Use secure secret management (AWS Secrets, etc.)

### 4. HTTPS in Production

✅ **Secure Cookies**: Enable `secure` flag
✅ **HTTPS Only**: Force HTTPS in production
✅ **Secure Callback URLs**: Use HTTPS in GitHub OAuth App

### 5. Error Handling

✅ **Generic Messages**: Don't reveal sensitive information in errors
✅ **Logging**: Log errors securely on server
✅ **Rate Limiting**: Implement rate limiting on auth endpoints (future)

### 6. Token Storage

✅ **httpOnly Cookies**: Prevent XSS attacks
✅ **No LocalStorage**: Don't store JWT in localStorage
✅ **Automatic Refresh**: Refresh tokens before expiration

---

## Testing Guide

### 1. Setup Test Environment

```bash
# Ensure .env is configured with test values
GITHUB_CLIENT_ID="test_client_id"
GITHUB_CLIENT_SECRET="test_client_secret"
GITHUB_CALLBACK_URL="http://localhost:5000/api/auth/github/callback"
JWT_SECRET="test_secret_32_characters_long_for_testing"
```

### 2. Test Authentication Flow

#### Test 1: Login Initiation

```bash
# Request GitHub login URL
curl http://localhost:5000/api/auth/github/login
```

Expected response:
```json
{
  "githubAuthUrl": "https://github.com/login/oauth/authorize?...",
  "state": "random_csrf_token"
}
```

#### Test 2: OAuth Callback (Manual Testing)

1. Copy `githubAuthUrl` from response
2. Open in browser
3. Authorize the app
4. Callback will redirect to your backend
5. Check for success response

#### Test 3: Protected Route Access

```bash
# Without token (should fail)
curl http://localhost:5000/api/protected/dashboard
# Expected: 401 Unauthorized

# With token (should succeed)
curl http://localhost:5000/api/protected/dashboard \
  -H "Cookie: auth_token=YOUR_JWT_TOKEN"
# Expected: 200 OK with user data
```

#### Test 4: Admin Route Access

```bash
# As non-admin user (should fail)
curl http://localhost:5000/api/admin/users \
  -H "Cookie: auth_token=USER_JWT_TOKEN"
# Expected: 403 Forbidden

# As admin user (should succeed)
curl http://localhost:5000/api/admin/users \
  -H "Cookie: auth_token=ADMIN_JWT_TOKEN"
# Expected: 200 OK
```

### 3. Frontend Testing

#### Test User Login Flow

1. Start frontend: `npm run dev:client`
2. Start backend: `npm run dev:server`
3. Open http://localhost:5173
4. Click "Sign in with GitHub"
5. Complete GitHub authorization
6. Verify user is logged in

#### Test Admin Access

1. Login with `vcalvi@gmail.com` GitHub account
2. Navigate to protected dashboard
3. Verify admin role is displayed
4. Test admin-specific actions

#### Test Non-Admin Access

1. Login with different GitHub account
2. Navigate to protected dashboard
3. Verify user role is displayed (not admin)
4. Verify admin actions are hidden
5. Attempt to access admin endpoint (should fail)

### 4. Test Error Scenarios

#### Invalid CSRF Token

```bash
# Send callback with invalid state
curl "http://localhost:5000/api/auth/github/callback?code=abc&state=invalid"
# Expected: 400 Bad Request - Invalid state
```

#### Expired JWT Token

```bash
# Use expired token
curl http://localhost:5000/api/protected/dashboard \
  -H "Cookie: auth_token=EXPIRED_TOKEN"
# Expected: 401 Unauthorized - Token expired
```

#### Missing Token

```bash
# Access protected route without token
curl http://localhost:5000/api/protected/dashboard
# Expected: 401 Unauthorized - No token provided
```

---

## Troubleshooting

### Issue 1: "Missing required environment variables"

**Cause**: One or more required environment variables are not set in `.env` file.

**Solution**:
1. Check `.env` file exists in project root
2. Verify all required variables are set:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_CALLBACK_URL`
   - `JWT_SECRET`
   - `DATABASE_URL`
3. Restart server after updating `.env`

### Issue 2: GitHub OAuth redirect error

**Cause**: Callback URL doesn't match GitHub OAuth App configuration.

**Solution**:
1. Go to GitHub OAuth App settings
2. Verify callback URL matches exactly:
   - GitHub App: `http://localhost:5000/api/auth/github/callback`
   - Must include protocol (http://)
   - Must match port (5000)
3. Update if needed and re-authenticate

### Issue 3: "Email is required but not available"

**Cause**: GitHub user's email is not public.

**Solution**:
1. Go to GitHub user settings
2. Navigate to Emails section
3. Set primary email to "Public" or ensure OAuth app has email permission
4. Re-authenticate after changing settings

### Issue 4: CORS errors on frontend

**Cause**: Backend CORS configuration doesn't allow frontend origin.

**Solution**:
The server already has CORS enabled. If you still have issues:

```typescript
// In server/index.ts
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
```

### Issue 5: JWT token validation fails

**Cause**: Token is malformed, expired, or JWT_SECRET doesn't match.

**Solution**:
1. Check `JWT_SECRET` is consistent between token generation and verification
2. Verify token format: `Bearer <token>` or in cookie
3. Check token expiration: default 7 days
4. Clear cookies and re-authenticate

### Issue 6: Cookie not set in browser

**Cause**: Browser blocking httpOnly cookies or wrong configuration.

**Solution**:
1. Check browser console for cookie errors
2. Verify SameSite and secure settings:
   - Development: `secure: false`
   - Production: `secure: true`
3. Check domain/path settings

### Issue 7: Admin role not assigned

**Cause**: Email doesn't match `vcalvi@gmail.com`.

**Solution**:
1. Check GitHub account email matches exactly: `vcalvi@gmail.com`
2. Verify case sensitivity (should be lowercase)
3. Check database user record:
   ```sql
   SELECT id, email, role FROM users WHERE email = 'vcalvi@gmail.com';
   ```
4. If needed, manually update role:
   ```sql
   UPDATE users SET role = 'ADMIN' WHERE email = 'vcalvi@gmail.com';
   ```

### Issue 8: Prisma client not generated

**Cause**: Prisma schema changes not applied.

**Solution**:
```bash
npx prisma generate
npx prisma db push
```

### Issue 9: Database connection errors

**Cause**: Incorrect `DATABASE_URL` or connection issues.

**Solution**:
1. Verify `DATABASE_URL` format:
   ```
   postgresql://user:password@host:port/database?sslmode=require
   ```
2. Test connection:
   ```bash
   psql $DATABASE_URL
   ```
3. Check firewall/network settings
4. Verify SSL mode: `sslmode=require` for Neon

### Issue 10: Port already in use

**Cause**: Another process using port 5000.

**Solution**:
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev:server
```

---

## Next.js Adaptation

This implementation uses Express.js. Here's how to adapt for Next.js:

### 1. Create Next.js API Routes

**File: `app/api/auth/github/login/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { generateCSRFToken } from '@/server/auth-utils';

export async function GET() {
  const state = generateCSRFToken();

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_CALLBACK_URL!,
    scope: 'user:email',
    state: state,
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return NextResponse.json({ githubAuthUrl, state });
}
```

**File: `app/api/auth/github/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { generateToken, findOrCreateUser } from '@/server/auth-utils';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Validate state, exchange code, create user, generate token
  // (similar to Express implementation)

  // Set cookie using NextResponse
  const response = NextResponse.json({ user, token });
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
```

### 2. Create Middleware for Protected Routes

**File: `middleware.ts` (root level)**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  // Protect specific routes
  if (request.nextUrl.pathname.startsWith('/admin') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
};
```

### 3. Server-Side Authentication in Pages

```typescript
// app/dashboard/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token');

  if (!token) {
    redirect('/login');
  }

  // Verify token and fetch user data
  const user = await getUserFromToken(token.value);

  return (
    <div>
      <h1>Welcome, {user.username}</h1>
      <p>Role: {user.role}</p>
    </div>
  );
}
```

### 4. Client-Side Authentication Hook

```typescript
// hooks/useAuth.ts
'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
```

---

## Summary

This GitHub OAuth 2.0 authentication system provides:

✅ Secure OAuth flow with CSRF protection
✅ JWT-based session management
✅ httpOnly cookie storage (XSS protection)
✅ Role-based access control (USER/ADMIN)
✅ Admin auto-assignment for specific email
✅ Comprehensive error handling
✅ Easy-to-use middleware
✅ Frontend components ready to use
✅ Production-ready configuration

### Key Files

- `server/auth.ts` - OAuth API routes
- `server/auth-utils.ts` - JWT and helper functions
- `server/auth-middleware.ts` - Authentication middleware
- `server/config.ts` - Configuration validation
- `prisma/schema.prisma` - User model definition
- `components/LoginButton.tsx` - Login component
- `components/ProtectedDashboard.tsx` - Protected page example

### Next Steps

1. Configure GitHub OAuth App
2. Set environment variables
3. Run database migrations
4. Test authentication flow
5. Integrate into your application
6. Deploy to production with HTTPS

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review error logs in server console
3. Verify environment variables
4. Test database connection
5. Check GitHub OAuth App settings

---

**License**: MIT
**Version**: 1.0.0
**Last Updated**: January 2025
