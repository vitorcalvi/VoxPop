# VoxPop Authentication System

Secure GitHub OAuth 2.0 authentication with role-based access control.

## Quick Links

- 📚 [Full Documentation](./GITHUB_OAUTH_GUIDE.md) - Complete implementation guide
- ⚡ [Quick Start](./QUICK_START_AUTH.md) - Get running in 5 minutes
- 🧪 [Test Suite](#testing) - Automated testing

## Features

- ✅ **GitHub OAuth 2.0** - Seamless login with GitHub
- 🔐 **JWT Authentication** - Secure token-based sessions
- 🍪 **httpOnly Cookies** - XSS protection
- 👤 **Role-Based Access** - USER and ADMIN roles
- 🛡️ **CSRF Protection** - Secure OAuth flow
- 📧 **Auto Admin Assignment** - Admin role for `vcalvi@gmail.com`
- 🔄 **Token Refresh** - Automatic token renewal
- ⚠️ **Error Handling** - Comprehensive error management

## Architecture

```
Frontend (React)
    ↓
LoginButton Component
    ↓
GitHub OAuth
    ↓
Backend (Express + Prisma)
    ↓
JWT + httpOnly Cookie
    ↓
Protected Routes
```

## Installation

### 1. Install Dependencies

```bash
npm install jsonwebtoken cookie-parser axios
npm install --save-dev @types/jsonwebtoken @types/cookie-parser @types/axios
```

### 2. Database Setup

```bash
npx prisma db push
```

### 3. Configure Environment

Create `.env` file with:

```bash
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
GITHUB_CALLBACK_URL="http://localhost:5000/api/auth/github/callback"
JWT_SECRET="your_jwt_secret_minimum_32_characters"
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Create new OAuth App
3. Set callback URL: `http://localhost:5000/api/auth/github/callback`
4. Copy Client ID and Secret to `.env`

### 5. Start Server

```bash
npm run dev:server
```

## Usage

### Frontend - Login Button

```tsx
import { LoginButton } from './components/LoginButton';

<LoginButton
  onLoginSuccess={(user) => console.log(user)}
  onLogout={() => console.log('Logged out')}
/>
```

### Frontend - Protected Dashboard

```tsx
import { ProtectedDashboard } from './components/ProtectedDashboard';

<ProtectedDashboard />
```

### Backend - Protected Routes

```typescript
// Require authentication
app.get('/api/protected', authenticateUserFromCookie, (req, res) => {
  res.json({ user: req.user });
});

// Require admin role
app.get('/api/admin', authenticateUserFromCookie, requireAdmin, (req, res) => {
  res.json({ message: 'Admin access' });
});
```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|---------|-----------|-------------|----------------|
| GET | `/api/auth/github/login` | Initiate GitHub OAuth | No |
| GET | `/api/auth/github/callback` | OAuth callback | No |
| GET | `/api/auth/me` | Get current user | Yes |
| POST | `/api/auth/logout` | Logout user | Yes |
| POST | `/api/auth/refresh` | Refresh JWT token | Yes |

### Protected Routes

| Method | Endpoint | Description | Access |
|---------|-----------|-------------|---------|
| GET | `/api/protected/dashboard` | User dashboard | Authenticated users |
| GET | `/api/admin/users` | Admin user management | Admin only |
| POST | `/api/protected/feedback` | Create feedback | Authenticated users |
| DELETE | `/api/admin/feedback/:id` | Delete feedback | Admin only |

## Database Schema

### User Table

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
}

enum UserRole {
  USER
  ADMIN
}
```

## Security Features

### JWT Security
- Strong secret (minimum 32 characters)
- 7-day token expiration
- Automatic token refresh

### Cookie Security
- `httpOnly`: Not accessible via JavaScript (XSS protection)
- `secure`: HTTPS only in production
- `sameSite`: CSRF protection

### OAuth Security
- CSRF state parameter validation
- State expiration (5 minutes)
- Unique state for each request

### Admin Security
- Email-based role assignment
- Server-side validation
- Middleware enforcement

## Testing

### Automated Tests

```bash
node server/test-auth.js
```

This will test:
- Environment variables
- Server health
- OAuth endpoints
- Protected routes
- Admin access

### Manual Testing

1. Start server: `npm run dev:server`
2. Start frontend: `npm run dev:client`
3. Open http://localhost:5173
4. Click "Sign in with GitHub"
5. Complete OAuth flow
6. Verify login works
7. Test admin access with `vcalvi@gmail.com`

### Testing API Endpoints

```bash
# Get GitHub login URL
curl http://localhost:5000/api/auth/github/login

# Access protected route (requires auth)
curl http://localhost:5000/api/protected/dashboard \
  -H "Cookie: auth_token=YOUR_TOKEN"

# Access admin route (requires admin)
curl http://localhost:5000/api/admin/users \
  -H "Cookie: auth_token=YOUR_ADMIN_TOKEN"
```

## Project Structure

```
/
├── server/
│   ├── index.ts              # Main Express server
│   ├── auth.ts              # OAuth API routes
│   ├── auth-utils.ts        # JWT and helper functions
│   ├── auth-middleware.ts   # Authentication middleware
│   ├── config.ts            # Configuration validation
│   └── test-auth.js        # Test suite
├── components/
│   ├── LoginButton.tsx       # Login component
│   ├── LoginButton.css       # Login styles
│   ├── ProtectedDashboard.tsx # Protected page example
│   └── ProtectedDashboard.css # Dashboard styles
├── prisma/
│   └── schema.prisma        # User model
├── GITHUB_OAUTH_GUIDE.md    # Full documentation
├── QUICK_START_AUTH.md        # Quick start guide
└── README_AUTH.md            # This file
```

## Configuration

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection
- `GITHUB_CLIENT_ID` - GitHub OAuth App ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth App Secret
- `GITHUB_CALLBACK_URL` - OAuth callback endpoint
- `JWT_SECRET` - JWT signing secret (32+ chars)

Optional:
- `JWT_EXPIRES_IN` - Token expiration (default: 7d)
- `APP_URL` - Backend URL (default: http://localhost:5000)
- `FRONTEND_URL` - Frontend URL (default: http://localhost:5173)
- `NODE_ENV` - Environment (default: development)
- `PORT` - Server port (default: 5000)

### GitHub OAuth App

1. Create OAuth App: https://github.com/settings/developers
2. Settings:
   - Homepage URL: `http://localhost:5173`
   - Callback URL: `http://localhost:5000/api/auth/github/callback`
3. Permissions: `user:email`

## Troubleshooting

### Common Issues

**"Missing required environment variables"**
→ Add all required variables to `.env` file

**"GitHub redirect error"**
→ Verify callback URL matches GitHub OAuth App exactly

**"Email is required but not available"**
→ Make GitHub email public or enable email permission

**"Not authenticated"**
→ Check browser cookies are enabled

**"Admin role not assigned"**
→ Verify email matches `vcalvi@gmail.com` exactly

See [Troubleshooting Guide](./GITHUB_OAUTH_GUIDE.md#troubleshooting) for more details.

## Next.js Adaptation

This implementation uses Express.js. For Next.js:

1. Create API routes in `app/api/auth/*`
2. Use Next.js middleware for protection
3. Use `cookies()` for server-side auth
4. Use `fetch()` for API calls

See [Next.js Adaptation](./GITHUB_OAUTH_GUIDE.md#nextjs-adaptation) section.

## Documentation

- 📖 [Full Guide](./GITHUB_OAUTH_GUIDE.md) - Comprehensive documentation
- ⚡ [Quick Start](./QUICK_START_AUTH.md) - 5-minute setup
- 🧪 [Test Suite](./server/test-auth.js) - Automated testing

## License

MIT License - Feel free to use and modify.

## Support

For issues:
1. Check [Troubleshooting Guide](./GITHUB_OAUTH_GUIDE.md#troubleshooting)
2. Review error logs
3. Verify environment configuration
4. Run test suite: `node server/test-auth.js`

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: January 2025
