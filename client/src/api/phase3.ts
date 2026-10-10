import { api } from './client.js';
import {
  Product,
  CompanySettings,
  Quote,
  Invoice,
  Payment,
  Workflow,
  WorkflowRun,
  Notification,
  AuditLog,
} from '../types/index.js';

// ================= PRODUCTS =================

export async function fetchProducts(params?: Record<string, any>): Promise<{ data: Product[] }> {
  const res = await api.get('/products', { params });
  return res.data;
}

export async function fetchProduct(id: string): Promise<Product> {
  const res = await api.get(`/products/${id}`);
  return res.data;
}

export async function createProduct(payload: Partial<Product>): Promise<Product> {
  const res = await api.post('/products', payload);
  return res.data;
}

export async function updateProduct(id: string, payload: Partial<Product>): Promise<Product> {
  const res = await api.put(`/products/${id}`, payload);
  return res.data;
}

export async function deleteProduct(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/products/${id}`);
  return res.data;
}

// ================= COMPANY SETTINGS =================

export async function fetchCompanySettings(): Promise<CompanySettings> {
  const res = await api.get('/settings/company');
  return res.data;
}

export async function updateCompanySettings(payload: Partial<CompanySettings>): Promise<CompanySettings> {
  const res = await api.put('/settings/company', payload);
  return res.data;
}

// ================= QUOTES =================

export async function fetchQuotes(params?: Record<string, any>): Promise<{
  data: Quote[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const res = await api.get('/quotes', { params });
  return res.data;
}

export async function fetchQuote(id: string): Promise<Quote> {
  const res = await api.get(`/quotes/${id}`);
  return res.data;
}

export async function createQuote(payload: Partial<Quote>): Promise<Quote> {
  const res = await api.post('/quotes', payload);
  return res.data;
}

export async function updateQuote(id: string, payload: Partial<Quote>): Promise<Quote> {
  const res = await api.put(`/quotes/${id}`, payload);
  return res.data;
}

export async function deleteQuote(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/quotes/${id}`);
  return res.data;
}

export async function sendQuote(id: string, payload?: { subject?: string; message?: string }): Promise<{ quote: Quote; message: string }> {
  const res = await api.post(`/quotes/${id}/send`, payload || {});
  return res.data;
}

export async function approveQuote(
  id: string,
  payload: { action: 'approve' | 'reject'; reason?: string }
): Promise<{ quote: Quote; message: string }> {
  const res = await api.post(`/quotes/${id}/approve`, payload);
  return res.data;
}

export async function convertQuoteToInvoice(id: string): Promise<{ invoice: Invoice; message: string }> {
  const res = await api.post(`/quotes/${id}/convert-to-invoice`);
  return res.data;
}

export async function fetchPublicQuote(token: string): Promise<{ quote: Quote; company: CompanySettings }> {
  const res = await api.get(`/quotes/public/${token}`);
  return res.data;
}

export async function respondPublicQuote(
  token: string,
  payload: { action: 'accept' | 'decline'; reason?: string }
): Promise<{ status: string; message: string }> {
  const res = await api.post(`/quotes/public/${token}/respond`, payload);
  return res.data;
}

// ================= INVOICES =================

export async function fetchInvoices(params?: Record<string, any>): Promise<{
  data: Invoice[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary?: { totalOutstanding: number; totalOverdue: number; countOverdue: number };
  };
}> {
  const res = await api.get('/invoices', { params });
  return res.data;
}

export async function fetchInvoice(id: string): Promise<{ invoice: Invoice; payments: Payment[] }> {
  const res = await api.get(`/invoices/${id}`);
  return res.data;
}

export async function createInvoice(payload: Partial<Invoice>): Promise<Invoice> {
  const res = await api.post('/invoices', payload);
  return res.data;
}

export async function updateInvoice(id: string, payload: Partial<Invoice>): Promise<Invoice> {
  const res = await api.put(`/invoices/${id}`, payload);
  return res.data;
}

export async function sendInvoice(id: string, payload?: { subject?: string; message?: string }): Promise<{ invoice: Invoice; message: string }> {
  const res = await api.post(`/invoices/${id}/send`, payload || {});
  return res.data;
}

export async function voidInvoice(id: string, reason: string): Promise<{ invoice: Invoice; message: string }> {
  const res = await api.post(`/invoices/${id}/void`, { reason });
  return res.data;
}

export async function recordPayment(invoiceId: string, payload: Partial<Payment>): Promise<{ payment: Payment; invoice: Invoice }> {
  const res = await api.post(`/invoices/${invoiceId}/payments`, payload);
  return res.data;
}

export async function deletePayment(invoiceId: string, paymentId: string): Promise<{ invoice: Invoice; message: string }> {
  const res = await api.delete(`/invoices/${invoiceId}/payments/${paymentId}`);
  return res.data;
}

// ================= NOTIFICATIONS =================

export async function fetchUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  const res = await api.get('/notifications/unread-count');
  return res.data;
}

export async function fetchNotifications(params?: { unread?: boolean; page?: number; limit?: number }): Promise<{
  data: Notification[];
  meta: { total: number; page: number; limit: number; totalPages: number; unreadCount: number };
}> {
  const res = await api.get('/notifications', { params });
  return res.data;
}

export async function markNotificationAsRead(id: string): Promise<Notification> {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsAsRead(): Promise<{ message: string }> {
  const res = await api.post('/notifications/read-all');
  return res.data;
}

export async function fetchNotificationPreferences(): Promise<{ preferences: Record<string, { inApp: boolean; email: boolean }> }> {
  const res = await api.get('/notifications/preferences');
  return res.data;
}

export async function updateNotificationPreferences(
  preferences: Record<string, { inApp: boolean; email: boolean }>
): Promise<{ message: string; preferences: any }> {
  const res = await api.put('/notifications/preferences', { preferences });
  return res.data;
}

// ================= WORKFLOWS / AUTOMATIONS =================

export async function fetchWorkflows(): Promise<{ data: Workflow[] }> {
  const res = await api.get('/automations');
  return res.data;
}

export async function fetchWorkflow(id: string): Promise<Workflow> {
  const res = await api.get(`/automations/${id}`);
  return res.data;
}

export async function createWorkflow(payload: Partial<Workflow>): Promise<Workflow> {
  const res = await api.post('/automations', payload);
  return res.data;
}

export async function updateWorkflow(id: string, payload: Partial<Workflow>): Promise<Workflow> {
  const res = await api.put(`/automations/${id}`, payload);
  return res.data;
}

export async function toggleWorkflow(id: string): Promise<{ workflow: Workflow; message: string }> {
  const res = await api.patch(`/automations/${id}/toggle`);
  return res.data;
}

export async function deleteWorkflow(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/automations/${id}`);
  return res.data;
}

export async function testWorkflowDryRun(
  id: string,
  entityType: string,
  entityId: string
): Promise<{
  matched: boolean;
  conditionResults: Array<{ field: string; operator: string; expected: any; actual: any; passed: boolean }>;
  plannedActions: Array<{ type: string; config: any }>;
}> {
  const res = await api.post(`/automations/${id}/test`, { entityType, entityId });
  return res.data;
}

export async function fetchWorkflowRuns(id: string, params?: { page?: number; limit?: number }): Promise<{
  data: WorkflowRun[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const res = await api.get(`/automations/${id}/runs`, { params });
  return res.data;
}

// ================= AUDIT LOGS =================

export async function fetchAuditLogs(params?: Record<string, any>): Promise<{
  data: AuditLog[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const res = await api.get('/audit-log', { params });
  return res.data;
}

export async function fetchEntityAuditHistory(entityType: string, entityId: string): Promise<{ data: AuditLog[] }> {
  const res = await api.get(`/audit-log/entity/${entityType}/${entityId}`);
  return res.data;
}
