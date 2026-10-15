import { apiClient } from './client';
import {
  Deal,
  DealInput,
  DealUpdateInput,
  CursorPaginatedResponse,
} from '@flowdesk/shared';

export interface DealListParams {
  cursor?: string;
  limit?: number;
  updatedSince?: string;
  search?: string;
  stage?: string;
  sort?: string;
}

export async function fetchDeals(
  params?: DealListParams
): Promise<CursorPaginatedResponse<Deal>> {
  const query = new URLSearchParams();
  if (params?.cursor) query.append('cursor', params.cursor);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.updatedSince) query.append('updatedSince', params.updatedSince);
  if (params?.search) query.append('q', params.search);
  if (params?.stage) query.append('stage', params.stage);
  if (params?.sort) query.append('sort', params.sort);

  const res = await apiClient.get<CursorPaginatedResponse<Deal>>(
    `/deals?${query.toString()}`
  );
  return res.data;
}

export async function fetchDealById(id: string): Promise<Deal> {
  const res = await apiClient.get<Deal>(`/deals/${id}`);
  return res.data;
}

export async function createDeal(data: DealInput): Promise<Deal> {
  const res = await apiClient.post<Deal>('/deals', data);
  return res.data;
}

export async function updateDeal(
  id: string,
  data: Partial<DealUpdateInput>
): Promise<Deal> {
  const res = await apiClient.patch<Deal>(`/deals/${id}`, data);
  return res.data;
}

export async function deleteDeal(id: string): Promise<{ id: string }> {
  const res = await apiClient.delete<{ id: string }>(`/deals/${id}`);
  return res.data;
}
