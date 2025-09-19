import { GmailMessage, GoogleAuthConfig } from '../types';
import {
  GoogleTokenRequest,
  GoogleTokenResponse,
  GoogleApiError,
  GmailProfile,
  MessageListResponse,
  MessageDetailResponse,
  MessagePayload
} from '../types/googleApi';

export class GmailServiceRaw {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private refreshToken?: string;

  // API endpoints
  private static readonly OAUTH2_BASE = 'https://oauth2.googleapis.com';
  private static readonly AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
  private static readonly TOKEN_URL = `${GmailServiceRaw.OAUTH2_BASE}/token`;
  private static readonly GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1';

  constructor(config: GoogleAuthConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${GmailServiceRaw.AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string) {
    const tokenRequest: GoogleTokenRequest = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri
    };

    try {
      const response = await fetch(GmailServiceRaw.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenRequest as any).toString()
      });

      if (!response.ok) {
        const errorData = await response.json() as GoogleApiError;
        throw new Error(`Token exchange failed: ${errorData.error.message}`);
      }

      const tokens = await response.json() as GoogleTokenResponse;
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        scope: tokens.scope
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  setCredentials(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  async getUserEmail(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${GmailServiceRaw.GMAIL_BASE}/users/me/profile`
      );

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const profile = await response.json() as GmailProfile;
      return profile.emailAddress || '';
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  async getUnreadMessages(maxResults: number = 10): Promise<GmailMessage[]> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      // Get list of unread message IDs
      const listUrl = `${GmailServiceRaw.GMAIL_BASE}/users/me/messages?${new URLSearchParams({
        q: 'is:unread',
        maxResults: maxResults.toString()
      })}`;

      const listResponse = await this.makeAuthenticatedRequest(listUrl);
      
      if (!listResponse.ok) {
        await this.handleApiError(listResponse);
      }

      const messageList = await listResponse.json() as MessageListResponse;
      const messageIds = messageList.messages || [];
      
      if (messageIds.length === 0) {
        return [];
      }

      // Get detailed information for each message
      const messagePromises = messageIds.map(async (msg) => {
        const messageUrl = `${GmailServiceRaw.GMAIL_BASE}/users/me/messages/${msg.id}?format=full`;
        
        const messageResponse = await this.makeAuthenticatedRequest(messageUrl);
        
        if (!messageResponse.ok) {
          await this.handleApiError(messageResponse);
        }

        const message = await messageResponse.json() as MessageDetailResponse;
        const headers = message.payload?.headers || [];
        
        const getHeader = (name: string) => {
          const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
          return header?.value || '';
        };

        return {
          id: message.id!,
          subject: getHeader('Subject') || '(No Subject)',
          sender: this.extractSenderEmail(getHeader('From')),
          date: new Date(getHeader('Date')).toISOString(),
          snippet: this.extractMessageBody(message.payload) || message.snippet || ''
        };
      });

      const messages = await Promise.all(messagePromises);
      
      // Sort by date (newest first)
      return messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
    } catch (error) {
      console.error('Error fetching Gmail messages:', error);
      throw new Error('Failed to fetch Gmail messages');
    }
  }

  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    return fetch(url, {
      ...options,
      headers
    });
  }

  private async handleApiError(response: Response): Promise<never> {
    let errorMessage = `API request failed with status ${response.status}`;
    
    try {
      const errorData = await response.json() as GoogleApiError;
      errorMessage = errorData.error?.message || errorMessage;
    } catch (parseError) {
      // If we can't parse the error response, use the default message
    }

    // Handle specific error cases
    if (response.status === 401) {
      // Token might be expired, could implement refresh logic here
      throw new Error('Authentication failed - token may be expired');
    } else if (response.status === 403) {
      throw new Error('Insufficient permissions or quota exceeded');
    } else if (response.status === 404) {
      throw new Error('Resource not found');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }

    throw new Error(errorMessage);
  }

  private extractSenderEmail(fromHeader: string): string {
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = fromHeader.match(/<([^>]+)>/);
    if (emailMatch) {
      return emailMatch[1];
    }
    
    // If no angle brackets, assume the whole string is the email
    return fromHeader.trim();
  }

  private extractMessageBody(payload: MessagePayload): string {
    if (!payload) {
      return '';
    }

    // If payload has body data directly
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // If payload has parts (multipart message)
    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        // Look for text/plain or text/html parts
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          if (part.body?.data) {
            const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
            
            // If it's HTML, strip basic tags for a cleaner text representation
            if (part.mimeType === 'text/html') {
              return content
                .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
                .replace(/\s+/g, ' ')      // Normalize whitespace
                .trim();
            }
            
            return content;
          }
        }
        
        // Recursively check nested parts
        if (part.parts) {
          const nestedContent = this.extractMessageBody(part);
          if (nestedContent) {
            return nestedContent;
          }
        }
      }
    }

    return '';
  }
}
