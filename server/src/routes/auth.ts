import { Router, Request, Response } from 'express';
import { GmailServiceRaw } from '../services/gmailServiceRaw';
import { ApiResponse, GoogleAuthConfig } from '../types';

export function createAuthRouter(gmailService: GmailServiceRaw): Router {
  const router = Router();

  // Initiate OAuth flow
  router.get('/auth', (req: Request, res: Response) => {
    try {
      const authUrl = gmailService.getAuthUrl();
      console.log("authUrl",authUrl)
      res.redirect(authUrl);
    } catch (error) {
      console.error('Error initiating auth:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate authentication'
      } as ApiResponse);
    }
  });

  // Handle OAuth callback
  router.get('/auth/callback', async (req: Request, res: Response) => {
    const { code, error } = req.query;

    if (error) {
      return res.status(400).json({
        success: false,
        error: `Authentication failed: ${error}`
      } as ApiResponse);
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code'
      } as ApiResponse);
    }

    try {
      const tokens = await gmailService.exchangeCodeForTokens(code);
      
      // Set credentials for the service
      gmailService.setCredentials(tokens.access_token!, tokens.refresh_token || undefined);
      
      // Get user email
      const email = await gmailService.getUserEmail();
      
      // Store user session
      req.session.user = {
        email,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined
      };

      // Redirect to client with success
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}?auth=success`);
      
    } catch (error) {
      console.error('Error in auth callback:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
      } as ApiResponse);
    }
  });

  // Check authentication status
  router.get('/auth/status', (req: Request, res: Response) => {
    const user = req.session.user;
    
    res.json({
      success: true,
      data: {
        authenticated: !!user,
        email: user?.email || null
      }
    } as ApiResponse);
  });

  // Logout
  router.post('/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Failed to logout'
        } as ApiResponse);
      }
      
      res.json({
        success: true,
        data: { message: 'Logged out successfully' }
      } as ApiResponse);
    });
  });

  return router;
}
