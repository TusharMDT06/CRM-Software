import { Request } from 'express';
import { AuditLog, AuditAction, AuditEntityType, AuditSource, FieldChange } from '../models/AuditLog.js';

export const AUDIT_RETENTION_DAYS = 365;

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'jwt',
  'apiKey',
  'secret',
  'resendApiKey',
  'RESEND_API_KEY',
]);

const IGNORED_DIFF_FIELDS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'password',
  'passwordHash',
]);

/**
 * Computes field-level difference between two document states
 */
export function computeFieldDiff(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined
): FieldChange[] {
  const changes: FieldChange[] = [];
  if (!before && !after) return changes;

  const b = before ? (before.toObject ? before.toObject() : { ...before }) : {};
  const a = after ? (after.toObject ? after.toObject() : { ...after }) : {};

  const allKeys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);

  for (const key of allKeys) {
    if (IGNORED_DIFF_FIELDS.has(key) || SENSITIVE_FIELDS.has(key)) {
      continue;
    }

    const valBefore = b[key];
    const valAfter = a[key];

    // Deep compare arrays/objects simply by JSON
    const strBefore = JSON.stringify(valBefore ?? null);
    const strAfter = JSON.stringify(valAfter ?? null);

    if (strBefore !== strAfter) {
      changes.push({
        field: key,
        from: valBefore !== undefined ? valBefore : null,
        to: valAfter !== undefined ? valAfter : null,
      });
    }
  }

  return changes;
}

import { runWithTenantContext, getTenantContext } from './tenantContext.js';

export interface RecordAuditParams {
  req?: Request | any;
  actor?: any;
  actorName?: string;
  tenantId?: any;
  source?: AuditSource;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  changes?: FieldChange[];
  ip?: string;
  userAgent?: string;
}

/**
 * Centrally writes an append-only AuditLog record
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    let actorId = params.actor?._id || params.actor;
    let actorName = params.actorName || params.actor?.name;
    let ip = params.ip || '';
    let userAgent = params.userAgent || '';

    if (params.req) {
      const user = params.req.user;
      if (user && !actorId) {
        actorId = user._id;
        actorName = user.name;
      }
      if (!ip) {
        const xForwardedFor = params.req.headers['x-forwarded-for'];
        ip = Array.isArray(xForwardedFor) ? xForwardedFor[0] : (xForwardedFor || params.req.socket?.remoteAddress || '');
      }
      if (!userAgent) {
        userAgent = params.req.headers['user-agent'] || '';
      }
    }

    let resolvedChanges = params.changes || [];
    if (resolvedChanges.length === 0 && (params.before || params.after)) {
      resolvedChanges = computeFieldDiff(params.before, params.after);
    }

    const currentCtx = getTenantContext();
    const effectiveTenantId =
      params.tenantId ||
      currentCtx?.tenantId ||
      params.actor?.tenantId ||
      params.req?.user?.tenantId;

    const auditAction = async () => {
      await AuditLog.create({
        tenantId: effectiveTenantId || undefined,
        actor: actorId || null,
        actorName: actorName || (params.source === 'system' ? 'System Job' : 'Guest'),
        source: params.source || (actorId ? 'user' : 'system'),
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ? String(params.entityId) : undefined,
        entityLabel: params.entityLabel || '',
        changes: resolvedChanges,
        ip: String(ip).substring(0, 60),
        userAgent: String(userAgent).substring(0, 250),
      });
    };

    if (currentCtx?.tenantId || currentCtx?.isBypassTenant) {
      await auditAction();
    } else if (effectiveTenantId) {
      await runWithTenantContext({ tenantId: effectiveTenantId.toString() }, auditAction);
    } else {
      await runWithTenantContext({ isBypassTenant: true }, auditAction);
    }
  } catch (error) {
    // Audit logging failure should never crash the main transaction
    console.error('[AuditLog Error] Failed to write audit log:', error);
  }
}

export const logAudit = recordAudit;

/**
 * Enforces audit log retention policy (default 365 days)
 */
export async function cleanupAuditLogs(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AUDIT_RETENTION_DAYS);

  const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
  const deletedCount = result.deletedCount || 0;

  if (deletedCount > 0) {
    await recordAudit({
      source: 'system',
      action: 'delete',
      entityType: 'company_settings',
      entityLabel: 'Audit Retention Job',
      changes: [
        {
          field: 'deletedCount',
          from: null,
          to: deletedCount,
        },
      ],
    });
  }

  return deletedCount;
}
