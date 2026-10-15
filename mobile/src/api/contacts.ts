import { apiClient } from './client';
import {
  Contact,
  ContactInput,
  ContactUpdateInput,
  CursorPaginatedResponse,
} from '@flowdesk/shared';

export interface ContactListParams {
  cursor?: string;
  limit?: number;
  updatedSince?: string;
  search?: string;
  sort?: string;
}

export async function fetchContacts(
  params?: ContactListParams
): Promise<CursorPaginatedResponse<Contact>> {
  const query = new URLSearchParams();
  if (params?.cursor) query.append('cursor', params.cursor);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.updatedSince) query.append('updatedSince', params.updatedSince);
  if (params?.search) query.append('q', params.search);
  if (params?.sort) query.append('sort', params.sort);

  const res = await apiClient.get<CursorPaginatedResponse<Contact>>(
    `/contacts?${query.toString()}`
  );
  return res.data;
}

export async function fetchContactById(id: string): Promise<Contact> {
  const res = await apiClient.get<Contact>(`/contacts/${id}`);
  return res.data;
}

export async function createContact(data: ContactInput): Promise<Contact> {
  const res = await apiClient.post<Contact>('/contacts', data);
  return res.data;
}

export async function updateContact(
  id: string,
  data: Partial<ContactUpdateInput>
): Promise<Contact> {
  const res = await apiClient.patch<Contact>(`/contacts/${id}`, data);
  return res.data;
}

export async function deleteContact(id: string): Promise<{ id: string }> {
  const res = await apiClient.delete<{ id: string }>(`/contacts/${id}`);
  return res.data;
}
