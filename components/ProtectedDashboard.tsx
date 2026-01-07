import React, { useEffect, useState } from 'react';
import { LoginButton } from './LoginButton';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export const ProtectedDashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secretData, setSecretData] = useState<string | null>(null);

  const API_BASE = 'http://localhost:5000/api';

  useEffect(() => {
    fetchProtectedData();
  }, [user]);

  const fetchProtectedData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/protected/dashboard`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch protected data');
      }

      const data = await response.json();
      setSecretData(data.message);
    } catch (error: any) {
      setError(error.message || 'Failed to load protected data');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    setSecretData(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>VoxPop Dashboard</h1>
        <LoginButton onLoginSuccess={handleLoginSuccess} onLogout={handleLogout} />
      </header>

      <main className="dashboard-main">
        {!user ? (
          <div className="auth-required">
            <h2>Authentication Required</h2>
            <p>Please sign in with GitHub to access this dashboard.</p>
          </div>
        ) : (
          <div className="dashboard-content">
            <section className="user-section">
              <h2>Welcome, {user.username}!</h2>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Role:</strong>{' '}
                <span className={`role-badge ${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
              </p>
            </section>

            {error && (
              <div className="error-banner">{error}</div>
            )}

            {secretData && (
              <section className="secret-section">
                <h3>Protected Data</h3>
                <p className="secret-message">{secretData}</p>
              </section>
            )}

            {user.role === 'ADMIN' && (
              <section className="admin-section">
                <h3>Admin Actions</h3>
                <p>
                  As an admin, you have access to additional features:
                </p>
                <ul>
                  <li>Manage all users</li>
                  <li>Delete feedback items</li>
                  <li>Access admin analytics</li>
                </ul>
                <button
                  onClick={fetchAdminUsers}
                  className="admin-action-btn"
                >
                  View Admin Panel
                </button>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const fetchAdminUsers = async () => {
  const API_BASE = 'http://localhost:5000/api';
  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to access admin panel');
    }

    const data = await response.json();
    alert(`Admin panel accessed:\n${JSON.stringify(data, null, 2)}`);
  } catch (error: any) {
    alert(`Error: ${error.message}`);
  }
};
