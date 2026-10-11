import { api } from './client.js';

export interface AiStatusResponse {
  isConfigured: boolean;
  aiEnabled: boolean;
  aiConsentConfirmedBy?: string;
  aiConsentConfirmedAt?: string;
  models: {
    strong: string;
    fast: string;
  };
  limits: {
    monthlyUsed: number;
    monthlyMax: number;
    plan: string;
  };
}

export interface ProposedAction {
  id: string;
  type: 'create_task' | 'change_deal_stage' | 'draft_email' | 'create_ticket';
  title: string;
  description: string;
  params: Record<string, any>;
  status: 'pending' | 'confirmed' | 'dismissed';
  executedResult?: any;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  proposedAction?: ProposedAction;
  toolCalls?: Array<{ name: string; args: Record<string, any> }>;
  toolResults?: Array<{ name: string; result: any }>;
  createdAt?: string;
}

export interface CopilotConversationSummary {
  _id: string;
  title: string;
  entityType?: string;
  entityId?: string;
  updatedAt: string;
  createdAt: string;
}

export interface DraftEmailParams {
  goal: string;
  tone: 'friendly' | 'formal' | 'short';
  entityType?: 'lead' | 'contact' | 'deal' | 'account' | 'ticket';
  entityId?: string;
  templateId?: string;
  recipientEmail?: string;
}

export interface RecordSummaryData {
  summary: string;
  keyFacts: string[];
  openIssues: string[];
  nextStep: string;
  fromCache: boolean;
  cachedAt?: string;
}

export interface NlFilterChip {
  field: string;
  operator: string;
  value: any;
  label: string;
}

export interface NlSearchData {
  entity: 'leads' | 'deals' | 'contacts' | 'tickets';
  explanation: string;
  chips: NlFilterChip[];
  results: any[];
  total: number;
}

export async function getAiStatus(): Promise<AiStatusResponse> {
  const res = await api.get('/ai/status');
  return res.data;
}

export async function updateAiConsent(enabled: boolean, acceptedNotice: boolean): Promise<any> {
  const res = await api.post('/ai/consent', { enabled, acceptedNotice });
  return res.data;
}

export async function getAiConversations(): Promise<CopilotConversationSummary[]> {
  const res = await api.get('/ai/copilot/conversations');
  return res.data.data;
}

export async function getAiConversation(id: string): Promise<any> {
  const res = await api.get(`/ai/copilot/conversations/${id}`);
  return res.data;
}

export async function deleteAiConversation(id: string): Promise<void> {
  await api.delete(`/ai/copilot/conversations/${id}`);
}

export async function clearAiConversations(): Promise<void> {
  await api.delete('/ai/copilot/conversations');
}

export async function confirmAiAction(conversationId: string, actionId: string): Promise<any> {
  const res = await api.post(`/ai/copilot/actions/${actionId}/confirm`, { conversationId });
  return res.data;
}

export async function dismissAiAction(conversationId: string, actionId: string): Promise<void> {
  await api.post(`/ai/copilot/actions/${actionId}/dismiss`, { conversationId });
}

export async function draftEmailWithAi(params: DraftEmailParams): Promise<{ subject: string; body: string }> {
  const res = await api.post('/ai/draft-email', params);
  return res.data;
}

export async function summarizeRecordWithAi(
  entityType: 'lead' | 'contact' | 'account' | 'deal' | 'ticket',
  id: string
): Promise<RecordSummaryData> {
  const res = await api.get(`/ai/summarize/${entityType}/${id}`);
  return res.data;
}

export async function searchWithNaturalLanguage(query: string): Promise<NlSearchData> {
  const res = await api.post('/ai/nl-search', { query });
  return res.data;
}

export async function explainScoreWithAi(
  entityType: 'lead' | 'deal',
  id: string
): Promise<{ explanation: string }> {
  const res = await api.post(`/ai/explain-score/${entityType}/${id}`);
  return res.data;
}

export async function submitAiFeedback(params: {
  feature: string;
  rating: 'up' | 'down';
  notes?: string;
  promptPreview?: string;
  responsePreview?: string;
}): Promise<void> {
  await api.post('/ai/feedback', params);
}

export interface AiUsageLogItem {
  _id: string;
  userId?: { _id: string; name: string; email: string };
  feature: string;
  modelName: string;
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostPaise?: number;
  createdAt: string;
}

export interface AiFeatureTotal {
  _id: string;
  count: number;
  totalTokens: number;
  totalCostPaise: number;
  avgLatencyMs: number;
}

export interface AiUsageAnalyticsResponse {
  recentLogs: AiUsageLogItem[];
  featureTotals: AiFeatureTotal[];
}

export async function getAiUsageAnalytics(): Promise<AiUsageAnalyticsResponse> {
  const res = await api.get('/ai/usage');
  return res.data;
}

/**
 * Streams Copilot chat responses via Server-Sent Events (SSE)
 */
export async function streamCopilotChat(options: {
  message: string;
  conversationId?: string;
  entityType?: 'lead' | 'contact' | 'account' | 'deal' | 'ticket';
  entityId?: string;
  contextRecord?: any;
  onChunk: (chunk: string) => void;
  onToolCall?: (call: any) => void;
  onToolResult?: (result: any) => void;
  onProposedAction?: (action: ProposedAction) => void;
  onDone: (data: { conversationId: string; response: string; proposedAction?: ProposedAction }) => void;
  onError: (error: Error) => void;
}): Promise<void> {
  const token = localStorage.getItem('flowdesk_token');

  try {
    const response = await fetch('/api/ai/copilot/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: options.message,
        conversationId: options.conversationId,
        entityType: options.entityType,
        entityId: options.entityId,
        contextRecord: options.contextRecord,
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.message || `Request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Readable stream not supported');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/event: (.*)/);
        const dataMatch = block.match(/data: (.*)/);

        const event = eventMatch ? eventMatch[1].trim() : 'message';
        const dataStr = dataMatch ? dataMatch[1].trim() : '{}';

        try {
          const parsed = JSON.parse(dataStr);
          if (event === 'chunk') {
            options.onChunk(parsed.chunk);
          } else if (event === 'tool_call') {
            options.onToolCall?.(parsed.call);
          } else if (event === 'tool_result') {
            options.onToolResult?.(parsed.result);
          } else if (event === 'proposed_action') {
            options.onProposedAction?.(parsed.action);
          } else if (event === 'done') {
            options.onDone(parsed);
          } else if (event === 'error') {
            options.onError(new Error(parsed.message || 'Error occurred'));
          }
        } catch {
          // ignore chunk parse errors
        }
      }
    }
  } catch (err: any) {
    options.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
