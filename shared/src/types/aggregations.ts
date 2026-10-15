export type TimeRange = 'week' | 'month' | 'quarter' | 'year';
export type DashboardScope = 'me' | 'team';

export interface MetricWithDelta {
  value: number;
  changePercent: number; // e.g. +14% vs previous period
  count?: number;
}

export interface PipelineStageCount {
  stage: string;
  count: number;
  amount: number;
  percentage?: number;
}

export interface MobileDashboardSummary {
  leads: MetricWithDelta;
  deals: MetricWithDelta;
  contacts: MetricWithDelta;
  revenue: MetricWithDelta;
  pipelineByStage: PipelineStageCount[];
  upNextTask: any | null;
  // Backward compatibility with web
  wonThisMonth?: { amount: number; count: number };
  wonLastMonth?: { amount: number; count: number };
  revenueChangePercent?: number;
  pipelineValue?: number;
  openDealCount?: number;
  dealsWon?: number;
  winRate?: number;
  newLeads?: number;
  totalLeads?: number;
  pipelineHealth?: number;
  dealsAtRisk?: any;
  taskStats?: any;
  ticketStats?: any;
  dealsByStage?: any[];
  revenueByMonth?: any[];
  recentDeals?: any[];
  openTasks?: any[];
  insights?: any;
  receivables?: {
    totalOutstandingPaise: number;
    totalOverduePaise: number;
    overdueCount: number;
    overduePct: number;
  };
}

export interface SalesTrendPoint {
  date: string;
  label: string;
  amount: number;
  count: number;
}

export interface SalesTrendReport {
  trend: SalesTrendPoint[];
  totalRevenue: number;
  previousRevenue: number;
  changePercent: number;
}

export interface StageAnalysisItem {
  stage: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface StageAnalysisReport {
  stages: StageAnalysisItem[];
  totalDeals: number;
  totalAmount: number;
}

export interface KpiSummary {
  winRate: number; // percentage e.g. 64%
  winRateDelta: number;
  averageDealSize: number; // in INR
  averageDealSizeDelta: number;
  salesCycleDays: number; // average days from creation to win
  salesCycleDelta: number;
  totalWonDeals: number;
  totalClosedDeals: number;
}

export interface LeadSourceBarItem {
  source: string;
  count: number;
  percentage: number;
}

export interface ConnectedChannelStatus {
  id: string;
  name: string;
  channel: string;
  status: 'connected' | 'setup_needed' | 'error';
  lastLeadAt?: string | Date | null;
}

export interface LeadSourcesSummaryReport {
  newLeadsThisWeek: number;
  newLeadsDeltaPercent: number;
  totalLeads: number;
  bySource: LeadSourceBarItem[];
  connectedChannels: ConnectedChannelStatus[];
}
