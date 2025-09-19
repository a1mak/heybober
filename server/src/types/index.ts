export interface GmailMessage {
  id: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
}

export interface AuthenticatedUser {
  email: string;
  accessToken: string;
  refreshToken?: string;
}

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: AuthenticatedUser;
    oauthState?: string;
  }
}
