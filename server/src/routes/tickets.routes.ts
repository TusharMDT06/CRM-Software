import { Router, Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import crypto from 'crypto';
import { Resend } from 'resend';
import { Ticket, ITicket } from '../models/Ticket.js';
import { TicketMessage } from '../models/TicketMessage.js';
import { CannedResponse } from '../models/CannedResponse.js';
import { SlaPolicy, getOrCreateDefaultSlaPolicy } from '../models/SlaPolicy.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { User } from '../models/User.js';
import { CompanySettings, getCompanySettings } from '../models/CompanySettings.js';
import { getNextDocumentNumber } from '../models/Counter.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { requireWithinRecordLimit } from '../middleware/planLimits.js';
import { AuthRequest } from '../types/index.js';
import { calculateTicketSla, handleTicketPendingState } from '../utils/slaEngine.js';
import { logActivity } from '../utils/activityHelper.js';
import { eventBus } from '../utils/eventBus.js';
import { sendNotification } from '../utils/notificationService.js';
import {
  createTicketSchema,
  updateTicketSchema,
  createTicketMessageSchema,
  createCannedResponseSchema,
  updateCannedResponseSchema,
  updateSlaPolicySchema,
} from '../validations/index.js';

export const ticketsRouter = Router();

// Apply auth to all internal ticket routes
ticketsRouter.use(authenticate);

// ==========================================
// 1. CANNED RESPONSES (Mounted before /:id)
// ==========================================
ticketsRouter.get('/canned-responses', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const items = await CannedResponse.find({
      $or: [{ isShared: true }, { createdBy: userId }],
    }).sort({ shortcut: 1 });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

ticketsRouter.post(
  '/canned-responses',
  validateBody(createCannedResponseSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const item = await CannedResponse.create({
        ...req.body,
        createdBy: req.user!._id,
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

ticketsRouter.put(
  '/canned-responses/:id',
  validateBody(updateCannedResponseSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const item = await CannedResponse.findById(req.params.id);
      if (!item) {
        res.status(404).json({ message: 'Canned response not found' });
        return;
      }
      if (
        !item.shared &&
        item.createdBy.toString() !== req.user!._id.toString() &&
        req.user!.role === 'sales'
      ) {
        res.status(403).json({ message: 'Not authorized to edit this response' });
        return;
      }
      Object.assign(item, req.body);
      await item.save();
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

ticketsRouter.delete('/canned-responses/:id', async (req: AuthRequest, res: Response) => {
  try {
    const item = await CannedResponse.findById(req.params.id);
    if (!item) {
      res.status(404).json({ message: 'Canned response not found' });
      return;
    }
    if (
      !item.shared &&
      item.createdBy.toString() !== req.user!._id.toString() &&
      req.user!.role === 'sales'
    ) {
      res.status(403).json({ message: 'Not authorized to delete this response' });
      return;
    }
    await CannedResponse.findByIdAndDelete(req.params.id);
    res.json({ message: 'Canned response deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 2. SLA POLICY (Mounted before /:id)
// ==========================================
ticketsRouter.get('/sla-policy', async (req: AuthRequest, res: Response) => {
  try {
    const policy = await getOrCreateDefaultSlaPolicy();
    res.json(policy);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

ticketsRouter.put(
  '/sla-policy',
  requireRole('admin', 'manager'),
  validateBody(updateSlaPolicySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const policy = await getOrCreateDefaultSlaPolicy();
      if (req.body.operatingHours) policy.operatingHours = req.body.operatingHours;
      if (req.body.timezone) policy.timeZone = req.body.timezone;
      if (req.body.targets) {
        const p: any = policy.priorities || {};
        if (req.body.targets.low) {
          p.low = {
            firstResponseHours: Math.round(req.body.targets.low.firstResponseMinutes / 60) || 24,
            resolutionHours: Math.round(req.body.targets.low.resolutionMinutes / 60) || 72,
          };
        }
        if (req.body.targets.medium) {
          p.medium = {
            firstResponseHours: Math.round(req.body.targets.medium.firstResponseMinutes / 60) || 8,
            resolutionHours: Math.round(req.body.targets.medium.resolutionMinutes / 60) || 24,
          };
        }
        if (req.body.targets.high) {
          p.high = {
            firstResponseHours: Math.round(req.body.targets.high.firstResponseMinutes / 60) || 4,
            resolutionHours: Math.round(req.body.targets.high.resolutionMinutes / 60) || 12,
          };
        }
        if (req.body.targets.urgent) {
          p.urgent = {
            firstResponseHours: Math.round(req.body.targets.urgent.firstResponseMinutes / 60) || 1,
            resolutionHours: Math.round(req.body.targets.urgent.resolutionMinutes / 60) || 4,
          };
        }
        policy.priorities = p;
      }
      await policy.save();
      res.json(policy);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ==========================================
// 3. TICKETS LIST & QUERY
// ==========================================
ticketsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      priority,
      channel,
      assignee,
      contact,
      account,
      deal,
      view,
      q,
      page = '1',
      limit = '20',
      sort = '-createdAt',
    } = req.query;

    const query: FilterQuery<ITicket> = {};

    // Quick views
    const now = new Date();
    if (view === 'my_open') {
      query.assignee = req.user!._id;
      query.status = { $nin: ['resolved', 'closed'] };
    } else if (view === 'unassigned') {
      query.assignee = null;
      query.status = { $nin: ['resolved', 'closed'] };
    } else if (view === 'breaching_soon') {
      const in4Hours = new Date(Date.now() + 4 * 60 * 60 * 1000);
      query.status = { $nin: ['resolved', 'closed'] };
      (query as any)['slaBreached.firstResponse'] = false;
      (query as any)['slaBreached.resolution'] = false;
      query.$or = [
        {
          firstResponseAt: null,
          slaFirstResponseDue: { $gt: now, $lte: in4Hours },
        },
        {
          resolvedAt: null,
          slaResolutionDue: { $gt: now, $lte: in4Hours },
        },
      ];
    } else if (view === 'breached') {
      query.status = { $nin: ['resolved', 'closed'] };
      query.$or = [
        { 'slaBreached.firstResponse': true },
        { 'slaBreached.resolution': true },
        { firstResponseAt: null, slaFirstResponseDue: { $lt: now } },
        { resolvedAt: null, slaResolutionDue: { $lt: now } },
      ];
    }

    if (status) query.status = status as any;
    if (priority) query.priority = priority as any;
    if (channel) query.channel = channel as any;
    if (assignee !== undefined) {
      if (assignee === 'unassigned' || assignee === 'null') {
        query.assignee = null;
      } else if (assignee) {
        query.assignee = assignee as any;
      }
    }
    if (contact) query.contact = contact as any;
    if (account) query.account = account as any;
    if (deal) query.deal = deal as any;

    if (q) {
      const searchStr = String(q).trim();
      query.$or = [
        { number: { $regex: searchStr, $options: 'i' } },
        { subject: { $regex: searchStr, $options: 'i' } },
        { description: { $regex: searchStr, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .populate('assignee', 'name email avatar role')
        .populate('contact', 'firstName lastName email phone')
        .populate('account', 'name domain')
        .populate('deal', 'title value stage')
        .sort(sort as string)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Ticket.countDocuments(query),
    ]);

    res.json({
      tickets,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 4. CREATE TICKET
// ==========================================
ticketsRouter.post(
  '/',
  requireWithinRecordLimit,
  validateBody(createTicketSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const currentYear = new Date().getFullYear();
      const number = await getNextDocumentNumber('TCK', currentYear);
      const priority = req.body.priority || 'medium';

      const slaTimes = await calculateTicketSla(priority);
      const publicToken = crypto.randomUUID();

      const ticket = await Ticket.create({
        ...req.body,
        number,
        publicToken,
        slaFirstResponseDue: slaTimes.firstResponseDue,
        slaResolutionDue: slaTimes.resolutionDue,
        createdBy: req.user!._id,
      });

      // Populate for response
      const populated = await Ticket.findById(ticket._id)
        .populate('assignee', 'name email avatar role')
        .populate('contact', 'firstName lastName email phone')
        .populate('account', 'name domain')
        .populate('deal', 'title value stage')
        .populate('createdBy', 'name email');

      // Activity timeline
      await logActivity({
        type: 'ticket',
        subject: `Created ticket ${number}: ${ticket.subject}`,
        body: ticket.description || 'Support ticket logged',
        entityType: 'ticket',
        entityId: ticket._id.toString(),
        createdBy: req.user!._id,
      });

      // Emit domain event for workflows
      eventBus.emitDomainEvent('ticket_created', {
        ticketId: ticket._id.toString(),
        entityType: 'ticket',
        entityId: ticket._id.toString(),
        record: ticket.toObject(),
      });

      // If assigned upon creation, send notification
      if (ticket.assignee) {
        eventBus.emitDomainEvent('ticket_assigned', {
          ticketId: ticket._id.toString(),
          entityType: 'ticket',
          entityId: ticket._id.toString(),
          record: ticket.toObject(),
        });

        await sendNotification({
          userId: ticket.assignee.toString(),
          type: 'ticket_assigned',
          title: `Ticket Assigned: ${ticket.number}`,
          body: `You were assigned to ticket "${ticket.subject}"`,
          link: `/tickets/${ticket._id}`,
          entityType: 'ticket',
          entityId: ticket._id.toString(),
        });
      }

      res.status(201).json(populated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ==========================================
// 5. GET SINGLE TICKET
// ==========================================
ticketsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('assignee', 'name email avatar role')
      .populate('contact', 'firstName lastName email phone')
      .populate('account', 'name domain')
      .populate('deal', 'title value stage')
      .populate('createdBy', 'name email avatar');

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found' });
      return;
    }

    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 6. UPDATE TICKET
// ==========================================
ticketsRouter.patch(
  '/:id',
  validateBody(updateTicketSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) {
        res.status(404).json({ message: 'Ticket not found' });
        return;
      }

      const prevStatus = ticket.status;
      const prevAssignee = ticket.assignee ? ticket.assignee.toString() : null;
      const newStatus = req.body.status;
      const newAssignee = req.body.assignee;

      // Handle SLA pending state pause/resume
      if (newStatus && newStatus !== prevStatus) {
        handleTicketPendingState(ticket, newStatus);

        if ((newStatus === 'resolved' || newStatus === 'closed') && !ticket.resolvedAt) {
          ticket.resolvedAt = new Date();
          // Check if resolved past SLA
          if (ticket.slaResolutionDue && ticket.resolvedAt > ticket.slaResolutionDue) {
            ticket.slaBreached.resolution = true;
          }
        }
      }

      // If priority changes, recalculate SLA if not resolved yet
      if (req.body.priority && req.body.priority !== ticket.priority && !ticket.resolvedAt) {
        const slaTimes = await calculateTicketSla(req.body.priority);
        // Adjust for any paused time
        const pausedMs = ticket.slaPendingTotalPausedMs || 0;
        ticket.slaFirstResponseDue = new Date(slaTimes.firstResponseDue.getTime() + pausedMs);
        ticket.slaResolutionDue = new Date(slaTimes.resolutionDue.getTime() + pausedMs);
      }

      // Apply updates
      Object.assign(ticket, req.body);
      await ticket.save();

      const populated = await Ticket.findById(ticket._id)
        .populate('assignee', 'name email avatar role')
        .populate('contact', 'firstName lastName email phone')
        .populate('account', 'name domain')
        .populate('deal', 'title value stage')
        .populate('createdBy', 'name email avatar');

      // Activity logging
      if (newStatus && newStatus !== prevStatus) {
        await logActivity({
          type: 'ticket',
          subject: `Ticket status updated to ${newStatus}`,
          entityType: 'ticket',
          entityId: ticket._id.toString(),
          createdBy: req.user!._id,
        });

        if (newStatus === 'resolved') {
          eventBus.emitDomainEvent('ticket_resolved', {
            ticketId: ticket._id.toString(),
            entityType: 'ticket',
            entityId: ticket._id.toString(),
            record: ticket.toObject(),
          });
        }
      }

      // Assignee changed
      if (newAssignee !== undefined && newAssignee !== prevAssignee) {
        eventBus.emitDomainEvent('ticket_assigned', {
          ticketId: ticket._id.toString(),
          entityType: 'ticket',
          entityId: ticket._id.toString(),
          record: ticket.toObject(),
        });

        if (newAssignee) {
          await sendNotification({
            userId: newAssignee,
            type: 'ticket_assigned',
            title: `Ticket Reassigned: ${ticket.number}`,
            body: `You were assigned to ticket "${ticket.subject}"`,
            link: `/tickets/${ticket._id}`,
            entityType: 'ticket',
            entityId: ticket._id.toString(),
          });
        }
      }

      res.json(populated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ==========================================
// 7. DELETE TICKET
// ==========================================
ticketsRouter.delete(
  '/:id',
  requireRole('admin', 'manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) {
        res.status(404).json({ message: 'Ticket not found' });
        return;
      }

      await Promise.all([
        TicketMessage.deleteMany({ ticket: ticket._id }),
        Ticket.findByIdAndDelete(ticket._id),
      ]);

      res.json({ message: 'Ticket deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ==========================================
// 8. TICKET MESSAGES (Timeline & Replies)
// ==========================================
ticketsRouter.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const messages = await TicketMessage.find({ ticket: req.params.id })
      .populate('author', 'name email avatar role')
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

ticketsRouter.post(
  '/:id/messages',
  validateBody(createTicketMessageSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await Ticket.findById(req.params.id).populate('contact');
      if (!ticket) {
        res.status(404).json({ message: 'Ticket not found' });
        return;
      }

      const { type, body, attachments } = req.body;

      const message = await TicketMessage.create({
        ticket: ticket._id,
        author: req.user!._id,
        type,
        body,
        attachments: attachments || [],
      });

      // If public reply
      if (type === 'public_reply') {
        const now = new Date();
        if (!ticket.firstResponseAt) {
          ticket.firstResponseAt = now;
          if (ticket.slaFirstResponseDue && now > ticket.slaFirstResponseDue) {
            ticket.slaBreached.firstResponse = true;
          }
        }

        // If ticket was new, move to open
        if (ticket.status === 'new') {
          ticket.status = 'open';
        }

        await ticket.save();

        // Send email to contact if email available and resend configured
        try {
          const contactObj = ticket.contact as any;
          if (contactObj?.email && process.env.RESEND_API_KEY) {
            const companySettings = await getCompanySettings();
            const resend = new Resend(process.env.RESEND_API_KEY);
            const fromEmail = process.env.EMAIL_FROM || 'Flowdesk Support <support@flowdesk.app>';

            await resend.emails.send({
              from: fromEmail,
              to: contactObj.email,
              replyTo: req.user!.email,
              subject: `Re: [${ticket.number}] ${ticket.subject}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
                  <div style="margin-bottom: 20px;">
                    <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">${companySettings?.legalName || 'Flowdesk CRM'} Support</span>
                    <h2 style="font-size: 18px; color: #0f172a; margin-top: 4px; margin-bottom: 0;">${ticket.subject}</h2>
                    <p style="font-size: 13px; color: #64748b; margin-top: 2px;">Ticket #${ticket.number}</p>
                  </div>
                  <div style="background-color: #f8fafc; border-left: 3px solid #0f172a; padding: 16px; border-radius: 6px; margin: 20px 0; font-size: 15px; white-space: pre-wrap;">${body}</div>
                  <p style="font-size: 13px; color: #64748b;">Replied by <strong>${req.user!.name}</strong></p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                  <p style="font-size: 12px; color: #94a3b8; text-align: center;">You can reply directly to this email to continue the conversation.</p>
                </div>
              `,
            });
          }
        } catch (mailErr) {
          console.error('[Tickets] Failed sending customer reply email:', mailErr);
        }
      }

      await ticket.save();

      const populatedMessage = await TicketMessage.findById(message._id).populate(
        'author',
        'name email avatar role'
      );

      res.status(201).json(populatedMessage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);
