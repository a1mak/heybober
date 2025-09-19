// OAuth2 API Interfaces
export interface GoogleTokenRequest {
  client_id: string;
  client_secret: string;
  code?: string;
  grant_type: 'authorization_code' | 'refresh_token';
  refresh_token?: string;
  redirect_uri?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: 'Bearer';
  scope: string;
}

export interface GoogleApiError {
  error: {
    code: number;
    message: string;
    status: string;
    details?: Array<{
      '@type': string;
      reason: string;
      domain: string;
    }>;
  };
}

// Gmail API Interfaces
export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface MessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export interface MessagePayload {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers: Array<{
    name: string;
    value: string;
  }>;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: MessagePayload[];
}

export interface MessageDetailResponse {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: MessagePayload;
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}
