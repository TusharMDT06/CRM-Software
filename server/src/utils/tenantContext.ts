import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextStore {
  tenantId?: string;
  isBypassTenant?: boolean;
  isImpersonating?: boolean;
  isReadOnly?: boolean;
  user?: any;
  requestId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContextStore>();

/**
 * Runs an asynchronous or synchronous function within a specific tenant context
 */
export function runWithTenantContext<T>(
  context: TenantContextStore,
  fn: () => Promise<T> | T
): Promise<T> {
  return asyncLocalStorage.run(context, async () => {
    return await fn();
  });
}

/**
 * Returns current tenant context store
 */
export function getTenantContext(): TenantContextStore | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Returns active tenantId string if present
 */
export function getCurrentTenantId(): string | undefined {
  return asyncLocalStorage.getStore()?.tenantId;
}

/**
 * Returns whether tenant scoping is explicitly bypassed (e.g. platform admin, migrations)
 */
export function isTenantBypassed(): boolean {
  return Boolean(asyncLocalStorage.getStore()?.isBypassTenant);
}

/**
 * Returns whether current context is read-only (e.g. platform admin impersonation)
 */
export function isReadOnlyContext(): boolean {
  return Boolean(asyncLocalStorage.getStore()?.isReadOnly);
}
