export type UserRole = 'platform_admin' | 'admin' | 'manager' | 'sales';

export interface TenantLimits {
  maxSeats: number;
  maxRecords: number;
  aiEnabled: boolean;
  aiMonthlyRequests: number;
}

export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  plan: 'free' | 'pro';
  limits: TenantLimits;
  seatsCount?: number;
  recordsCount?: number;
  lastActiveAt?: string;
  suspendedReason?: string;
  deletionRequestedAt?: string;
  createdAt?: string;
}

export interface User {
  _id: string;
  tenantId?: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type LeadSource = 'website' | 'referral' | 'social' | 'email' | 'event' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export interface LeadScore {
  score: number;
  grade: 'hot' | 'warm' | 'cold';
  reasons: string[];
  explanation?: string;
  scoredAt: string;
}

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
  aiScore?: LeadScore;
  rating?: 'hot' | 'warm' | 'cold';
  // Phase 5: Marketing Attribution additions
  channel?: MarketingChannel;
  campaign?: {
    externalId?: string;
    name?: string;
  };
  adSet?: {
    externalId?: string;
    name?: string;
  };
  ad?: {
    externalId?: string;
    name?: string;
  };
  formName?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  clickIds?: {
    gclid?: string;
    fbclid?: string;
  };
  landingPage?: string;
  referrer?: string;
  consent?: {
    given: boolean;
    text?: string;
    at?: string;
    via?: string;
  };
  inquiryCount?: number;
  lastInquiryAt?: string;
  firstContactAt?: string | null;
  isTest?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MarketingChannel =
  | 'google_ads'
  | 'facebook'
  | 'instagram'
  | 'website_form'
  | 'whatsapp'
  | 'manual'
  | 'import'
  | 'api'
  | 'other';

export type LeadSourcePlatformType =
  | 'meta_lead_ads'
  | 'google_ads'
  | 'website_form'
  | 'generic_webhook';

export type LeadSourceStatus = 'active' | 'paused' | 'error';

export interface LeadSourceCounters {
  received: number;
  created: number;
  duplicates: number;
  failed: number;
}

export interface LeadSourceItem {
  _id: string;
  tenantId: string;
  name: string;
  type: LeadSourcePlatformType;
  status: LeadSourceStatus;
  config: Record<string, any>;
  webhookId: string;
  routingRules: any[];
  counters: LeadSourceCounters;
  lastLeadAt: string | null;
  lastError: string | null;
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadEventItem {
  _id: string;
  tenantId: string;
  source: string;
  providerLeadId?: string;
  status: 'received' | 'processed' | 'duplicate' | 'ignored' | 'failed';
  attempts: number;
  error?: string | null;
  rawPayload: Record<string, any>;
  lead?: {
    _id: string;
    name: string;
    email: string;
    status: string;
    isTest?: boolean;
    createdAt: string;
  } | null;
  isTest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignItem {
  _id: string;
  tenantId: string;
  channel: MarketingChannel;
  externalId: string;
  name: string;
  leadCount?: number;
  firstSeenAt: string;
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

export interface DealRisk {
  level: 'low' | 'medium' | 'high';
  score: number;
  reasons: string[];
  explanation?: string;
  evaluatedAt: string;
}

export interface Deal {
  _id: string;
  title: string;
  account: Account | { _id: string; name: string; industry: string };
  contact?: (Contact | { _id: string; firstName: string; lastName: string; email: string; phone: string }) | null;
  amount: number;
  stage: DealStage;
  expectedClose: string;
  closedAt: string | null;
  custom?: Record<string, any>;
  owner: User | string;
  aiRisk?: DealRisk;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'open' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskType = 'call' | 'email' | 'meeting' | 'document' | 'todo';

export interface Task {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  type?: TaskType;
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
    highRiskCount?: number;
    mediumRiskCount?: number;
    lowRiskCount?: number;
  };
  taskStats: {
    total: number;
    doneRate: number;
    open: number;
    done: number;
    overdue: number;
  };
  ticketStats?: {
    open: number;
    breached: number;
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
    openTickets?: number;
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

// Support Tickets Types
export type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketChannel = 'manual' | 'portal' | 'email' | 'whatsapp';

export interface TicketAttachment {
  filename: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface TicketMessage {
  _id: string;
  ticket: string;
  author?: User | null;
  type: 'public_reply' | 'internal_note' | 'system';
  body: string;
  attachments?: TicketAttachment[];
  createdAt: string;
  updatedAt?: string;
}

export interface Ticket {
  _id: string;
  number: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  contact?: Contact | null;
  account?: Account | null;
  deal?: Deal | null;
  assignee?: User | null;
  createdBy?: User | null;
  tags?: string[];
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  slaFirstResponseDue?: string | null;
  slaResolutionDue?: string | null;
  slaBreached?: {
    firstResponse: boolean;
    resolution: boolean;
  };
  slaPendingPausedAt?: string | null;
  slaPendingTotalPausedMs?: number;
  publicToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CannedResponse {
  _id: string;
  shortcut?: string;
  title: string;
  body: string;
  category?: string;
  shared: boolean;
  createdBy: string;
  createdAt: string;
}

export interface SlaPriorityTarget {
  firstResponseHours: number;
  resolutionHours: number;
}

export interface SlaPolicy {
  _id: string;
  name: string;
  operatingHours: 'business_hours' | '24x7';
  businessHoursStart: string;
  businessHoursEnd: string;
  timeZone: string;
  priorities: {
    low: SlaPriorityTarget;
    medium: SlaPriorityTarget;
    high: SlaPriorityTarget;
    urgent: SlaPriorityTarget;
  };
  isDefault: boolean;
}

export type RealtimeEntityType =
  | 'lead'
  | 'contact'
  | 'account'
  | 'deal'
  | 'task'
  | 'message'
  | 'user'
  | 'leadSource';

export type RealtimeActionType = 'created' | 'updated' | 'deleted' | 'bulk';

export interface EntityChangedPayload {
  entity: RealtimeEntityType;
  action: RealtimeActionType;
  id?: string;
  orgId: string;
  actorId?: string;
  clientMutationId?: string;
  updatedAt?: string | Date;
  data?: any;
}

// ================= ZOHO SALES: DOCUMENTS & FORECASTS TYPES =================

export type DocumentStatus = 'draft' | 'under_review' | 'approved' | 'signed' | 'archived';
export type RelatedEntityType = 'deal' | 'account' | 'lead' | 'contact' | 'none';

export interface DocumentItem {
  _id: string;
  name: string;
  folder: string;
  fileType: string;
  fileSize: number;
  fileData?: string;
  version: string;
  status: DocumentStatus;
  tags: string[];
  description?: string;
  relatedTo?: {
    entityType: RelatedEntityType;
    entityId?: string;
    entityName?: string;
  };
  uploadedBy?: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  downloadCount: number;
  isShared: boolean;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFolder {
  name: string;
  count: number;
}

export interface DocumentStats {
  totalDocuments: number;
  totalBytes: number;
  starredCount: number;
  folders: DocumentFolder[];
}

export interface ForecastSummary {
  targetQuota: number;
  closedWonAmount: number;
  closedWonCount: number;
  committedAmount: number;
  committedCount: number;
  bestCaseAmount: number;
  totalPipelineAmount: number;
  totalPipelineCount: number;
  attainmentPercent: number;
  gapAmount: number;
  coverageRatio: number;
}

export interface ForecastAiInsights {
  status: string;
  predictedAttainment: number;
  expectedFinalRevenue: number;
  recommendation: string;
  highRiskCount: number;
  closingSoonCount: number;
  highRiskDeals: Array<{
    _id: string;
    title: string;
    amount: number;
    stage: string;
    probability: number;
    weightedAmount: number;
    expectedClose: string;
    account?: { name: string };
    aiRisk?: { level: string; score: number; reasons: string[] };
  }>;
  closingSoonDeals: Array<{
    _id: string;
    title: string;
    amount: number;
    stage: string;
    expectedClose: string;
    account?: { name: string };
  }>;
}

export interface ForecastDealItem {
  _id: string;
  title: string;
  amount: number;
  stage: string;
  probability: number;
  weightedAmount: number;
  expectedClose: string;
  account?: { _id: string; name: string; industry?: string };
  owner?: { _id: string; name: string; email: string };
  aiRisk?: { level: string; score: number; reasons: string[]; explanation?: string };
}

export interface ForecastMonthlyBar {
  monthKey: string;
  monthLabel: string;
  year: number;
  monthIndex: number;
  wonAmount: number;
  committedAmount: number;
  weightedAmount: number;
  grossAmount: number;
  dealsCount: number;
}

export interface ForecastDashboardData {
  period: string;
  year: number;
  summary: ForecastSummary;
  aiInsights: ForecastAiInsights;
  stageBreakdown: Record<
    string,
    { count: number; totalAmount: number; weightedAmount: number; probability: number }
  >;
  monthlyBreakdown: ForecastMonthlyBar[];
  deals: ForecastDealItem[];
  repLeaderboard: Array<{
    owner: { _id: string; name: string; email: string; role?: string };
    wonAmount: number;
    wonCount: number;
    pipelineAmount: number;
    weightedAmount: number;
    dealsCount: number;
  }>;
}

// ================= ZOHO ACTIVITIES: MEETINGS & CALLS =================

export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingLocationType = 'google_meet' | 'zoom' | 'teams' | 'in_person' | 'phone' | 'other';

export interface MeetingItem {
  _id: string;
  title: string;
  from: string;
  to: string;
  allDay: boolean;
  status: MeetingStatus;
  locationType: MeetingLocationType;
  locationDetails?: string;
  meetingUrl?: string;
  relatedTo: {
    entityType: 'deal' | 'account' | 'lead' | 'contact' | 'none';
    entityId?: string;
    entityName?: string;
  };
  contactName?: string;
  contactEmail?: string;
  host: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  };
  participants: string[];
  agenda?: string;
  outcome?: string; // MOM
  reminderMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingStats {
  totalMeetings: number;
  upcomingCount: number;
  todayCount: number;
  completedCount: number;
}

export type CallType = 'outbound' | 'inbound' | 'scheduled';
export type CallPurpose = 'discovery' | 'prospecting' | 'demo' | 'negotiation' | 'follow_up' | 'support' | 'administrative';
export type CallResult =
  | 'connected'
  | 'left_voicemail'
  | 'no_answer'
  | 'busy'
  | 'wrong_number'
  | 'callback_requested'
  | 'interested'
  | 'not_interested';

export interface CallItem {
  _id: string;
  subject: string;
  callType: CallType;
  callPurpose: CallPurpose;
  startTime: string;
  durationSeconds: number;
  callResult: CallResult;
  relatedTo: {
    entityType: 'deal' | 'account' | 'lead' | 'contact' | 'none';
    entityId?: string;
    entityName?: string;
  };
  contactName?: string;
  phoneNumber?: string;
  owner: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  };
  notes?: string;
  followUpAction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallStats {
  totalCalls: number;
  outboundCount: number;
  inboundCount: number;
  scheduledCount: number;
  totalDurationSeconds: number;
}



