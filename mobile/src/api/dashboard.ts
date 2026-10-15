import { apiClient } from './client';
import { MobileDashboardSummary } from '@flowdesk/shared';

export async function fetchDashboardSummary(
  scope: 'me' | 'team' = 'me',
  range: 'week' | 'month' | 'quarter' | 'year' = 'week',
  owner?: string
): Promise<MobileDashboardSummary> {
  const url = owner
    ? `/dashboard/summary?scope=${scope}&range=${range}&owner=${encodeURIComponent(owner)}`
    : `/dashboard/summary?scope=${scope}&range=${range}`;
  const res = await apiClient.get<MobileDashboardSummary>(url);
  return res.data;
}
