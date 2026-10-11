import { Schema, Types, Query, Aggregate } from 'mongoose';
import {
  getTenantContext,
  isTenantBypassed,
  isReadOnlyContext,
} from './tenantContext.js';

export class TenantContextError extends Error {
  constructor(message: string = 'Tenant context missing: A query with no tenant context is strictly forbidden') {
    super(message);
    this.name = 'TenantContextError';
  }
}

export function tenantPlugin(schema: Schema) {
  // 1. Add tenantId field to schema if not already explicitly defined
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: {
        type: Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
      },
    });
  }

  function resolveTenantId(isWrite: boolean = false): Types.ObjectId | undefined {
    if (isTenantBypassed()) {
      return undefined;
    }

    const ctx = getTenantContext();
    if (!ctx || !ctx.tenantId) {
      throw new TenantContextError();
    }

    if (isWrite && isReadOnlyContext()) {
      throw new Error('Tenant impersonation is read-only. Modifications are forbidden.');
    }

    return new Types.ObjectId(ctx.tenantId);
  }

  // 2. Query hooks for all read and write queries
  const queryOps = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndReplace',
    'findOneAndDelete',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'countDocuments',
    'distinct',
  ] as const;

  schema.pre(queryOps as any, function (this: Query<any, any>) {
    const options = (this as any).getOptions ? (this as any).getOptions() : {};
    if (options.bypassTenant) {
      return;
    }

    const isWrite = [
      'updateOne',
      'updateMany',
      'findOneAndUpdate',
      'findOneAndReplace',
      'findOneAndDelete',
      'deleteOne',
      'deleteMany',
    ].includes((this as any).op);

    const tenantId = resolveTenantId(isWrite);
    if (tenantId) {
      this.where({ tenantId });
    }
  });

  // 3. Pre-aggregate hook: Injects $match: { tenantId } as the FIRST aggregation stage
  schema.pre('aggregate', function (this: Aggregate<any>) {
    const options = (this as any).options || {};
    if (options.bypassTenant) {
      return;
    }

    const tenantId = resolveTenantId(false);
    if (tenantId) {
      const pipeline = this.pipeline();
      // Inject $match as the very first stage
      pipeline.unshift({ $match: { tenantId } });
    }
  });

  // 4. Pre-validate and Pre-save hooks for document instantiation & saving
  schema.pre('validate', function (this: any, next) {
    try {
      const isWrite = true;
      const tenantId = resolveTenantId(isWrite);

      if (tenantId) {
        if (!this.tenantId) {
          this.tenantId = tenantId;
        } else if (this.isNew && this.tenantId.toString() !== tenantId.toString()) {
          // Prevent setting a different tenantId than active context
          this.tenantId = tenantId;
        }
      }
      next();
    } catch (err: any) {
      next(err);
    }
  });

  // 5. Pre-insertMany hook for bulk insertions
  schema.pre('insertMany', function (this: any, next: (err?: any) => void, docs: any[]) {
    try {
      const isWrite = true;
      const tenantId = resolveTenantId(isWrite);

      if (tenantId && Array.isArray(docs)) {
        for (const doc of docs) {
          if (!doc.tenantId) {
            doc.tenantId = tenantId;
          }
        }
      }
      next();
    } catch (err: any) {
      next(err);
    }
  });
}
