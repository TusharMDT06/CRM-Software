import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import { Quote, IQuote } from '../models/Quote.js';
import { Invoice } from '../models/Invoice.js';
import { Deal } from '../models/Deal.js';
import { Account } from '../models/Account.js';
import { Contact } from '../models/Contact.js';
import { CompanySettings, getCompanySettings } from '../models/CompanySettings.js';
import { getNextDocumentNumber } from '../models/Counter.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  createQuoteSchema,
  updateQuoteSchema,
  quoteApprovalResponseSchema,
} from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter, parseSort } from '../utils/queryHelper.js';
import { calculateDocumentTotals, paiseToRupees } from '../utils/moneyHelper.js';
import { generateDocumentPDF } from '../utils/pdfGenerator.js';
import { logActivity } from '../utils/activityHelper.js';
import { eventBus } from '../utils/eventBus.js';

export const quotesRouter = Router();

// Public Rate Limiter for public quote endpoints
const publicQuoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Too many requests. Please try again later.' },
});

// Helper to assemble query with owner scoping
function buildQuoteQuery(user: any, queryParams: any): FilterQuery<any> {
  const query: FilterQuery<any> = {
    ...buildOwnerFilter(user, queryParams.owner as string),
  };

  if (queryParams.status) {
    query.status = queryParams.status;
  }
  if (queryParams.deal) {
    query.deal = queryParams.deal;
  }
  if (queryParams.account) {
    query.account = queryParams.account;
  }
  if (queryParams.contact) {
    query.contact = queryParams.contact;
  }

  if (queryParams.q) {
    const q = String(queryParams.q).trim();
    query.$or = [
      { number: { $regex: q, $options: 'i' } },
      { notes: { $regex: q, $options: 'i' } },
    ];
  }

  return query;
}

// ================= PUBLIC ROUTES (NO AUTH) =================

// GET /quotes/public/:publicToken
quotesRouter.get('/public/:publicToken', publicQuoteLimiter, async (req, res: Response) => {
  try {
    const { publicToken } = req.params;
    const quote = await Quote.findOne({ publicToken })
      .populate('account', 'name industry city state gstin')
      .populate('contact', 'firstName lastName email phone')
      .populate('deal', 'title amount')
      .populate('owner', 'name email');

    if (!quote) {
      res.status(404).json({ message: 'Quote not found or invalid link' });
      return;
    }

    const company = await getCompanySettings();

    // Check expiry
    const now = new Date();
    if (
      quote.status !== 'accepted' &&
      quote.status !== 'declined' &&
      new Date(quote.validUntil) < now &&
      quote.status !== 'expired'
    ) {
      quote.status = 'expired';
      await quote.save();
    }

    // If first time viewed by recipient (status was 'sent'), mark as 'viewed'
    if (quote.status === 'sent') {
      quote.status = 'viewed';
      quote.viewedAt = new Date();
      await quote.save();

      // Log activity
      await logActivity({
        type: 'meeting', // system event indicator
        subject: `Quote ${quote.number} viewed by client`,
        body: `Client opened quote ${quote.number} online.`,
        entityType: 'deal',
        entityId: quote.deal._id,
        createdBy: quote.owner._id,
      });

      // Emit event for workflows and notifications
      eventBus.emit('quote_viewed', {
        quoteId: quote._id,
        quoteNumber: quote.number,
        ownerId: (quote.owner as any)._id,
        dealId: (quote.deal as any)._id,
        accountId: (quote.account as any)._id,
        total: quote.total,
      });
    }

    res.json({
      quote: {
        _id: quote._id,
        number: quote.number,
        status: quote.status,
        items: quote.items,
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        taxTotal: quote.taxTotal,
        cgstTotal: quote.cgstTotal,
        sgstTotal: quote.sgstTotal,
        igstTotal: quote.igstTotal,
        total: quote.total,
        taxMode: quote.taxMode,
        validUntil: quote.validUntil,
        notes: quote.notes,
        terms: quote.terms,
        account: quote.account,
        contact: quote.contact,
        deal: quote.deal,
        owner: {
          name: (quote.owner as any)?.name,
          email: (quote.owner as any)?.email,
        },
        viewedAt: quote.viewedAt,
        respondedAt: quote.respondedAt,
        responseReason: quote.responseReason,
      },
      company: {
        legalName: company.legalName,
        address: company.address,
        state: company.state,
        gstin: company.gstin,
        email: company.email,
        phone: company.phone,
        bankDetails: company.bankDetails,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to load public quote' });
  }
});

// GET /quotes/public/:publicToken/pdf
quotesRouter.get('/public/:publicToken/pdf', publicQuoteLimiter, async (req, res: Response) => {
  try {
    const { publicToken } = req.params;
    const quote = await Quote.findOne({ publicToken })
      .populate('account')
      .populate('contact')
      .populate('deal')
      .populate('owner');

    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    const company = await getCompanySettings();
    const pdfBuffer = await generateDocumentPDF({ type: 'quote', doc: quote, company });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate PDF' });
  }
});

// POST /quotes/public/:publicToken/respond (Accept or Decline)
quotesRouter.post(['/public/:publicToken/respond', '/public/:publicToken/action'], publicQuoteLimiter, async (req, res: Response) => {
  try {
    const { publicToken } = req.params;
    const { action, reason } = req.body;

    if (!['accept', 'decline'].includes(action)) {
      res.status(400).json({ message: 'Invalid action. Must be "accept" or "decline"' });
      return;
    }

    const quote = await Quote.findOne({ publicToken })
      .populate('deal')
      .populate('account')
      .populate('contact')
      .populate('owner');

    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    if (quote.status === 'accepted' || quote.status === 'declined') {
      res.status(400).json({ message: `This quote has already been ${quote.status}` });
      return;
    }

    if (quote.status === 'expired' || new Date(quote.validUntil) < new Date()) {
      res.status(400).json({ message: 'This quote has expired and cannot be accepted' });
      return;
    }

    quote.status = action === 'accept' ? 'accepted' : 'declined';
    quote.respondedAt = new Date();
    if (action === 'decline' && reason) {
      quote.responseReason = String(reason).trim();
    }
    await quote.save();

    const eventName = action === 'accept' ? 'quote_accepted' : 'quote_declined';

    // Log timeline activity
    await logActivity({
      type: 'note',
      subject: `Quote ${quote.number} ${action === 'accept' ? 'Accepted' : 'Declined'} by Client`,
      body:
        action === 'accept'
          ? `Client formally accepted quote ${quote.number} (Total: ₹${paiseToRupees(quote.total).toLocaleString('en-IN')}).`
          : `Client declined quote ${quote.number}. Reason: ${quote.responseReason || 'None provided'}.`,
      entityType: 'deal',
      entityId: quote.deal._id,
      createdBy: quote.owner._id,
    });

    // Emit event for notifications and automations
    eventBus.emit(eventName, {
      quoteId: quote._id,
      quoteNumber: quote.number,
      ownerId: (quote.owner as any)._id,
      dealId: (quote.deal as any)._id,
      accountId: (quote.account as any)._id,
      total: quote.total,
      reason: quote.responseReason,
    });

    res.json({
      message: `Quote successfully ${quote.status}`,
      status: quote.status,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to submit response' });
  }
});

// ================= AUTHENTICATED ROUTES =================

quotesRouter.use(authenticate);

// GET /quotes
quotesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const query = buildQuoteQuery(user, req.query);
    const sort = parseSort(req.query.sort as string) || { createdAt: -1 };

    const [data, total] = await Promise.all([
      Quote.find(query)
        .populate('deal', 'title amount stage')
        .populate('account', 'name industry city state')
        .populate('contact', 'firstName lastName email phone')
        .populate('owner', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Quote.countDocuments(query),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch quotes' });
  }
});

// GET /quotes/:id
quotesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const quote = await Quote.findById(req.params.id)
      .populate('deal')
      .populate('account')
      .populate('contact')
      .populate('owner', 'name email role')
      .populate('approval.respondedBy', 'name email role');

    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    if (user.role === 'sales' && String(quote.owner._id) !== String(user._id)) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    res.json(quote);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch quote' });
  }
});

// POST /quotes
quotesRouter.post('/', validateBody(createQuoteSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { items, taxMode, validUntil, ...body } = req.body;

    const company = await getCompanySettings();

    // Compute lines and totals on the server (Money Rule)
    const totals = calculateDocumentTotals(items, taxMode);

    // Document numbering from atomic Counter
    const number = await getNextDocumentNumber(company.quotePrefix || 'QT');

    const quote = await Quote.create({
      ...body,
      number,
      taxMode,
      items: totals.items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      total: totals.total,
      validUntil: new Date(validUntil),
      terms: body.terms || company.defaultTerms,
      approval: {
        required: totals.requiresApproval,
        status: 'pending',
      },
      owner: user.role === 'sales' ? user._id : body.owner || user._id,
    });

    await quote.populate([
      { path: 'deal' },
      { path: 'account' },
      { path: 'contact' },
      { path: 'owner', select: 'name email role' },
    ]);

    // Log timeline activity
    await logActivity({
      type: 'note',
      subject: `Quote Created: ${quote.number}`,
      body: `Quote ${quote.number} generated for total amount ₹${paiseToRupees(quote.total).toLocaleString('en-IN')}.`,
      entityType: 'deal',
      entityId: quote.deal._id,
      createdBy: user._id,
    });

    res.status(201).json(quote);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create quote' });
  }
});

// PATCH /quotes/:id
quotesRouter.patch('/:id', validateBody(updateQuoteSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    if (user.role === 'sales' && String(quote.owner) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden: You can only edit quotes you own' });
      return;
    }

    if (['accepted', 'declined'].includes(quote.status)) {
      res.status(400).json({ message: `Cannot edit quote that has already been ${quote.status}` });
      return;
    }

    // Recompute totals if items or taxMode changed
    const itemsToCompute = req.body.items || quote.items;
    const modeToCompute = req.body.taxMode || quote.taxMode;
    const totals = calculateDocumentTotals(itemsToCompute, modeToCompute);

    Object.assign(quote, req.body);
    quote.items = totals.items as any;
    quote.subtotal = totals.subtotal;
    quote.discountTotal = totals.discountTotal;
    quote.taxTotal = totals.taxTotal;
    quote.cgstTotal = totals.cgstTotal;
    quote.sgstTotal = totals.sgstTotal;
    quote.igstTotal = totals.igstTotal;
    quote.total = totals.total;
    quote.taxMode = modeToCompute;

    // Reset approval if financials changed
    if (totals.requiresApproval) {
      quote.approval = {
        required: true,
        status: 'pending',
      };
      if (quote.status === 'sent') {
        quote.status = 'pending_approval';
      }
    } else {
      quote.approval = {
        required: false,
        status: 'approved',
      };
    }

    await quote.save();
    await quote.populate([
      { path: 'deal' },
      { path: 'account' },
      { path: 'contact' },
      { path: 'owner', select: 'name email role' },
    ]);

    res.json(quote);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update quote' });
  }
});

// DELETE /quotes/:id
quotesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    if (user.role === 'sales' && String(quote.owner) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (quote.status !== 'draft') {
      res.status(400).json({ message: 'Only draft quotes can be deleted. Cancel or void instead.' });
      return;
    }

    await quote.deleteOne();
    res.json({ message: 'Quote deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete quote' });
  }
});

// POST /quotes/:id/approve (Manager / Admin)
quotesRouter.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'sales') {
      res.status(403).json({ message: 'Only managers and admins can approve quotes' });
      return;
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    quote.approval = {
      required: true,
      status: 'approved',
      respondedBy: user._id,
      respondedAt: new Date(),
      reason: req.body.reason || 'Approved by management',
    };

    if (quote.status === 'pending_approval') {
      quote.status = 'draft'; // ready to send
    }

    await quote.save();

    // Log activity
    await logActivity({
      type: 'note',
      subject: `Quote ${quote.number} Approved`,
      body: `Approved by ${user.name} (${user.role}).`,
      entityType: 'deal',
      entityId: quote.deal,
      createdBy: user._id,
    });

    eventBus.emit('quote_approved', {
      quoteId: quote._id,
      quoteNumber: quote.number,
      ownerId: quote.owner,
      approvedBy: user._id,
    });

    res.json({ message: 'Quote approved successfully', quote });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to approve quote' });
  }
});

// POST /quotes/:id/reject (Manager / Admin)
quotesRouter.post('/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'sales') {
      res.status(403).json({ message: 'Only managers and admins can reject quotes' });
      return;
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      res.status(400).json({ message: 'A rejection reason is required' });
      return;
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    quote.approval = {
      required: true,
      status: 'rejected',
      respondedBy: user._id,
      respondedAt: new Date(),
      reason: reason.trim(),
    };
    quote.status = 'draft';

    await quote.save();

    // Log activity
    await logActivity({
      type: 'note',
      subject: `Quote ${quote.number} Rejected`,
      body: `Rejected by ${user.name}: ${reason.trim()}`,
      entityType: 'deal',
      entityId: quote.deal,
      createdBy: user._id,
    });

    eventBus.emit('quote_rejected', {
      quoteId: quote._id,
      quoteNumber: quote.number,
      ownerId: quote.owner,
      rejectedBy: user._id,
      reason: reason.trim(),
    });

    res.json({ message: 'Quote rejected', quote });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to reject quote' });
  }
});

// POST /quotes/:id/send
quotesRouter.post('/:id/send', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const quote = await Quote.findById(req.params.id)
      .populate('deal')
      .populate('account')
      .populate('contact')
      .populate('owner');

    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    if (user.role === 'sales' && String((quote.owner as any)._id) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden: You can only send quotes you own' });
      return;
    }

    const company = await getCompanySettings();

    // Approval checks:
    // If discount > 15% or total > 10,00,000 paise and quote is not yet approved
    const totals = calculateDocumentTotals(quote.items, quote.taxMode);
    if (totals.requiresApproval && quote.approval?.status !== 'approved') {
      if (user.role === 'sales') {
        quote.status = 'pending_approval';
        quote.approval = {
          required: true,
          status: 'pending',
          requestedAt: new Date(),
          reason: totals.approvalReasons.join('; '),
        };
        await quote.save();

        // Emit event to notify managers
        eventBus.emit('quote_needs_approval', {
          quoteId: quote._id,
          quoteNumber: quote.number,
          ownerId: (quote.owner as any)._id,
          ownerName: (quote.owner as any).name,
          total: quote.total,
          reasons: totals.approvalReasons,
        });

        res.status(200).json({
          status: 'pending_approval',
          message: 'Quote requires management approval before it can be sent to client',
          reasons: totals.approvalReasons,
          quote,
        });
        return;
      }
      // If manager or admin sends, it auto-approves
      quote.approval = {
        required: true,
        status: 'approved',
        respondedBy: user._id,
        respondedAt: new Date(),
        reason: 'Authorized directly by ' + user.name,
      };
    }

    // Generate PDF Buffer
    const pdfBuffer = await generateDocumentPDF({ type: 'quote', doc: quote, company });

    // Client public URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const publicUrl = `${clientUrl}/q/${quote.publicToken}`;

    const recipientEmail = (quote.contact as any)?.email;
    const recipientName = `${(quote.contact as any)?.firstName} ${(quote.contact as any)?.lastName || ''}`.trim();

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'Flowdesk <onboarding@resend.dev>';

    // Resend fallback if key not configured
    if (!resendApiKey) {
      quote.status = 'sent';
      quote.sentAt = new Date();
      await quote.save();

      const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
        `Quotation ${quote.number} from ${company.legalName}`
      )}&body=${encodeURIComponent(
        `Dear ${recipientName},\n\nPlease review your quotation ${quote.number} for ₹${paiseToRupees(
          quote.total
        ).toLocaleString('en-IN')}.\n\nView online: ${publicUrl}\n\nBest regards,\n${user.name}`
      )}`;

      res.status(503).json({
        message: 'Resend API key is not configured. Quote marked as sent with mailto link provided.',
        mailtoUrl,
        publicUrl,
        quote,
      });
      return;
    }

    // Send email with PDF attachment via Resend SDK
    const resend = new Resend(resendApiKey);
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: emailFrom,
      to: [recipientEmail],
      subject: `Quotation ${quote.number} from ${company.legalName}`,
      html: `
        <div style="font-family: sans-serif; color: #111; max-width: 600px; line-height: 1.5;">
          <h2>Quotation ${quote.number}</h2>
          <p>Dear ${recipientName},</p>
          <p>Please find attached our quotation <strong>${quote.number}</strong> for a total amount of <strong>₹${paiseToRupees(quote.total).toLocaleString('en-IN')}</strong>.</p>
          <p>You can also view, download, or accept the quotation online at the link below:</p>
          <p style="margin: 24px 0;">
            <a href="${publicUrl}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              View Quotation Online
            </a>
          </p>
          <p>Valid until: <strong>${new Date(quote.validUntil).toLocaleDateString('en-IN')}</strong></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #666;">${company.legalName} &bull; ${company.phone || ''}</p>
        </div>
      `,
      text: `Dear ${recipientName},\n\nPlease review quotation ${quote.number} for ₹${paiseToRupees(quote.total).toLocaleString('en-IN')}.\n\nView and accept online: ${publicUrl}\n\nValid until: ${new Date(quote.validUntil).toLocaleDateString('en-IN')}\n\nBest regards,\n${company.legalName}`,
      replyTo: user.email,
      attachments: [
        {
          filename: `${quote.number}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (resendError) {
      let statusCode = 502;
      const errMsg = resendError.message || 'Email delivery failed';
      if (/invalid.*(email|recipient|domain|from|to)/i.test(errMsg)) statusCode = 400;
      else if (/rate.*limit/i.test(errMsg)) statusCode = 429;
      res.status(statusCode).json({ message: errMsg.replace(/re_[a-zA-Z0-9_-]+/g, '[REDACTED]') });
      return;
    }

    quote.status = 'sent';
    quote.sentAt = new Date();
    await quote.save();

    // Log timeline activity
    await logActivity({
      type: 'email',
      subject: `Quote Sent: ${quote.number}`,
      body: `Quotation sent to ${recipientEmail} with PDF attachment. (Resend ID: ${resendData?.id || '-'})`,
      entityType: 'deal',
      entityId: quote.deal._id,
      createdBy: user._id,
      messageId: resendData?.id,
    });

    eventBus.emit('quote_sent', {
      quoteId: quote._id,
      quoteNumber: quote.number,
      ownerId: (quote.owner as any)._id,
      recipientEmail,
    });

    res.json({
      message: 'Quote sent successfully',
      publicUrl,
      quote,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to send quote' });
  }
});

// GET /quotes/:id/pdf (Authenticated user download)
quotesRouter.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const quote = await Quote.findById(req.params.id)
      .populate('account')
      .populate('contact')
      .populate('deal')
      .populate('owner');

    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    if (user.role === 'sales' && String((quote.owner as any)._id) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const company = await getCompanySettings();
    const pdfBuffer = await generateDocumentPDF({ type: 'quote', doc: quote, company });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate PDF' });
  }
});

// POST /quotes/:id/convert-to-invoice
quotesRouter.post('/:id/convert-to-invoice', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { moveDealToWon = true } = req.body;

    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      res.status(404).json({ message: 'Quote not found' });
      return;
    }

    if (quote.status !== 'accepted') {
      res.status(400).json({ message: 'Only accepted quotes can be converted into an invoice' });
      return;
    }

    if (quote.invoiceCreated) {
      res.status(400).json({ message: 'An invoice has already been created for this quote' });
      return;
    }

    const company = await getCompanySettings();
    const invNumber = await getNextDocumentNumber(company.invoicePrefix || 'INV');

    // Due date = issue date + company defaultPaymentTermsDays
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (company.defaultPaymentTermsDays || 30));

    const invoice = await Invoice.create({
      number: invNumber,
      status: 'draft',
      quote: quote._id,
      deal: quote.deal,
      account: quote.account,
      contact: quote.contact,
      items: quote.items,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      cgstTotal: quote.cgstTotal,
      sgstTotal: quote.sgstTotal,
      igstTotal: quote.igstTotal,
      total: quote.total,
      paidTotal: 0,
      balance: quote.total,
      taxMode: quote.taxMode,
      issueDate,
      dueDate,
      notes: quote.notes,
      terms: quote.terms,
      owner: quote.owner,
    });

    quote.invoiceCreated = invoice._id;
    await quote.save();

    // Optionally update deal to won
    if (moveDealToWon && quote.deal) {
      const deal = await Deal.findById(quote.deal);
      if (deal && deal.stage !== 'won') {
        deal.stage = 'won';
        deal.closedAt = new Date();
        await deal.save();

        await logActivity({
          type: 'note',
          subject: `Deal Won: ${deal.title}`,
          body: `Deal marked Won upon invoice ${invoice.number} creation from accepted quote ${quote.number}.`,
          entityType: 'deal',
          entityId: deal._id,
          createdBy: user._id,
        });

        eventBus.emit('deal_won', {
          dealId: deal._id,
          dealTitle: deal.title,
          amount: deal.amount,
          ownerId: deal.owner,
        });
      }
    }

    // Log timeline activity
    await logActivity({
      type: 'note',
      subject: `Invoice Created: ${invoice.number}`,
      body: `Invoice ${invoice.number} created from accepted quote ${quote.number}.`,
      entityType: 'deal',
      entityId: quote.deal,
      createdBy: user._id,
    });

    await invoice.populate([
      { path: 'deal' },
      { path: 'account' },
      { path: 'contact' },
      { path: 'owner', select: 'name email role' },
    ]);

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to convert quote to invoice' });
  }
});
