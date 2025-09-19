import React, { useState, useEffect } from 'react';
import './App.css';

interface GmailMessage {
  id: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
}

interface EnhancedGmailMessage extends GmailMessage {
  content: {
    original: string;
    processed?: {
      translatedText?: string;
      summary?: string;
      language?: string;
      confidence?: number;
    };
  };
  aiProcessing: {
    status: 'pending' | 'completed' | 'failed';
    processedAt?: string;
    error?: string;
  };
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
  const [enhancedMessages, setEnhancedMessages] = useState<EnhancedGmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAiProcessing, setUseAiProcessing] = useState(false);

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

  const fetchEnhancedMessages = async () => {
    setAiLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/messages/enhanced', {
        credentials: 'include'
      });
      const result: ApiResponse<{ 
        messages: EnhancedGmailMessage[], 
        count: number,
        aiProcessingStatus: {
          processed: number;
          failed: number;
          pending: number;
        }
      }> = await response.json();
      
      if (result.success && result.data) {
        setEnhancedMessages(result.data.messages);
        console.log(`AI Processing Status - Processed: ${result.data.aiProcessingStatus.processed}, Failed: ${result.data.aiProcessingStatus.failed}`);
      } else {
        setError(result.error || 'Failed to fetch enhanced messages');
      }
    } catch (error) {
      setError('Error fetching enhanced messages');
      console.error('Error fetching enhanced messages:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleAiProcessing = () => {
    const newUseAi = !useAiProcessing;
    setUseAiProcessing(newUseAi);
    
    if (newUseAi) {
      fetchEnhancedMessages();
    } else {
      fetchMessages();
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
              <button onClick={useAiProcessing ? fetchEnhancedMessages : fetchMessages} className="refresh-btn" disabled={loading || aiLoading}>
                {(loading || aiLoading) ? 'Loading...' : 'Refresh Messages'}
              </button>
              <button onClick={toggleAiProcessing} className="ai-toggle-btn" disabled={loading || aiLoading}>
                {useAiProcessing ? 'Disable AI Processing' : 'Enable AI Processing'}
              </button>
            </div>

            {error && (
              <div className="error">
                <p>Error: {error}</p>
              </div>
            )}

            <div className="messages-section">
              <h2>Last 10 Unread Messages {useAiProcessing && '(AI Enhanced)'}</h2>
              
              {aiLoading && (
                <p>Processing messages with AI...</p>
              )}
              
              {loading ? (
                <p>Loading messages...</p>
              ) : useAiProcessing ? (
                enhancedMessages.length === 0 ? (
                  <p>No unread messages found.</p>
                ) : (
                  <div className="messages-list">
                    {enhancedMessages.map((message) => (
                      <div key={message.id} className="message-item enhanced">
                        <div className="message-header">
                          <strong className="message-subject">{message.subject}</strong>
                          <span className="message-date">{formatDate(message.date)}</span>
                          <span className={`ai-status ${message.aiProcessing.status}`}>
                            {message.aiProcessing.status === 'completed' ? '✓ AI Processed' : 
                             message.aiProcessing.status === 'pending' ? '⏳ Processing...' : 
                             '✗ AI Failed'}
                          </span>
                        </div>
                        <div className="message-sender">From: {message.sender}</div>
                        
                        <div className="message-content">
                          <div className="original-content">
                            <strong>Original:</strong>
                            <div className="message-snippet">{message.content.original}</div>
                          </div>
                          
                          {message.content.processed && (
                            <div className="ai-content">
                              <div className="ai-summary">
                                <strong>AI Summary:</strong>
                                <div className="ai-text">{message.content.processed.summary}</div>
                              </div>
                              
                              {message.content.processed.translatedText && (
                                <div className="ai-translation">
                                  <strong>Translation {message.content.processed.language ? `(${message.content.processed.language})` : ''}:</strong>
                                  <div className="ai-text">{message.content.processed.translatedText}</div>
                                </div>
                              )}
                              
                              {message.content.processed.confidence && (
                                <div className="ai-confidence">
                                  <small>AI Confidence: {Math.round(message.content.processed.confidence * 100)}%</small>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {message.aiProcessing.status === 'failed' && message.aiProcessing.error && (
                            <div className="ai-error">
                              <small>AI processing failed: {message.aiProcessing.error}</small>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                messages.length === 0 ? (
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
                )
              )}
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
