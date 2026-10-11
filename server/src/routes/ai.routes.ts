import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { geminiProvider } from '../ai/geminiProvider.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { Tenant } from '../models/Tenant.js';
import { AuditLog } from '../models/AuditLog.js';
import { AiUsageLog } from '../models/AiUsageLog.js';
import { AiFeedback } from '../models/AiFeedback.js';
import { CopilotConversation } from '../models/CopilotConversation.js';
import {
  runCopilotChat,
  confirmProposedAction,
  dismissProposedAction,
  checkAiGateAndLimits,
} from '../ai/copilotService.js';
import { generateEmailDraft, draftEmailRequestSchema } from '../ai/emailDraftGenerator.js';
import { summarizeRecord } from '../ai/summarizer.js';
import { executeNaturalLanguageSearch } from '../ai/nlSearch.js';
import { evaluateAllTenantScores, explainScoreWithAi } from '../ai/scoringEngine.js';

export const aiRouter = Router();

aiRouter.use(authenticate);

// ============================================
// 1. AI STATUS & DATA PRIVACY GATE
// ============================================

aiRouter.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    const isConfigured = geminiProvider.isConfigured();

    const settings = await CompanySettings.findOne();
    const aiEnabled = Boolean(settings?.aiEnabled);

    // Monthly request count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyUsed = await AiUsageLog.countDocuments({
      tenantId: tenant._id,
      createdAt: { $gte: startOfMonth },
    });

    res.json({
      isConfigured,
      aiEnabled,
      aiConsentConfirmedBy: settings?.aiConsentConfirmedBy,
      aiConsentConfirmedAt: settings?.aiConsentConfirmedAt,
      models: {
        strong: geminiProvider.getModelName('strong'),
        fast: geminiProvider.getModelName('fast'),
      },
      limits: {
        monthlyUsed,
        monthlyMax: tenant.limits.aiMonthlyRequests || 50,
        plan: tenant.plan,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch AI status' });
  }
});

// Update AI consent & enablement (Admin only)
aiRouter.post('/consent', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    const { enabled, acceptedNotice } = req.body;

    if (enabled && !acceptedNotice) {
      res.status(400).json({
        message: 'You must review and accept the data privacy disclosure before enabling AI.',
      });
      return;
    }

    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({
        aiEnabled: Boolean(enabled),
        aiConsentConfirmedBy: enabled ? user._id : undefined,
        aiConsentConfirmedAt: enabled ? new Date() : undefined,
      });
    } else {
      settings.aiEnabled = Boolean(enabled);
      if (enabled) {
        settings.aiConsentConfirmedBy = user._id;
        settings.aiConsentConfirmedAt = new Date();
      }
      await settings.save();
    }

    // Mirror to tenant limits and settings
    await Tenant.findByIdAndUpdate(tenant._id, {
      $set: {
        'limits.aiEnabled': Boolean(enabled),
        'settings.aiEnabled': Boolean(enabled),
      },
    });

    // Audit log this privacy-sensitive decision
    await AuditLog.create({
      tenantId: tenant._id,
      actor: user._id,
      actorName: user.name,
      source: 'user',
      action: 'settings_changed',
      entityType: 'company_settings',
      entityId: settings._id ? settings._id.toString() : tenant._id.toString(),
      entityLabel: 'AI Privacy Consent',
      changes: [
        {
          field: 'aiEnabled',
          from: !enabled,
          to: enabled,
        },
      ],
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({
      success: true,
      aiEnabled: settings.aiEnabled,
      aiConsentConfirmedAt: settings.aiConsentConfirmedAt,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to update AI consent' });
  }
});

// ============================================
// 2. COPILOT STREAMING CHAT & ACTIONS
// ============================================

aiRouter.post('/copilot/chat', async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const tenant = req.tenant!;
  const { conversationId, message, entityType, entityId, contextRecord } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ message: 'A prompt message is required' });
    return;
  }

  const isSse = req.headers.accept?.includes('text/event-stream');

  if (isSse) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await runCopilotChat({
        user,
        tenant,
        conversationId,
        message,
        entityType,
        entityId,
        contextRecord,
        onChunk: (chunk) => sendEvent('chunk', { chunk }),
        onToolCall: (call) => sendEvent('tool_call', { call }),
        onToolResult: (result) => sendEvent('tool_result', { result }),
        onProposedAction: (action) => sendEvent('proposed_action', { action }),
      });

      sendEvent('done', {
        conversationId: result.conversationId,
        response: result.response,
        proposedAction: result.proposedAction,
      });
      res.end();
    } catch (err: any) {
      sendEvent('error', { message: err?.message || 'AI request failed' });
      res.end();
    }
  } else {
    try {
      const result = await runCopilotChat({
        user,
        tenant,
        conversationId,
        message,
        entityType,
        entityId,
        contextRecord,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to process Copilot chat' });
    }
  }
});

aiRouter.get('/copilot/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const conversations = await CopilotConversation.find({ userId: user._id })
      .select('title entityType entityId updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    res.json({ data: conversations });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch conversations' });
  }
});

aiRouter.get('/copilot/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const conversation = await CopilotConversation.findOne({
      _id: id,
      userId: user._id,
    }).lean();

    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

    res.json(conversation);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch conversation' });
  }
});

aiRouter.delete('/copilot/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    await CopilotConversation.deleteOne({ _id: id, userId: user._id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to delete conversation' });
  }
});

aiRouter.delete('/copilot/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    await CopilotConversation.deleteMany({ userId: user._id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to clear conversations' });
  }
});

aiRouter.post('/copilot/actions/:actionId/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    const { actionId } = req.params;
    const { conversationId } = req.body;

    if (!conversationId) {
      res.status(400).json({ message: 'conversationId is required' });
      return;
    }

    const result = await confirmProposedAction(conversationId, actionId, user, tenant);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to confirm action' });
  }
});

aiRouter.post('/copilot/actions/:actionId/dismiss', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { actionId } = req.params;
    const { conversationId } = req.body;

    if (!conversationId) {
      res.status(400).json({ message: 'conversationId is required' });
      return;
    }

    await dismissProposedAction(conversationId, actionId, user._id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to dismiss action' });
  }
});

// ============================================
// 3. EMAIL DRAFT GENERATOR
// ============================================

aiRouter.post('/draft-email', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    await checkAiGateAndLimits(user, tenant);

    const validated = draftEmailRequestSchema.parse(req.body);
    const draft = await generateEmailDraft(validated, user);
    res.json(draft);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to draft email' });
  }
});

// ============================================
// 4. RECORD SUMMARIES (CACHED)
// ============================================

aiRouter.get('/summarize/:entityType/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    await checkAiGateAndLimits(user, tenant);

    const { entityType, id } = req.params;
    if (!['lead', 'contact', 'account', 'deal', 'ticket'].includes(entityType)) {
      res.status(400).json({ message: 'Unsupported entity type' });
      return;
    }

    const summary = await summarizeRecord(entityType as any, id, user);
    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to generate record summary' });
  }
});

// ============================================
// 5. NATURAL LANGUAGE SEARCH
// ============================================

aiRouter.post('/nl-search', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    await checkAiGateAndLimits(user, tenant);

    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ message: 'Query string is required' });
      return;
    }

    const result = await executeNaturalLanguageSearch(query, user);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to execute natural language search' });
  }
});

// ============================================
// 6. SCORING & EXPLANATIONS
// ============================================

aiRouter.post('/explain-score/:entityType/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    await checkAiGateAndLimits(user, tenant);

    const { entityType, id } = req.params;
    if (entityType !== 'lead' && entityType !== 'deal') {
      res.status(400).json({ message: 'Entity type must be lead or deal' });
      return;
    }

    const explanation = await explainScoreWithAi(entityType, id, user);
    res.json({ explanation });
  } catch (err: any) {
    res.status(400).json({ message: err.message || 'Failed to generate score explanation' });
  }
});

// Nightly score run manual trigger (admin only)
aiRouter.post('/score-all', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenant = req.tenant!;
    const results = await evaluateAllTenantScores(tenant._id.toString());
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Scoring evaluation failed' });
  }
});

// ============================================
// 7. USER QUALITY FEEDBACK (THUMBS UP/DOWN)
// ============================================

aiRouter.post('/feedback', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    const { feature, rating, notes, promptPreview, responsePreview } = req.body;

    if (!feature || !['up', 'down'].includes(rating)) {
      res.status(400).json({ message: 'feature and rating (up/down) are required' });
      return;
    }

    const feedback = await AiFeedback.create({
      tenantId: tenant._id,
      userId: user._id,
      feature,
      rating,
      notes,
      promptPreview: promptPreview ? String(promptPreview).substring(0, 300) : undefined,
      responsePreview: responsePreview ? String(responsePreview).substring(0, 300) : undefined,
    });

    res.json({ success: true, feedbackId: feedback._id });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to submit feedback' });
  }
});

// ============================================
// 8. AI USAGE ANALYTICS (ADMIN ONLY)
// ============================================

aiRouter.get('/usage', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const tenant = req.tenant!;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await AiUsageLog.find({
      tenantId: tenant._id,
      createdAt: { $gte: thirtyDaysAgo },
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const totals = await AiUsageLog.aggregate([
      { $match: { tenantId: tenant._id, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$feature',
          count: { $sum: 1 },
          totalTokens: { $sum: '$totalTokens' },
          totalCostPaise: { $sum: '$estimatedCostPaise' },
          avgLatencyMs: { $avg: '$latencyMs' },
        },
      },
    ]);

    res.json({
      recentLogs: logs,
      featureTotals: totals,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch usage analytics' });
  }
});
