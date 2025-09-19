import { Router, Request, Response } from 'express';
import { GmailService } from '../services/gmailService';
import { OpenAiService } from '../services/openAiService';
import { ApiResponse, EnhancedGmailMessage } from '../types';

export function createMessagesRouter(gmailService: GmailService, openAiService?: OpenAiService): Router {
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

  // Get enhanced messages with AI processing
  router.get('/messages/enhanced', requireAuth, async (req: Request, res: Response) => {
    try {
      const messages = await gmailService.getUnreadMessages(10);
      
      if (!messages.length) {
        return res.json({
          success: true,
          data: {
            messages: [],
            count: 0,
            aiProcessingStatus: {
              processed: 0,
              failed: 0,
              pending: 0
            }
          }
        } as ApiResponse);
      }

      const enhancedMessages: EnhancedGmailMessage[] = [];
      let processedCount = 0;
      let failedCount = 0;

      // Process each message through AI if service is available
      for (const message of messages) {
        const enhancedMessage: EnhancedGmailMessage = {
          ...message,
          content: {
            original: message.snippet
          },
          aiProcessing: {
            status: 'pending'
          }
        };

        if (openAiService) {
          try {
            console.log(`Processing message ${message.id} through AI...`);
            const aiResponse = await openAiService.processMessage(message);
            
            enhancedMessage.content.processed = {
              summary: aiResponse.summary,
              translatedText: aiResponse.translatedContent,
              language: aiResponse.detectedLanguage,
              confidence: aiResponse.confidence
            };
            
            enhancedMessage.aiProcessing = {
              status: 'completed',
              processedAt: new Date().toISOString()
            };
            
            processedCount++;
            console.log(`Successfully processed message ${message.id}`);
            
          } catch (error) {
            console.error(`Failed to process message ${message.id}:`, error);
            
            enhancedMessage.aiProcessing = {
              status: 'failed',
              error: error instanceof Error ? error.message : 'AI processing failed'
            };
            
            failedCount++;
          }
        } else {
          // No AI service available
          enhancedMessage.aiProcessing = {
            status: 'failed',
            error: 'AI service not available'
          };
          failedCount++;
        }

        enhancedMessages.push(enhancedMessage);
      }

      res.json({
        success: true,
        data: {
          messages: enhancedMessages,
          count: enhancedMessages.length,
          aiProcessingStatus: {
            processed: processedCount,
            failed: failedCount,
            pending: 0
          }
        }
      } as ApiResponse);
      
    } catch (error) {
      console.error('Error fetching enhanced messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch enhanced messages'
      } as ApiResponse);
    }
  });

  return router;
}
