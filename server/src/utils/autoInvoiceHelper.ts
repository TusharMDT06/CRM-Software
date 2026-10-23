import { Types } from 'mongoose';
import { Account, IAccount } from '../models/Account.js';
import { Deal, IDeal } from '../models/Deal.js';
import { Contact, IContact } from '../models/Contact.js';
import { Product, IProduct } from '../models/Product.js';
import { Invoice, IInvoice, InvoiceStatus } from '../models/Invoice.js';
import { CompanySettings, getCompanySettings } from '../models/CompanySettings.js';
import { getNextDocumentNumber } from '../models/Counter.js';
import { calculateDocumentTotals } from './moneyHelper.js';
import { logActivity } from './activityHelper.js';
import { sendNotification } from './notificationService.js';

export interface AutoInvoiceOptions {
  accountId: Types.ObjectId | string;
  dealId?: Types.ObjectId | string;
  userId?: Types.ObjectId | string;
  status?: InvoiceStatus;
  notes?: string;
}

/**
 * Automatically generates a standard, GST-compliant Tax Invoice for a Company/Account
 */
export async function generateInvoiceForAccount(options: AutoInvoiceOptions): Promise<IInvoice> {
  const { accountId, dealId, userId, status = 'sent', notes } = options;

  const account = await Account.findById(accountId);
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const effectiveOwner = userId || account.owner;

  // 1. Locate or create a Deal for this Account
  let deal: IDeal | null = null;
  if (dealId) {
    deal = await Deal.findById(dealId);
  }
  if (!deal) {
    deal = await Deal.findOne({ account: account._id });
  }
  if (!deal) {
    deal = await Deal.create({
      title: `${account.name} - Enterprise Cloud Platform Rollout`,
      amount: 14160000, // ₹1,41,600
      stage: 'won',
      account: account._id,
      owner: effectiveOwner,
      closedAt: new Date(),
      tenantId: account.tenantId,
    });
  }

  // 2. Locate or create a Contact for this Account
  let contact: IContact | null = await Contact.findOne({ account: account._id });
  if (!contact) {
    const cleanDomain = account.website
      ? account.website.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim()
      : `${account.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

    contact = await Contact.create({
      firstName: 'Finance & Accounts',
      lastName: 'Desk',
      email: `billing@${cleanDomain}`,
      phone: account.phone || '+91 22 4000 1234',
      jobTitle: 'Accounts Payable Manager',
      account: account._id,
      owner: effectiveOwner,
      tenantId: account.tenantId,
    });
  }

  // 3. Determine Tax Mode (Intra-state CGST+SGST vs Inter-state IGST)
  const company = await getCompanySettings();
  const companyState = (company.state || 'Maharashtra').toLowerCase().trim();
  const accState = (account.city || '').toLowerCase().trim();
  const accGstin = account.custom?.gst_number || '';

  const isIntraState =
    accState.includes('mumbai') ||
    accState.includes('pune') ||
    accState.includes('maharashtra') ||
    accGstin.startsWith('27') ||
    companyState.includes(accState);

  const taxMode = isIntraState ? 'intra' : 'inter';

  // 4. Build realistic billable line items from products
  const products = await Product.find({ active: true }).limit(5);

  let rawItems: any[] = [];
  if (products.length > 0) {
    // Primary software tier
    const p1 = products[0];
    rawItems.push({
      product: p1._id,
      name: p1.name,
      description: p1.description || 'Enterprise platform subscription with priority multi-channel support.',
      qty: 1,
      unitPrice: p1.unitPrice || 12000000,
      discountPct: 0,
      taxRate: p1.taxRate || 18,
    });

    // Add implementation or support if available
    if (products.length > 2) {
      const p2 = products[2];
      rawItems.push({
        product: p2._id,
        name: p2.name,
        description: p2.description || 'Priority technical escalation support and compliance monitoring.',
        qty: 1,
        unitPrice: p2.unitPrice || 3000000,
        discountPct: 0,
        taxRate: p2.taxRate || 18,
      });
    }
  } else {
    // Fallback standard enterprise SaaS item
    rawItems.push({
      name: 'Flowdesk Enterprise Cloud CRM Suite (Annual License)',
      description: 'HSN/SAC 998313 - Complete automated sales, billing & analytics enterprise tier.',
      qty: 1,
      unitPrice: 12000000, // ₹1,20,000
      discountPct: 0,
      taxRate: 18,
    });
  }

  const totals = calculateDocumentTotals(rawItems, taxMode);

  // 5. Generate official document number
  const invoiceNumber = await getNextDocumentNumber('INV');

  // 6. Calculate dates
  const issueDate = new Date();
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days credit

  const paidTotal = status === 'paid' ? totals.total : 0;
  const balance = totals.total - paidTotal;

  const invoice = await Invoice.create({
    number: invoiceNumber,
    status,
    deal: deal._id,
    account: account._id,
    contact: contact._id,
    items: totals.lineDetails,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    total: totals.total,
    taxMode,
    issueDate,
    dueDate,
    paidTotal,
    balance,
    sentAt: status === 'sent' || status === 'paid' ? new Date() : undefined,
    notes: notes || `Original Tax Invoice auto-generated for ${account.name} (GST compliant).`,
    terms: company.defaultTerms || 'Payment due within 30 days of invoice date. All payments subject to standard commercial terms.',
    owner: effectiveOwner,
    tenantId: account.tenantId,
  });

  // 7. Log Activity on Account
  await logActivity({
    type: 'system',
    subject: `Tax Invoice ${invoice.number} Generated`,
    body: `Original Tax Invoice ${invoice.number} for ₹${(totals.total / 100).toLocaleString('en-IN')} automatically generated for company "${account.name}".`,
    entityType: 'account',
    entityId: account._id,
    createdBy: effectiveOwner,
  });

  // 8. Notification to Owner
  if (effectiveOwner) {
    sendNotification({
      userId: effectiveOwner,
      actorId: effectiveOwner,
      type: 'deal_assigned',
      title: `Invoice Generated: ${invoice.number}`,
      body: `Tax Invoice for ${account.name} generated successfully for ₹${(totals.total / 100).toLocaleString('en-IN')}`,
      link: `/invoices/${invoice._id}`,
      entityType: 'invoice',
      entityId: invoice._id.toString(),
    }).catch(() => {});
  }

  return invoice;
}

/**
 * Finds all accounts that currently have zero invoices and generates authentic invoices for each
 */
export async function autoGenerateMissingInvoicesForAllAccounts(
  tenantId?: Types.ObjectId | string,
  userId?: Types.ObjectId | string
): Promise<{ count: number; invoices: IInvoice[]; accountsChecked: number }> {
  const query: any = {};
  if (tenantId) {
    query.tenantId = tenantId;
  }

  const accounts = await Account.find(query);
  const createdInvoices: IInvoice[] = [];

  for (const account of accounts) {
    const existing = await Invoice.findOne({ account: account._id });
    if (!existing) {
      try {
        const inv = await generateInvoiceForAccount({
          accountId: account._id,
          userId: userId || account.owner,
          status: 'sent',
        });
        createdInvoices.push(inv);
      } catch (err) {
        console.error(`[AutoInvoice] Error generating invoice for account ${account.name}:`, err);
      }
    }
  }

  return {
    count: createdInvoices.length,
    invoices: createdInvoices,
    accountsChecked: accounts.length,
  };
}
