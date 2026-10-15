export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  leads: {
    all: ['leads'] as const,
    lists: () => [...queryKeys.leads.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.leads.lists(), params] as const,
    details: () => [...queryKeys.leads.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.leads.details(), id] as const,
  },
  deals: {
    all: ['deals'] as const,
    lists: () => [...queryKeys.deals.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.deals.lists(), params] as const,
    details: () => [...queryKeys.deals.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.deals.details(), id] as const,
    kanban: (params?: Record<string, any>) => [...queryKeys.deals.all, 'kanban', params] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    lists: () => [...queryKeys.contacts.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.contacts.lists(), params] as const,
    details: () => [...queryKeys.contacts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.contacts.details(), id] as const,
  },
  accounts: {
    all: ['accounts'] as const,
    lists: () => [...queryKeys.accounts.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.accounts.lists(), params] as const,
    details: () => [...queryKeys.accounts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.accounts.details(), id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.tasks.lists(), params] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    summary: (scope: string = 'me', range: string = 'week', owner?: string) =>
      [...queryKeys.dashboard.all, 'summary', { scope, range, owner }] as const,
  },
  reports: {
    all: ['reports'] as const,
    salesTrend: (range: string = 'month') => [...queryKeys.reports.all, 'salesTrend', range] as const,
    stageAnalysis: () => [...queryKeys.reports.all, 'stageAnalysis'] as const,
    kpis: (range: string = 'month') => [...queryKeys.reports.all, 'kpis', range] as const,
  },
  leadSources: {
    all: ['leadSources'] as const,
    summary: (range: string = 'week') => [...queryKeys.leadSources.all, 'summary', range] as const,
    list: (params?: Record<string, any>) => [...queryKeys.leadSources.all, 'list', params] as const,
  },
  messages: {
    all: ['messages'] as const,
    lists: () => [...queryKeys.messages.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.messages.lists(), params] as const,
    threads: (channel?: string) => [...queryKeys.messages.all, 'threads', channel] as const,
    thread: (threadId: string) => [...queryKeys.messages.all, 'thread', threadId] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
    team: () => [...queryKeys.users.all, 'team'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => [...queryKeys.notifications.all, 'list'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unreadCount'] as const,
  },
  activities: {
    all: ['activities'] as const,
    list: (params?: Record<string, any>) => ['activities', 'list', params] as const,
    entity: (type: string, id: string) => ['activities', type, id] as const,
  },
};
