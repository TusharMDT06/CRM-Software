import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Resend } from 'resend';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { CompanySettings, getCompanySettings } from '../models/CompanySettings.js';
import { getNextDocumentNumber } from '../models/Counter.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { requireWithinRecordLimit } from '../middleware/planLimits.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
  createPaymentSchema,
} from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter, parseSort } from '../utils/queryHelper.js';
import { calculateDocumentTotals, paiseToRupees } from '../utils/moneyHelper.js';
import { generateDocumentPDF } from '../utils/pdfGenerator.js';
import { logActivity } from '../utils/activityHelper.js';
import { eventBus } from '../utils/eventBus.js';
import {
  autoGenerateMissingInvoicesForAllAccounts,
  generateInvoiceForAccount,
} from '../utils/autoInvoiceHelper.js';

export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

function buildInvoiceQuery(user: any, queryParams: any): FilterQuery<any> {
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

// GET /invoices
invoicesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const query = buildInvoiceQuery(user, req.query);
    const sort = parseSort(req.query.sort as string) || { createdAt: -1 };

    const [data, total] = await Promise.all([
      Invoice.find(query)
        .populate('deal', 'title amount stage')
        .populate('account', 'name industry city state')
        .populate('contact', 'firstName lastName email phone')
        .populate('owner', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query),
    ]);

    // Financial Metrics Summary (All matching scoped records)
    const allMatching = await Invoice.find(query, {
      status: 1,
      total: 1,
      paidTotal: 1,
      balance: 1,
      dueDate: 1,
    });

    const now = new Date();
    let totalOutstandingPaise = 0;
    let totalOverduePaise = 0;
    let totalCollectedPaise = 0;
    let overdueCount = 0;

    allMatching.forEach((inv) => {
      if (inv.status !== 'void') {
        totalCollectedPaise += inv.paidTotal || 0;
        if (inv.status !== 'paid') {
          totalOutstandingPaise += inv.balance || 0;
          if (inv.status === 'overdue' || (new Date(inv.dueDate) < now && inv.balance > 0)) {
            totalOverduePaise += inv.balance || 0;
            overdueCount++;
          }
        }
      }
    });

    const totalOutstanding = paiseToRupees(totalOutstandingPaise);
    const totalOverdue = paiseToRupees(totalOverduePaise);
    const totalCollected = paiseToRupees(totalCollectedPaise);

    res.json({
      data,
      summary: {
        totalOutstanding,
        totalOverdue,
        totalCollected,
        totalOutstandingPaise,
        totalOverduePaise,
        totalCollectedPaise,
        overdueCount,
        countOverdue: overdueCount,
        totalInvoices: total,
      },
      meta: {
        summary: {
          totalOutstanding,
          totalOverdue,
          countOverdue: overdueCount,
          totalInvoices: total,
        },
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch invoices' });
  }
});

// POST /invoices/auto-generate-all
invoicesRouter.post('/auto-generate-all', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const result = await autoGenerateMissingInvoicesForAllAccounts(user.tenantId, user._id);
    res.json({
      message: `Successfully generated original invoices for ${result.count} companies.`,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to auto-generate invoices' });
  }
});

// GET /invoices/:id
invoicesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const invoice = await Invoice.findById(req.params.id)
      .populate('deal')
      .populate('account')
      .populate('contact')
      .populate('quote')
      .populate('owner', 'name email role');

    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    if (user.role === 'sales' && String((invoice.owner as any)._id) !== String(user._id)) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    const payments = await Payment.find({ invoice: invoice._id })
      .populate('recordedBy', 'name email role')
      .sort({ paidAt: -1 });

    res.json({
      ...invoice.toObject(),
      payments,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch invoice' });
  }
});

// POST /invoices
invoicesRouter.post('/', requireWithinRecordLimit, validateBody(createInvoiceSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { items, taxMode, dueDate, issueDate, ...body } = req.body;

    const company = await getCompanySettings();

    // Server-side calculation of line items and totals
    const totals = calculateDocumentTotals(items, taxMode);

    // Document numbering from atomic Counter
    const number = await getNextDocumentNumber(company.invoicePrefix || 'INV');

    const calculatedIssueDate = issueDate ? new Date(issueDate) : new Date();
    const calculatedDueDate = new Date(dueDate);

    const invoice = await Invoice.create({
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
      paidTotal: 0,
      balance: totals.total,
      issueDate: calculatedIssueDate,
      dueDate: calculatedDueDate,
      terms: body.terms || company.defaultTerms,
      owner: user.role === 'sales' ? user._id : body.owner || user._id,
    });

    await invoice.populate([
      { path: 'deal' },
      { path: 'account' },
      { path: 'contact' },
      { path: 'owner', select: 'name email role' },
    ]);

    // Log timeline activity
    await logActivity({
      type: 'note',
      subject: `Invoice Created: ${invoice.number}`,
      body: `Invoice ${invoice.number} generated for total amount ₹${paiseToRupees(invoice.total).toLocaleString('en-IN')}. Due on ${calculatedDueDate.toLocaleDateString('en-IN')}.`,
      entityType: 'deal',
      entityId: invoice.deal._id,
      createdBy: user._id,
    });

    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create invoice' });
  }
});

// PATCH /invoices/:id
invoicesRouter.patch('/:id', validateBody(updateInvoiceSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    if (user.role === 'sales' && String(invoice.owner) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden: You can only edit invoices you own' });
      return;
    }

    if (invoice.status !== 'draft') {
      res.status(400).json({ message: `Cannot modify invoice with status "${invoice.status}". Only draft invoices can be edited.` });
      return;
    }

    // Recompute totals if items or taxMode changed
    const itemsToCompute = req.body.items || invoice.items;
    const modeToCompute = req.body.taxMode || invoice.taxMode;
    const totals = calculateDocumentTotals(itemsToCompute, modeToCompute);

    Object.assign(invoice, req.body);
    invoice.items = totals.items as any;
    invoice.subtotal = totals.subtotal;
    invoice.discountTotal = totals.discountTotal;
    invoice.taxTotal = totals.taxTotal;
    invoice.cgstTotal = totals.cgstTotal;
    invoice.sgstTotal = totals.sgstTotal;
    invoice.igstTotal = totals.igstTotal;
    invoice.total = totals.total;
    invoice.balance = totals.total - invoice.paidTotal;
    invoice.taxMode = modeToCompute;

    await invoice.save();
    await invoice.populate([
      { path: 'deal' },
      { path: 'account' },
      { path: 'contact' },
      { path: 'owner', select: 'name email role' },
    ]);

    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update invoice' });
  }
});

// POST /invoices/:id/void (Admin & Manager only)
invoicesRouter.post('/:id/void', requireRole('admin', 'manager'), validateBody(voidInvoiceSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { reason } = req.body;
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    if (invoice.status === 'void') {
      res.status(400).json({ message: 'Invoice is already void' });
      return;
    }

    if (invoice.paidTotal > 0) {
      res.status(400).json({ message: 'Cannot void an invoice that has payments recorded against it. Remove payments first.' });
      return;
    }

    invoice.status = 'void';
    invoice.voidedAt = new Date();
    invoice.voidReason = reason.trim();
    await invoice.save();

    // Log timeline activity
    await logActivity({
      type: 'note',
      subject: `Invoice ${invoice.number} Voided`,
      body: `Voided by ${user.name} (${user.role}). Reason: ${reason.trim()}`,
      entityType: 'deal',
      entityId: invoice.deal,
      createdBy: user._id,
    });

    res.json({ message: 'Invoice voided successfully', invoice });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to void invoice' });
  }
});

// POST /invoices/:id/send
invoicesRouter.post('/:id/send', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const invoice = await Invoice.findById(req.params.id)
      .populate('deal')
      .populate('account')
      .populate('contact')
      .populate('owner');

    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    if (user.role === 'sales' && String((invoice.owner as any)._id) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (invoice.status === 'void') {
      res.status(400).json({ message: 'Cannot send a void invoice' });
      return;
    }

    const company = await getCompanySettings();
    const pdfBuffer = await generateDocumentPDF({ type: 'invoice', doc: invoice, company });

    const recipientEmail = (invoice.contact as any)?.email;
    const recipientName = `${(invoice.contact as any)?.firstName} ${(invoice.contact as any)?.lastName || ''}`.trim();

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'Flowdesk <onboarding@resend.dev>';

    if (!resendApiKey) {
      if (invoice.status === 'draft') {
        invoice.status = 'sent';
        invoice.sentAt = new Date();
        await invoice.save();
      }

      const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
        `Invoice ${invoice.number} from ${company.legalName}`
      )}&body=${encodeURIComponent(
        `Dear ${recipientName},\n\nPlease find attached tax invoice ${invoice.number} for ₹${paiseToRupees(
          invoice.total
        ).toLocaleString('en-IN')}.\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString(
          'en-IN'
        )}.\n\nBest regards,\n${user.name}`
      )}`;

      res.status(503).json({
        message: 'Resend API key is not configured. Invoice marked as sent with mailto link provided.',
        mailtoUrl,
        invoice,
      });
      return;
    }

    const resend = new Resend(resendApiKey);
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: emailFrom,
      to: [recipientEmail],
      subject: `Tax Invoice ${invoice.number} from ${company.legalName}`,
      html: `
        <div style="font-family: sans-serif; color: #111; max-width: 600px; line-height: 1.5;">
          <h2>Tax Invoice ${invoice.number}</h2>
          <p>Dear ${recipientName},</p>
          <p>Please find attached tax invoice <strong>${invoice.number}</strong> for a total amount of <strong>₹${paiseToRupees(invoice.total).toLocaleString('en-IN')}</strong>.</p>
          <p>Payment Due Date: <strong>${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</strong></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
          <p><strong>Bank Details for NEFT / RTGS:</strong><br />
          Bank: ${company.bankDetails?.bankName || '-'}<br />
          A/C Name: ${company.bankDetails?.accountName || company.legalName}<br />
          A/C Number: ${company.bankDetails?.accountNumber || '-'}<br />
          IFSC: ${company.bankDetails?.ifsc || '-'}</p>
        </div>
      `,
      text: `Dear ${recipientName},\n\nPlease find attached tax invoice ${invoice.number} for ₹${paiseToRupees(invoice.total).toLocaleString('en-IN')}.\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}.\n\nBest regards,\n${company.legalName}`,
      replyTo: user.email,
      attachments: [
        {
          filename: `${invoice.number}.pdf`,
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

    if (invoice.status === 'draft') {
      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();
    }

    // Log activity
    await logActivity({
      type: 'email',
      subject: `Invoice Sent: ${invoice.number}`,
      body: `Tax invoice dispatched to ${recipientEmail} with PDF. (Resend ID: ${resendData?.id || '-'})`,
      entityType: 'deal',
      entityId: invoice.deal._id,
      createdBy: user._id,
      messageId: resendData?.id,
    });

    res.json({ message: 'Invoice sent successfully', invoice });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to send invoice' });
  }
});

// GET /invoices/:id/pdf
invoicesRouter.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const invoice = await Invoice.findById(req.params.id)
      .populate('account')
      .populate('contact')
      .populate('deal')
      .populate('owner');

    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    if (user.role === 'sales' && String((invoice.owner as any)._id) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const company = await getCompanySettings();
    const pdfBuffer = await generateDocumentPDF({ type: 'invoice', doc: invoice, company });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate PDF' });
  }
});

// ================= PAYMENT ROUTES =================

// POST /invoices/:id/payments
invoicesRouter.post('/:id/payments', validateBody(createPaymentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { amount, method, reference, paidAt, notes } = req.body;

    const invoice = await Invoice.findById(req.params.id).populate('deal').populate('owner');
    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    if (user.role === 'sales' && String((invoice.owner as any)._id) !== String(user._id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (invoice.status === 'void') {
      res.status(400).json({ message: 'Cannot record payment on a void invoice' });
      return;
    }

    if (amount > invoice.balance) {
      res.status(400).json({
        message: `Payment amount (₹${paiseToRupees(amount)}) cannot exceed invoice balance (₹${paiseToRupees(invoice.balance)})`,
      });
      return;
    }

    // Create payment
    const payment = await Payment.create({
      invoice: invoice._id,
      amount,
      method,
      reference,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      notes,
      recordedBy: user._id,
    });

    // Update invoice paidTotal and balance
    invoice.paidTotal = (invoice.paidTotal || 0) + amount;
    invoice.balance = invoice.total - invoice.paidTotal;

    const previousStatus = invoice.status;
    if (invoice.balance === 0) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partially_paid';
    }

    await invoice.save();

    // Log timeline activity
    await logActivity({
      type: 'note',
      subject: `Payment Recorded: ₹${paiseToRupees(amount).toLocaleString('en-IN')}`,
      body: `Payment of ₹${paiseToRupees(amount).toLocaleString('en-IN')} via ${method} recorded for Invoice ${invoice.number}. Balance: ₹${paiseToRupees(invoice.balance).toLocaleString('en-IN')}. Ref: ${reference || '-'}`,
      entityType: 'deal',
      entityId: (invoice.deal as any)._id,
      createdBy: user._id,
    });

    // Emit payment events
    eventBus.emit('payment_recorded', {
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      paymentId: payment._id,
      amount,
      balance: invoice.balance,
      ownerId: (invoice.owner as any)._id,
      recordedBy: user._id,
    });

    if (invoice.status === 'paid' && previousStatus !== 'paid') {
      eventBus.emit('invoice_paid', {
        invoiceId: invoice._id,
        invoiceNumber: invoice.number,
        total: invoice.total,
        ownerId: (invoice.owner as any)._id,
        dealId: (invoice.deal as any)._id,
      });
    }

    await payment.populate('recordedBy', 'name email role');

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment,
      invoice,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to record payment' });
  }
});

// DELETE /invoices/:id/payments/:paymentId (Admin only)
invoicesRouter.delete('/:id/payments/:paymentId', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id, paymentId } = req.params;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    const payment = await Payment.findOne({ _id: paymentId, invoice: invoice._id });
    if (!payment) {
      res.status(404).json({ message: 'Payment record not found' });
      return;
    }

    await payment.deleteOne();

    // Recompute invoice paidTotal and balance from remaining payments
    const remainingPayments = await Payment.find({ invoice: invoice._id });
    const newPaidTotal = remainingPayments.reduce((sum, p) => sum + p.amount, 0);

    invoice.paidTotal = newPaidTotal;
    invoice.balance = invoice.total - newPaidTotal;

    const now = new Date();
    if (newPaidTotal === 0) {
      invoice.status = new Date(invoice.dueDate) < now ? 'overdue' : 'sent';
    } else if (invoice.balance === 0) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partially_paid';
    }

    await invoice.save();

    // Log timeline activity
    await logActivity({
      type: 'note',
      subject: `Payment Deleted: ₹${paiseToRupees(payment.amount).toLocaleString('en-IN')}`,
      body: `Payment of ₹${paiseToRupees(payment.amount).toLocaleString('en-IN')} removed by Admin ${user.name}. New balance: ₹${paiseToRupees(invoice.balance).toLocaleString('en-IN')}.`,
      entityType: 'deal',
      entityId: invoice.deal,
      createdBy: user._id,
    });

    res.json({
      message: 'Payment deleted and invoice recalculated successfully',
      invoice,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete payment' });
  }
});
