import { useSessionStore } from './sessionStore';
import { UserRole } from '@flowdesk/shared';

export type PermissionAction =
  | 'lead:create'
  | 'lead:read'
  | 'lead:update'
  | 'lead:delete'
  | 'deal:create'
  | 'deal:read'
  | 'deal:update'
  | 'deal:delete'
  | 'task:create'
  | 'task:read'
  | 'task:update'
  | 'task:delete'
  | 'contact:create'
  | 'contact:read'
  | 'contact:update'
  | 'contact:delete'
  | 'account:create'
  | 'account:read'
  | 'account:update'
  | 'account:delete'
  | 'team:view'
  | 'team:invite'
  | 'team:edit'
  | 'reports:view'
  | 'settings:view'
  | 'settings:edit';

export function hasPermission(role: UserRole | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  if (role === 'platform_admin' || role === 'admin') return true;

  if (role === 'manager') {
    // Managers can do everything except delete records or invite/edit roles
    if (action.endsWith(':delete')) return false;
    if (action === 'team:invite' || action === 'team:edit') return false;
    if (action === 'settings:edit') return false;
    return true;
  }

  if (role === 'sales') {
    // Sales reps cannot delete, manage team, or edit settings
    if (action.endsWith(':delete')) return false;
    if (action.startsWith('team:')) return false;
    if (action === 'settings:edit') return false;
    return true;
  }

  return false;
}

/**
 * Hook to evaluate whether current authenticated user has permission for an action.
 * Example: const canDelete = useCan('lead:delete');
 */
export function useCan(action: PermissionAction): boolean {
  const user = useSessionStore((state) => state.user);
  return hasPermission(user?.role, action);
}
