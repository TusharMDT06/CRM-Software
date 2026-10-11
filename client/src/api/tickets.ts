import { api } from './client.js';
import axios from 'axios';
import {
  Ticket,
  TicketMessage,
  CannedResponse,
  SlaPolicy,
} from '../types/index.js';

// ================= TICKETS =================

export async function fetchTickets(params?: Record<string, any>): Promise<{
  tickets: Ticket[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const res = await api.get('/tickets', { params });
  return res.data;
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const res = await api.get(`/tickets/${id}`);
  return res.data;
}

export async function createTicket(payload: Partial<Ticket>): Promise<Ticket> {
  const res = await api.post('/tickets', payload);
  return res.data;
}

export async function updateTicket(id: string, payload: Partial<Ticket>): Promise<Ticket> {
  const res = await api.patch(`/tickets/${id}`, payload);
  return res.data;
}

export async function deleteTicket(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/tickets/${id}`);
  return res.data;
}

// ================= MESSAGES =================

export async function fetchTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const res = await api.get(`/tickets/${ticketId}/messages`);
  return res.data;
}

export async function createTicketMessage(
  ticketId: string,
  payload: { type: 'public_reply' | 'internal_note'; body: string; attachments?: any[] }
): Promise<TicketMessage> {
  const res = await api.post(`/tickets/${ticketId}/messages`, payload);
  return res.data;
}

// ================= CANNED RESPONSES =================

export async function fetchCannedResponses(): Promise<CannedResponse[]> {
  const res = await api.get('/tickets/canned-responses');
  return res.data;
}

export async function createCannedResponse(payload: Partial<CannedResponse>): Promise<CannedResponse> {
  const res = await api.post('/tickets/canned-responses', payload);
  return res.data;
}

export async function updateCannedResponse(
  id: string,
  payload: Partial<CannedResponse>
): Promise<CannedResponse> {
  const res = await api.put(`/tickets/canned-responses/${id}`, payload);
  return res.data;
}

export async function deleteCannedResponse(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/tickets/canned-responses/${id}`);
  return res.data;
}

// ================= SLA POLICY =================

export async function fetchSlaPolicy(): Promise<SlaPolicy> {
  const res = await api.get('/tickets/sla-policy');
  return res.data;
}

export async function updateSlaPolicy(payload: Partial<SlaPolicy>): Promise<SlaPolicy> {
  const res = await api.put('/tickets/sla-policy', payload);
  return res.data;
}

// ================= SUPPORT REPORTS =================

export async function fetchSupportReport(params?: Record<string, any>): Promise<any> {
  const res = await api.get('/reports/support', { params });
  return res.data;
}

// ================= PUBLIC SUPPORT PORTAL =================

export async function submitPublicTicket(
  tenantSlug: string,
  payload: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    subject: string;
    description: string;
    priority?: string;
    website?: string;
  }
): Promise<{ success: boolean; ticketNumber: string; publicToken: string }> {
  const res = await axios.post(`/api/support/${tenantSlug}`, payload);
  return res.data;
}

export async function fetchPublicTicketStatus(publicToken: string): Promise<{
  ticket: {
    number: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    contactName: string;
  };
  messages: Array<{
    _id: string;
    body: string;
    isAgent: boolean;
    authorName: string;
    createdAt: string;
    attachments?: any[];
  }>;
  companyName: string;
}> {
  const res = await axios.get(`/api/support/ticket/${publicToken}`);
  return res.data;
}

export async function replyToPublicTicket(
  publicToken: string,
  body: string
): Promise<{ success: boolean; message: string }> {
  const res = await axios.post(`/api/support/ticket/${publicToken}/reply`, { body });
  return res.data;
}
