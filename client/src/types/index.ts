export type UserRole = 'admin' | 'manager' | 'sales';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type LeadSource = 'website' | 'referral' | 'social' | 'email' | 'event' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export interface Lead {
  _id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  value: number;
  notes: string;
  custom?: Record<string, any>;
  owner: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  _id: string;
  name: string;
  industry: string;
  website: string;
  phone: string;
  city: string;
  employees: number;
  custom?: Record<string, any>;
  owner: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  account: Account | string;
  custom?: Record<string, any>;
  owner: User | string;
  createdAt: string;
  updatedAt: string;
}

export type DealStage = 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Deal {
  _id: string;
  title: string;
  account: Account | { _id: string; name: string; industry: string };
  contact: Contact | { _id: string; firstName: string; lastName: string; email: string; phone: string };
  amount: number;
  stage: DealStage;
  expectedClose: string;
  closedAt: string | null;
  custom?: Record<string, any>;
  owner: User | string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'open' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  deal?: Deal | { _id: string; title: string; stage: string; amount: number } | null;
  owner: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  wonThisMonth: { amount: number; count: number };
  wonLastMonth: { amount: number; count: number };
  revenueChangePercent: number;
  pipelineValue: number;
  openDealCount: number;
  dealsWon: number;
  winRate: number;
  newLeads: number;
  totalLeads: number;
  pipelineHealth: number;
  dealsAtRisk: {
    count: number;
    amount: number;
    percentage: number;
    activeCount: number;
    healthyCount: number;
  };
  taskStats: {
    total: number;
    doneRate: number;
    open: number;
    done: number;
    overdue: number;
  };
  dealsByStage: Array<{
    stage: DealStage;
    count: number;
    amount: number;
  }>;
  revenueByMonth: Array<{
    month: string;
    shortMonth: string;
    year: number;
    amount: number;
    count: number;
  }>;
  recentDeals: Deal[];
  openTasks: Task[];
  insights: {
    newLeadsWaiting: number;
    dealsInNegotiation: number;
    overdueTasks: number;
  };
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export type ActivityType = 'note' | 'call' | 'meeting' | 'email' | 'task' | 'stage_change' | 'system';
export type ActivityOutcome = 'connected' | 'no_answer' | 'left_message';

export interface Activity {
  _id: string;
  type: ActivityType;
  subject: string;
  body: string;
  entityType: 'lead' | 'contact' | 'account' | 'deal';
  entityId: string;
  createdBy: User | { _id: string; name: string; email: string; role: UserRole };
  occurredAt: string;
  durationMins?: number;
  outcome?: ActivityOutcome;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory = 'follow_up' | 'proposal' | 'intro' | 'thank_you' | 'other';

export interface EmailTemplate {
  _id: string;
  name: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  shared: boolean;
  owner: User | { _id: string; name: string; email: string; role: UserRole };
  createdAt: string;
  updatedAt: string;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url';

export interface FieldDefinition {
  _id: string;
  entity: 'lead' | 'contact' | 'account' | 'deal';
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required: boolean;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FunnelReportData {
  funnel: Array<{
    stage: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  conversion: {
    totalLeads: number;
    convertedLeads: number;
    rate: number;
  };
}

export interface RevenueReportData {
  months: Array<{
    month: string;
    amount: number;
    count: number;
    prevAmount: number;
  }>;
  summary: {
    total: number;
    avgDealSize: number;
    count: number;
    prevTotal: number;
    percentageChange: number;
  };
}

export interface LeadsReportData {
  bySource: Array<{
    source: string;
    count: number;
    converted: number;
    rate: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  overallConversionRate: number;
}

export interface TeamLeaderboardReportData {
  leaderboard: Array<{
    owner: {
      _id: string;
      name: string;
      email: string;
    };
    wonCount: number;
    wonRevenue: number;
    winRate: number;
    pipelineValue: number;
    tasksCompleted: number;
  }>;
}

export interface ForecastReportData {
  months: Array<{
    month: string;
    totalAmount: number;
    weightedAmount: number;
    count: number;
  }>;
  summary: {
    totalAmount: number;
    weightedAmount: number;
    count: number;
  };
}

// ================= PHASE 3 TYPES =================

export type ProductUnit = 'nos' | 'hours' | 'days' | 'months' | 'kg' | 'other';

export interface Product {
  _id: string;
  name: string;
  sku: string;
  description?: string;
  unitPrice: number; // in paise
  taxRate: number; // percentage
  unit: ProductUnit;
  active: boolean;
  owner?: User | { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface BankDetails {
  accountName?: string;
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
}

export interface CompanySettings {
  _id?: string;
  legalName: string;
  address: string;
  state: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  bankDetails?: BankDetails;
  defaultPaymentTermsDays: number;
  defaultQuoteValidityDays: number;
  defaultTerms?: string;
  quotePrefix: string;
  invoicePrefix: string;
}

export interface QuoteLineItem {
  product?: string | Product;
  name: string;
  description?: string;
  qty: number;
  unitPrice: number; // in paise
  discountPct: number; // percent
  taxRate: number; // percent
  rawAmount?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxAmount?: number;
  lineTotal?: number;
}

export type QuoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'expired';

export interface Quote {
  _id: string;
  number: string;
  status: QuoteStatus;
  deal: any;
  account: any;
  contact: any;
  items: QuoteLineItem[];
  subtotal: number; // paise
  discountTotal: number; // paise
  taxableTotal: number; // paise
  taxTotal: number; // paise
  cgstTotal: number; // paise
  sgstTotal: number; // paise
  igstTotal: number; // paise
  total: number; // paise
  taxMode: 'intra' | 'inter';
  validUntil: string;
  notes?: string;
  terms?: string;
  publicToken: string;
  approval?: {
    required: boolean;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt?: string;
    respondedAt?: string;
    approvedBy?: any;
    reason?: string;
  };
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
  responseReason?: string;
  owner: any;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void';

export interface Invoice {
  _id: string;
  number: string;
  status: InvoiceStatus;
  quote?: any;
  deal: any;
  account: any;
  contact: any;
  items: QuoteLineItem[];
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  total: number;
  taxMode: 'intra' | 'inter';
  issueDate: string;
  dueDate: string;
  paidTotal: number;
  balance: number;
  notes?: string;
  terms?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: any;
  owner: any;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod =
  | 'bank_transfer'
  | 'upi'
  | 'card'
  | 'cash'
  | 'cheque'
  | 'other';

export interface Payment {
  _id: string;
  invoice: string | Invoice;
  amount: number; // paise
  method: PaymentMethod;
  reference?: string;
  paidAt: string;
  notes?: string;
  recordedBy: any;
  createdAt: string;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_empty';
  value?: any;
}

export interface WorkflowAction {
  type: 'create_task' | 'send_email' | 'send_notification' | 'update_field' | 'assign_owner';
  config: Record<string, any>;
}

export interface Workflow {
  _id: string;
  name: string;
  description?: string;
  enabled: boolean;
  stopOnError?: boolean;
  trigger: {
    type: string;
    config?: Record<string, any>;
  };
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  roundRobinIndex?: number;
  lastRunAt?: string;
  runCount: number;
  owner: any;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  _id: string;
  workflow: string;
  triggerEntity: {
    type: string;
    id: string;
  };
  status: 'success' | 'failed' | 'skipped';
  steps: Array<{
    action: string;
    status: 'success' | 'failed' | 'skipped';
    message?: string;
  }>;
  startedAt: string;
  finishedAt: string;
  error?: string;
  createdAt: string;
}

export interface Notification {
  _id: string;
  user: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  inApp: boolean;
  email: boolean;
}

export interface AuditLog {
  _id: string;
  actor?: any;
  actorName: string;
  source: 'user' | 'system' | 'automation' | 'public_link';
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel: string;
  changes: Array<{
    field: string;
    from: any;
    to: any;
  }>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

