import React, { useState, useEffect } from 'react';
import './App.css';

interface GmailMessage {
  id: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
}

interface AuthStatus {
  authenticated: boolean;
  email: string | null;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false, email: null });
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
    
    // Check for auth success in URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      // Remove the auth parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/auth/status', {
        credentials: 'include'
      });
      const result: ApiResponse<AuthStatus> = await response.json();
      
      if (result.success && result.data) {
        setAuthStatus(result.data);
        if (result.data.authenticated) {
          fetchMessages();
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const handleLogin = () => {
    window.location.href = 'http://localhost:8080/auth';
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setAuthStatus({ authenticated: false, email: null });
      setMessages([]);
      setError(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/messages', {
        credentials: 'include'
      });
      const result: ApiResponse<{ messages: GmailMessage[], count: number }> = await response.json();
      
      if (result.success && result.data) {
        setMessages(result.data.messages);
      } else {
        setError(result.error || 'Failed to fetch messages');
      }
    } catch (error) {
      setError('Error fetching messages');
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Gmail Unread Messages</h1>
        
        {!authStatus.authenticated ? (
          <div className="auth-section">
            <p>Sign in with your Gmail account to view your unread messages</p>
            <button onClick={handleLogin} className="login-btn">
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="dashboard">
            <div className="user-info">
              <p>Signed in as: <strong>{authStatus.email}</strong></p>
              <button onClick={handleLogout} className="logout-btn">
                Sign Out
              </button>
              <button onClick={fetchMessages} className="refresh-btn" disabled={loading}>
                {loading ? 'Loading...' : 'Refresh Messages'}
              </button>
            </div>

            {error && (
              <div className="error">
                <p>Error: {error}</p>
              </div>
            )}

            <div className="messages-section">
              <h2>Last 10 Unread Messages</h2>
              
              {loading ? (
                <p>Loading messages...</p>
              ) : messages.length === 0 ? (
                <p>No unread messages found.</p>
              ) : (
                <div className="messages-list">
                  {messages.map((message) => (
                    <div key={message.id} className="message-item">
                      <div className="message-header">
                        <strong className="message-subject">{message.subject}</strong>
                        <span className="message-date">{formatDate(message.date)}</span>
                      </div>
                      <div className="message-sender">From: {message.sender}</div>
                      <div className="message-snippet">{message.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
