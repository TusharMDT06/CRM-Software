import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Tenant, DEFAULT_PLAN_LIMITS } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { Activity } from '../models/Activity.js';
import { authenticate, requirePlatformAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  updateTenantLimitsSchema,
  updateTenantStatusSchema,
} from '../validations/index.js';
import { AuthRequest } from '../types/index.js';
import { getTenantUsage } from '../utils/planLimits.js';
import { runWithTenantContext } from '../utils/tenantContext.js';
import { recordAudit } from '../utils/auditLogger.js';

export const platformRouter = Router();

// Platform routes strictly require authentication and platform_admin role
platformRouter.use(authenticate);
platformRouter.use(requirePlatformAdmin);

// GET /api/platform/tenants
platformRouter.get('/tenants', async (req: AuthRequest, res: Response) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 });

    const tenantListWithUsage = await Promise.all(
      tenants.map(async (t) => {
        const usage = await getTenantUsage(t._id.toString());
        // Find last active timestamp from activities or audit logs
        const lastActivity = await runWithTenantContext(
          { tenantId: t._id.toString(), isBypassTenant: true },
          async () => Activity.findOne({ tenantId: t._id }).sort({ occurredAt: -1 })
        );

        return {
          ...usage,
          createdAt: t.createdAt,
          lastActiveAt: lastActivity?.occurredAt || t.createdAt,
          suspendedReason: t.suspendedReason || '',
          deletionRequestedAt: t.deletionRequestedAt || null,
        };
      })
    );

    res.json(tenantListWithUsage);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch tenants' });
  }
});

// GET /api/platform/tenants/:id
platformRouter.get('/tenants/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      res.status(404).json({ message: 'Tenant not found' });
      return;
    }

    const usage = await getTenantUsage(tenant._id.toString());
    res.json({
      ...tenant.toObject(),
      ...usage,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch tenant' });
  }
});

// PATCH /api/platform/tenants/:id/status
platformRouter.patch(
  '/tenants/:id/status',
  validateBody(updateTenantStatusSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await Tenant.findById(req.params.id);
      if (!tenant) {
        res.status(404).json({ message: 'Tenant not found' });
        return;
      }

      const before = tenant.toObject();
      const { status, suspendedReason } = req.body;

      tenant.status = status;
      if (suspendedReason !== undefined) {
        tenant.suspendedReason = suspendedReason;
      }
      await tenant.save();

      await recordAudit({
        actor: req.user!._id,
        actorName: req.user!.name,
        source: 'user',
        action: status === 'suspended' ? 'tenant_suspended' : 'tenant_reactivated',
        entityType: 'tenant',
        entityId: tenant._id.toString(),
        entityLabel: tenant.name,
        before,
        after: tenant.toObject(),
        req,
      });

      res.json({
        message: `Tenant "${tenant.name}" status updated to ${status}`,
        tenant,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update tenant status' });
    }
  }
);

// PATCH /api/platform/tenants/:id/limits
platformRouter.patch(
  '/tenants/:id/limits',
  validateBody(updateTenantLimitsSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await Tenant.findById(req.params.id);
      if (!tenant) {
        res.status(404).json({ message: 'Tenant not found' });
        return;
      }

      const before = tenant.toObject();
      const { plan, maxSeats, maxRecords, aiEnabled, aiMonthlyRequests } = req.body;

      if (plan) {
        tenant.plan = plan;
        if (maxSeats === undefined && maxRecords === undefined) {
          tenant.limits = { ...DEFAULT_PLAN_LIMITS[plan as 'free' | 'pro'] };
        }
      }

      if (maxSeats !== undefined) tenant.limits.maxSeats = maxSeats;
      if (maxRecords !== undefined) tenant.limits.maxRecords = maxRecords;
      if (aiEnabled !== undefined) tenant.limits.aiEnabled = aiEnabled;
      if (aiMonthlyRequests !== undefined) tenant.limits.aiMonthlyRequests = aiMonthlyRequests;

      await tenant.save();

      await recordAudit({
        actor: req.user!._id,
        actorName: req.user!.name,
        source: 'user',
        action: 'tenant_limits_updated',
        entityType: 'tenant',
        entityId: tenant._id.toString(),
        entityLabel: tenant.name,
        before,
        after: tenant.toObject(),
        req,
      });

      res.json({
        message: `Tenant "${tenant.name}" plan and limits updated`,
        tenant,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update tenant limits' });
    }
  }
);

// POST /api/platform/tenants/:id/impersonate
platformRouter.post('/tenants/:id/impersonate', async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      res.status(404).json({ message: 'Tenant not found' });
      return;
    }

    // Sign a 30-minute impersonation token
    const secret = process.env.JWT_SECRET || 'flowdesk_super_secret_jwt_key_2026_crm';
    const impersonationToken = jwt.sign(
      {
        userId: req.user!._id.toString(),
        impersonateTenantId: tenant._id.toString(),
        isImpersonating: true,
      },
      secret,
      { expiresIn: '30m' }
    );

    await recordAudit({
      actor: req.user!._id,
      actorName: req.user!.name,
      source: 'user',
      action: 'tenant_impersonated',
      entityType: 'tenant',
      entityId: tenant._id.toString(),
      entityLabel: tenant.name,
      changes: [{ field: 'impersonation_duration', from: null, to: '30m' }],
      req,
    });

    res.json({
      message: `Impersonation session established for "${tenant.name}". Read-only for 30 minutes.`,
      token: impersonationToken,
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
      expiresInMinutes: 30,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to establish impersonation' });
  }
});

// GET /api/platform/audit-logs
platformRouter.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [logs, total] = await runWithTenantContext(
      { isBypassTenant: true },
      async () => {
        return Promise.all([
          AuditLog.find()
            .populate('actor', 'name email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
          AuditLog.countDocuments(),
        ]);
      }
    );

    res.json({
      data: logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch platform audit logs' });
  }
});
