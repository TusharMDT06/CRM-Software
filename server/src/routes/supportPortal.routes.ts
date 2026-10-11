import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { Resend } from 'resend';
import { Tenant } from '../models/Tenant.js';
import { Ticket } from '../models/Ticket.js';
import { TicketMessage } from '../models/TicketMessage.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { CompanySettings, getCompanySettings } from '../models/CompanySettings.js';
import { getNextDocumentNumber } from '../models/Counter.js';
import { runWithTenantContext } from '../utils/tenantContext.js';
import { calculateTicketSla } from '../utils/slaEngine.js';
import { validateBody } from '../middleware/validate.js';
import { publicPortalSubmitTicketSchema } from '../validations/index.js';
import { eventBus } from '../utils/eventBus.js';
import { sendNotification } from '../utils/notificationService.js';
import { z } from 'zod';

export const supportPortalRouter = Router();

// Strict rate limiter for public support portal submissions
const portalSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many requests. Please try again later.' },
});

// Rate limiter for viewing / replying via public token
const portalViewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Too many requests. Please try again later.' },
});

// ==========================================
// 1. PUBLIC TICKET SUBMISSION
// ==========================================
supportPortalRouter.post(
  '/:tenantSlug',
  portalSubmitLimiter,
  validateBody(publicPortalSubmitTicketSchema),
  async (req: Request, res: Response) => {
    try {
      const { tenantSlug } = req.params;
      const { name, email, phone, company, subject, description, priority = 'medium', website } = req.body;

      // 1. Honeypot check (anti-bot)
      if (website && website.trim().length > 0) {
        // Silently succeed for bots
        res.status(200).json({ success: true, message: 'Ticket received.' });
        return;
      }

      // 2. Find tenant
      const tenant = await Tenant.findOne({ slug: tenantSlug });
      if (!tenant) {
        res.status(404).json({ message: 'Support portal not found for this organization.' });
        return;
      }

      // 3. Execute inside tenant context
      const result = await runWithTenantContext(
        { tenantId: tenant._id.toString() },
        async () => {
          // Find or create Contact
          let contact = await Contact.findOne({ email: email.toLowerCase().trim() });
          let accountId = null;

          if (company && company.trim()) {
            let account = await Account.findOne({
              name: { $regex: new RegExp(`^${company.trim()}$`, 'i') },
            });
            if (!account) {
              account = await Account.create({
                name: company.trim(),
              });
            }
            accountId = account._id;
          }

          if (!contact) {
            contact = await Contact.create({
              name: name.trim(),
              email: email.toLowerCase().trim(),
              phone: phone ? phone.trim() : undefined,
              account: accountId,
            });
          } else if (accountId && !contact.account) {
            contact.account = accountId;
            await contact.save();
          }

          // Generate Ticket Number
          const currentYear = new Date().getFullYear();
          const number = await getNextDocumentNumber('TCK', currentYear);

          // Calculate SLA
          const slaTimes = await calculateTicketSla(priority);
          const publicToken = crypto.randomUUID();

          // Create Ticket
          const ticket = await Ticket.create({
            number,
            subject: subject.trim(),
            description: description.trim(),
            status: 'new',
            priority,
            channel: 'portal',
            contact: contact._id,
            account: accountId,
            publicToken,
            slaFirstResponseDue: slaTimes.firstResponseDue,
            slaResolutionDue: slaTimes.resolutionDue,
          });

          // Create initial message from customer
          await TicketMessage.create({
            ticket: ticket._id,
            author: null,
            type: 'public_reply',
            body: description.trim(),
          });

          // Emit domain event
          eventBus.emitDomainEvent('ticket_created', {
            ticketId: ticket._id.toString(),
            entityType: 'ticket',
            entityId: ticket._id.toString(),
            tenantId: tenant._id.toString(),
            record: ticket.toObject(),
          });

          // Send confirmation email
          try {
            if (process.env.RESEND_API_KEY) {
              const companySettings = await getCompanySettings();
              const resend = new Resend(process.env.RESEND_API_KEY);
              const fromEmail = process.env.EMAIL_FROM || 'Flowdesk Support <support@flowdesk.app>';
              const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
              const ticketTrackingUrl = `${clientUrl}/support/status/${publicToken}`;

              await resend.emails.send({
                from: fromEmail,
                to: email,
                subject: `[${ticket.number}] We received your support request: ${ticket.subject}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0f172a; margin-top: 0;">Thanks for reaching out!</h2>
                    <p>Hi ${name},</p>
                    <p>We've received your support request regarding <strong>"${ticket.subject}"</strong>. Our team is reviewing it and will get back to you shortly.</p>
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                      <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Ticket Number:</strong> ${ticket.number}</p>
                      <p style="margin: 0; font-size: 14px;"><strong>Priority:</strong> ${priority.toUpperCase()}</p>
                    </div>
                    <p>You can check the status of your ticket or send updates anytime using the link below:</p>
                    <div style="margin: 24px 0;">
                      <a href="${ticketTrackingUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; display: inline-block;">View Ticket Status</a>
                    </div>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">${companySettings?.legalName || 'Flowdesk CRM'} Support</p>
                  </div>
                `,
              });
            }
          } catch (mailErr) {
            console.error('[SupportPortal] Failed sending ticket confirmation email:', mailErr);
          }

          return {
            success: true,
            ticketNumber: ticket.number,
            publicToken,
          };
        }
      );

      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ==========================================
// 2. READ TICKET STATUS VIA PUBLIC TOKEN
// ==========================================
supportPortalRouter.get('/ticket/:publicToken', portalViewLimiter, async (req: Request, res: Response) => {
  try {
    const { publicToken } = req.params;

    // Search across tenants by unique publicToken
    const ticket = await runWithTenantContext({ isBypassTenant: true }, async () => {
      return Ticket.findOne({ publicToken })
        .populate('contact', 'name email')
        .lean();
    });

    if (!ticket) {
      res.status(404).json({ message: 'Ticket not found or link has expired.' });
      return;
    }

    const tenantId = (ticket as any).tenantId.toString();

    // Fetch messages inside tenant context (EXCLUDE internal notes!)
    const messages = await runWithTenantContext({ tenantId }, async () => {
      return TicketMessage.find({
        ticket: ticket._id,
        type: { $ne: 'internal_note' }, // Strictly no internal notes
      })
        .populate('author', 'name')
        .sort({ createdAt: 1 })
        .lean();
    });

    // Fetch company name for branding
    const companySettings = await runWithTenantContext({ tenantId }, async () => {
      return CompanySettings.findOne().lean();
    });

    res.json({
      ticket: {
        number: ticket.number,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        contactName: (ticket.contact as any)?.name || 'Customer',
      },
      messages: messages.map((m) => ({
        _id: m._id,
        body: m.body,
        isAgent: !!m.author,
        authorName: (m.author as any)?.name || 'Support Agent',
        createdAt: m.createdAt,
        attachments: m.attachments,
      })),
      companyName: companySettings?.legalName || 'Customer Support',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 3. CUSTOMER REPLY TO TICKET VIA PUBLIC TOKEN
// ==========================================
const customerReplySchema = z.object({
  body: z.string().trim().min(1, 'Message body cannot be empty'),
});

supportPortalRouter.post(
  '/ticket/:publicToken/reply',
  portalSubmitLimiter,
  validateBody(customerReplySchema),
  async (req: Request, res: Response) => {
    try {
      const { publicToken } = req.params;
      const { body } = req.body;

      const ticket = await runWithTenantContext({ isBypassTenant: true }, async () => {
        return Ticket.findOne({ publicToken });
      });

      if (!ticket) {
        res.status(404).json({ message: 'Ticket not found or link has expired.' });
        return;
      }

      const tenantId = ticket.tenantId.toString();

      await runWithTenantContext({ tenantId }, async () => {
        // Create customer message
        const message = await TicketMessage.create({
          ticket: ticket._id,
          author: null,
          type: 'public_reply',
          body: body.trim(),
        });

        // If ticket was resolved/closed, reopen
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          ticket.status = 'open';
          ticket.resolvedAt = undefined;
        }

        ticket.updatedAt = new Date();
        await ticket.save();

        // Notify assignee if assigned
        if (ticket.assignee) {
          await sendNotification({
            userId: ticket.assignee.toString(),
            type: 'ticket_assigned',
            title: `Customer replied on ${ticket.number}`,
            body: `New message on ticket "${ticket.subject}"`,
            link: `/tickets/${ticket._id}`,
            entityType: 'ticket',
            entityId: ticket._id.toString(),
          });
        }
      });

      res.status(201).json({ success: true, message: 'Reply sent successfully.' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);
