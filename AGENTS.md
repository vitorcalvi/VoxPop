# AGENTS.md

This document helps AI agents work effectively in the VoxPop codebase.

## Project Overview

VoxPop is an AI-powered feedback management application built with React, TypeScript, Express.js, and PostgreSQL (Neon). It uses Chutes AI for model deployment and inference, providing real-time database storage with custom LLM integration.

### Architecture
- **Frontend**: React 18.3.1 + TypeScript + Vite + Tailwind CSS (CDN)
- **Backend**: Express.js + TypeScript + pg (node-postgres)
- **Database**: PostgreSQL (Neon Cloud)
- **AI Service**: Chutes AI for model deployment and LLM inference
- **LLM Model**: Custom deployed model on Chutes AI (specified by CHUTE_ID)

## Essential Commands

```bash
# Install dependencies
npm install

# Run both frontend and backend in development mode
npm run dev

# Run backend server only
npm run server

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development Scripts
- `npm run dev` - Runs both dev server (port 5000) and Vite dev server (port 5173) concurrently
- `npm run dev:server` - Runs backend with tsx watch mode
- `npm run dev:client` - Runs Vite frontend dev server

## Project Structure

```
/
├── App.tsx              # Main application component (uses API)
├── index.tsx            # React entry point
├── types.ts             # TypeScript type definitions
├── server/
│   └── index.ts        # Express.js API server
├── components/
│   ├── FeedbackCard.tsx # Individual feedback item display
│   ├── FeedbackForm.tsx  # Feedback submission form
│   └── Sidebar.tsx      # Category filtering sidebar
├── services/
│   └── chutesService.ts # Chutes AI integration for LLM inference
└── .env                 # Environment variables
```

## Code Conventions

### Component Structure
- Functional components with `React.FC` type annotation
- Props interface named `Props` (camelCase)
- Use TypeScript interfaces for all props
- Components exported as named exports: `export const ComponentName: React.FC<Props> = ...`

### API Integration
- All data fetched from backend API at `http://localhost:5000/api`
- No localStorage for feedback data (only for user session ID)
- Backend handles all CRUD operations and database queries

### Backend Structure
- Express.js with TypeScript
- RESTful API endpoints
- PostgreSQL connection via pg (node-postgres)
- CORS enabled for frontend-backend communication

### Example Component Pattern:
```tsx
import React, { useState, useEffect } from 'react';

interface Props {
  onAdd: (item: Item) => void;
}

export const ComponentName: React.FC<Props> = ({ onAdd }) => {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = 'http://localhost:5000/api';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const response = await fetch(`${API_BASE}/items`);
    const data = await response.json();
    setData(data);
    setLoading(false);
  };

  return <div>{loading ? <Loading /> : <List items={data} />}</div>;
};
```

### Naming Conventions
- **Components**: PascalCase (`FeedbackForm`, `Sidebar`)
- **Props interface**: `Props` (lowercase)
- **Functions**: camelCase (`handleAddFeedback`, `analyzeFeedback`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE`, `DATABASE_URL`)
- **Types/Interfaces**: PascalCase (`FeedbackItem`, `AIAnalysisResult`)

### React Hooks Usage
- `useState`: For component state
- `useEffect`: For data fetching and side effects
- `useMemo`: For expensive computations (filtering, mapping)
- `useRef`: For DOM references (file inputs)

### State Management
- API-driven state: All feedback data fetched from backend
- Local state: Only for UI state (filters, modals, loading)
- User session: Simple user ID stored in localStorage for voting tracking
- No global state management library

### TypeScript Patterns
- Type definitions centralized in `types.ts`
- Union types for status: `'open' | 'planned' | 'in-progress' | 'completed' | 'closed'`
- Optional fields with `?` operator
- Strict type checking enabled in tsconfig.json

## Styling Conventions (Tailwind)

### Color Scheme
- Primary: Indigo (`indigo-50`, `indigo-100`, `indigo-600`, `indigo-900`)
- Backgrounds: Gray scale (`gray-50`, `gray-100`, `gray-900`)
- Status colors mapped to semantic colors (blue, yellow, green, red)

### Common Patterns
- **Cards**: `bg-white rounded-xl shadow-sm border border-gray-100 p-5`
- **Buttons**: `bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black`
- **Inputs**: `px-4 py-3 border border-gray-100 bg-gray-50/50 rounded-xl focus:ring-4 focus:ring-indigo-100`
- **Labels**: `text-xs font-black text-gray-400 uppercase tracking-widest`
- **Icons**: Font Awesome with `fa-solid` prefix

### Responsive Design
- Mobile-first approach
- Breakpoints: `md:` for medium screens, `lg:` for large screens
- Common pattern: Hide elements on mobile with `hidden md:block`

## Backend API (Express.js)

### API Endpoints

#### GET `/api/health`
Health check endpoint.

#### GET `/api/feedback?category={category}&search={query}`
Fetch all feedback with optional filters.

#### GET `/api/feedback/:id`
Fetch single feedback item by ID.

#### GET `/api/categories`
Get list of all categories.

#### POST `/api/feedback`
Create new feedback item. Body:
```typescript
{
  title: string;
  description: string;
  category: string;
  sentiment?: string;
  aiInsight?: string;
  screenshot?: string;
  status?: string;
}
```

#### POST `/api/feedback/:id/vote`
Vote on feedback. Body:
```typescript
{
  userId: string;
  vote: boolean; // true for upvote, false to toggle off
}
```

#### POST `/api/analyze`
Analyze feedback using AI. Body:
```typescript
{
  title: string;
  description: string;
  screenshot?: string;
}
```

#### POST `/api/roadmap`
Generate roadmap summary. Body:
```typescript
{
  feedbacks: FeedbackItem[];
}
```

#### PUT `/api/feedback/:id`
Update feedback item.

#### DELETE `/api/feedback/:id`
Delete feedback item.

### Database Schema (PostgreSQL)

#### Table: feedback_items
```sql
- id (UUID, PRIMARY KEY)
- title (VARCHAR(255), NOT NULL)
- description (TEXT, NOT NULL)
- category (VARCHAR(100), NOT NULL)
- votes (INTEGER, DEFAULT 1)
- status (VARCHAR(20), DEFAULT 'open')
- sentiment (VARCHAR(20))
- aiInsight (TEXT)
- screenshot (TEXT) - Base64 encoded
- createdAt (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- updatedAt (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

#### Table: user_votes
```sql
- id (UUID, PRIMARY KEY)
- userId (VARCHAR(100))
- feedbackId (UUID, FOREIGN KEY)
- votedAt (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- UNIQUE(userId, feedbackId)
```

## AI Integration (Chutes AI)

### Configuration
- **API Key**: Set `CHUTES_API_KEY` in `.env` file
- **Chute ID**: Set `CHUTE_ID` in `.env` (ID of deployed LLM model)
- **Service File**: `services/chutesService.ts`

### Chutes AI Workflow

1. **Deploy a Model**: Go to Chutes AI console and deploy an LLM model (Llama, Mistral, etc.)
2. **Get Chute ID**: Copy the `chute_id` from deployed model
3. **Set CHUTE_ID**: Add `CHUTE_ID=<chute_id>` to `.env`
4. **Run App**: System will use deployed model for inference

### Analysis Functions

#### analyzeFeedback(title, description, screenshot?)
Analyzes feedback using deployed LLM model via Chutes AI. Creates a job, polls for completion, and returns:
```typescript
{
  category: string;         // Feature, Bug, UI/UX, Performance, Mobile, Security
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedTags: string[];
  impactScore: number;      // 1-10 priority
  aiInsight: string;         // Concise insight from AI
}
```

#### generateRoadmapSummary(feedbacks[])
Generates roadmap summary using deployed LLM model via Chutes AI.

#### listChutes()
Lists all deployed chutes for the account.

### Chutes AI API Usage
- **Job Creation**: POST `/jobs/{chute_id}/chat` to invoke model
- **Job Polling**: GET `/jobs/{job_id}` to check completion
- **Async Execution**: Jobs run asynchronously, must poll for results

## Important Gotchas

### Database Connection
- Neon PostgreSQL requires SSL connection
- Connection string uses `pooler` endpoint for better performance
- Tables auto-created on server startup

### API vs localStorage
- **OLD**: Feedback data stored in browser localStorage
- **NEW**: All data persisted in PostgreSQL database
- Frontend only stores user session ID in localStorage for voting

### Backend and Frontend Ports
- **Frontend (Vite)**: Port 5173 (default)
- **Backend (Express)**: Port 5000
- Both run concurrently with `npm run dev`

### Chutes AI API Key
- Required for AI analysis features
- Set in `.env` as `CHUTES_API_KEY=cpk-...`
- Also set `CHUTE_ID` to your deployed model's chute_id
- Without proper configuration, analysis will fail gracefully (returns null)

### TypeScript in Backend
- Backend runs with `tsx` for TypeScript execution
- Type-safe database queries using pg library
- Express middleware handles JSON parsing and CORS

### API Response Format
- All API responses return JSON
- Errors return `{ error: string }` with appropriate HTTP status codes
- GET requests return arrays or single objects
- POST/PUT return created/updated objects

### User Session Tracking
- Simple user ID generation: `Math.random().toString(36).substr(2, 9)`
- Stored in `localStorage.getItem('voxpop_user_id')`
- Used for vote deduplication in database

## Environment Variables

Create a `.env` file in project root:

```bash
# PostgreSQL Database (Neon)
DATABASE_URL="postgresql://user:pass@host:port/dbname?sslmode=require"

# Chutes AI API (for LLM model deployment and inference)
CHUTES_API_KEY=cpk-your-chutes-api-key

# Chute ID (the deployed model to use for analysis)
CHUTE_ID=your-deployed-chute-id-here

# Server
PORT=5000
```

## Adding New Features

When extending the application:

1. **Backend**: Add new API endpoints in `server/index.ts`
2. **Database**: Modify tables in `server/index.ts` initDb function
3. **Frontend**: Create components in `/components/` following existing patterns
4. **AI**: Add new service functions in `/services/chutesService.ts`
5. **Styling**: Use existing Tailwind color scheme (indigo primary)

## Common Tasks

### Adding a New Feedback Category
Categories are dynamic - extracted from feedback items in database. No hardcoded list.

### Adding a New API Endpoint
1. Add route in `server/index.ts`: `app.get('/api/new-endpoint', ...)`
2. Implement async handler with try/catch
3. Use `pool.query()` for database operations
4. Return JSON response with appropriate status code

### Changing AI Model
1. Deploy new model on Chutes AI console
2. Copy the new `chute_id` from deployed model
3. Update `CHUTE_ID` in `.env` file
4. Restart backend server to apply changes

### Adding a New Status
1. Update status enum in database schema (if using Prisma)
2. Update type definitions in `types.ts`
3. Update any status-specific logic

### Testing API Endpoints
Use curl or Postman:
```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/feedback
curl -X POST http://localhost:5000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test feedback"}'
```

### Database Queries
Direct SQL queries via pg:
```typescript
const result = await pool.query('SELECT * FROM feedback_items');
const inserted = await pool.query(
  'INSERT INTO feedback_items (title, description) VALUES ($1, $2)',
  ['Title', 'Description']
);
```

## Deployment Notes

### Database (Neon)
- Managed PostgreSQL on Neon Cloud
- Connection URL stored in `.env`
- Auto-reconnect on connection failure
- SSL required for all connections

### Backend
- Runs on port 5000
- CORS enabled for frontend communication
- JSON body parsing with 10MB limit (for base64 images)

### Frontend
- Built with Vite
- Serves static files from `dist` directory
- API_BASE URL should be updated to production endpoint

### Production Checklist
- [ ] Update `API_BASE` in frontend to production URL
- [ ] Set proper `CHUTES_API_KEY` and `CHUTE_ID` in production environment
- [ ] Configure PostgreSQL for production load
- [ ] Enable HTTPS for backend server
- [ ] Set up proper user authentication
- [ ] Add rate limiting to API endpoints
