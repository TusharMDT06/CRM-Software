import { apiClient } from './client';
import {
  SalesTrendReport,
  StageAnalysisReport,
  KpiSummary,
  TimeRange,
} from '@flowdesk/shared';

export async function fetchSalesTrend(
  range: TimeRange = 'month'
): Promise<SalesTrendReport> {
  const res = await apiClient.get<SalesTrendReport>(
    `/reports/sales-trend?range=${range}`
  );
  return res.data;
}

export async function fetchStageAnalysis(): Promise<StageAnalysisReport> {
  const res = await apiClient.get<StageAnalysisReport>('/reports/stage-analysis');
  return res.data;
}

export async function fetchKpis(
  range: TimeRange = 'month'
): Promise<KpiSummary> {
  const res = await apiClient.get<KpiSummary>(`/reports/kpis?range=${range}`);
  return res.data;
}
