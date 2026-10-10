import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { AuditLog, IAuditLog } from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { parseSort } from '../utils/queryHelper.js';
import { recordAudit } from '../utils/auditLogger.js';
import { toCSV } from '../utils/csvHelper.js';

export const auditLogRouter = Router();

auditLogRouter.use(authenticate);

function buildAuditQuery(queryParams: any): FilterQuery<any> {
  const query: FilterQuery<any> = {};

  if (queryParams.actor) {
    query.actor = queryParams.actor;
  }
  if (queryParams.action) {
    query.action = queryParams.action;
  }
  if (queryParams.entityType) {
    query.entityType = queryParams.entityType;
  }
  if (queryParams.entityId) {
    query.entityId = queryParams.entityId;
  }

  // Date range filter
  if (queryParams.from || queryParams.to) {
    query.createdAt = {};
    if (queryParams.from) query.createdAt.$gte = new Date(queryParams.from);
    if (queryParams.to) query.createdAt.$lte = new Date(queryParams.to);
  }

  // Search by entityLabel or actorName
  if (queryParams.q) {
    const q = String(queryParams.q).trim();
    query.$or = [
      { entityLabel: { $regex: q, $options: 'i' } },
      { actorName: { $regex: q, $options: 'i' } },
    ];
  }

  return query;
}

// GET /audit-log (Admin only)
auditLogRouter.get('/', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const query = buildAuditQuery(req.query);
    const sort = parseSort(req.query.sort as string) || { createdAt: -1 };

    const [data, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actor', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query),
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
    res.status(500).json({ message: error.message || 'Failed to fetch audit logs' });
  }
});

// GET /audit-log/entity/:entityType/:entityId (Record detail History tab)
auditLogRouter.get('/entity/:entityType/:entityId', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { entityType, entityId } = req.params;

    const isPrivileged = user.role === 'admin' || user.role === 'manager';

    const logs = await AuditLog.find({ entityType, entityId })
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);

    // If sales role: sanitize actor details and field-level diff
    const sanitized = logs.map((log) => {
      const obj = log.toObject();
      if (!isPrivileged) {
        return {
          _id: obj._id,
          action: obj.action,
          entityType: obj.entityType,
          entityId: obj.entityId,
          entityLabel: obj.entityLabel,
          createdAt: obj.createdAt,
          source: obj.source,
          // Hide actor personal info and deep diff details from basic sales view
          actorName: obj.source === 'automation' ? 'Automation' : 'Team Member',
          changesCount: (obj.changes || []).length,
        };
      }
      return obj;
    });

    res.json(sanitized);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch record history' });
  }
});

// GET /audit-log/export (Admin only)
auditLogRouter.get('/export', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = buildAuditQuery(req.query);

    const logs = await AuditLog.find(query)
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(5000);

    const rows = logs.map((l) => ({
      'Date & Time': new Date(l.createdAt).toISOString(),
      'Actor': l.actorName || (l.actor as any)?.name || 'System',
      'Action': l.action,
      'Source': l.source,
      'Entity Type': l.entityType,
      'Entity ID': l.entityId || '',
      'Entity Label': l.entityLabel,
      'Changes Count': (l.changes || []).length,
      'IP Address': l.ip || '',
    }));

    const headers = [
      { key: 'Date & Time', label: 'Date & Time' },
      { key: 'Actor', label: 'Actor' },
      { key: 'Action', label: 'Action' },
      { key: 'Source', label: 'Source' },
      { key: 'Entity Type', label: 'Entity Type' },
      { key: 'Entity ID', label: 'Entity ID' },
      { key: 'Entity Label', label: 'Entity Label' },
      { key: 'Changes Count', label: 'Changes Count' },
      { key: 'IP Address', label: 'IP Address' },
    ];

    const csvContent = toCSV(rows, headers);

    // RULE: The export itself must be logged!
    await recordAudit({
      req,
      action: 'export',
      entityType: 'company_settings',
      entityLabel: `Exported ${rows.length} audit log entries`,
      changes: [{ field: 'count', from: null, to: rows.length }],
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_log_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to export audit logs' });
  }
});
