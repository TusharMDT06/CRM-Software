import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { Message, IMessage } from '../models/Message.js';
import { Contact } from '../models/Contact.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { Resend } from 'resend';
import { logger } from '../utils/logger.js';
import { emitChange } from '../realtime/socket.js';
import { sendNotification } from '../utils/notificationService.js';
import { runWithTenantContext } from '../utils/tenantContext.js';

export const messagesRouter = Router();

// =========================================================================
// INBOUND SMS WEBHOOK (Public or Provider authenticated)
// =========================================================================
export const inboundSmsRouter = Router();

inboundSmsRouter.post('/inbound', async (req, res: Response) => {
  try {
    const { from, to, body, threadId, tenantId } = req.body;

    if (!from || !body) {
      res.status(400).json({ message: 'from and body are required' });
      return;
    }

    const cleanThreadId = threadId || `sms_${from.replace(/\D/g, '')}`;

    const message = await Message.create({
      tenantId: tenantId || req.headers['x-tenant-id'],
      threadId: cleanThreadId,
      channel: 'sms',
      direction: 'inbound',
      status: 'received',
      from: from.trim(),
      to: to ? to.trim() : 'Flowdesk SMS',
      body: body.trim(),
    });

    emitChange({
      entity: 'message',
      action: 'created',
      id: message._id.toString(),
      orgId: message.tenantId ? message.tenantId.toString() : undefined,
      updatedAt: message.updatedAt,
      data: message.toObject(),
    });

    const targetTenantId = tenantId || req.headers['x-tenant-id'] || (message.tenantId ? message.tenantId.toString() : undefined);
    const phoneDigits = from.replace(/\D/g, '').slice(-10);

    runWithTenantContext({ tenantId: targetTenantId, isBypassTenant: !targetTenantId }, async () => {
      let recipientUserId: any = null;
      if (phoneDigits) {
        const contact = await Contact.findOne({ phone: new RegExp(phoneDigits) });
        if (contact && contact.owner) {
          recipientUserId = contact.owner;
        } else {
          const lead = await Lead.findOne({ phone: new RegExp(phoneDigits) });
          if (lead && lead.owner) {
            recipientUserId = lead.owner;
          }
        }
      }

      if (!recipientUserId) {
        const admin = await User.findOne({ role: 'admin', active: true });
        if (admin) recipientUserId = admin._id;
      }

      if (recipientUserId) {
        await sendNotification({
          userId: recipientUserId,
          type: 'inbound_sms',
          title: `Inbound SMS from ${from}`,
          body: body.trim(),
          link: `/messages/${cleanThreadId}`,
          entityType: 'message',
          entityId: message._id.toString(),
        });
      }
    }).catch((notifErr) => {
      logger.warn('[InboundSMS] Notification dispatch failed:', notifErr);
    });

    res.status(200).json({ success: true, messageId: message._id });
  } catch (err: any) {
    logger.error('[InboundSMS] Error receiving SMS webhook:', err);
    res.status(500).json({ message: 'Error processing SMS webhook' });
  }
});

// Protected Message Endpoints
messagesRouter.use(authenticate);

// GET /messages/threads - List threads
messagesRouter.get('/threads', async (req: AuthRequest, res: Response) => {
  try {
    const channel = req.query.channel as string;
    const match: any = {};
    if (channel) {
      match.channel = channel;
    }

    const messages = await Message.find(match).sort({ createdAt: -1 });

    const threadMap = new Map<string, {
      threadId: string;
      participantName: string;
      participantContact: string;
      channel: string;
      lastMessage: IMessage;
      unreadCount: number;
    }>();

    for (const msg of messages) {
      const tId = msg.threadId;
      const otherParty = msg.direction === 'inbound' ? msg.from : msg.to;
      const isUnread = msg.direction === 'inbound' && !msg.readAt;

      if (!threadMap.has(tId)) {
        threadMap.set(tId, {
          threadId: tId,
          participantName: otherParty,
          participantContact: otherParty,
          channel: msg.channel,
          lastMessage: msg,
          unreadCount: isUnread ? 1 : 0,
        });
      } else {
        const item = threadMap.get(tId)!;
        if (isUnread) {
          item.unreadCount += 1;
        }
      }
    }

    res.json({ threads: Array.from(threadMap.values()) });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to list message threads' });
  }
});

// GET /messages/thread/:threadId - Get thread history
messagesRouter.get('/thread/:threadId', async (req: AuthRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const messages = await Message.find({ threadId }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to fetch thread' });
  }
});

// POST /messages - Send SMS / Email message
messagesRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { channel, to, subject, body, entityType, entityId, threadId } = req.body;

    if (!channel || !to || !body) {
      res.status(400).json({ message: 'channel, to, and body are required' });
      return;
    }

    const cleanThreadId =
      threadId ||
      `${channel}_${String(to).replace(/[^a-zA-Z0-9]/g, '_')}`;

    let status = 'sent';

    if (channel === 'email') {
      if (process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const emailFrom = process.env.EMAIL_FROM || 'Flowdesk CRM <onboarding@resend.dev>';
          await resend.emails.send({
            from: emailFrom,
            to: [to],
            subject: subject || 'Message from Flowdesk CRM',
            text: body,
          });
          status = 'delivered';
        } catch (resendErr: any) {
          logger.warn('[Messages] Resend send error:', resendErr?.message);
        }
      }
    } else if (channel === 'sms') {
      logger.info(`[SMS Dispatch] Sending SMS to ${to}: ${body}`);
      status = 'sent';
    }

    const message = await Message.create({
      tenantId: user.tenantId,
      threadId: cleanThreadId,
      channel,
      direction: 'outbound',
      status,
      from: user.email || 'Flowdesk CRM',
      to: to.trim(),
      subject: subject || '',
      body: body.trim(),
      entityType,
      entityId,
    });

    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to send message' });
  }
});
