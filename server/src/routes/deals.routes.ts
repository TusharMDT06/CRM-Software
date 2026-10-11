import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Deal } from '../models/Deal.js';
import { FieldDefinition } from '../models/FieldDefinition.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { requireWithinRecordLimit } from '../middleware/planLimits.js';
import { dealSchema, dealUpdateSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter, parseSort } from '../utils/queryHelper.js';
import { validateCustomFields } from '../utils/customFields.js';
import { logActivity } from '../utils/activityHelper.js';
import { toCSV } from '../utils/csvHelper.js';

export const dealsRouter = Router();

dealsRouter.use(authenticate);

function buildDealQuery(user: any, queryParams: any): FilterQuery<any> {
  const query: FilterQuery<any> = {
    ...buildOwnerFilter(user, queryParams.owner as string),
  };

  if (queryParams.stage) {
    query.stage = queryParams.stage;
  }
  if (queryParams.account) {
    query.account = queryParams.account;
  }
  if (queryParams.contact) {
    query.contact = queryParams.contact;
  }

  if (queryParams.q) {
    const q = String(queryParams.q).trim();
    query.$or = [{ title: { $regex: q, $options: 'i' } }];
  }

  return query;
}

// GET /deals
dealsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const query = buildDealQuery(user, req.query);
    const sort = parseSort(req.query.sort as string);

    const [data, total] = await Promise.all([
      Deal.find(query)
        .populate('account', 'name industry')
        .populate('contact', 'firstName lastName email phone')
        .populate('owner', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Deal.countDocuments(query),
    ]);

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch deals' });
  }
});

// GET /deals/export
dealsRouter.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = buildDealQuery(user, req.query);
    const sort = parseSort(req.query.sort as string);

    const [deals, activeCustomFields] = await Promise.all([
      Deal.find(query)
        .populate('account', 'name')
        .populate('contact', 'firstName lastName email')
        .populate('owner', 'name email')
        .sort(sort),
      FieldDefinition.find({ entity: 'deal', active: true }).sort({ order: 1 }),
    ]);

    const headers = [
      { key: 'title', label: 'Deal Title' },
      { key: 'accountName', label: 'Account' },
      { key: 'contactName', label: 'Contact' },
      { key: 'amount', label: 'Amount (INR)' },
      { key: 'stage', label: 'Stage' },
      { key: 'expectedClose', label: 'Expected Close' },
      { key: 'closedAt', label: 'Closed At' },
      { key: 'ownerName', label: 'Owner' },
      { key: 'createdAt', label: 'Created At' },
      ...activeCustomFields.map((cf) => ({
        key: `custom.${cf.key}`,
        label: `custom.${cf.key}`,
      })),
    ];

    const rows = deals.map((d) => {
      const row: Record<string, any> = {
        title: d.title,
        accountName: typeof d.account === 'object' ? (d.account as any)?.name : '',
        contactName:
          typeof d.contact === 'object'
            ? `${(d.contact as any)?.firstName || ''} ${(d.contact as any)?.lastName || ''}`.trim()
            : '',
        amount: d.amount,
        stage: d.stage,
        expectedClose: d.expectedClose ? d.expectedClose.toISOString().split('T')[0] : '',
        closedAt: d.closedAt ? d.closedAt.toISOString().split('T')[0] : '',
        ownerName: typeof d.owner === 'object' ? (d.owner as any)?.name : '',
        createdAt: d.createdAt.toISOString(),
      };

      activeCustomFields.forEach((cf) => {
        row[`custom.${cf.key}`] = d.custom?.[cf.key] ?? '';
      });

      return row;
    });

    const csvData = toCSV(rows, headers);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="deals-export-${Date.now()}.csv"`);
    res.send(csvData);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to export deals' });
  }
});

// GET /deals/:id
dealsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const deal = await Deal.findById(req.params.id)
      .populate('account', 'name industry phone website city')
      .populate('contact', 'firstName lastName email phone jobTitle')
      .populate('owner', 'name email role');

    if (!deal) {
      res.status(404).json({ message: 'Deal not found' });
      return;
    }

    // Scoping: sales can only open records they own (404 otherwise)
    if (user.role === 'sales' && !deal.owner.equals(user._id)) {
      res.status(404).json({ message: 'Deal not found' });
      return;
    }

    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch deal' });
  }
});

// POST /deals
dealsRouter.post('/', requireWithinRecordLimit, validateBody(dealSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const dealData = { ...req.body };

    const cf = await validateCustomFields('deal', dealData.custom, true);
    if (!cf.valid) {
      res.status(400).json({ message: cf.error });
      return;
    }
    dealData.custom = cf.cleanData;

    if (user.role === 'sales' || !dealData.owner) {
      dealData.owner = user._id;
    }

    if (dealData.stage === 'won' || dealData.stage === 'lost') {
      dealData.closedAt = new Date();
    } else {
      dealData.closedAt = null;
    }

    const deal = await Deal.create(dealData);
    await deal.populate('account', 'name industry');
    await deal.populate('contact', 'firstName lastName email phone');
    await deal.populate('owner', 'name email role');

    await logActivity({
      type: 'system',
      subject: 'Deal created',
      body: `Deal "${deal.title}" created with stage ${deal.stage.toUpperCase()}`,
      entityType: 'deal',
      entityId: deal._id,
      createdBy: user._id,
    });

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create deal' });
  }
});

// PATCH /deals/:id
dealsRouter.patch('/:id', validateBody(dealUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      res.status(404).json({ message: 'Deal not found' });
      return;
    }

    if (user.role === 'sales') {
      if (!deal.owner.equals(user._id)) {
        res.status(404).json({ message: 'Deal not found' });
        return;
      }
      delete req.body.owner;
    }

    const oldStage = deal.stage;

    // Check if stage is changing to update closedAt
    if (req.body.stage !== undefined) {
      if (req.body.stage === 'won' || req.body.stage === 'lost') {
        if (!deal.closedAt) {
          deal.closedAt = new Date();
        }
      } else {
        deal.closedAt = null;
      }
    }

    if (req.body.custom) {
      const cf = await validateCustomFields('deal', req.body.custom, false);
      if (!cf.valid) {
        res.status(400).json({ message: cf.error });
        return;
      }
      req.body.custom = { ...(deal.custom || {}), ...cf.cleanData };
    }

    Object.assign(deal, req.body);
    await deal.save();
    await deal.populate('account', 'name industry');
    await deal.populate('contact', 'firstName lastName email phone');
    await deal.populate('owner', 'name email role');

    // Stage change activity
    if (req.body.stage && req.body.stage !== oldStage) {
      await logActivity({
        type: 'stage_change',
        subject: `Stage changed: ${oldStage.toUpperCase()} to ${deal.stage.toUpperCase()}`,
        body: `Deal moved from ${oldStage} to ${deal.stage}`,
        entityType: 'deal',
        entityId: deal._id,
        createdBy: user._id,
      });
    }

    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update deal' });
  }
});

// DELETE /deals/:id (admin/manager only)
dealsRouter.delete('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) {
      res.status(404).json({ message: 'Deal not found' });
      return;
    }
    res.json({ message: 'Deal deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete deal' });
  }
});
