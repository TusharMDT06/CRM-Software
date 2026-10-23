import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser, UserRole } from '../models/User.js';
import { Tenant, ITenant } from '../models/Tenant.js';
import { AuthRequest } from '../types/index.js';
import { runWithTenantContext } from '../utils/tenantContext.js';

interface JwtPayload {
  userId: string;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    res.status(401).json({ message: 'Authentication token required' });
    return;
  }
  const secret = process.env.JWT_SECRET || 'flowdesk_super_secret_jwt_key_2026_crm';
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = requestId;

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Bypass tenant scoping to locate user by ID
    const user = await runWithTenantContext(
      { isBypassTenant: true },
      async () => User.findById(decoded.userId)
    );

    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ message: 'Account has been deactivated. Please contact an admin.' });
      return;
    }

    req.user = user;

    // Handle platform_admin
    if (user.role === 'platform_admin') {
      const impersonateTenantId = req.headers['x-impersonate-tenant'] as string;
      if (impersonateTenantId) {
        const targetTenant = await Tenant.findById(impersonateTenantId);
        if (!targetTenant) {
          res.status(404).json({ message: 'Target tenant for impersonation not found' });
          return;
        }

        req.tenant = targetTenant;
        req.isImpersonating = true;

        // Run as read-only impersonation
        return runWithTenantContext(
          {
            tenantId: targetTenant._id.toString(),
            isImpersonating: true,
            isReadOnly: true,
            user,
            requestId,
          },
          () => next()
        );
      }

      // Normal platform admin context (global bypass)
      return runWithTenantContext(
        {
          isBypassTenant: true,
          user,
          requestId,
        },
        () => next()
      );
    }

    // Regular tenant-scoped user
    if (!user.tenantId) {
      res.status(401).json({ message: 'User has no associated tenant organization' });
      return;
    }

    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant) {
      res.status(401).json({ message: 'Tenant organization not found' });
      return;
    }

    if (tenant.status === 'suspended') {
      res.status(403).json({
        message:
          'Your organization account is suspended. Please contact Flowdesk support.',
        suspendedReason: tenant.suspendedReason || '',
      });
      return;
    }

    // Email verification check for mutating operations
    if (user.isVerified === false && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.status(403).json({
        message:
          'Email verification required: Please verify your email address to create or modify records.',
        needsVerification: true,
      });
      return;
    }

    req.tenant = tenant;
    const clientMutationId = (req.headers['x-client-mutation-id'] as string) || undefined;
    req.clientMutationId = clientMutationId;

    // Run rest of request inside active tenant context
    return runWithTenantContext(
      {
        tenantId: user.tenantId.toString(),
        user,
        requestId,
        clientMutationId,
      },
      () => next()
    );
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (req.user.role === 'platform_admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden: Insufficient permissions for this action' });
      return;
    }

    next();
  };
}

export function requirePlatformAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'platform_admin') {
    res.status(403).json({ message: 'Forbidden: Platform administrator access required' });
    return;
  }
  next();
}
