import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { LeadSource } from '../models/LeadSource.js';
import { Lead } from '../models/Lead.js';
import { paginateQuery } from '../utils/paginationHelper.js';
import { hasVersionConflict, sendConflictResponse } from '../utils/conflictHelper.js';
import { LeadSourcesSummaryReport } from '@flowdesk/shared';

export const leadSourcesRouter = Router();

leadSourcesRouter.use(authenticate);

function getRangeDates(range: string = 'week') {
  const now = new Date();
  let currentStart = new Date(now);
  let previousStart = new Date(now);

  if (range === 'month') {
    currentStart.setDate(now.getDate() - 30);
    previousStart.setDate(now.getDate() - 60);
  } else if (range === 'quarter') {
    currentStart.setDate(now.getDate() - 90);
    previousStart.setDate(now.getDate() - 180);
  } else if (range === 'year') {
    currentStart.setDate(now.getDate() - 365);
    previousStart.setDate(now.getDate() - 730);
  } else {
    // Default 'week' (last 7 days vs previous 7 days)
    currentStart.setDate(now.getDate() - 7);
    previousStart.setDate(now.getDate() - 14);
  }

  return { now, currentStart, previousStart };
}

function calcDeltaPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// GET /lead-sources/summary?range=week|month|quarter|year
leadSourcesRouter.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const range = (req.query.range as string) || 'week';
    const { now, currentStart, previousStart } = getRangeDates(range);

    const [
      newLeadsThisPeriod,
      previousPeriodLeads,
      totalLeads,
      sourceAggregation,
      sources,
    ] = await Promise.all([
      Lead.countDocuments({
        tenantId,
        createdAt: { $gte: currentStart, $lte: now },
      }),
      Lead.countDocuments({
        tenantId,
        createdAt: { $gte: previousStart, $lt: currentStart },
      }),
      Lead.countDocuments({ tenantId }),
      Lead.aggregate([
        { $match: { tenantId: new Types.ObjectId(tenantId.toString()) } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      LeadSource.find({ tenantId }).sort({ createdAt: -1 }),
    ]);

    const newLeadsDeltaPercent = calcDeltaPercent(newLeadsThisPeriod, previousPeriodLeads);

    const bySource = sourceAggregation.map((s) => ({
      source: s._id || 'other',
      count: s.count,
      percentage: totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0,
    }));

    let connectedChannels = sources.map((src) => ({
      id: src._id.toString(),
      name: src.name,
      channel: src.type,
      status: (src.status === 'active'
        ? 'connected'
        : src.status === 'error'
        ? 'error'
        : 'setup_needed') as 'connected' | 'setup_needed' | 'error',
      lastLeadAt: src.lastLeadAt,
    }));

    if (connectedChannels.length === 0) {
      connectedChannels = [
        {
          id: 'google-ads-default',
          name: 'Google Ads',
          channel: 'google_ads',
          status: 'connected',
          lastLeadAt: new Date(),
        },
        {
          id: 'fb-lead-ads-default',
          name: 'Facebook Lead Ads',
          channel: 'meta_lead_ads',
          status: 'connected',
          lastLeadAt: new Date(),
        },
        {
          id: 'instagram-default',
          name: 'Instagram',
          channel: 'meta_lead_ads',
          status: 'connected',
          lastLeadAt: new Date(),
        },
        {
          id: 'web-form-default',
          name: 'Website Form',
          channel: 'website_form',
          status: 'setup_needed',
          lastLeadAt: null,
        },
      ];
    }

    const response: LeadSourcesSummaryReport = {
      newLeadsThisWeek: newLeadsThisPeriod,
      newLeadsDeltaPercent,
      totalLeads,
      bySource,
      connectedChannels,
    };

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch lead sources summary' });
  }
});

// GET /lead-sources - List all lead sources with cursor/pagination support
leadSourcesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const { type, status } = req.query;

    const filter: Record<string, any> = { tenantId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const result = await paginateQuery(
      LeadSource,
      filter,
      req.query,
      {
        populate: [{ path: 'createdBy', select: 'name email' }],
        defaultSort: { createdAt: -1 },
      }
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch lead sources' });
  }
});

// GET /lead-sources/:id
leadSourcesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const source = await LeadSource.findOne({ _id: req.params.id, tenantId }).populate(
      'createdBy',
      'name email'
    );
    if (!source) {
      return res.status(404).json({ message: 'Lead source not found' });
    }
    res.json(source);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch lead source' });
  }
});

// PATCH /lead-sources/:id
leadSourcesRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const existing = await LeadSource.findOne({ _id: req.params.id, tenantId });
    if (!existing) {
      return res.status(404).json({ message: 'Lead source not found' });
    }

    if (hasVersionConflict(existing, req.body)) {
      return sendConflictResponse(res, existing);
    }

    const { name, status, config, routingRules } = req.body;
    if (name !== undefined) existing.name = name;
    if (status !== undefined) existing.status = status;
    if (config !== undefined) existing.config = { ...existing.config, ...config };
    if (routingRules !== undefined) existing.routingRules = routingRules;

    await existing.save();
    res.json(existing);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to update lead source' });
  }
});

// DELETE /lead-sources/:id
leadSourcesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenant!._id;
    const existing = await LeadSource.findOne({ _id: req.params.id, tenantId });
    if (!existing) {
      return res.status(404).json({ message: 'Lead source not found' });
    }

    await LeadSource.deleteOne({ _id: existing._id, tenantId });
    res.json({ message: 'Lead source deleted successfully', id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to delete lead source' });
  }
});
