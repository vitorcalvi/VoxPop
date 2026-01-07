import React, { useState, useEffect } from 'react';
import './LoginButton.css';

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role: string;
}

interface LoginButtonProps {
  onLoginSuccess?: (user: User) => void;
  onLogout?: () => void;
  className?: string;
}

export const LoginButton: React.FC<LoginButtonProps> = ({
  onLoginSuccess,
  onLogout,
  className = '',
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const API_BASE = 'http://localhost:5000/api';

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        onLoginSuccess?.(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const initiateGitHubLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get GitHub OAuth URL
      const response = await fetch(`${API_BASE}/auth/github/login`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate login');
      }

      // Store state for callback verification
      localStorage.setItem('oauth_state', data.state);

      // Redirect to GitHub
      window.location.href = data.githubAuthUrl;
    } catch (error: any) {
      setError(error.message || 'Failed to start login process');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      setUser(null);
      onLogout?.();
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear user state even if API call fails
      setUser(null);
      onLogout?.();
    }
  };

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code && state) {
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
          const response = await fetch(
            `${API_BASE}/auth/github/callback?code=${code}&state=${state}`,
            {
              credentials: 'include',
            }
          );

          const data = await response.json();

          if (response.ok) {
            setUser(data.user);
            onLoginSuccess?.(data.user);

            // Clear stored state
            localStorage.removeItem('oauth_state');
          } else {
            setError(data.error || 'Authentication failed');
          }
        } catch (error: any) {
          setError(error.message || 'Authentication failed');
        } finally {
          setLoading(false);
        }
      }
    };

    handleCallback();
  }, []);

  if (checkingAuth) {
    return (
      <div className={`login-container ${className}`}>
        <div className="loading-spinner">Checking authentication...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className={`login-container ${className}`}>
        <div className="user-info">
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="user-avatar"
            />
          )}
          <div className="user-details">
            <span className="user-name">{user.username}</span>
            <span className={`user-role ${user.role.toLowerCase()}`}>
              {user.role}
            </span>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className={`login-container ${className}`}>
      {error && <div className="error-message">{error}</div>}
      <button
        onClick={initiateGitHubLogin}
        disabled={loading}
        className="github-login-btn"
      >
        <svg className="github-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        {loading ? 'Connecting to GitHub...' : 'Sign in with GitHub'}
      </button>
    </div>
  );
};
