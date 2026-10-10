import { Router, Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { Activity } from '../models/Activity.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createActivitySchema, updateActivitySchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';

export const activitiesRouter = Router();

activitiesRouter.use(authenticate);

// Helper to verify if user has access to an entity
async function checkEntityAccess(
  user: any,
  entityType: string,
  entityId: string
): Promise<boolean> {
  if (user.role === 'admin' || user.role === 'manager') return true;

  if (!Types.ObjectId.isValid(entityId)) return false;

  switch (entityType) {
    case 'lead': {
      const lead = await Lead.findById(entityId);
      return !!lead && lead.owner.equals(user._id);
    }
    case 'contact': {
      const contact = await Contact.findById(entityId);
      return !!contact && contact.owner.equals(user._id);
    }
    case 'account': {
      const account = await Account.findById(entityId);
      return !!account && account.owner.equals(user._id);
    }
    case 'deal': {
      const deal = await Deal.findById(entityId);
      return !!deal && deal.owner.equals(user._id);
    }
    default:
      return false;
  }
}

// GET /activities
activitiesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { entityType, entityId } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    let query: FilterQuery<any> = {};

    if (entityType && entityId) {
      const hasAccess = await checkEntityAccess(user, String(entityType), String(entityId));
      if (!hasAccess) {
        res.status(404).json({ message: 'Record not found or access denied' });
        return;
      }
      query = {
        entityType: String(entityType),
        entityId: new Types.ObjectId(String(entityId)),
      };
    } else {
      // Recent activities (e.g. for dashboard or general stream)
      if (user.role === 'sales') {
        const [userLeads, userContacts, userAccounts, userDeals] = await Promise.all([
          Lead.find({ owner: user._id }).select('_id'),
          Contact.find({ owner: user._id }).select('_id'),
          Account.find({ owner: user._id }).select('_id'),
          Deal.find({ owner: user._id }).select('_id'),
        ]);

        const allowedEntityIds = [
          ...userLeads.map((l) => l._id),
          ...userContacts.map((c) => c._id),
          ...userAccounts.map((a) => a._id),
          ...userDeals.map((d) => d._id),
        ];

        query = {
          $or: [{ createdBy: user._id }, { entityId: { $in: allowedEntityIds } }],
        };
      }
    }

    const [data, total] = await Promise.all([
      Activity.find(query)
        .populate('createdBy', 'name email role')
        .sort({ occurredAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Activity.countDocuments(query),
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
    res.status(500).json({ message: error.message || 'Failed to fetch activities' });
  }
});

// POST /activities
activitiesRouter.post(
  '/',
  validateBody(createActivitySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { entityType, entityId } = req.body;

      const hasAccess = await checkEntityAccess(user, entityType, entityId);
      if (!hasAccess) {
        res.status(404).json({ message: 'Target record not found or access denied' });
        return;
      }

      const activity = await Activity.create({
        ...req.body,
        createdBy: user._id,
        occurredAt: req.body.occurredAt || new Date(),
      });

      await activity.populate('createdBy', 'name email role');
      res.status(201).json(activity);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create activity' });
    }
  }
);

// PATCH /activities/:id (author, manager, or admin only)
activitiesRouter.patch(
  '/:id',
  validateBody(updateActivitySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const activity = await Activity.findById(req.params.id);

      if (!activity) {
        res.status(404).json({ message: 'Activity not found' });
        return;
      }

      // Check author or manager/admin
      const isAuthor = activity.createdBy.equals(user._id);
      const isManagerOrAdmin = user.role === 'admin' || user.role === 'manager';

      if (!isAuthor && !isManagerOrAdmin) {
        res.status(403).json({ message: 'Forbidden: You can only edit your own activities' });
        return;
      }

      Object.assign(activity, req.body);
      await activity.save();
      await activity.populate('createdBy', 'name email role');

      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update activity' });
    }
  }
);

// DELETE /activities/:id (author, manager, or admin only)
activitiesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      res.status(404).json({ message: 'Activity not found' });
      return;
    }

    const isAuthor = activity.createdBy.equals(user._id);
    const isManagerOrAdmin = user.role === 'admin' || user.role === 'manager';

    if (!isAuthor && !isManagerOrAdmin) {
      res.status(403).json({ message: 'Forbidden: You can only delete your own activities' });
      return;
    }

    await activity.deleteOne();
    res.json({ message: 'Activity deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete activity' });
  }
});
