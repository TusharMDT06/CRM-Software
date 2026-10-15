import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { Task } from '../models/Task.js';
import { Message } from '../models/Message.js';
import { buildOwnerFilter } from '../utils/queryHelper.js';

export const syncRouter = Router();

syncRouter.use(authenticate);

// GET /sync/changes?since=ISO
syncRouter.get('/changes', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const sinceParam = req.query.since as string;
    const sinceDate = sinceParam && !isNaN(new Date(sinceParam).getTime())
      ? new Date(sinceParam)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // default last 24h

    const ownerFilter = buildOwnerFilter(user);

    const filter = {
      ...ownerFilter,
      updatedAt: { $gt: sinceDate },
    };

    const [leads, contacts, accounts, deals, tasks, messages] = await Promise.all([
      Lead.find(filter).populate('owner', 'name email role').sort({ updatedAt: -1 }).limit(200),
      Contact.find(filter).populate('account', 'name industry city').populate('owner', 'name email role').sort({ updatedAt: -1 }).limit(200),
      Account.find(filter).populate('owner', 'name email role').sort({ updatedAt: -1 }).limit(200),
      Deal.find(filter).populate('account', 'name industry').populate('contact', 'firstName lastName email').populate('owner', 'name email role').sort({ updatedAt: -1 }).limit(200),
      Task.find(filter).populate('deal', 'title stage amount').populate('owner', 'name email role').sort({ updatedAt: -1 }).limit(200),
      Message.find({ updatedAt: { $gt: sinceDate } }).sort({ createdAt: -1 }).limit(100),
    ]);

    res.json({
      since: sinceDate.toISOString(),
      serverTime: new Date().toISOString(),
      changes: {
        leads,
        contacts,
        accounts,
        deals,
        tasks,
        messages,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to retrieve sync changes' });
  }
});
