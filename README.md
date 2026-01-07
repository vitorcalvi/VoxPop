# VoxPop - AI-Powered Feedback System

An intelligent feedback management application powered by Chutes AI (LLM models) and PostgreSQL.

## 🚀 Features

- **AI-Powered Analysis**: Automatic categorization, sentiment analysis, and insight generation using custom LLM models deployed on Chutes AI
- **Multimodal Support**: Text + Screenshot analysis for visual feedback context
- **Real-Time Database**: Persistent storage with PostgreSQL (Neon Cloud)
- **Smart Filtering**: Dynamic category extraction and search functionality
- **AI Roadmap Generation**: Automatic product roadmap summaries based on feedback
- **Responsive Design**: Mobile-first UI with Tailwind CSS
- **Vote System**: User-agnostic voting with deduplication

## 🏗️ Architecture

```
┌─────────────────┐    HTTP    ┌──────────────┐    SQL    ┌─────────────┐
│   Frontend     │ ◄────────► │   Backend     │ ◄────────► │ PostgreSQL  │
│  (React/Vite)  │   5000     │   (Express)   │   (Neon)    │
│  Port: 5173     │            │  Port: 5000   │              │
└─────────────────┘            └──────────────┘              └─────────────┘
                                             ▲
                                             │
                                    HTTP API
                                             │
                                    ┌──────────────┐
                                    │   Chutes AI  │
                                    │  (LLM Model) │
                                    │  (Chute ID)  │
                                    └──────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **React 18.3.1** - UI library
- **TypeScript** - Type safety
- **Vite 6** - Build tool and dev server
- **Tailwind CSS** - Styling (CDN)
- **Font Awesome** - Icons (CDN)

### Backend
- **Express.js 5** - API server
- **TypeScript** - Type-safe backend
- **pg (node-postgres)** - PostgreSQL client
- **CORS** - Cross-origin support

### Database
- **PostgreSQL** - Primary database
- **Neon Cloud** - Managed PostgreSQL hosting

### AI Services
- **Chutes AI** - LLM model deployment and inference (deploy your own model)
- **Custom LLM Models** - Any compatible model (Llama, Mistral, etc.)

## 📦 Installation

```bash
# Clone repository
git clone <repository-url>
cd VoxPop

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your API keys
```

## ⚙️ Configuration

Create a `.env` file in project root:

```bash
# PostgreSQL Database (Neon)
DATABASE_URL="postgresql://neondb_owner:password@ep-host-name-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Chutes AI API Key (required for AI analysis)
CHUTES_API_KEY=cpk_baee7a2deb56498aa5c1e7f83cd6ea35.89c85babdb2f5fee845af071220bfcc3.f3Gw21b2zXjfyeW1hncDgmLGjrffksfs

# Chute ID (required - your deployed LLM model's ID)
# Step 1: Deploy an LLM model on Chutes AI console
# Step 2: Copy the chute_id from your deployed model
# Step 3: Paste it below
CHUTE_ID=your-deployed-chute-id-here

# Server Port
PORT=5000
```

### Setting Up Chutes AI

1. **Create Account**: Sign up at [chutes.ai](https://chutes.ai)
2. **Get API Key**: Copy your API key from account settings
3. **Deploy an LLM Model**:
   - Go to Chutes AI console
   - Choose an LLM model (Llama, Mistral, etc.)
   - Deploy it as a "chute"
   - Copy the `chute_id` from the deployed model
4. **Configure Environment**:
   - Add `CHUTES_API_KEY` to `.env` (from step 2)
   - Add `CHUTE_ID` to `.env` (the chute ID from step 3)
5. **Neon Database**: Create a PostgreSQL database on [neon.tech](https://neon.tech) and copy connection string to `.env`

### Getting Started

After configuring `.env`:

```bash
# Install dependencies
npm install

# Run application
npm run dev
```

## 🚀 Running the Application

### Development Mode (Both Servers)

```bash
npm run dev
```

This starts:
- Frontend (Vite): http://localhost:5173
- Backend (Express): http://localhost:5000

### Backend Only

```bash
npm run server
```

### Frontend Only

```bash
npm run dev:client
```

### Production Build

```bash
npm run build
npm run preview
```

## 📊 Database Schema

### feedback_items

| Column | Type | Description |
|---------|-------|-------------|
| id | UUID | Primary key |
| title | VARCHAR(255) | Feedback title |
| description | TEXT | Feedback description |
| category | VARCHAR(100) | AI-generated or user-specified category |
| votes | INTEGER | Vote count (default: 1) |
| status | VARCHAR(20) | Status: open, planned, in-progress, completed, closed |
| sentiment | VARCHAR(20) | AI-detected sentiment |
| aiInsight | TEXT | AI-generated insight |
| screenshot | TEXT | Base64 encoded screenshot |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

### user_votes

| Column | Type | Description |
|---------|-------|-------------|
| id | UUID | Primary key |
| userId | VARCHAR(100) | User identifier |
| feedbackId | UUID | Foreign key to feedback_items |
| votedAt | TIMESTAMP | Vote timestamp |

**Unique constraint**: (userId, feedbackId) prevents duplicate votes

## 🔌 API Endpoints

### Public Endpoints

#### GET `/api/health`
Health check endpoint.

#### GET `/api/chutes`
Lists all deployed Chutes AI models (chutes) for the account.

#### GET `/api/feedback?category={category}&search={query}`
Fetch feedback with optional filters.

**Response**: Array of feedback items

#### GET `/api/feedback/:id`
Fetch single feedback item.

**Response**: Single feedback object

#### GET `/api/categories`
Get list of all unique categories.

**Response**: Array of category names

#### POST `/api/feedback`
Create new feedback item.

**Body**:
```json
{
  "title": "string",
  "description": "string",
  "category": "string",
  "sentiment": "string",
  "aiInsight": "string",
  "screenshot": "base64..."
}
```

**Response**: Created feedback item

#### POST `/api/feedback/:id/vote`
Vote on feedback.

**Body**:
```json
{
  "userId": "string",
  "vote": true
}
```

**Response**: Updated feedback item

#### POST `/api/analyze`
Analyze feedback with AI.

**Body**:
```json
{
  "title": "string",
  "description": "string",
  "screenshot": "base64..."
}
```

**Response**:
```json
{
  "category": "Feature | Bug | UI/UX | Performance | Mobile | Security",
  "sentiment": "positive | neutral | negative",
  "suggestedTags": ["tag1", "tag2"],
  "impactScore": 1-10,
  "aiInsight": "AI insight text..."
}
```

#### POST `/api/roadmap`
Generate AI roadmap summary.

**Body**:
```json
{
  "feedbacks": [...]
}
```

**Response**:
```json
{
  "summary": "AI-generated roadmap summary..."
}
```

#### PUT `/api/feedback/:id`
Update feedback item.

**Response**: Updated feedback item

#### DELETE `/api/feedback/:id`
Delete feedback item.

**Response**: Success message

## 🤖 AI Features

### Feedback Analysis

When users submit feedback, the system:
1. Sends title, description, and optional screenshot to Chutes AI
2. Invokes the deployed LLM model via job system
3. Polls for job completion (async execution)
4. Receives structured analysis including:
   - **Category**: Auto-categorized (Feature, Bug, UI/UX, etc.)
   - **Sentiment**: Detected emotional tone (positive, neutral, negative)
   - **Tags**: Relevant keywords for filtering
   - **Impact Score**: Priority rating (1-10)
   - **AI Insight**: Concise explanation of importance
5. Stores analysis with feedback in database

### Roadmap Generation

The AI Roadmap feature:
1. Collects all feedback from database
2. Sends to deployed LLM model for summary via Chutes AI
3. Polls for job completion
4. Returns prioritized themes and suggestions
5. Displays in a styled modal overlay

### Chutes AI Workflow

1. **Deploy Model**: Deploy an LLM (Llama, Mistral, etc.) as a "chute" on Chutes AI
2. **Get Chute ID**: Copy the `chute_id` from your deployed model
3. **Set CHUTE_ID**: Add `CHUTE_ID=<chute_id>` to `.env`
4. **Run Application**: System will use your deployed model for all AI analysis

### Supported Categories

AI automatically classifies feedback into:
- **Feature** - New functionality requests
- **Bug** - Defects or errors
- **UI/UX** - Interface or user experience issues
- **Performance** - Speed or resource concerns
- **Mobile** - Mobile-specific issues
- **Security** - Security vulnerabilities or concerns
- **Other** - General feedback

## 🎨 UI Components

### FeedbackCard
Displays individual feedback with:
- Vote counter and toggle button
- Status badge with color coding
- Category tag
- Sentiment emoji indicator
- Screenshot preview with expand
- AI insight block

### FeedbackForm
Submission form with:
- Title and description inputs
- Screenshot upload with preview
- Real-time AI analysis indicator
- Form validation

### Sidebar
Filtering panel with:
- Dynamic category list
- Active category highlighting
- "All Feedback" option
- Chutes AI model info card

## 📱 Responsive Breakpoints

- **Mobile**: < 768px (default)
- **md**: ≥ 768px
- **lg**: ≥ 1024px

### Mobile Features
- Single column layout
- Simplified navigation
- Touch-friendly inputs
- Collapsible sidebar

### Desktop Features
- Three-column layout
- Sticky sidebar
- Admin panel indicator
- Enhanced search

## 🔒 Security Considerations

### Current Implementation
- **User Session**: Simple random ID for vote tracking
- **CORS**: Enabled for dev environment
- **SQL Injection Prevention**: Parameterized queries

### Production Recommendations
- [ ] Implement user authentication
- [ ] Add rate limiting to API endpoints
- [ ] Use HTTPS for all connections
- [ ] Implement CSRF protection
- [ ] Add API key authentication
- [ ] Sanitize all user inputs
- [ ] Add logging and monitoring
- [ ] Implement backup strategy

## 🚀 Deployment

### Frontend (Vite)
```bash
npm run build
# Upload dist/ folder to your hosting
```

### Backend (Node.js)
```bash
# Use PM2 or similar process manager
npm run server
# Or build with tsx
npx tsx build server/index.ts
node dist/index.js
```

### Database (Neon)
- Neon handles all database management
- Connection string in environment
- Automatic backups included

### Environment Checklist
- [ ] Set `CHUTES_API_KEY` and `CHUTE_ID` in production environment
- [ ] Update `DATABASE_URL` to production Neon URL
- [ ] Configure proper domain for API
- [ ] Enable SSL certificates
- [ ] Set up CI/CD pipeline
- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up monitoring (Datadog, etc.)

## 🐛 Troubleshooting

### Backend won't start
- Check port 5000 is not in use
- Verify DATABASE_URL is correct
- Check Node.js version (>= 18)
- Verify CHUTES_API_KEY is set
- Verify CHUTE_ID is set (deployed model required)

### Database connection errors
- Verify Neon database is active
- Check SSL is enabled in connection string
- Test connection with psql or Neon console

### AI analysis fails
- Verify CHUTES_API_KEY is set
- Check API key has proper permissions
- Verify CHUTE_ID points to a valid, deployed model
- Check model is active on Chutes AI
- Check network connectivity to Chutes AI

### Frontend won't load
- Check Vite is running on port 5173
- Verify CORS is enabled on backend
- Check browser console for errors

### Images not uploading
- Check file size (should be < 10MB)
- Verify image format (jpg, png, webp)
- Check browser permissions

### Chutes AI Job Timeout
- Increase timeout in chutesService.ts (default 30 seconds)
- Check model status on Chutes AI console
- Verify model has available GPU resources
- Try deploying a different model

## 📝 Development Notes

### Code Style
- Functional components with hooks
- TypeScript strict mode
- Consistent naming conventions
- Descriptive variable names

### Testing
- Test API endpoints with curl or Postman
- Test database queries in Neon console
- Test AI prompts in Chutes AI console
- Test responsive design with browser dev tools

### Debugging
- Backend logs to console
- Frontend errors in browser console
- Use Chrome DevTools for React debugging
- Check Network tab for API calls
- Monitor Chutes AI job status

## 🤝 Contributing

1. Fork repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure code quality
5. Submit a pull request

### Guidelines
- Follow existing code style
- Add TypeScript types for new code
- Update documentation for new features
- Test thoroughly before submitting

## 📄 License

This project is proprietary and confidential.

## 📞 Support

For issues and questions:
- Check AGENTS.md for development documentation
- Review API endpoints for integration
- Deploy a compatible LLM model on Chutes AI
- Contact development team

## 🔮 Future Enhancements

- [ ] User authentication system
- [ ] Admin dashboard for moderation
- [ ] Email notifications for updates
- [ ] Integration with project management tools
- [ ] Advanced analytics dashboard
- [ ] Multiple LLM model support (select different chutes)
- [ ] Mobile app development
- [ ] Dark mode support
- [ ] Internationalization (i18n)
- [ ] Webhook integrations
- [ ] Export functionality (CSV, PDF)

---

**Built with ❤️ using Chutes AI and Neon**
