import { Router, Request, Response } from 'express';
import { GmailService } from '../services/gmailService';
import { ApiResponse } from '../types';

export function createMessagesRouter(gmailService: GmailService): Router {
  const router = Router();

  // Middleware to check authentication
  const requireAuth = (req: Request, res: Response, next: Function) => {
    const user = req.session.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
    }
    
    // Set credentials for this request
    gmailService.setCredentials(user.accessToken, user.refreshToken);
    next();
  };

  // Get unread messages
  router.get('/messages', requireAuth, async (req: Request, res: Response) => {
    try {
      const messages = await gmailService.getUnreadMessages(10);
      
      res.json({
        success: true,
        data: {
          messages,
          count: messages.length
        }
      } as ApiResponse);
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch messages'
      } as ApiResponse);
    }
  });

  return router;
}
