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
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
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
          snippet: message.snippet || ''
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
}
