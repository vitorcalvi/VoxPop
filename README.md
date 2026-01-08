# Feedback - AI-Powered Community Voice

An intelligent feedback management application powered by AI for community-driven product development.

## 🚀 Features

- **AI-Powered Analysis**: Automatic sentiment analysis, categorization, and intelligent insights
- **Feedback Management**: Submit, categorize, and track user feedback
- **Real-Time Database**: Persistent storage with PostgreSQL (Neon Cloud)
- **Smart Filtering**: Dynamic category extraction and search functionality
- **Vote System**: User-agnostic voting with deduplication
- **Multi-Language Support**: English, Spanish, Portuguese
- **Responsive Design**: Mobile-first UI with Tailwind CSS

## 🏗️ Architecture

```
┌─────────────────┐    HTTP    ┌──────────────┐    SQL    ┌─────────────┐
│   Frontend     │ ◄────────► │   Backend     │ ◄────────► │ PostgreSQL  │
│  (React/Vite)  │   5000     │   (Express)   │   (Neon)    │
│  Port: 5173     │            │  Port: 5000   │              │
└─────────────────┘            └──────────────┘              └─────────────┘
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
- **Chutes Plus AI** - Comprehensive feedback analysis
- **Google Gemini** - Alternative AI provider

## 📦 Installation

```bash
# Clone repository
git clone <repository-url>
cd Feedback

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database URL
```

## ⚙️ Configuration

Create a `.env` file in project root:

```bash
# PostgreSQL Database (Neon)
DATABASE_URL="postgresql://neondb_owner:password@ep-host-name-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Server Port
PORT=5000
```

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

### Database connection errors
- Verify Neon database is active
- Check SSL is enabled in connection string
- Test connection with psql or Neon console

### Frontend won't load
- Check Vite is running on port 5173
- Verify CORS is enabled on backend
- Check browser console for errors

### Images not uploading
- Check file size (should be < 10MB)
- Verify image format (jpg, png, webp)
- Check browser permissions

## 📝 Development Notes

### Code Style
- Functional components with hooks
- TypeScript strict mode
- Consistent naming conventions
- Descriptive variable names

### Testing
- Test API endpoints with curl or Postman
- Test database queries in Neon console
- Test responsive design with browser dev tools

### Debugging
- Backend logs to console
- Frontend errors in browser console
- Use Chrome DevTools for React debugging
- Check Network tab for API calls

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
- Contact development team

## 🔮 Future Enhancements

- [ ] User authentication system
- [ ] Admin dashboard for moderation
- [ ] Email notifications for updates
- [ ] Integration with project management tools
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] Dark mode support
- [ ] Webhook integrations
- [ ] Export functionality (CSV, PDF)

---

**Built with ❤️ using Feedback**
