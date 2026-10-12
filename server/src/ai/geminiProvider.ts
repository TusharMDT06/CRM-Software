import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import {
  IAiProvider,
  GenerateTextOptions,
  GenerateTextResult,
  StreamTextOptions,
  StreamTextResult,
  ToolLoopOptions,
  ToolLoopResult,
  StructuredJsonOptions,
  StructuredJsonResult,
  TokenUsage,
  ToolCall,
  AiProviderError,
  AiRateLimitError,
  AiBlockedContentError,
  AiTimeoutError,
  AiConfigurationError,
} from './provider.js';

export class GeminiProvider implements IAiProvider {
  private client: GoogleGenAI | null = null;

  constructor(clientOverride?: GoogleGenAI) {
    if (clientOverride) {
      this.client = clientOverride;
    } else if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0) {
      this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.client || (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0));
  }

  public getModelName(tier: 'strong' | 'fast' = 'strong'): string {
    if (tier === 'fast') {
      return env.AI_MODEL_FAST || 'gemini-2.0-flash-lite';
    }
    return env.AI_MODEL || 'gemini-2.0-flash';
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0) {
        this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      } else {
        throw new AiConfigurationError('GEMINI_API_KEY is not configured');
      }
    }
    return this.client;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 30000,
    maxRetries: number = 2
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      let timeoutHandle: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new AiTimeoutError());
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([operation(), timeoutPromise]);
        if (timeoutHandle) clearTimeout(timeoutHandle);
        return result;
      } catch (err: any) {
        if (timeoutHandle) clearTimeout(timeoutHandle);

        if (err instanceof AiTimeoutError) {
          throw err;
        }

        const errMessage = String(err?.message || '').toLowerCase();
        const status = err?.status || err?.statusCode || err?.code;
        const isTransientError =
          status === 429 ||
          status === 503 ||
          errMessage.includes('429') ||
          errMessage.includes('503') ||
          errMessage.includes('unavailable') ||
          errMessage.includes('high demand') ||
          errMessage.includes('resource_exhausted') ||
          errMessage.includes('quota') ||
          errMessage.includes('too many requests') ||
          errMessage.includes('rate limit');

        if (isTransientError) {
          attempt++;
          if (attempt <= maxRetries) {
            const backoffDelay = Math.pow(2, attempt) * 1500;
            await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            continue;
          }
          throw new AiRateLimitError('AI is busy, try again');
        }

        // Safety filter or blocked response checks
        if (
          errMessage.includes('safety') ||
          errMessage.includes('blocked') ||
          errMessage.includes('harm') ||
          errMessage.includes('recitation')
        ) {
          throw new AiBlockedContentError("The AI couldn't answer this one");
        }

        // Re-throw if already an AiProviderError subclass
        if (err instanceof AiProviderError) {
          throw err;
        }

        // Sanitize unknown errors to prevent API key or internal leakage
        console.error('[GeminiProvider Internal Error]:', err?.message || err);
        throw new AiProviderError('An unexpected AI processing error occurred');
      }
    }
  }

  private extractUsage(usageMetadata?: any): TokenUsage {
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = usageMetadata?.totalTokenCount || inputTokens + outputTokens;
    return { inputTokens, outputTokens, totalTokens };
  }

  public async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const client = this.getClient();
    const model = options.model || this.getModelName('strong');

    return this.executeWithRetry(async () => {
      const response = await client.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemPrompt,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
        },
      });

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
        if (['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(finishReason)) {
          throw new AiBlockedContentError("The AI couldn't answer this one");
        }
      }

      const text = response.text || '';
      if (!text && finishReason !== 'STOP') {
        throw new AiBlockedContentError("The AI couldn't answer this one");
      }

      return {
        text,
        usage: this.extractUsage(response.usageMetadata),
        finishReason,
      };
    }, options.timeoutMs);
  }

  public async streamText(options: StreamTextOptions): Promise<StreamTextResult> {
    const client = this.getClient();
    const model = options.model || this.getModelName('strong');

    return this.executeWithRetry(async () => {
      // Build contents with optional chat history
      const contents: any[] = [];
      if (options.history && options.history.length > 0) {
        for (const msg of options.history) {
          contents.push({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: options.prompt }],
      });

      const responseStream = await client.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: options.systemPrompt,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
        },
      });

      let fullText = '';
      let lastUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

      for await (const chunk of responseStream) {
        const chunkText = chunk.text || '';
        if (chunkText) {
          fullText += chunkText;
          await options.onChunk(chunkText);
        }
        if (chunk.usageMetadata) {
          lastUsage = this.extractUsage(chunk.usageMetadata);
        }
      }

      if (!fullText) {
        throw new AiBlockedContentError("The AI couldn't answer this one");
      }

      return {
        fullText,
        usage: lastUsage,
      };
    }, options.timeoutMs);
  }

  public async runToolCallingLoop(options: ToolLoopOptions): Promise<ToolLoopResult> {
    const client = this.getClient();
    const model = options.model || this.getModelName('strong');
    const maxRounds = options.maxRounds || 6;

    // Convert tool declarations
    const tools = [
      {
        functionDeclarations: options.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters as any,
        })),
      },
    ];

    return this.executeWithRetry(async () => {
      const contents: any[] = [];

      if (options.history && options.history.length > 0) {
        for (const msg of options.history) {
          contents.push({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: options.prompt }],
      });

      let rounds = 0;
      let finalResponseText = '';
      const toolCallsExecuted: Array<{ call: ToolCall; result: any }> = [];
      let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

      while (rounds < maxRounds) {
        rounds++;

        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: options.systemPrompt,
            tools,
            temperature: 0.2,
          },
        });

        if (response.usageMetadata) {
          const roundUsage = this.extractUsage(response.usageMetadata);
          totalUsage.inputTokens += roundUsage.inputTokens;
          totalUsage.outputTokens += roundUsage.outputTokens;
          totalUsage.totalTokens += roundUsage.totalTokens;
        }

        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (finishReason && ['SAFETY', 'RECITATION', 'BLOCKLIST'].includes(finishReason)) {
          throw new AiBlockedContentError("The AI couldn't answer this one");
        }

        const functionCalls = response.functionCalls;

        // If model has tool calls
        if (functionCalls && functionCalls.length > 0) {
          // Add model turn with functionCalls to conversation history
          contents.push({
            role: 'model',
            parts: functionCalls.map((fc) => ({
              functionCall: {
                name: fc.name,
                args: fc.args,
              },
            })),
          });

          // Execute each function call and accumulate responses
          const responseParts: any[] = [];
          for (const fc of functionCalls) {
            const toolCall: ToolCall = {
              id: fc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: fc.name || '',
              args: (fc.args as Record<string, any>) || {},
            };

            await options.onToolCall?.(toolCall);

            let toolResult: any;
            try {
              toolResult = await options.executeTool(toolCall.name, toolCall.args);
            } catch (err: any) {
              toolResult = { error: err?.message || 'Tool execution failed' };
            }

            toolCallsExecuted.push({ call: toolCall, result: toolResult });
            await options.onToolResult?.({ callId: toolCall.id, name: toolCall.name, result: toolResult });

            responseParts.push({
              functionResponse: {
                name: fc.name,
                response: { output: toolResult },
              },
            });
          }

          // Append function responses to contents
          contents.push({
            role: 'user',
            parts: responseParts,
          });

          // Continue next round
          continue;
        }

        // No function calls: model has provided its final response text
        finalResponseText = response.text || '';
        if (options.onChunk && finalResponseText) {
          await options.onChunk(finalResponseText);
        }
        break;
      }

      if (!finalResponseText && toolCallsExecuted.length === 0) {
        throw new AiBlockedContentError("The AI couldn't answer this one");
      }

      return {
        text: finalResponseText,
        toolCallsExecuted,
        rounds,
        usage: totalUsage,
      };
    }, options.timeoutMs);
  }

  public async generateStructuredJson<T>(
    options: StructuredJsonOptions<T>
  ): Promise<StructuredJsonResult<T>> {
    const client = this.getClient();
    const model = options.model || this.getModelName('fast');

    return this.executeWithRetry(async () => {
      const response = await client.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction:
            (options.systemPrompt ? options.systemPrompt + '\n' : '') +
            'Return ONLY valid raw JSON adhering to the required structure. No explanations, no markdown code fence.',
          responseMimeType: 'application/json',
          temperature: options.temperature ?? 0.1,
          maxOutputTokens: options.maxOutputTokens,
        },
      });

      const candidate = response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason && ['SAFETY', 'RECITATION', 'BLOCKLIST'].includes(finishReason)) {
        throw new AiBlockedContentError("The AI couldn't answer this one");
      }

      let rawText = response.text?.trim() || '';
      if (!rawText) {
        throw new AiBlockedContentError("The AI couldn't answer this one");
      }

      // Clean any accidental markdown code blocks
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch (err: any) {
        throw new AiProviderError('Malformed JSON returned by model', err);
      }

      const validated = options.schema.parse(parsed);

      return {
        data: validated,
        rawText,
        usage: this.extractUsage(response.usageMetadata),
      };
    }, options.timeoutMs);
  }
}

// Singleton default provider instance
export const geminiProvider = new GeminiProvider();
