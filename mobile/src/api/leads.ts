import { apiClient } from './client';
import {
  Lead,
  LeadInput,
  LeadUpdateInput,
  CursorPaginatedResponse,
} from '@flowdesk/shared';

export interface LeadListParams {
  cursor?: string;
  limit?: number;
  updatedSince?: string;
  search?: string;
  status?: string;
  rating?: string;
  source?: string;
  sort?: string;
}

export async function fetchLeads(
  params?: LeadListParams
): Promise<CursorPaginatedResponse<Lead>> {
  const query = new URLSearchParams();
  if (params?.cursor) query.append('cursor', params.cursor);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.updatedSince) query.append('updatedSince', params.updatedSince);
  if (params?.search) query.append('q', params.search);
  if (params?.status) query.append('status', params.status);
  if (params?.rating) query.append('rating', params.rating);
  if (params?.source) query.append('source', params.source);
  if (params?.sort) query.append('sort', params.sort);

  const res = await apiClient.get<CursorPaginatedResponse<Lead>>(
    `/leads?${query.toString()}`
  );
  return res.data;
}

export async function fetchLeadById(id: string): Promise<Lead> {
  const res = await apiClient.get<Lead>(`/leads/${id}`);
  return res.data;
}

export async function createLead(data: LeadInput): Promise<Lead> {
  const res = await apiClient.post<Lead>('/leads', data);
  return res.data;
}

export async function updateLead(
  id: string,
  data: Partial<LeadUpdateInput>
): Promise<Lead> {
  const res = await apiClient.patch<Lead>(`/leads/${id}`, data);
  return res.data;
}

export async function deleteLead(id: string): Promise<{ id: string }> {
  const res = await apiClient.delete<{ id: string }>(`/leads/${id}`);
  return res.data;
}

export async function convertLead(id: string): Promise<any> {
  const res = await apiClient.post(`/leads/${id}/convert`);
  return res.data;
}
