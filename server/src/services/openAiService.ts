import { GmailMessage, OpenAiAssistantResponse } from '../types';

export class OpenAiService {
  private apiKey: string;
  private assistantId: string;
  private readonly timeout = 30000; // 30 seconds timeout
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey: string, assistantId: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!assistantId) {
      throw new Error('OpenAI Assistant ID is required');
    }

    this.apiKey = apiKey;
    this.assistantId = assistantId;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    };
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(url, {
      headers: this.getHeaders(),
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async processMessages(messages: GmailMessage[]): Promise<OpenAiAssistantResponse[]> {
    try {
      // Create a single thread for all messages
      const thread = await this.makeRequest(`${this.baseUrl}/threads`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      // Concatenate all message content with ----- separator, using actual message IDs
      const concatenatedContent = messages.map((message) => {
        return `MessageID: ${message.id}
Subject: ${message.subject}
From: ${message.sender}
Content: ${message.snippet}`;
      }).join('\n-----\n');

      // Add the concatenated message content to the thread
      await this.makeRequest(`${this.baseUrl}/threads/${thread.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: concatenatedContent
        })
      });

      // Run the assistant
      const run = await this.makeRequest(`${this.baseUrl}/threads/${thread.id}/runs`, {
        method: 'POST',
        body: JSON.stringify({
          assistant_id: this.assistantId
        })
      });

      // Wait for completion with timeout
      const result = await this.waitForCompletion(thread.id, run.id);
      
      if (!result) {
        throw new Error('AI processing timed out');
      }

      // Get the assistant's response
      const threadMessages = await this.makeRequest(`${this.baseUrl}/threads/${thread.id}/messages`);
      const assistantMessage = threadMessages.data.find((msg: any) => msg.role === 'assistant');

      if (!assistantMessage || !assistantMessage.content[0] || assistantMessage.content[0].type !== 'text') {
        throw new Error('No valid response from AI assistant');
      }

      const responseText = assistantMessage.content[0].text.value;
      
      // Try to parse JSON response as array of individual message responses
      try {
        const parsedResponse = JSON.parse(responseText);
        
        // If it's an array, map each response to corresponding message by ID
        if (Array.isArray(parsedResponse)) {
          return messages.map((message) => {
            // Find the AI response that matches this message's ID
            const messageResponse = parsedResponse.find((response: any) => 
              response.messageId === message.id
            );
            
            if (messageResponse && messageResponse.summary) {
              return {
                summary: messageResponse.summary,
                translatedContent: messageResponse.translatedContent,
                detectedLanguage: messageResponse.detectedLanguage,
                confidence: messageResponse.confidence || 0.8
              };
            } else {
              return {
                summary: 'No AI response available for this message',
                confidence: 0.5
              };
            }
          });
        } else {
          // If it's a single object, return the same response for all messages
          const singleResponse: OpenAiAssistantResponse = {
            summary: parsedResponse.summary || responseText,
            translatedContent: parsedResponse.translatedContent,
            detectedLanguage: parsedResponse.detectedLanguage,
            confidence: parsedResponse.confidence || 0.8
          };
          return messages.map(() => singleResponse);
        }
      } catch (parseError) {
        // If not JSON, treat the whole response as a summary for all messages
        const fallbackResponse: OpenAiAssistantResponse = {
          summary: responseText,
          confidence: 0.7
        };
        return messages.map(() => fallbackResponse);
      }

    } catch (error) {
      console.error('OpenAI processing error:', error);
      // Return error response for each message
      const errorResponse: OpenAiAssistantResponse = {
        summary: `AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0
      };
      return messages.map(() => errorResponse);
    }
  }

  private async waitForCompletion(threadId: string, runId: string): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.timeout) {
      try {
        const run = await this.makeRequest(`${this.baseUrl}/threads/${threadId}/runs/${runId}`);
        
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
