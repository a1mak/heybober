import OpenAI from 'openai';
import { GmailMessage, OpenAiAssistantResponse } from '../types';

export class OpenAiService {
  private openai: OpenAI;
  private assistantId: string;
  private readonly timeout = 30000; // 30 seconds timeout

  constructor(apiKey: string, assistantId: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!assistantId) {
      throw new Error('OpenAI Assistant ID is required');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
    this.assistantId = assistantId;
  }

  async processMessage(message: GmailMessage): Promise<OpenAiAssistantResponse> {
    try {
      // Create a thread for this conversation
      const thread = await this.openai.beta.threads.create();

      // Add the message content to the thread
      const messageContent = `Please process this email message and provide:
1. A summary of the content
2. If the content appears to be in a language other than English, provide a translation
3. Detect the language if it's not English

Email details:
Subject: ${message.subject}
From: ${message.sender}
Content: ${message.snippet}

Please respond with a JSON object containing:
- summary: A brief summary of the email
- translatedContent: Translation if needed (optional)
- detectedLanguage: The detected language code (optional)
- confidence: Your confidence level (0-1) in the processing (optional)`;

      await this.openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: messageContent,
      });

      // Run the assistant
      const run = await this.openai.beta.threads.runs.create(thread.id, {
        assistant_id: this.assistantId,
      });

      // Wait for completion with timeout
      const result = await this.waitForCompletion(thread.id, run.id);
      
      if (!result) {
        throw new Error('AI processing timed out');
      }

      // Get the assistant's response
      const messages = await this.openai.beta.threads.messages.list(thread.id);
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant');

      if (!assistantMessage || !assistantMessage.content[0] || assistantMessage.content[0].type !== 'text') {
        throw new Error('No valid response from AI assistant');
      }

      const responseText = assistantMessage.content[0].text.value;
      
      // Try to parse JSON response, fallback to plain text summary
      try {
        const parsedResponse = JSON.parse(responseText);
        return {
          summary: parsedResponse.summary || responseText,
          translatedContent: parsedResponse.translatedContent,
          detectedLanguage: parsedResponse.detectedLanguage,
          confidence: parsedResponse.confidence || 0.8
        };
      } catch (parseError) {
        // If not JSON, treat the whole response as a summary
        return {
          summary: responseText,
          confidence: 0.7
        };
      }

    } catch (error) {
      console.error('OpenAI processing error:', error);
      throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processMessages(messages: GmailMessage[]): Promise<OpenAiAssistantResponse[]> {
    const results: OpenAiAssistantResponse[] = [];
    
    // Process messages in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (message) => {
        try {
          return await this.processMessage(message);
        } catch (error) {
          console.error(`Failed to process message ${message.id}:`, error);
          return {
            summary: 'AI processing failed for this message',
            confidence: 0
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  private async waitForCompletion(threadId: string, runId: string): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.timeout) {
      try {
        const run = await this.openai.beta.threads.runs.retrieve(runId, {
          thread_id: threadId
        });
        
        if (run.status === 'completed') {
          return true;
        } else if (run.status === 'failed' || run.status === 'cancelled') {
          throw new Error(`AI run ${run.status}: ${run.last_error?.message || 'Unknown error'}`);
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error waiting for AI completion:', error);
        throw error;
      }
    }
    
    return false; // Timeout
  }
}
