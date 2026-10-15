import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Lead } from '../models/Lead.js';
import { Account } from '../models/Account.js';
import { Contact } from '../models/Contact.js';
import { Deal } from '../models/Deal.js';
import { FieldDefinition } from '../models/FieldDefinition.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { requireWithinRecordLimit } from '../middleware/planLimits.js';
import { leadSchema, leadUpdateSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter, parseSort } from '../utils/queryHelper.js';
import { validateCustomFields } from '../utils/customFields.js';
import { logActivity } from '../utils/activityHelper.js';
import { toCSV } from '../utils/csvHelper.js';
import { paginateQuery } from '../utils/paginationHelper.js';
import { hasVersionConflict, sendConflictResponse } from '../utils/conflictHelper.js';
import { sendNotification } from '../utils/notificationService.js';

export const leadsRouter = Router();

leadsRouter.use(authenticate);

// Helper to build query filters
function buildLeadQuery(user: any, queryParams: any): FilterQuery<any> {
  const query: FilterQuery<any> = {
    ...buildOwnerFilter(user, queryParams.owner as string),
  };

  if (queryParams.status) {
    query.status = queryParams.status;
  }
  if (queryParams.rating) {
    query.rating = queryParams.rating;
  }
  if (queryParams.source) {
    query.source = queryParams.source;
  }
  if (queryParams.channel) {
    query.channel = queryParams.channel;
  }
  if (queryParams.campaign) {
    query['campaign.name'] = { $regex: String(queryParams.campaign).trim(), $options: 'i' };
  }
  if (queryParams.isTest !== undefined) {
    query.isTest = queryParams.isTest === 'true';
  }

  if (queryParams.q) {
    const q = String(queryParams.q).trim();
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { company: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ];
  }

  return query;
}

// GET /leads
leadsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = buildLeadQuery(user, req.query);

    const result = await paginateQuery(Lead, query, req.query, {
      populate: [{ path: 'owner', select: 'name email role' }],
      defaultSort: { createdAt: -1 },
      defaultLimit: 10,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch leads' });
  }
});

// GET /leads/export (CSV export with custom fields)
leadsRouter.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = buildLeadQuery(user, req.query);
    const sort = parseSort(req.query.sort as string);

    const [leads, activeCustomFields] = await Promise.all([
      Lead.find(query).populate('owner', 'name email').sort(sort),
      FieldDefinition.find({ entity: 'lead', active: true }).sort({ order: 1 }),
    ]);

    const headers = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'company', label: 'Company' },
      { key: 'source', label: 'Source' },
      { key: 'channel', label: 'Channel' },
      { key: 'campaign', label: 'Campaign' },
      { key: 'formName', label: 'Form Name' },
      { key: 'utmSource', label: 'UTM Source' },
      { key: 'utmCampaign', label: 'UTM Campaign' },
      { key: 'inquiryCount', label: 'Inquiry Count' },
      { key: 'isTest', label: 'Is Test' },
      { key: 'status', label: 'Status' },
      { key: 'value', label: 'Value (INR)' },
      { key: 'ownerName', label: 'Owner' },
      { key: 'notes', label: 'Notes' },
      { key: 'createdAt', label: 'Created At' },
      ...activeCustomFields.map((cf) => ({
        key: `custom.${cf.key}`,
        label: `custom.${cf.key}`,
      })),
    ];

    const rows = leads.map((lead) => {
      const row: Record<string, any> = {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        source: lead.source,
        channel: lead.channel || 'other',
        campaign: lead.campaign?.name || lead.campaign?.externalId || '',
        formName: lead.formName || '',
        utmSource: lead.utm?.source || '',
        utmCampaign: lead.utm?.campaign || '',
        inquiryCount: lead.inquiryCount || 1,
        isTest: lead.isTest ? 'true' : 'false',
        status: lead.status,
        value: lead.value,
        ownerName: typeof lead.owner === 'object' ? (lead.owner as any)?.name : '',
        notes: lead.notes,
        createdAt: lead.createdAt.toISOString(),
      };

      activeCustomFields.forEach((cf) => {
        row[`custom.${cf.key}`] = lead.custom?.[cf.key] ?? '';
      });

      return row;
    });

    const csvData = toCSV(rows, headers);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads-export-${Date.now()}.csv"`);
    res.send(csvData);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to export leads' });
  }
});

// POST /leads/import
leadsRouter.post('/import', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { rows, duplicateAction = 'skip', assignedOwner } = req.body;
    const isDryRun = req.query.dryRun === 'true';

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ message: 'Rows array is required' });
      return;
    }

    if (rows.length > 5000) {
      res.status(400).json({ message: 'Maximum 5000 rows allowed per import' });
      return;
    }

    // Owner determination
    let ownerId = user._id;
    if ((user.role === 'admin' || user.role === 'manager') && assignedOwner) {
      ownerId = assignedOwner;
    }

    const errors: Array<{ row: number; data: any; error: string }> = [];
    const duplicates: Array<{ row: number; email: string; existingId: string }> = [];
    const validRows: Array<{ index: number; data: any; existingId?: string }> = [];

    // Pre-fetch existing emails
    const emailsInFile = rows.map((r) => String(r.email || '').toLowerCase().trim()).filter(Boolean);
    const existingLeads = await Lead.find({ email: { $in: emailsInFile } });
    const existingEmailMap = new Map(existingLeads.map((l) => [l.email.toLowerCase(), l]));

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const parsedEmail = String(rawRow.email || '').toLowerCase().trim();

      // Separate custom fields if provided as custom.key
      const customData: Record<string, any> = { ...(rawRow.custom || {}) };
      Object.keys(rawRow).forEach((k) => {
        if (k.startsWith('custom.')) {
          const fieldKey = k.replace('custom.', '');
          customData[fieldKey] = rawRow[k];
        }
      });

      const leadPayload = {
        name: rawRow.name,
        email: parsedEmail,
        phone: String(rawRow.phone || ''),
        company: rawRow.company,
        source: rawRow.source || 'website',
        status: rawRow.status || 'new',
        value: Number(rawRow.value) || 0,
        notes: rawRow.notes || '',
        custom: customData,
        owner: String(ownerId),
      };

      const parsed = leadSchema.safeParse(leadPayload);
      if (!parsed.success) {
        errors.push({
          row: i + 1,
          data: rawRow,
          error: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', '),
        });
        continue;
      }

      // Check duplicates
      const existing = existingEmailMap.get(parsedEmail);
      if (existing) {
        duplicates.push({ row: i + 1, email: parsedEmail, existingId: existing._id.toString() });
        if (duplicateAction === 'update') {
          validRows.push({ index: i + 1, data: parsed.data, existingId: existing._id.toString() });
        }
      } else {
        validRows.push({ index: i + 1, data: parsed.data });
      }
    }

    if (isDryRun) {
      res.json({
        summary: {
          total: rows.length,
          valid: validRows.length,
          duplicates: duplicates.length,
          errors: errors.length,
        },
        errors,
        duplicates,
      });
      return;
    }

    // Actual import
    let created = 0;
    let updated = 0;
    let skipped = duplicateAction === 'skip' ? duplicates.length : 0;

    for (const item of validRows) {
      if (item.existingId && duplicateAction === 'update') {
        await Lead.findByIdAndUpdate(item.existingId, {
          ...item.data,
          owner: user.role === 'sales' ? user._id : ownerId,
        });
        updated++;
      } else if (!item.existingId) {
        await Lead.create({
          ...item.data,
          owner: ownerId,
        });
        created++;
      }
    }

    res.json({
      summary: {
        total: rows.length,
        created,
        updated,
        skipped,
        failed: errors.length,
      },
      errors,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to import leads' });
  }
});

// GET /leads/:id
leadsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const lead = await Lead.findById(req.params.id).populate('owner', 'name email role');

    if (!lead) {
      res.status(404).json({ message: 'Lead not found' });
      return;
    }

    // Scoping: sales can only open records they own (404 otherwise)
    if (user.role === 'sales' && !lead.owner.equals(user._id)) {
      res.status(404).json({ message: 'Lead not found' });
      return;
    }

    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch lead' });
  }
});

// POST /leads
leadsRouter.post('/', requireWithinRecordLimit, validateBody(leadSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const leadData = { ...req.body };

    // Validate custom fields
    const cf = await validateCustomFields('lead', leadData.custom, true);
    if (!cf.valid) {
      res.status(400).json({ message: cf.error });
      return;
    }
    leadData.custom = cf.cleanData;

    // Owner assignment logic
    if (user.role === 'sales' || !leadData.owner) {
      leadData.owner = user._id;
    }

    const lead = await Lead.create(leadData);
    await lead.populate('owner', 'name email role');

    // Automatic system activity
    await logActivity({
      type: 'system',
      subject: 'Lead created',
      body: `Lead "${lead.name}" (${lead.company}) was added to pipeline`,
      entityType: 'lead',
      entityId: lead._id,
      createdBy: user._id,
    });

    const leadOwnerId = (lead.owner as any)?._id || lead.owner;
    if (leadOwnerId && !leadOwnerId.equals(user._id)) {
      sendNotification({
        userId: leadOwnerId,
        actorId: user._id,
        type: 'lead_assigned',
        title: `Lead Assigned: ${lead.name}`,
        body: `You were assigned lead "${lead.name}" (${lead.company})`,
        link: `/leads/${lead._id}`,
        entityType: 'lead',
        entityId: lead._id.toString(),
      }).catch(() => {});
    }

    res.status(201).json(lead);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create lead' });
  }
});

// PATCH /leads/:id
leadsRouter.patch('/:id', validateBody(leadUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      res.status(404).json({ message: 'Lead not found' });
      return;
    }

    if (user.role === 'sales') {
      if (!lead.owner.equals(user._id)) {
        res.status(404).json({ message: 'Lead not found' });
        return;
      }
      delete req.body.owner; // Sales cannot reassign owner
    }

    // Validate custom fields if updated
    if (req.body.custom) {
      const cf = await validateCustomFields('lead', req.body.custom, false);
      if (!cf.valid) {
        res.status(400).json({ message: cf.error });
        return;
      }
      req.body.custom = { ...(lead.custom || {}), ...cf.cleanData };
    }

    if (hasVersionConflict(lead, req.body)) {
      await lead.populate('owner', 'name email role');
      sendConflictResponse(res, lead);
      return;
    }

    const previousOwner = lead.owner ? lead.owner.toString() : '';
    Object.assign(lead, req.body);
    await lead.save();
    await lead.populate('owner', 'name email role');

    if (req.body.owner && previousOwner && previousOwner !== req.body.owner.toString()) {
      sendNotification({
        userId: req.body.owner,
        actorId: user._id,
        type: 'lead_assigned',
        title: `Lead Assigned: ${lead.name}`,
        body: `You were assigned lead "${lead.name}" (${lead.company})`,
        link: `/leads/${lead._id}`,
        entityType: 'lead',
        entityId: lead._id.toString(),
      }).catch(() => {});
    }

    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update lead' });
  }
});

// DELETE /leads/:id (admin/manager only)
leadsRouter.delete('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      res.status(404).json({ message: 'Lead not found' });
      return;
    }
    res.json({ message: 'Lead deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete lead' });
  }
});

// POST /leads/:id/convert
leadsRouter.post('/:id/convert', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      res.status(404).json({ message: 'Lead not found' });
      return;
    }

    if (user.role === 'sales' && !lead.owner.equals(user._id)) {
      res.status(404).json({ message: 'Lead not found' });
      return;
    }

    if (lead.status === 'converted') {
      res.status(400).json({ message: 'Lead is already converted' });
      return;
    }

    const ownerId = lead.owner;

    // 1. Find or create Account from company name
    let account = await Account.findOne({ name: lead.company });
    if (!account) {
      account = await Account.create({
        name: lead.company,
        industry: 'Technology',
        phone: lead.phone,
        city: 'Mumbai',
        employees: 25,
        owner: ownerId,
      });

      await logActivity({
        type: 'system',
        subject: 'Account created from lead',
        body: `Created from converted lead "${lead.name}"`,
        entityType: 'account',
        entityId: account._id,
        createdBy: user._id,
      });
    }

    // 2. Create Contact from lead details
    const nameParts = lead.name.trim().split(' ');
    const firstName = nameParts[0] || lead.name;
    const lastName = nameParts.slice(1).join(' ') || 'Lead';

    const contact = await Contact.create({
      firstName,
      lastName,
      email: lead.email,
      phone: lead.phone,
      jobTitle: 'Decision Maker',
      account: account._id,
      owner: ownerId,
    });

    await logActivity({
      type: 'system',
      subject: 'Contact created from lead',
      body: `Created from converted lead "${lead.name}"`,
      entityType: 'contact',
      entityId: contact._id,
      createdBy: user._id,
    });

    // 3. Create Deal (stage qualified, amount = lead value)
    const expectedClose = new Date();
    expectedClose.setDate(expectedClose.getDate() + 30);

    const deal = await Deal.create({
      title: `${account.name} - Deal`,
      account: account._id,
      contact: contact._id,
      amount: lead.value,
      stage: 'qualified',
      expectedClose,
      owner: ownerId,
      channel: lead.channel || 'other',
      campaign: lead.campaign,
    });

    await logActivity({
      type: 'system',
      subject: 'Deal created from lead',
      body: `Created from converted lead "${lead.name}" with amount ₹${lead.value.toLocaleString('en-IN')}`,
      entityType: 'deal',
      entityId: deal._id,
      createdBy: user._id,
    });

    // 4. Mark lead as converted
    lead.status = 'converted';
    await lead.save();

    await logActivity({
      type: 'system',
      subject: 'Lead converted',
      body: `Converted to Account "${account.name}", Contact "${contact.firstName} ${contact.lastName}", and Deal "${deal.title}"`,
      entityType: 'lead',
      entityId: lead._id,
      createdBy: user._id,
    });

    res.status(200).json({
      message: 'Lead converted successfully',
      account,
      contact,
      deal,
      lead,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to convert lead' });
  }
});
