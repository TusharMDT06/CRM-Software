import { api } from './client.js';
import {
  LeadSourceItem,
  LeadEventItem,
  CampaignItem,
} from '../types/index.js';

export interface CreateLeadSourcePayload {
  name: string;
  type: 'meta_lead_ads' | 'google_ads' | 'website_form' | 'generic_webhook';
  config?: Record<string, any>;
}

export interface CreateLeadSourceResponse {
  source: LeadSourceItem;
  apiKey?: string;
}

export async function getLeadSources(): Promise<LeadSourceItem[]> {
  const res = await api.get('/marketing/sources');
  return res.data.sources || [];
}

export async function createLeadSource(
  payload: CreateLeadSourcePayload
): Promise<CreateLeadSourceResponse> {
  const res = await api.post('/marketing/sources', payload);
  return res.data;
}

export async function getLeadSource(
  id: string
): Promise<{ source: LeadSourceItem; recentEvents: LeadEventItem[] }> {
  const res = await api.get(`/marketing/sources/${id}`);
  return res.data;
}

export async function updateLeadSource(
  id: string,
  data: Partial<LeadSourceItem>
): Promise<LeadSourceItem> {
  const res = await api.patch(`/marketing/sources/${id}`, data);
  return res.data.source;
}

export async function deleteLeadSource(id: string): Promise<void> {
  await api.delete(`/marketing/sources/${id}`);
}

export async function rotateLeadSourceSecret(
  id: string
): Promise<{ webhookId: string; apiKey?: string }> {
  const res = await api.post(`/marketing/sources/${id}/rotate-secret`);
  return res.data;
}

export async function sendTestLead(
  id: string
): Promise<{ success: boolean; leadId?: string; status: string }> {
  const res = await api.post(`/marketing/sources/${id}/test-lead`);
  return res.data;
}

export async function getLeadSourceEvents(
  sourceId: string,
  page = 1,
  limit = 20
): Promise<{ events: LeadEventItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  const res = await api.get(`/marketing/sources/${sourceId}/events?page=${page}&limit=${limit}`);
  return res.data;
}

export async function replayLeadEvent(eventId: string): Promise<any> {
  const res = await api.post(`/marketing/events/${eventId}/replay`);
  return res.data;
}

export async function getMarketingCampaigns(): Promise<CampaignItem[]> {
  const res = await api.get('/marketing/campaigns');
  return res.data.campaigns || [];
}

export async function updateMarketingCampaign(
  id: string,
  name: string
): Promise<CampaignItem> {
  const res = await api.patch(`/marketing/campaigns/${id}`, { name });
  return res.data.campaign;
}
