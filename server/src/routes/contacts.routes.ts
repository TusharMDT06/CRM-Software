import { Router, Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { FieldDefinition } from '../models/FieldDefinition.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { requireWithinRecordLimit } from '../middleware/planLimits.js';
import { contactSchema, contactUpdateSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter, parseSort } from '../utils/queryHelper.js';
import { validateCustomFields } from '../utils/customFields.js';
import { logActivity } from '../utils/activityHelper.js';
import { toCSV } from '../utils/csvHelper.js';

export const contactsRouter = Router();

contactsRouter.use(authenticate);

function buildContactQuery(user: any, queryParams: any): FilterQuery<any> {
  const query: FilterQuery<any> = {
    ...buildOwnerFilter(user, queryParams.owner as string),
  };

  if (queryParams.account) {
    query.account = queryParams.account;
  }

  if (queryParams.q) {
    const q = String(queryParams.q).trim();
    query.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { jobTitle: { $regex: q, $options: 'i' } },
    ];
  }

  return query;
}

// GET /contacts
contactsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const query = buildContactQuery(user, req.query);
    const sort = parseSort(req.query.sort as string);

    const [data, total] = await Promise.all([
      Contact.find(query)
        .populate('account', 'name industry city phone')
        .populate('owner', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Contact.countDocuments(query),
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
    res.status(500).json({ message: error.message || 'Failed to fetch contacts' });
  }
});

// GET /contacts/export
contactsRouter.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = buildContactQuery(user, req.query);
    const sort = parseSort(req.query.sort as string);

    const [contacts, activeCustomFields] = await Promise.all([
      Contact.find(query)
        .populate('account', 'name industry')
        .populate('owner', 'name email')
        .sort(sort),
      FieldDefinition.find({ entity: 'contact', active: true }).sort({ order: 1 }),
    ]);

    const headers = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'jobTitle', label: 'Job Title' },
      { key: 'accountName', label: 'Account' },
      { key: 'ownerName', label: 'Owner' },
      { key: 'createdAt', label: 'Created At' },
      ...activeCustomFields.map((cf) => ({
        key: `custom.${cf.key}`,
        label: `custom.${cf.key}`,
      })),
    ];

    const rows = contacts.map((c) => {
      const row: Record<string, any> = {
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        jobTitle: c.jobTitle,
        accountName: typeof c.account === 'object' ? (c.account as any)?.name : '',
        ownerName: typeof c.owner === 'object' ? (c.owner as any)?.name : '',
        createdAt: c.createdAt.toISOString(),
      };

      activeCustomFields.forEach((cf) => {
        row[`custom.${cf.key}`] = c.custom?.[cf.key] ?? '';
      });

      return row;
    });

    const csvData = toCSV(rows, headers);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-export-${Date.now()}.csv"`);
    res.send(csvData);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to export contacts' });
  }
});

// POST /contacts/import
contactsRouter.post('/import', async (req: AuthRequest, res: Response) => {
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

    let ownerId = user._id;
    if ((user.role === 'admin' || user.role === 'manager') && assignedOwner) {
      ownerId = assignedOwner;
    }

    const errors: Array<{ row: number; data: any; error: string }> = [];
    const duplicates: Array<{ row: number; email: string; existingId: string }> = [];
    const validRows: Array<{ index: number; data: any; existingId?: string }> = [];

    const emailsInFile = rows.map((r) => String(r.email || '').toLowerCase().trim()).filter(Boolean);
    const existingContacts = await Contact.find({ email: { $in: emailsInFile } });
    const existingEmailMap = new Map(existingContacts.map((c) => [c.email.toLowerCase(), c]));

    // Fetch accounts to resolve account names
    const allAccounts = await Account.find({});
    const accountMap = new Map(allAccounts.map((a) => [a.name.toLowerCase().trim(), a]));

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const parsedEmail = String(rawRow.email || '').toLowerCase().trim();

      // Resolve Account
      let accountRef = rawRow.account;
      if (!Types.ObjectId.isValid(accountRef)) {
        const found = accountMap.get(String(rawRow.account || '').toLowerCase().trim());
        if (found) {
          accountRef = found._id.toString();
        } else {
          // If in dryRun and account not found, or create fallback
          if (!accountRef && allAccounts[0]) {
            accountRef = allAccounts[0]._id.toString();
          }
        }
      }

      const customData: Record<string, any> = { ...(rawRow.custom || {}) };
      Object.keys(rawRow).forEach((k) => {
        if (k.startsWith('custom.')) {
          const fieldKey = k.replace('custom.', '');
          customData[fieldKey] = rawRow[k];
        }
      });

      const contactPayload = {
        firstName: rawRow.firstName,
        lastName: rawRow.lastName,
        email: parsedEmail,
        phone: String(rawRow.phone || ''),
        jobTitle: rawRow.jobTitle || '',
        account: accountRef,
        custom: customData,
        owner: String(ownerId),
      };

      const parsed = contactSchema.safeParse(contactPayload);
      if (!parsed.success) {
        errors.push({
          row: i + 1,
          data: rawRow,
          error: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', '),
        });
        continue;
      }

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

    let created = 0;
    let updated = 0;
    let skipped = duplicateAction === 'skip' ? duplicates.length : 0;

    for (const item of validRows) {
      if (item.existingId && duplicateAction === 'update') {
        await Contact.findByIdAndUpdate(item.existingId, {
          ...item.data,
          owner: user.role === 'sales' ? user._id : ownerId,
        });
        updated++;
      } else if (!item.existingId) {
        await Contact.create({
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
    res.status(500).json({ message: error.message || 'Failed to import contacts' });
  }
});

// GET /contacts/:id
contactsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const contact = await Contact.findById(req.params.id)
      .populate('account', 'name industry city phone')
      .populate('owner', 'name email role');

    if (!contact) {
      res.status(404).json({ message: 'Contact not found' });
      return;
    }

    // Scoping: sales can only open records they own (404 otherwise)
    if (user.role === 'sales' && !contact.owner.equals(user._id)) {
      res.status(404).json({ message: 'Contact not found' });
      return;
    }

    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch contact' });
  }
});

// POST /contacts
contactsRouter.post('/', requireWithinRecordLimit, validateBody(contactSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const contactData = { ...req.body };

    const cf = await validateCustomFields('contact', contactData.custom, true);
    if (!cf.valid) {
      res.status(400).json({ message: cf.error });
      return;
    }
    contactData.custom = cf.cleanData;

    if (user.role === 'sales' || !contactData.owner) {
      contactData.owner = user._id;
    }

    const contact = await Contact.create(contactData);
    await contact.populate('account', 'name industry city phone');
    await contact.populate('owner', 'name email role');

    await logActivity({
      type: 'system',
      subject: 'Contact created',
      body: `Contact "${contact.firstName} ${contact.lastName}" added`,
      entityType: 'contact',
      entityId: contact._id,
      createdBy: user._id,
    });

    res.status(201).json(contact);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create contact' });
  }
});

// PATCH /contacts/:id
contactsRouter.patch('/:id', validateBody(contactUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      res.status(404).json({ message: 'Contact not found' });
      return;
    }

    if (user.role === 'sales') {
      if (!contact.owner.equals(user._id)) {
        res.status(404).json({ message: 'Contact not found' });
        return;
      }
      delete req.body.owner;
    }

    if (req.body.custom) {
      const cf = await validateCustomFields('contact', req.body.custom, false);
      if (!cf.valid) {
        res.status(400).json({ message: cf.error });
        return;
      }
      req.body.custom = { ...(contact.custom || {}), ...cf.cleanData };
    }

    Object.assign(contact, req.body);
    await contact.save();
    await contact.populate('account', 'name industry city phone');
    await contact.populate('owner', 'name email role');

    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update contact' });
  }
});

// DELETE /contacts/:id (admin/manager only)
contactsRouter.delete('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) {
      res.status(404).json({ message: 'Contact not found' });
      return;
    }
    res.json({ message: 'Contact deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete contact' });
  }
});
