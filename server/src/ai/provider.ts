import { z } from 'zod';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameterProperty;
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
}

export interface ToolCall {
  id?: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  callId?: string;
  name: string;
  result: any;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface GenerateTextOptions {
  model?: string;
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface GenerateTextResult {
  text: string;
  usage: TokenUsage;
  finishReason?: string;
}

export interface StreamTextOptions {
  model?: string;
  systemPrompt?: string;
  prompt: string;
  history?: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  onChunk: (chunk: string) => void | Promise<void>;
}

export interface StreamTextResult {
  fullText: string;
  usage: TokenUsage;
}

export interface ToolLoopOptions {
  model?: string;
  systemPrompt?: string;
  prompt: string;
  history?: ChatMessage[];
  tools: ToolDefinition[];
  executeTool: (name: string, args: Record<string, any>) => Promise<any>;
  maxRounds?: number;
  timeoutMs?: number;
  onChunk?: (chunk: string) => void | Promise<void>;
  onToolCall?: (toolCall: ToolCall) => void | Promise<void>;
  onToolResult?: (toolResult: ToolResult) => void | Promise<void>;
}

export interface ToolLoopResult {
  text: string;
  toolCallsExecuted: Array<{ call: ToolCall; result: any }>;
  rounds: number;
  usage: TokenUsage;
}

export interface StructuredJsonOptions<T> {
  model?: string;
  systemPrompt?: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  schemaName?: string;
  schemaDescription?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface StructuredJsonResult<T> {
  data: T;
  rawText: string;
  usage: TokenUsage;
}

export class AiProviderError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export class AiRateLimitError extends AiProviderError {
  constructor(message: string = 'AI is busy, try again') {
    super(message);
    this.name = 'AiRateLimitError';
  }
}

export class AiBlockedContentError extends AiProviderError {
  constructor(message: string = "The AI couldn't answer this one") {
    super(message);
    this.name = 'AiBlockedContentError';
  }
}

export class AiTimeoutError extends AiProviderError {
  constructor(message: string = 'AI request timed out, please try again') {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

export class AiConfigurationError extends AiProviderError {
  constructor(message: string = 'AI service is not configured') {
    super(message);
    this.name = 'AiConfigurationError';
  }
}

export interface IAiProvider {
  isConfigured(): boolean;
  getModelName(tier?: 'strong' | 'fast'): string;
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  streamText(options: StreamTextOptions): Promise<StreamTextResult>;
  runToolCallingLoop(options: ToolLoopOptions): Promise<ToolLoopResult>;
  generateStructuredJson<T>(options: StructuredJsonOptions<T>): Promise<StructuredJsonResult<T>>;
}
