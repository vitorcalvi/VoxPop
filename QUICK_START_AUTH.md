# Quick Start Guide - GitHub OAuth Authentication

Get your authentication system running in 5 minutes!

## Step 1: Install Dependencies (30 seconds)

```bash
npm install jsonwebtoken cookie-parser axios
npm install --save-dev @types/jsonwebtoken @types/cookie-parser @types/axios
```

## Step 2: Create GitHub OAuth App (2 minutes)

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: VoxPop Auth
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5000/api/auth/github/callback`
4. Click "Register application"
5. Copy **Client ID** and generate **Client Secret**

## Step 3: Configure Environment (1 minute)

Add to your `.env` file:

```bash
# Generate a secure secret:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

GITHUB_CLIENT_ID="paste_your_client_id_here"
GITHUB_CLIENT_SECRET="paste_your_client_secret_here"
GITHUB_CALLBACK_URL="http://localhost:5000/api/auth/github/callback"
JWT_SECRET="paste_your_generated_secret_here"
```

## Step 4: Update Database (30 seconds)

```bash
npx prisma db push
```

## Step 5: Start Servers (1 minute)

```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

## Step 6: Test Authentication (1 minute)

1. Open http://localhost:5173
2. Import and use `LoginButton` component:

```tsx
import { LoginButton } from './components/LoginButton';

function App() {
  return (
    <div>
      <LoginButton
        onLoginSuccess={(user) => console.log('Logged in:', user)}
        onLogout={() => console.log('Logged out')}
      />
    </div>
  );
}
```

3. Click "Sign in with GitHub"
4. Authorize the application
5. You should be logged in!

## Verify Admin Access

If your GitHub email is `vcalvi@gmail.com`:
- You'll see "ADMIN" badge
- You can access `/api/admin/*` routes
- You can delete feedback items

For regular users:
- You'll see "USER" badge
- Admin actions will be hidden/forbidden

## Testing Protected Routes

```bash
# Test protected endpoint (requires login)
curl http://localhost:5000/api/protected/dashboard \
  -H "Cookie: auth_token=YOUR_TOKEN"

# Test admin endpoint (requires admin role)
curl http://localhost:5000/api/admin/users \
  -H "Cookie: auth_token=YOUR_ADMIN_TOKEN"
```

## Next Steps

- Read [GITHUB_OAUTH_GUIDE.md](./GITHUB_OAUTH_GUIDE.md) for full documentation
- Integrate `LoginButton` into your app
- Add protected routes using middleware
- Deploy to production with HTTPS

## Troubleshooting

### "Missing environment variables"
→ Ensure all variables are in `.env` file

### "GitHub redirect error"
→ Check callback URL matches GitHub OAuth App settings exactly

### "Email not available"
→ Make sure your GitHub email is public or OAuth has email permission

### "Not authenticated"
→ Check browser cookies and ensure httpOnly cookies are enabled

For detailed troubleshooting, see the [Troubleshooting section](./GITHUB_OAUTH_GUIDE.md#troubleshooting) in the full guide.

---

**Done!** You now have a working GitHub OAuth authentication system. 🎉
