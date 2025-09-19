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

      let processedCount = 0;
      let failedCount = 0;
      const enhancedMessages: EnhancedGmailMessage[] = [];

      if (openAiService) {
        console.log(`Processing ${messages.length} messages through AI using batched processing...`);
        
        // Use the batched processing method for efficiency
        const aiResponses = await openAiService.processMessages(messages);
        
        // Combine messages with their AI responses
        messages.forEach((message, index) => {
          const aiResponse = aiResponses[index];
          const enhancedMessage: EnhancedGmailMessage = {
            ...message,
            content: {
              original: message.snippet
            },
            aiProcessing: {
              status: 'pending'
            }
          };

          if (aiResponse && aiResponse.summary !== 'AI processing failed for this message') {
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
          } else {
            enhancedMessage.aiProcessing = {
              status: 'failed',
              error: 'AI processing failed'
            };
            failedCount++;
          }

          enhancedMessages.push(enhancedMessage);
        });
        
        console.log(`Batch processing completed: ${processedCount} successful, ${failedCount} failed`);
      } else {
        // No AI service available - create enhanced messages without AI processing
        messages.forEach(message => {
          enhancedMessages.push({
            ...message,
            content: {
              original: message.snippet
            },
            aiProcessing: {
              status: 'failed',
              error: 'AI service not available'
            }
          });
          failedCount++;
        });
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
