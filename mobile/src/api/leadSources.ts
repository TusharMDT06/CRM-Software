import { apiClient } from './client';
import {
  LeadSourcesSummaryReport,
  LeadSource,
  CursorPaginatedResponse,
  TimeRange,
} from '@flowdesk/shared';

export async function fetchLeadSourcesSummary(
  range: TimeRange = 'week'
): Promise<LeadSourcesSummaryReport> {
  const res = await apiClient.get<LeadSourcesSummaryReport>(
    `/lead-sources/summary?range=${range}`
  );
  return res.data;
}

export async function fetchLeadSources(): Promise<CursorPaginatedResponse<LeadSource>> {
  const res = await apiClient.get<CursorPaginatedResponse<LeadSource>>('/lead-sources');
  return res.data;
}
