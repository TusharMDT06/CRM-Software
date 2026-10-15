import { apiClient } from './client';
import {
  Account,
  AccountInput,
  AccountUpdateInput,
  CursorPaginatedResponse,
} from '@flowdesk/shared';

export interface AccountListParams {
  cursor?: string;
  limit?: number;
  updatedSince?: string;
  search?: string;
  industry?: string;
  sort?: string;
}

export async function fetchAccounts(
  params?: AccountListParams
): Promise<CursorPaginatedResponse<Account>> {
  const query = new URLSearchParams();
  if (params?.cursor) query.append('cursor', params.cursor);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.updatedSince) query.append('updatedSince', params.updatedSince);
  if (params?.search) query.append('q', params.search);
  if (params?.industry) query.append('industry', params.industry);
  if (params?.sort) query.append('sort', params.sort);

  const res = await apiClient.get<CursorPaginatedResponse<Account>>(
    `/accounts?${query.toString()}`
  );
  return res.data;
}

export async function fetchAccountById(id: string): Promise<Account> {
  const res = await apiClient.get<Account>(`/accounts/${id}`);
  return res.data;
}

export async function createAccount(data: AccountInput): Promise<Account> {
  const res = await apiClient.post<Account>('/accounts', data);
  return res.data;
}

export async function updateAccount(
  id: string,
  data: Partial<AccountUpdateInput>
): Promise<Account> {
  const res = await apiClient.patch<Account>(`/accounts/${id}`, data);
  return res.data;
}

export async function deleteAccount(id: string): Promise<{ id: string }> {
  const res = await apiClient.delete<{ id: string }>(`/accounts/${id}`);
  return res.data;
}
