import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Tenant } from '../models/Tenant.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { Task } from '../models/Task.js';
import { Product } from '../models/Product.js';
import { Quote } from '../models/Quote.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { Workflow } from '../models/Workflow.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { toCSV } from '../utils/csvHelper.js';
import { recordAudit } from '../utils/auditLogger.js';

export const tenantSettingsRouter = Router();

tenantSettingsRouter.use(authenticate);
tenantSettingsRouter.use(requireRole('admin'));

// In-memory store for generated export files: jobId -> { filePath, tenantId, createdAt }
const exportJobs = new Map<string, { filePath: string; tenantId: string; createdAt: Date }>();

const EXPORT_DIR = path.resolve(process.cwd(), 'temp', 'exports');
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// POST /api/settings/tenant/export
tenantSettingsRouter.post('/export', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!.toString();
    const jobId = `export_${tenantId}_${Date.now()}`;
    const zipPath = path.join(EXPORT_DIR, `${jobId}.zip`);

    // Fetch all business records
    const [
      leads,
      contacts,
      accounts,
      deals,
      tasks,
      products,
      quotes,
      invoices,
      payments,
      workflows,
    ] = await Promise.all([
      Lead.find().lean(),
      Contact.find().lean(),
      Account.find().lean(),
      Deal.find().lean(),
      Task.find().lean(),
      Product.find().lean(),
      Quote.find().lean(),
      Invoice.find().lean(),
      Payment.find().lean(),
      Workflow.find().lean(),
    ]);

    // Create zip archive
    const output = fs.createWriteStream(zipPath);
    const archive = (archiver as any)('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    // Helper to add entity CSV to archive
    function addCsv(filename: string, data: any[]) {
      if (data.length === 0) {
        archive.append('No records found\n', { name: `${filename}.csv` });
        return;
      }
      const keys = Object.keys(data[0]).filter((k) => k !== '__v');
      const headers = keys.map((k) => ({ key: k, label: k }));
      const csvStr = toCSV(headers, data);
      archive.append(csvStr, { name: `${filename}.csv` });
    }

    addCsv('leads', leads);
    addCsv('contacts', contacts);
    addCsv('accounts', accounts);
    addCsv('deals', deals);
    addCsv('tasks', tasks);
    addCsv('products', products);
    addCsv('quotes', quotes);
    addCsv('invoices', invoices);
    addCsv('payments', payments);
    addCsv('workflows', workflows);

    await archive.finalize();

    exportJobs.set(jobId, {
      filePath: zipPath,
      tenantId,
      createdAt: new Date(),
    });

    await recordAudit({
      actor: req.user!._id,
      actorName: req.user!.name,
      source: 'user',
      action: 'tenant_exported',
      entityType: 'tenant',
      entityId: tenantId,
      entityLabel: req.tenant?.name || 'Tenant Export',
      req,
    });

    res.json({
      message: 'Export generated successfully',
      jobId,
      downloadUrl: `/api/settings/tenant/export/download/${jobId}`,
      recordCounts: {
        leads: leads.length,
        contacts: contacts.length,
        accounts: accounts.length,
        deals: deals.length,
        tasks: tasks.length,
        products: products.length,
        quotes: quotes.length,
        invoices: invoices.length,
        payments: payments.length,
        workflows: workflows.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to export tenant data' });
  }
});

// GET /api/settings/tenant/export/download/:jobId
tenantSettingsRouter.get('/export/download/:jobId', async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = exportJobs.get(jobId);

    if (!job) {
      res.status(404).json({ message: 'Export job not found or expired' });
      return;
    }

    if (job.tenantId !== req.user!.tenantId!.toString()) {
      res.status(403).json({ message: 'Forbidden: Export does not belong to your organization' });
      return;
    }

    if (!fs.existsSync(job.filePath)) {
      res.status(404).json({ message: 'Export file not found' });
      return;
    }

    res.download(job.filePath, `flowdesk-export-${new Date().toISOString().split('T')[0]}.zip`);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Download failed' });
  }
});

// POST /api/settings/tenant/delete-request
tenantSettingsRouter.post('/delete-request', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!.toString();
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      res.status(404).json({ message: 'Tenant not found' });
      return;
    }

    tenant.deletionRequestedAt = new Date();
    tenant.status = 'suspended';
    tenant.suspendedReason =
      'Organization deletion requested by administrator. Pending 14-day grace period.';
    await tenant.save();

    await recordAudit({
      actor: req.user!._id,
      actorName: req.user!.name,
      source: 'user',
      action: 'tenant_deletion_requested',
      entityType: 'tenant',
      entityId: tenantId,
      entityLabel: tenant.name,
      req,
    });

    res.json({
      message:
        'Deletion request submitted. Your organization data is suspended and will be permanently purged after a 14-day grace period.',
      deletionRequestedAt: tenant.deletionRequestedAt,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to request deletion' });
  }
});

// POST /api/settings/tenant/cancel-deletion
tenantSettingsRouter.post('/cancel-deletion', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!.toString();
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      res.status(404).json({ message: 'Tenant not found' });
      return;
    }

    tenant.deletionRequestedAt = undefined;
    tenant.status = 'active';
    tenant.suspendedReason = '';
    await tenant.save();

    await recordAudit({
      actor: req.user!._id,
      actorName: req.user!.name,
      source: 'user',
      action: 'tenant_deletion_cancelled',
      entityType: 'tenant',
      entityId: tenantId,
      entityLabel: tenant.name,
      req,
    });

    res.json({
      message: 'Deletion request cancelled successfully. Organization is now fully active.',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to cancel deletion' });
  }
});
