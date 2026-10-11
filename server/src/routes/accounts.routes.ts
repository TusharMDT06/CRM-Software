import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Account } from '../models/Account.js';
import { FieldDefinition } from '../models/FieldDefinition.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { requireWithinRecordLimit } from '../middleware/planLimits.js';
import { accountSchema, accountUpdateSchema } from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter, parseSort } from '../utils/queryHelper.js';
import { validateCustomFields } from '../utils/customFields.js';
import { logActivity } from '../utils/activityHelper.js';
import { toCSV } from '../utils/csvHelper.js';

export const accountsRouter = Router();

accountsRouter.use(authenticate);

function buildAccountQuery(user: any, queryParams: any): FilterQuery<any> {
  const query: FilterQuery<any> = {
    ...buildOwnerFilter(user, queryParams.owner as string),
  };

  if (queryParams.industry) {
    query.industry = queryParams.industry;
  }

  if (queryParams.q) {
    const q = String(queryParams.q).trim();
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { industry: { $regex: q, $options: 'i' } },
      { city: { $regex: q, $options: 'i' } },
    ];
  }

  return query;
}

// GET /accounts
accountsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const query = buildAccountQuery(user, req.query);
    const sort = parseSort(req.query.sort as string);

    const [data, total] = await Promise.all([
      Account.find(query)
        .populate('owner', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Account.countDocuments(query),
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
    res.status(500).json({ message: error.message || 'Failed to fetch accounts' });
  }
});

// GET /accounts/export
accountsRouter.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = buildAccountQuery(user, req.query);
    const sort = parseSort(req.query.sort as string);

    const [accounts, activeCustomFields] = await Promise.all([
      Account.find(query).populate('owner', 'name email').sort(sort),
      FieldDefinition.find({ entity: 'account', active: true }).sort({ order: 1 }),
    ]);

    const headers = [
      { key: 'name', label: 'Account Name' },
      { key: 'industry', label: 'Industry' },
      { key: 'website', label: 'Website' },
      { key: 'phone', label: 'Phone' },
      { key: 'city', label: 'City' },
      { key: 'employees', label: 'Employees' },
      { key: 'ownerName', label: 'Owner' },
      { key: 'createdAt', label: 'Created At' },
      ...activeCustomFields.map((cf) => ({
        key: `custom.${cf.key}`,
        label: `custom.${cf.key}`,
      })),
    ];

    const rows = accounts.map((a) => {
      const row: Record<string, any> = {
        name: a.name,
        industry: a.industry,
        website: a.website,
        phone: a.phone,
        city: a.city,
        employees: a.employees,
        ownerName: typeof a.owner === 'object' ? (a.owner as any)?.name : '',
        createdAt: a.createdAt.toISOString(),
      };

      activeCustomFields.forEach((cf) => {
        row[`custom.${cf.key}`] = a.custom?.[cf.key] ?? '';
      });

      return row;
    });

    const csvData = toCSV(rows, headers);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="accounts-export-${Date.now()}.csv"`);
    res.send(csvData);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to export accounts' });
  }
});

// POST /accounts/import
accountsRouter.post('/import', async (req: AuthRequest, res: Response) => {
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
    const duplicates: Array<{ row: number; name: string; existingId: string }> = [];
    const validRows: Array<{ index: number; data: any; existingId?: string }> = [];

    // Pre-fetch accounts by name (duplicates for accounts = same company name)
    const namesInFile = rows.map((r) => String(r.name || '').toLowerCase().trim()).filter(Boolean);
    const existingAccounts = await Account.find({
      name: { $in: namesInFile.map((n) => new RegExp(`^${n}$`, 'i')) },
    });
    const existingNameMap = new Map(existingAccounts.map((a) => [a.name.toLowerCase().trim(), a]));

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const parsedName = String(rawRow.name || '').trim();

      const customData: Record<string, any> = { ...(rawRow.custom || {}) };
      Object.keys(rawRow).forEach((k) => {
        if (k.startsWith('custom.')) {
          const fieldKey = k.replace('custom.', '');
          customData[fieldKey] = rawRow[k];
        }
      });

      const accountPayload = {
        name: parsedName,
        industry: rawRow.industry || 'Technology',
        website: rawRow.website || '',
        phone: String(rawRow.phone || ''),
        city: rawRow.city || '',
        employees: Number(rawRow.employees) || 1,
        custom: customData,
        owner: String(ownerId),
      };

      const parsed = accountSchema.safeParse(accountPayload);
      if (!parsed.success) {
        errors.push({
          row: i + 1,
          data: rawRow,
          error: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', '),
        });
        continue;
      }

      const existing = existingNameMap.get(parsedName.toLowerCase());
      if (existing) {
        duplicates.push({ row: i + 1, name: parsedName, existingId: existing._id.toString() });
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
        await Account.findByIdAndUpdate(item.existingId, {
          ...item.data,
          owner: user.role === 'sales' ? user._id : ownerId,
        });
        updated++;
      } else if (!item.existingId) {
        await Account.create({
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
    res.status(500).json({ message: error.message || 'Failed to import accounts' });
  }
});

// GET /accounts/:id
accountsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const account = await Account.findById(req.params.id).populate('owner', 'name email role');

    if (!account) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    // Scoping: sales can only open records they own (404 otherwise)
    if (user.role === 'sales' && !account.owner.equals(user._id)) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    res.json(account);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch account' });
  }
});

// POST /accounts
accountsRouter.post('/', requireWithinRecordLimit, validateBody(accountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const accountData = { ...req.body };

    const cf = await validateCustomFields('account', accountData.custom, true);
    if (!cf.valid) {
      res.status(400).json({ message: cf.error });
      return;
    }
    accountData.custom = cf.cleanData;

    if (user.role === 'sales' || !accountData.owner) {
      accountData.owner = user._id;
    }

    const account = await Account.create(accountData);
    await account.populate('owner', 'name email role');

    await logActivity({
      type: 'system',
      subject: 'Account created',
      body: `Account "${account.name}" was registered`,
      entityType: 'account',
      entityId: account._id,
      createdBy: user._id,
    });

    res.status(201).json(account);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create account' });
  }
});

// PATCH /accounts/:id
accountsRouter.patch('/:id', validateBody(accountUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const account = await Account.findById(req.params.id);

    if (!account) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    if (user.role === 'sales') {
      if (!account.owner.equals(user._id)) {
        res.status(404).json({ message: 'Account not found' });
        return;
      }
      delete req.body.owner;
    }

    if (req.body.custom) {
      const cf = await validateCustomFields('account', req.body.custom, false);
      if (!cf.valid) {
        res.status(400).json({ message: cf.error });
        return;
      }
      req.body.custom = { ...(account.custom || {}), ...cf.cleanData };
    }

    Object.assign(account, req.body);
    await account.save();
    await account.populate('owner', 'name email role');

    res.json(account);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update account' });
  }
});

// DELETE /accounts/:id (admin/manager only)
accountsRouter.delete('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }
    res.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete account' });
  }
});
