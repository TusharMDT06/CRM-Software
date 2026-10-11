import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { LeadSource } from '../models/LeadSource.js';
import { LeadEvent } from '../models/LeadEvent.js';
import { Campaign } from '../models/Campaign.js';
import { Lead } from '../models/Lead.js';
import { AuditLog } from '../models/AuditLog.js';
import {
  hashSecret,
  generateUnguessableId,
} from '../utils/cryptoHelper.js';
import { processInboundLeadEvent } from '../services/leadAttributionService.js';
import { logger } from '../utils/logger.js';

export const marketingRouter = Router();

// Protect all marketing endpoints: Admin & Manager only
marketingRouter.use(authenticate);
marketingRouter.use(requireRole('admin', 'manager'));

// Validation Schemas
const createSourceSchema = z.object({
  name: z.string().trim().min(1, 'Source name is required'),
  type: z.enum(['meta_lead_ads', 'google_ads', 'website_form', 'generic_webhook']),
  config: z.record(z.any()).optional().default({}),
});

const updateSourceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(['active', 'paused', 'error']).optional(),
  config: z.record(z.any()).optional(),
  routingRules: z.array(z.any()).optional(),
});

// GET /api/marketing/sources - List all lead sources with counters
marketingRouter.get('/sources', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const sources = await LeadSource.find({ tenantId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Sanitize config secrets before returning to client (never return hashed or plain keys)
    const sanitized = sources.map((s) => {
      const obj = s.toObject();
      if (obj.config?.apiKeyHash) {
        obj.config = {
          ...obj.config,
          apiKeyHash: undefined,
          hasApiKey: true,
        };
      }
      return obj;
    });

    res.json({ sources: sanitized });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch sources' });
  }
});

// POST /api/marketing/sources - Create a new lead source
marketingRouter.post('/sources', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const user = req.user!;
    const parsed = createSourceSchema.parse(req.body);

    const webhookId = generateUnguessableId(
      parsed.type === 'website_form' ? 'form' : 'wh'
    );

    let plainApiKey: string | undefined = undefined;
    const initialConfig = { ...(parsed.config || {}) };

    if (parsed.type === 'generic_webhook') {
      // Generate high-entropy API key for the webhook header
      plainApiKey = `fk_live_${crypto.randomBytes(24).toString('hex')}`;
      initialConfig.apiKeyHash = hashSecret(plainApiKey);
    } else if (parsed.type === 'website_form') {
      initialConfig.fields =
        initialConfig.fields ||
        initialConfig.formFields || [
          { field: 'name', label: 'Full Name', required: true },
          { field: 'email', label: 'Work Email', required: true },
          { field: 'phone', label: 'Phone Number', required: true },
          { field: 'company', label: 'Company Name', required: false },
        ];
      initialConfig.consentCheckboxText =
        initialConfig.consentCheckboxText ||
        'I agree to receive communications and updates regarding Flowdesk products and services.';
      initialConfig.successMessage =
        initialConfig.successMessage || 'Thank you! Our sales team will get back to you shortly.';
    }

    const source = await LeadSource.create({
      tenantId,
      name: parsed.name,
      type: parsed.type,
      status: 'active',
      config: initialConfig,
      webhookId,
      counters: { received: 0, created: 0, duplicates: 0, failed: 0 },
      createdBy: user._id,
    });

    // Audit log source creation
    await AuditLog.create({
      tenantId,
      actor: user._id,
      actorName: user.name,
      source: 'user',
      action: 'create',
      entityType: 'company_settings',
      entityId: source._id.toString(),
      entityLabel: `Lead Source: ${source.name} (${source.type})`,
      changes: [{ field: 'source', from: null, to: source.name }],
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    const responseObj = source.toObject();
    if (responseObj.config?.apiKeyHash) {
      delete responseObj.config.apiKeyHash;
    }

    res.status(201).json({
      source: responseObj,
      // Plain API key is shown ONCE to the user upon creation
      apiKey: plainApiKey,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0]?.message || 'Validation error' });
      return;
    }
    res.status(500).json({ message: err.message || 'Failed to create source' });
  }
});

// GET /api/marketing/sources/:id - Get source details + recent events
marketingRouter.get('/sources/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const source = await LeadSource.findOne({ _id: req.params.id, tenantId }).populate(
      'createdBy',
      'name email'
    );

    if (!source) {
      res.status(404).json({ message: 'Lead source not found' });
      return;
    }

    const recentEvents = await LeadEvent.find({ source: source._id, tenantId })
      .populate('lead', 'name email status isTest createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    const sanitized = source.toObject();
    if (sanitized.config?.apiKeyHash) {
      delete sanitized.config.apiKeyHash;
      sanitized.config.hasApiKey = true;
    }

    res.json({ source: sanitized, recentEvents });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch source' });
  }
});

// PATCH /api/marketing/sources/:id - Update source
marketingRouter.patch('/sources/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const user = req.user!;
    const parsed = updateSourceSchema.parse(req.body);

    const source = await LeadSource.findOne({ _id: req.params.id, tenantId });
    if (!source) {
      res.status(404).json({ message: 'Lead source not found' });
      return;
    }

    const previousStatus = source.status;
    if (parsed.name) source.name = parsed.name;
    if (parsed.status) source.status = parsed.status;
    if (parsed.config) {
      // Preserve existing secret hash if not provided
      source.config = {
        ...source.config,
        ...parsed.config,
        apiKeyHash: source.config?.apiKeyHash,
      };
    }
    if (parsed.routingRules) source.routingRules = parsed.routingRules;

    await source.save();

    await AuditLog.create({
      tenantId,
      actor: user._id,
      actorName: user.name,
      source: 'user',
      action: 'update',
      entityType: 'company_settings',
      entityId: source._id.toString(),
      entityLabel: `Lead Source: ${source.name}`,
      changes: [{ field: 'status', from: previousStatus, to: source.status }],
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    const sanitized = source.toObject();
    if (sanitized.config?.apiKeyHash) {
      delete sanitized.config.apiKeyHash;
    }

    res.json({ source: sanitized });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0]?.message || 'Validation error' });
      return;
    }
    res.status(500).json({ message: err.message || 'Failed to update source' });
  }
});

// DELETE /api/marketing/sources/:id - Delete source
marketingRouter.delete('/sources/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const user = req.user!;

    const source = await LeadSource.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!source) {
      res.status(404).json({ message: 'Lead source not found' });
      return;
    }

    // Clean up associated LeadEvents
    await LeadEvent.deleteMany({ source: source._id, tenantId });

    await AuditLog.create({
      tenantId,
      actor: user._id,
      actorName: user.name,
      source: 'user',
      action: 'delete',
      entityType: 'company_settings',
      entityId: source._id.toString(),
      entityLabel: `Lead Source: ${source.name}`,
      changes: [{ field: 'deleted', from: false, to: true }],
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({ success: true, message: 'Lead source deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to delete source' });
  }
});

// POST /api/marketing/sources/:id/rotate-secret - Rotate API key or webhook token
marketingRouter.post('/sources/:id/rotate-secret', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const user = req.user!;

    const source = await LeadSource.findOne({ _id: req.params.id, tenantId });
    if (!source) {
      res.status(404).json({ message: 'Lead source not found' });
      return;
    }

    let newApiKey: string | undefined = undefined;
    source.webhookId = generateUnguessableId(
      source.type === 'website_form' ? 'form' : 'wh'
    );

    if (source.type === 'generic_webhook') {
      newApiKey = `fk_live_${crypto.randomBytes(24).toString('hex')}`;
      source.config = {
        ...source.config,
        apiKeyHash: hashSecret(newApiKey),
      };
    }

    await source.save();

    await AuditLog.create({
      tenantId,
      actor: user._id,
      actorName: user.name,
      source: 'user',
      action: 'settings_changed',
      entityType: 'company_settings',
      entityId: source._id.toString(),
      entityLabel: `Lead Source: ${source.name} (Secret Rotated)`,
      changes: [{ field: 'webhookId', from: 'rotated', to: source.webhookId }],
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({
      success: true,
      webhookId: source.webhookId,
      apiKey: newApiKey,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to rotate secret' });
  }
});

// POST /api/marketing/sources/:id/test-lead - Send a simulated test lead
marketingRouter.post('/sources/:id/test-lead', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const source = await LeadSource.findOne({ _id: req.params.id, tenantId });
    if (!source) {
      res.status(404).json({ message: 'Lead source not found' });
      return;
    }

    const testId = `test_${Date.now()}`;
    const testPayload = {
      name: `Demo Prospect (${source.name})`,
      email: `test_lead_${Date.now()}@flowdesk-demo.test`,
      phone: '+919876543210',
      company: 'Acme Test Corp Pvt Ltd',
      value: 150000,
      notes: `Automated test lead dispatched via Flowdesk source verification (${source.name})`,
      formName: source.type === 'website_form' ? source.name : undefined,
      utm: {
        source: source.type,
        medium: 'test_dispatch',
        campaign: 'flowdesk_verification_test',
      },
      campaign: {
        externalId: 'test_campaign_001',
        name: 'Q4 Product Launch Test',
      },
      consent: {
        given: true,
        text: 'Test consent authorization',
        at: new Date(),
        via: 'test_button',
      },
      isTest: true,
    };

    const event = await LeadEvent.create({
      tenantId,
      source: source._id,
      providerLeadId: testId,
      status: 'received',
      rawPayload: testPayload,
      isTest: true,
    });

    source.counters.received += 1;
    await source.save();

    // Process event
    const result = await processInboundLeadEvent(event._id, testPayload);

    res.json({
      success: true,
      eventId: event._id,
      leadId: result.leadId,
      status: result.status,
      message: 'Test lead processed successfully with isTest = true',
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to dispatch test lead' });
  }
});

// GET /api/marketing/sources/:id/events - List events for debugging
marketingRouter.get('/sources/:id/events', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      LeadEvent.find({ source: req.params.id, tenantId })
        .populate('lead', 'name email status isTest createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LeadEvent.countDocuments({ source: req.params.id, tenantId }),
    ]);

    res.json({
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch events' });
  }
});

// POST /api/marketing/events/:id/replay - Replay a failed event
marketingRouter.post('/events/:id/replay', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const event = await LeadEvent.findOne({ _id: req.params.id, tenantId });
    if (!event) {
      res.status(404).json({ message: 'Event not found' });
      return;
    }

    const result = await processInboundLeadEvent(event._id);
    res.json({
      success: result.success,
      status: result.status,
      leadId: result.leadId,
      error: result.error,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to replay event' });
  }
});

// GET /api/marketing/campaigns - List campaigns
marketingRouter.get('/campaigns', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const campaigns = await Campaign.find({ tenantId }).sort({ firstSeenAt: -1 });

    // Aggregate lead count for each campaign
    const campaignNames = campaigns.map((c) => c.name);
    const leadCounts = await Lead.aggregate([
      {
        $match: {
          tenantId,
          'campaign.name': { $in: campaignNames },
        },
      },
      {
        $group: {
          _id: '$campaign.name',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(leadCounts.map((x) => [x._id, x.count]));

    const result = campaigns.map((c) => ({
      ...c.toObject(),
      leadCount: countMap.get(c.name) || 0,
    }));

    res.json({ campaigns: result });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch campaigns' });
  }
});

// PATCH /api/marketing/campaigns/:id - Update campaign name
marketingRouter.patch('/campaigns/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Campaign name is required' });
      return;
    }

    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: { name: name.trim() } },
      { new: true }
    );

    if (!campaign) {
      res.status(404).json({ message: 'Campaign not found' });
      return;
    }

    res.json({ campaign });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to update campaign' });
  }
});
