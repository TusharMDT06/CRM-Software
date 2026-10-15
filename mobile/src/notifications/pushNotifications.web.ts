/**
 * Web implementation of push notifications (no-op on web preview)
 */

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null;
}

export async function unregisterPushNotificationsAsync(): Promise<void> {
  // No-op on web
}

export function resolveDeepLinkRoute(rawUrl?: string, data?: Record<string, any>): string | null {
  if (!rawUrl && !data) return null;

  let url = rawUrl || '';

  if (!url && data?.link) {
    url = data.link;
  }

  if (url.startsWith('flowdesk://')) {
    const path = url.replace('flowdesk://', '');
    const [section, id] = path.split('/');

    if (section === 'leads' && id) return `/(tabs)/leads/${id}`;
    if (section === 'deals' && id) return `/(tabs)/deals/${id}`;
    if (section === 'tasks') return `/(tabs)/more/tasks`;
    if (section === 'messages' && id) return `/(tabs)/more/messages/thread/${id}`;
    if (section === 'contacts' && id) return `/(tabs)/contacts/${id}`;
  }

  if (url.startsWith('/leads/')) {
    const id = url.replace('/leads/', '');
    return `/(tabs)/leads/${id}`;
  }
  if (url.startsWith('/deals/')) {
    const id = url.replace('/deals/', '');
    return `/(tabs)/deals/${id}`;
  }
  if (url.startsWith('/tasks')) {
    return `/(tabs)/more/tasks`;
  }
  if (url.startsWith('/messages/thread/')) {
    const id = url.replace('/messages/thread/', '');
    return `/(tabs)/more/messages/thread/${id}`;
  }
  if (url.startsWith('/contacts/')) {
    const id = url.replace('/contacts/', '');
    return `/(tabs)/contacts/${id}`;
  }

  if (data?.entityType && data?.entityId) {
    if (data.entityType === 'lead') return `/(tabs)/leads/${data.entityId}`;
    if (data.entityType === 'deal') return `/(tabs)/deals/${data.entityId}`;
    if (data.entityType === 'task') return `/(tabs)/more/tasks`;
    if (data.entityType === 'message') return `/(tabs)/more/messages/thread/${data.entityId}`;
    if (data.entityType === 'contact') return `/(tabs)/contacts/${data.entityId}`;
  }

  return null;
}

export function setupPushNotificationListeners(
  _onNavigate: (route: string) => void
): () => void {
  return () => {};
}

export async function handleInitialPushOrDeepLink(
  _onNavigate: (route: string) => void
): Promise<void> {
  // No-op on web
}
