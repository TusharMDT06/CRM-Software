import { Router, Response } from 'express';
import { Resend } from 'resend';
import rateLimit from 'express-rate-limit';
import { EmailTemplate } from '../models/EmailTemplate.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  emailTemplateSchema,
  emailTemplateUpdateSchema,
  sendEmailSchema,
} from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { logActivity } from '../utils/activityHelper.js';
import { resolveMergeFields, MergeContext } from '../utils/mergeFields.js';

export const emailsRouter = Router();

emailsRouter.use(authenticate);

// Rate limiter for sending emails
const sendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many emails sent in a short period. Please wait.' },
});

// Helper to assemble merge context from entity
async function getEntityMergeContext(entityType: string, entityId: string, currentUser: any): Promise<{ context: MergeContext; targetEmail?: string }> {
  const context: MergeContext = {
    owner: { name: currentUser.name, email: currentUser.email },
  };
  let targetEmail = '';

  switch (entityType) {
    case 'lead': {
      const lead = await Lead.findById(entityId).populate('owner');
      if (lead) {
        context.lead = { name: lead.name, company: lead.company };
        if (lead.owner && typeof lead.owner === 'object') {
          context.owner = { name: (lead.owner as any).name, email: (lead.owner as any).email };
        }
        targetEmail = lead.email;
      }
      break;
    }
    case 'contact': {
      const contact = await Contact.findById(entityId).populate('account').populate('owner');
      if (contact) {
        context.contact = {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
        };
        if (contact.account && typeof contact.account === 'object') {
          context.account = { name: (contact.account as any).name, industry: (contact.account as any).industry };
        }
        if (contact.owner && typeof contact.owner === 'object') {
          context.owner = { name: (contact.owner as any).name, email: (contact.owner as any).email };
        }
        targetEmail = contact.email;
      }
      break;
    }
    case 'account': {
      const account = await Account.findById(entityId).populate('owner');
      if (account) {
        context.account = { name: account.name, industry: account.industry };
        if (account.owner && typeof account.owner === 'object') {
          context.owner = { name: (account.owner as any).name, email: (account.owner as any).email };
        }
      }
      break;
    }
    case 'deal': {
      const deal = await Deal.findById(entityId).populate('account').populate('contact').populate('owner');
      if (deal) {
        context.deal = { title: deal.title, amount: deal.amount };
        if (deal.account && typeof deal.account === 'object') {
          context.account = { name: (deal.account as any).name, industry: (deal.account as any).industry };
        }
        if (deal.contact && typeof deal.contact === 'object') {
          context.contact = {
            firstName: (deal.contact as any).firstName,
            lastName: (deal.contact as any).lastName,
            email: (deal.contact as any).email,
          };
          targetEmail = (deal.contact as any).email;
        }
        if (deal.owner && typeof deal.owner === 'object') {
          context.owner = { name: (deal.owner as any).name, email: (deal.owner as any).email };
        }
      }
      break;
    }
  }

  return { context, targetEmail };
}

// GET /emails/templates
emailsRouter.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let query = {};

    if (user.role === 'sales') {
      query = {
        $or: [{ owner: user._id }, { shared: true }],
      };
    }

    const templates = await EmailTemplate.find(query)
      .populate('owner', 'name email role')
      .sort({ createdAt: -1 });

    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch email templates' });
  }
});

// POST /emails/templates
emailsRouter.post('/templates', validateBody(emailTemplateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const template = await EmailTemplate.create({
      ...req.body,
      owner: user._id,
    });
    await template.populate('owner', 'name email role');
    res.status(201).json(template);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create email template' });
  }
});

// GET /emails/templates/:id
emailsRouter.get('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const template = await EmailTemplate.findById(req.params.id).populate('owner', 'name email role');
    if (!template) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch template' });
  }
});

// PATCH /emails/templates/:id
emailsRouter.patch(
  '/templates/:id',
  validateBody(emailTemplateUpdateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const template = await EmailTemplate.findById(req.params.id);

      if (!template) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }

      // Sales can edit only their own templates
      if (user.role === 'sales' && !template.owner.equals(user._id)) {
        res.status(403).json({ message: 'Forbidden: You can only edit your own email templates' });
        return;
      }

      Object.assign(template, req.body);
      await template.save();
      await template.populate('owner', 'name email role');

      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update template' });
    }
  }
);

// DELETE /emails/templates/:id
emailsRouter.delete('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const template = await EmailTemplate.findById(req.params.id);

    if (!template) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }

    if (user.role === 'sales' && !template.owner.equals(user._id)) {
      res.status(403).json({ message: 'Forbidden: You can only delete your own email templates' });
      return;
    }

    await template.deleteOne();
    res.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete template' });
  }
});

// POST /emails/templates/:id/duplicate
emailsRouter.post('/templates/:id/duplicate', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const original = await EmailTemplate.findById(req.params.id);

    if (!original) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }

    const copy = await EmailTemplate.create({
      name: `${original.name} (Copy)`,
      subject: original.subject,
      body: original.body,
      category: original.category,
      shared: false,
      owner: user._id,
    });

    await copy.populate('owner', 'name email role');
    res.status(201).json(copy);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to duplicate template' });
  }
});

// GET /emails/config (Returns whether Resend is configured and if test domain is in use)
emailsRouter.get('/config', (_req: AuthRequest, res: Response) => {
  const isConfigured = Boolean(process.env.RESEND_API_KEY);
  const emailFrom = process.env.EMAIL_FROM || 'Flowdesk <onboarding@resend.dev>';
  const isTestDomain = emailFrom.includes('resend.dev');

  res.json({
    isConfigured,
    isTestDomain,
    emailFrom: isTestDomain ? 'onboarding@resend.dev' : undefined,
  });
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// POST /emails/send
emailsRouter.post('/send', sendEmailLimiter, validateBody(sendEmailSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { to, subject, body, entityType, entityId } = req.body;

    const { context } = await getEntityMergeContext(entityType, entityId, user);
    const resolvedSubject = resolveMergeFields(subject, context);
    const resolvedBody = resolveMergeFields(body, context);

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'Flowdesk <onboarding@resend.dev>';

    // If RESEND_API_KEY is NOT configured, return 503 with helpful data for client mailto & manual logging
    if (!resendApiKey) {
      const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
        resolvedSubject
      )}&body=${encodeURIComponent(resolvedBody)}`;

      res.status(503).json({
        message: 'Resend API key is not configured on this server. You can open this in your email app or log it as sent.',
        mailtoUrl,
        resolvedSubject,
        resolvedBody,
      });
      return;
    }

    const htmlBody = escapeHtml(resolvedBody).replace(/\r?\n/g, '<br />');
    const textBody = resolvedBody;

    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [to],
      subject: resolvedSubject,
      html: htmlBody,
      text: textBody,
      replyTo: user.email,
    });

    if (error) {
      let statusCode = 502;
      const errMsg = error.message || 'Email delivery failed';
      const errName = (error as any).name || '';

      if (
        errName === 'validation_error' ||
        /invalid.*(email|recipient|domain|from|to|address)/i.test(errMsg)
      ) {
        statusCode = 400;
      } else if (errName === 'rate_limit_exceeded' || /rate.*limit/i.test(errMsg)) {
        statusCode = 429;
      }

      // Never leak the API key or raw provider internals
      const sanitizedMessage = errMsg.replace(/re_[a-zA-Z0-9_-]+/g, '[REDACTED]');
      res.status(statusCode).json({ message: sanitizedMessage });
      return;
    }

    // Log system activity on the record with Resend message id
    await logActivity({
      type: 'email',
      subject: `Email sent: ${resolvedSubject}`,
      body: resolvedBody,
      entityType,
      entityId,
      createdBy: user._id,
      messageId: data?.id,
    });

    res.json({
      message: 'Email sent successfully',
      id: data?.id,
      resolvedSubject,
      resolvedBody,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to send email' });
  }
});

// POST /emails/log-sent (Allows logging an email sent via mailto/client app)
emailsRouter.post('/log-sent', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { to, subject, body, entityType, entityId } = req.body;

    if (!to || !subject || !entityType || !entityId) {
      res.status(400).json({ message: 'Missing required fields for logging email' });
      return;
    }

    const { context } = await getEntityMergeContext(entityType, entityId, user);
    const resolvedSubject = resolveMergeFields(subject, context);
    const resolvedBody = resolveMergeFields(body || '', context);

    const activity = await logActivity({
      type: 'email',
      subject: `Email sent (client): ${resolvedSubject}`,
      body: resolvedBody,
      entityType,
      entityId,
      createdBy: user._id,
    });

    res.status(201).json({
      message: 'Email logged as activity',
      activity,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to log email activity' });
  }
});
