import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GmailMessage, GoogleAuthConfig } from '../types';

export class GmailService {
  private oauth2Client: OAuth2Client;
  private gmail: gmail_v1.Gmail;

  constructor(config: GoogleAuthConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async exchangeCodeForTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  setCredentials(accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }

  async getUserEmail(): Promise<string> {
    const response = await this.gmail.users.getProfile({ userId: 'me' });
    return response.data.emailAddress || '';
  }

  async getUnreadMessages(maxResults: number = 10): Promise<GmailMessage[]> {
    try {
      // Get list of unread message IDs
      const messagesResponse = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults
      });

      const messageIds = messagesResponse.data.messages || [];
      
      if (messageIds.length === 0) {
        return [];
      }

      // Get detailed information for each message
      const messagePromises = messageIds.map(async (msg) => {
        const messageResponse = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full'
        });

        const message = messageResponse.data;
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

  private extractSenderEmail(fromHeader: string): string {
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = fromHeader.match(/<([^>]+)>/);
    if (emailMatch) {
      return emailMatch[1];
    }
    
    // If no angle brackets, assume the whole string is the email
    return fromHeader.trim();
  }

  private extractMessageBody(payload: any): string {
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
