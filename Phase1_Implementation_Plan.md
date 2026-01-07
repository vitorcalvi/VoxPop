# Phase 1 Implementation Plan: Foundation & Core Feature Parity

This document provides a detailed implementation plan for Phase 1 of VoxPop's evolution toward competing with Linear.app, focusing on foundational features and core functionality.

---

## 1. User Management & Authentication

### 1.1 Database Schema Updates

**New Tables to Add:**

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams/Organizations table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team memberships table
CREATE TABLE team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

-- User sessions table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 Authentication Implementation

**Files to Create:**

#### `server/middleware/auth.ts`
```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../database';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    teamId?: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Verify session is still valid
    const sessionResult = await pool.query(
      'SELECT * FROM user_sessions WHERE token_hash = $1 AND expires_at > NOW()',
      [hashedToken]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user details
    const userResult = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireTeamRole = (roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const teamId = req.params.teamId || req.body.teamId;
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID required' });
    }

    const membershipResult = await pool.query(
      'SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );

    if (membershipResult.rows.length === 0 || !roles.includes(membershipResult.rows[0].role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.user.teamId = teamId;
    next();
  };
};
```

#### `server/routes/auth.ts`
```typescript
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name) 
       VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name`,
      [email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // Create default team for user
    const teamResult = await pool.query(
      `INSERT INTO teams (name, slug, created_by) 
       VALUES ($1, $2, $3) RETURNING *`,
      [`${firstName}'s Team`, email.replace(/[@.]/g, '-'), user.id]
    );

    const team = teamResult.rows[0];

    // Add user as owner of team
    await pool.query(
      `INSERT INTO team_memberships (team_id, user_id, role) 
       VALUES ($1, $2, 'owner')`,
      [team.id, user.id]
    );

    res.status(201).json({ user, team });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const userResult = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at) 
       VALUES ($1, $2, $3)`,
      [user.id, hashToken(token), expiresAt]
    );

    res.json({
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await pool.query(
        'DELETE FROM user_sessions WHERE token_hash = $1',
        [hashToken(token)]
      );
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name, avatar_url, role, preferences 
       FROM users WHERE id = $1`,
      [req.user?.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

function hashToken(token: string): string {
  return require('crypto')
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

export default router;
```

### 1.3 Frontend Authentication Components

#### `components/Auth/LoginForm.tsx`
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  onToggleMode: () => void;
}

export const LoginForm: React.FC<Props> = ({ onToggleMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome Back</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <button
            onClick={onToggleMode}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};
```

#### `hooks/useAuth.ts`
```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('voxpop_token');
    if (storedToken) {
      setToken(storedToken);
      // Verify token and get user
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('voxpop_token');
        setToken(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      localStorage.removeItem('voxpop_token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const { token: authToken, user: userData } = await response.json();
    
    setToken(authToken);
    setUser(userData);
    localStorage.setItem('voxpop_token', authToken);
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    setUser(null);
    setToken(null);
    localStorage.removeItem('voxpop_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

---

## 2. Enhanced Issue Management

### 2.1 Database Schema Updates

**Extend feedback_items table:**

```sql
ALTER TABLE feedback_items RENAME TO issues;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_type VARCHAR(20) DEFAULT 'feedback' 
  CHECK (issue_type IN ('bug', 'feature', 'task', 'incident', 'feedback'));

ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium' 
  CHECK (priority IN ('critical', 'high', 'medium', 'low', 'no_priority'));

ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES users(id);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS estimate_hours INTEGER;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS actual_hours INTEGER;

ALTER TABLE issues ADD COLUMN IF NOT EXISTS parent_issue_id UUID REFERENCES issues(id);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '[]'::jsonb;

-- Create issue relations table for blocking issues
CREATE TABLE IF NOT EXISTS issue_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  target_issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  relation_type VARCHAR(20) NOT NULL CHECK (relation_type IN ('blocks', 'duplicates', 'relates_to')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_issue_id, target_issue_id, relation_type)
);

-- Create issue comments table
CREATE TABLE IF NOT EXISTS issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create issue history table for tracking changes
CREATE TABLE IF NOT EXISTS issue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  field_name VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Enhanced Issue Types

#### `types.ts` Updates
```typescript
export type IssueType = 'bug' | 'feature' | 'task' | 'incident' | 'feedback';
export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'no_priority';
export type RelationType = 'blocks' | 'duplicates' | 'relates_to';

export interface Issue extends FeedbackItem {
  issueType: IssueType;
  priority: Priority;
  assigneeId?: string;
  assignee?: User;
  reporterId: string;
  reporter: User;
  teamId: string;
  team: Team;
  dueDate?: string;
  estimateHours?: number;
  actualHours?: number;
  parentIssueId?: string;
  parentIssue?: Issue;
  labels: string[];
  comments: Comment[];
  relations: IssueRelation[];
  history: IssueHistory[];
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: UserRole;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  settings: Record<string, any>;
  createdBy: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  user: User;
  role: 'member' | 'admin' | 'owner';
  joinedAt: string;
}

export interface Comment {
  id: string;
  issueId: string;
  userId: string;
  user: User;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueRelation {
  id: string;
  sourceIssueId: string;
  targetIssueId: string;
  relationType: RelationType;
  createdAt: string;
}

export interface IssueHistory {
  id: string;
  issueId: string;
  userId: string;
  user: User;
  fieldName: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export type UserRole = 'user' | 'admin' | 'owner';
```

### 2.3 Enhanced Issue Components

#### `components/Issue/IssueForm.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { Issue, IssueType, Priority, User } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  issue?: Issue;
  onSave: (issue: Partial<Issue>) => void;
  onCancel: () => void;
}

export const IssueForm: React.FC<Props> = ({ issue, onSave, onCancel }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(issue?.title || '');
  const [description, setDescription] = useState(issue?.description || '');
  const [issueType, setIssueType] = useState<IssueType>(issue?.issueType || 'feedback');
  const [priority, setPriority] = useState<Priority>(issue?.priority || 'medium');
  const [assigneeId, setAssigneeId] = useState(issue?.assigneeId || '');
  const [dueDate, setDueDate] = useState(issue?.dueDate || '');
  const [estimateHours, setEstimateHours] = useState(issue?.estimateHours || 0);
  const [labels, setLabels] = useState<string[]>(issue?.labels || []);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch team members for assignee dropdown
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch('/api/teams/members');
        if (response.ok) {
          const members = await response.json();
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    fetchTeamMembers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const issueData = {
        title,
        description,
        issueType,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
        estimateHours: estimateHours || null,
        labels,
        reporterId: user?.id
      };

      await onSave(issueData);
    } catch (error) {
      console.error('Error saving issue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addLabel = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      setLabels([...labels, e.currentTarget.value.trim()]);
      e.currentTarget.value = '';
    }
  };

  const removeLabel = (labelToRemove: string) => {
    setLabels(labels.filter(label => label !== labelToRemove));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {issue ? 'Edit Issue' : 'Create New Issue'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="feedback">Feedback</option>
              <option value="bug">Bug</option>
              <option value="feature">Feature</option>
              <option value="task">Task</option>
              <option value="incident">Incident</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="no_priority">No Priority</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assignee
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Unassigned</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>
                  {member.firstName && member.lastName 
                    ? `${member.firstName} ${member.lastName}` 
                    : member.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimate (hours)
            </label>
            <input
              type="number"
              min="0"
              value={estimateHours}
              onChange={(e) => setEstimateHours(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Labels
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {labels.map(label => (
              <span
                key={label}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
              >
                {label}
                <button
                  type="button"
                  onClick={() => removeLabel(label)}
                  className="ml-1 text-indigo-600 hover:text-indigo-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add label and press Enter"
            onKeyDown={addLabel}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : (issue ? 'Update Issue' : 'Create Issue')}
          </button>
        </div>
      </form>
    </div>
  );
};
```

---

## 3. Team Collaboration Features

### 3.1 Real-time Comments System

#### `server/routes/comments.ts`
```typescript
import express from 'express';
import { pool } from '../database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get comments for an issue
router.get('/issues/:issueId/comments', authenticateToken, async (req, res) => {
  try {
    const { issueId } = req.params;
    
    const result = await pool.query(
      `SELECT ic.*, u.email, u.first_name, u.last_name, u.avatar_url
       FROM issue_comments ic
       JOIN users u ON ic.user_id = u.id
       WHERE ic.issue_id = $1
       ORDER BY ic.created_at ASC`,
      [issueId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add a comment to an issue
router.post('/issues/:issueId/comments', authenticateToken, async (req, res) => {
  try {
    const { issueId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const result = await pool.query(
      `INSERT INTO issue_comments (issue_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [issueId, userId, content.trim()]
    );

    const comment = result.rows[0];

    // Get user details for response
    const userResult = await pool.query(
      'SELECT email, first_name, last_name, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    const commentWithUser = {
      ...comment,
      user: userResult.rows[0]
    };

    // Emit real-time update
    req.io?.to(`issue:${issueId}`).emit('comment_added', commentWithUser);

    res.status(201).json(commentWithUser);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Update a comment
router.put('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Check if user owns the comment
    const ownershipResult = await pool.query(
      'SELECT user_id, issue_id FROM issue_comments WHERE id = $1',
      [commentId]
    );

    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (ownershipResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    const result = await pool.query(
      `UPDATE issue_comments 
       SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [content.trim(), commentId]
    );

    const updatedComment = result.rows[0];

    // Emit real-time update
    req.io?.to(`issue:${ownershipResult.rows[0].issue_id}`).emit('comment_updated', updatedComment);

    res.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete a comment
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;

    // Check if user owns the comment
    const ownershipResult = await pool.query(
      'SELECT user_id, issue_id FROM issue_comments WHERE id = $1',
      [commentId]
    );

    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (ownershipResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await pool.query('DELETE FROM issue_comments WHERE id = $1', [commentId]);

    // Emit real-time update
    req.io?.to(`issue:${ownershipResult.rows[0].issue_id}`).emit('comment_deleted', { commentId });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
```

### 3.2 WebSocket Implementation

#### `server/websocket.ts`
```typescript
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { pool } from './database';

export const initializeWebSocket = (httpServer: HTTPServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"]
    }
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Verify session is still valid
      const sessionResult = await pool.query(
        'SELECT * FROM user_sessions WHERE token_hash = $1 AND expires_at > NOW()',
        [hashToken(token)]
      );
      
      if (sessionResult.rows.length === 0) {
        return next(new Error('Invalid or expired session'));
      }

      // Get user details
      const userResult = await pool.query(
        'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.data.user = userResult.rows[0];
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.user.email}`);

    // Join user to their personal room for notifications
    socket.join(`user:${socket.data.user.id}`);

    // Handle joining issue rooms
    socket.on('join_issue', (issueId) => {
      socket.join(`issue:${issueId}`);
      console.log(`User ${socket.data.user.email} joined issue ${issueId}`);
    });

    // Handle leaving issue rooms
    socket.on('leave_issue', (issueId) => {
      socket.leave(`issue:${issueId}`);
      console.log(`User ${socket.data.user.email} left issue ${issueId}`);
    });

    // Handle typing indicators
    socket.on('typing_start', (issueId) => {
      socket.to(`issue:${issueId}`).emit('user_typing', {
        userId: socket.data.user.id,
        userName: socket.data.user.first_name || socket.data.user.email,
        isTyping: true
      });
    });

    socket.on('typing_stop', (issueId) => {
      socket.to(`issue:${issueId}`).emit('user_typing', {
        userId: socket.data.user.id,
        isTyping: false
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.user.email}`);
    });
  });

  return io;
};

function hashToken(token: string): string {
  return require('crypto')
    .createHash('sha256')
    .update(token)
    .digest('hex');
}
```

---

## 4. Basic Project Management

### 4.1 Project Database Schema

```sql
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, slug)
);

-- Project memberships table
CREATE TABLE IF NOT EXISTS project_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

-- Project milestones table
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Project Components

#### `components/Projects/ProjectBoard.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { Issue, IssueStatus } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { IssueCard } from '../Issue/IssueCard';

interface Props {
  projectId: string;
}

export const ProjectBoard: React.FC<Props> = ({ projectId }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const columns: { status: IssueStatus; title: string; color: string }[] = [
    { status: 'open', title: 'Open', color: 'bg-gray-100' },
    { status: 'planned', title: 'Planned', color: 'bg-blue-100' },
    { status: 'in-progress', title: 'In Progress', color: 'bg-yellow-100' },
    { status: 'completed', title: 'Completed', color: 'bg-green-100' },
    { status: 'closed', title: 'Closed', color: 'bg-red-100' }
  ];

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/issues`);
        if (response.ok) {
          const issuesData = await response.json();
          setIssues(issuesData);
        }
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIssues();
  }, [projectId]);

  const handleDrop = async (e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('issueId');
    
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('voxpop_token')}`
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        const updatedIssue = await response.json();
        setIssues(prevIssues => 
          prevIssues.map(issue => 
            issue.id === issueId ? updatedIssue : issue
          )
        );
      }
    } catch (error) {
      console.error('Error updating issue status:', error);
    }
  };

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData('issueId', issueId);
  };

  const getIssuesForStatus = (status: IssueStatus) => {
    return issues.filter(issue => issue.status === status);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex space-x-4 overflow-x-auto pb-4">
      {columns.map(column => (
        <div
          key={column.status}
          className={`flex-shrink-0 w-80 ${column.color} rounded-lg p-4`}
          onDrop={(e) => handleDrop(e, column.status)}
          onDragOver={(e) => e.preventDefault()}
        >
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center justify-between">
            {column.title}
            <span className="bg-white rounded-full px-2 py-1 text-xs font-medium">
              {getIssuesForStatus(column.status).length}
            </span>
          </h3>
          
          <div className="space-y-3">
            {getIssuesForStatus(column.status).map(issue => (
              <div
                key={issue.id}
                draggable
                onDragStart={(e) => handleDragStart(e, issue.id)}
                className="cursor-move"
              >
                <IssueCard issue={issue} compact={true} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## Implementation Timeline

### Month 1: Foundation
- Week 1-2: User authentication system
- Week 3-4: Basic user management and team creation

### Month 2: Core Issue Management
- Week 1-2: Enhanced issue schema and types
- Week 3-4: Issue creation, editing, and management

### Month 3: Collaboration Features
- Week 1-2: Comments system
- Week 3-4: Real-time updates and notifications

### Month 4: Project Management
- Week 1-2: Project creation and management
- Week 3-4: Kanban board and basic project views

---

## Dependencies to Install

```bash
# Authentication & Security
npm install jsonwebtoken bcryptjs
npm install --save-dev @types/jsonwebtoken @types/bcryptjs

# Real-time Communication
npm install socket.io
npm install --save-dev @types/socket.io

# Enhanced Validation
npm install joi
npm install --save-dev @types/joi

# File Uploads
npm install multer
npm install --save-dev @types/multer

# Date Handling
npm install date-fns
```

---

## Next Steps

1. Begin with user authentication implementation
2. Set up enhanced database schema
3. Create core issue management components
4. Implement real-time collaboration features
5. Build basic project management functionality

This implementation plan provides a solid foundation for VoxPop to compete with Linear.app while leveraging its existing AI capabilities as a unique differentiator.