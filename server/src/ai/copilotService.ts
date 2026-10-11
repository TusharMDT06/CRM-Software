import { Types } from 'mongoose';
import {
  CopilotConversation,
  ICopilotConversation,
  ICopilotMessage,
  IProposedAction,
} from '../models/CopilotConversation.js';
import { IUser } from '../models/User.js';
import { ITenant } from '../models/Tenant.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { AiUsageLog } from '../models/AiUsageLog.js';
import { geminiProvider } from './geminiProvider.js';
import { COPILOT_TOOLS, executeAiTool } from './tools.js';
import { COPILOT_SYSTEM_PROMPT, wrapUntrustedData, sanitizeRecordForAi } from './promptSanitizer.js';
import { Task } from '../models/Task.js';
import { Deal } from '../models/Deal.js';
import { Ticket } from '../models/Ticket.js';
import { AuditLog } from '../models/AuditLog.js';
import { logActivity } from '../utils/activityHelper.js';
import { emitWorkflowEvent } from '../utils/eventBus.js';

export interface CopilotChatOptions {
  user: IUser;
  tenant: ITenant;
  conversationId?: string;
  message: string;
  entityType?: 'lead' | 'contact' | 'account' | 'deal' | 'ticket';
  entityId?: string;
  contextRecord?: any;
  onChunk?: (chunk: string) => void | Promise<void>;
  onToolCall?: (toolCall: any) => void | Promise<void>;
  onToolResult?: (toolResult: any) => void | Promise<void>;
  onProposedAction?: (action: IProposedAction) => void | Promise<void>;
}

export interface CopilotChatResult {
  conversationId: string;
  response: string;
  proposedAction?: IProposedAction;
  toolCallsExecuted: any[];
}

/**
 * Checks AI gate and plan rate limits
 */
export async function checkAiGateAndLimits(user: IUser, tenant: ITenant): Promise<void> {
  // 1. Check Gemini API key configuration
  if (!geminiProvider.isConfigured()) {
    throw new Error('AI service is not configured on this server');
  }

  // 2. Data Privacy Gate: Check if tenant has enabled AI
  const settings = await CompanySettings.findOne();
  const isEnabled = settings?.aiEnabled === true || tenant.limits.aiEnabled === true;
  if (!isEnabled) {
    throw new Error(
      'AI features are disabled for this organization. A tenant admin must enable AI under Settings > AI after reviewing data privacy disclosures.'
    );
  }

  // 3. Monthly tenant request limit check
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyRequests = await AiUsageLog.countDocuments({
    tenantId: tenant._id,
    createdAt: { $gte: startOfMonth },
  });

  const maxMonthly = tenant.limits.aiMonthlyRequests || 50;
  if (monthlyRequests >= maxMonthly) {
    throw new Error(
      `Monthly AI request cap (${maxMonthly}) reached for your organization plan. Upgrade to Pro for increased capacity.`
    );
  }

  // 4. Per-user daily request cap (150 requests/day)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const userDailyRequests = await AiUsageLog.countDocuments({
    userId: user._id,
    createdAt: { $gte: startOfDay },
  });

  if (userDailyRequests >= 150) {
    throw new Error('Daily AI request limit reached for your account. Please try again tomorrow.');
  }
}

/**
 * Executes a Copilot chat interaction with streaming, tool loop, and memory
 */
export async function runCopilotChat(options: CopilotChatOptions): Promise<CopilotChatResult> {
  const { user, tenant, message, entityType, entityId, contextRecord } = options;

  await checkAiGateAndLimits(user, tenant);

  // 1. Load or initialize conversation (Scoped to tenant & user)
  let conversation: ICopilotConversation | null = null;
  if (options.conversationId && Types.ObjectId.isValid(options.conversationId)) {
    conversation = await CopilotConversation.findOne({
      _id: options.conversationId,
      userId: user._id,
    });
  }

  if (!conversation) {
    // Maintain maximum of 20 conversations per user
    const userConvs = await CopilotConversation.find({ userId: user._id })
      .sort({ updatedAt: -1 })
      .select('_id');

    if (userConvs.length >= 20) {
      const convsToDelete = userConvs.slice(19).map((c) => c._id);
      await CopilotConversation.deleteMany({ _id: { $in: convsToDelete } });
    }

    const title = message.length > 30 ? message.substring(0, 27) + '...' : message;
    conversation = await CopilotConversation.create({
      tenantId: user.tenantId,
      userId: user._id,
      title,
      entityType,
      entityId: entityId && Types.ObjectId.isValid(entityId) ? new Types.ObjectId(entityId) : undefined,
      messages: [],
    });
  }

  // 2. Build system instructions with context
  let enrichedSystemPrompt = COPILOT_SYSTEM_PROMPT;
  if (entityType && contextRecord) {
    const sanitizedContext = sanitizeRecordForAi(contextRecord);
    enrichedSystemPrompt += `\n\nCURRENT OPEN RECORD CONTEXT:
The user is currently viewing a ${entityType.toUpperCase()} record.
Details:
${wrapUntrustedData(JSON.stringify(sanitizedContext, null, 2), `current_${entityType}`)}
You can answer questions directly regarding this open record without extra searching unless needed.`;
  }

  // 3. Build chat history from past conversation messages (up to last 10 turns)
  const history = conversation.messages.slice(-10).map((m) => ({
    role: m.role as 'user' | 'model',
    content: m.content,
  }));

  // 4. Append user message to conversation
  const userMessageId = `msg_${Date.now()}_u`;
  conversation.messages.push({
    id: userMessageId,
    role: 'user',
    content: message,
    createdAt: new Date(),
  });

  const startTime = Date.now();
  let latestProposedAction: IProposedAction | undefined;

  // 5. Execute tool calling loop
  const toolLoopResult = await geminiProvider.runToolCallingLoop({
    model: geminiProvider.getModelName('strong'),
    systemPrompt: enrichedSystemPrompt,
    prompt: message,
    history,
    tools: COPILOT_TOOLS,
    executeTool: async (name, args) => {
      const res = await executeAiTool(name, args, { user, tenantId: tenant._id.toString() });
      if (res && res.proposedAction) {
        latestProposedAction = res.proposedAction;
        if (options.onProposedAction) {
          await options.onProposedAction(res.proposedAction);
        }
      }
      return res;
    },
    maxRounds: 6,
    onChunk: options.onChunk,
    onToolCall: options.onToolCall,
    onToolResult: options.onToolResult,
  });

  const latencyMs = Date.now() - startTime;

  // 6. Log AI usage
  await AiUsageLog.create({
    tenantId: tenant._id,
    userId: user._id,
    feature: 'copilot',
    modelName: geminiProvider.getModelName('strong'),
    tokensIn: toolLoopResult.usage.inputTokens,
    tokensOut: toolLoopResult.usage.outputTokens,
    totalTokens: toolLoopResult.usage.totalTokens,
    latencyMs,
    estimatedCostPaise: Math.ceil((toolLoopResult.usage.totalTokens / 1000) * 3),
  });

  // 7. Append assistant response to conversation
  const modelMessageId = `msg_${Date.now()}_m`;
  conversation.messages.push({
    id: modelMessageId,
    role: 'model',
    content: toolLoopResult.text,
    proposedAction: latestProposedAction,
    toolCalls: toolLoopResult.toolCallsExecuted.map((e) => e.call),
    toolResults: toolLoopResult.toolCallsExecuted.map((e) => ({
      name: e.call.name,
      result: e.result,
    })),
    createdAt: new Date(),
  });

  await conversation.save();

  return {
    conversationId: conversation._id.toString(),
    response: toolLoopResult.text,
    proposedAction: latestProposedAction,
    toolCallsExecuted: toolLoopResult.toolCallsExecuted,
  };
}

/**
 * Confirm and execute a proposed action with audit log source "ai_assisted"
 */
export async function confirmProposedAction(
  conversationId: string,
  actionId: string,
  user: IUser,
  tenant: ITenant
): Promise<{ success: boolean; result: any }> {
  const conversation = await CopilotConversation.findOne({
    _id: conversationId,
    userId: user._id,
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Find message with this proposed action
  const msg = conversation.messages.find((m) => m.proposedAction?.id === actionId);
  if (!msg || !msg.proposedAction) {
    throw new Error('Proposed action not found');
  }

  if (msg.proposedAction.status !== 'pending') {
    throw new Error(`Action is already ${msg.proposedAction.status}`);
  }

  const { type, params } = msg.proposedAction;
  let executionResult: any = null;

  switch (type) {
    case 'create_task': {
      const task = await Task.create({
        tenantId: user.tenantId,
        title: params.title,
        dueDate: new Date(params.dueDate),
        priority: params.priority || 'medium',
        status: 'pending',
        assignedTo: user._id,
        entityType: params.entityType,
        entityId: params.entityId,
        notes: params.notes,
      });

      await logActivity({
        type: 'task',
        subject: `AI-Assisted Task: ${task.title}`,
        body: `Created via Copilot confirmation`,
        entityType: (params.entityType as any) || 'deal',
        entityId: params.entityId || task._id,
        createdBy: user._id,
      });

      executionResult = { taskId: task._id, title: task.title };
      break;
    }

    case 'change_deal_stage': {
      const deal = await Deal.findById(params.dealId);
      if (!deal) throw new Error('Deal not found');

      const oldStage = deal.stage;
      deal.stage = params.stage;
      await deal.save();

      emitWorkflowEvent('deal_stage_changed', {
        tenantId: user.tenantId ? user.tenantId.toString() : tenant._id.toString(),
        entityType: 'deal',
        entityId: deal._id.toString(),
        dealId: deal._id.toString(),
        fromStage: oldStage,
        toStage: params.stage,
        record: deal,
      });

      await logActivity({
        type: 'stage_change',
        subject: `AI-Assisted Stage Change: ${oldStage} -> ${deal.stage}`,
        body: params.reason || 'Updated via Copilot proposal',
        entityType: 'deal',
        entityId: deal._id,
        createdBy: user._id,
      });

      executionResult = { dealId: deal._id, stage: deal.stage };
      break;
    }

    case 'create_ticket': {
      const ticket = await Ticket.create({
        tenantId: user.tenantId,
        subject: params.subject,
        description: params.description,
        priority: params.priority || 'medium',
        status: 'open',
        customerEmail: params.customerEmail,
        assignedTo: user._id,
      });

      await logActivity({
        type: 'ticket',
        subject: `AI-Assisted Ticket Created: ${ticket.number || ticket.subject}`,
        body: ticket.description,
        entityType: 'ticket',
        entityId: ticket._id,
        createdBy: user._id,
      });

      executionResult = { ticketId: ticket._id, subject: ticket.subject };
      break;
    }

    case 'draft_email': {
      executionResult = { draftSaved: true, to: params.to, subject: params.subject };
      break;
    }

    default:
      throw new Error(`Unsupported action type: ${type}`);
  }

  // Update proposed action state
  msg.proposedAction.status = 'confirmed';
  msg.proposedAction.executedResult = executionResult;
  await conversation.save();

  // Audit log with source "ai_assisted"
  await AuditLog.create({
    tenantId: user.tenantId,
    userId: user._id,
    action: `ai_action_confirmed:${type}`,
    entity: type,
    entityId: msg.proposedAction.id,
    details: {
      actionId,
      type,
      params,
      executionResult,
      source: 'ai_assisted',
    },
    ipAddress: '127.0.0.1',
    userAgent: 'Copilot',
  });

  return { success: true, result: executionResult };
}

/**
 * Dismiss a proposed action card
 */
export async function dismissProposedAction(
  conversationId: string,
  actionId: string,
  userId: Types.ObjectId
): Promise<void> {
  const conversation = await CopilotConversation.findOne({
    _id: conversationId,
    userId,
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const msg = conversation.messages.find((m) => m.proposedAction?.id === actionId);
  if (msg && msg.proposedAction) {
    msg.proposedAction.status = 'dismissed';
    await conversation.save();
  }
}
