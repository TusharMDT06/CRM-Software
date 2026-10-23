import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Plus,
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Ban,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client.js';
import { fetchInvoices, voidInvoice } from '../api/phase3.js';
import { Invoice, InvoiceStatus } from '../types/index.js';
import { formatINR } from '../utils/money.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Reveal, CountUp } from '../components/motion/Motion.js';

export const InvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [voidModalInvoice, setVoidModalInvoice] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter, searchTerm],
    queryFn: () =>
      fetchInvoices({
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: searchTerm || undefined,
      }),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => voidInvoice(id, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      success(res.message || 'Invoice voided successfully');
      setVoidModalInvoice(null);
      setVoidReason('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to void invoice');
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/invoices/auto-generate-all');
      return res.data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      success(res.message || 'Original Tax Invoices generated successfully for all companies!');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to auto-generate invoices');
    },
  });

  const renderStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F4F5] text-[#71717A] dark:bg-[#27272A] dark:text-[#A1A1AA]">
            Draft
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF8FF] text-[#175CD3] dark:bg-[#175CD3]/20 dark:text-[#84CAFF]">
            Sent
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF6EE] text-[#B93815] dark:bg-[#B93815]/20 dark:text-[#FDB022]">
            <Clock className="w-3 h-3" />
            Partially Paid
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ECFDF3] text-[#027A48] dark:bg-[#027A48]/20 dark:text-[#6CE9A6]">
            <CheckCircle2 className="w-3 h-3" />
            Paid
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3F2] text-[#B42318] dark:bg-[#B42318]/20 dark:text-[#FDA29B] animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            Overdue
          </span>
        );
      case 'void':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F4F5] text-muted line-through dark:bg-[#27272A]">
            Void
          </span>
        );
    }
  };

  const invoices = data?.data || [];
  const rawSummary = (data as any)?.summary || (data as any)?.meta?.summary || {};
  const summary = {
    totalOutstanding: rawSummary.totalOutstanding ?? (rawSummary.totalOutstandingPaise ? rawSummary.totalOutstandingPaise / 100 : 0),
    totalOverdue: rawSummary.totalOverdue ?? (rawSummary.totalOverduePaise ? rawSummary.totalOverduePaise / 100 : 0),
    countOverdue: rawSummary.countOverdue ?? rawSummary.overdueCount ?? 0,
    totalInvoices: rawSummary.totalInvoices ?? (data as any)?.pagination?.total ?? invoices.length,
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      {/* Page Header */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-foreground" />
              Tax Invoices & Billing
            </h1>
            <p className="text-sm text-muted mt-1">
              Issue compliant GST invoices, collect payments, monitor overdue aging, and reconcile receivables.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => autoGenerateMutation.mutate()}
              disabled={autoGenerateMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs shrink-0"
              title="Automatically generate original Tax Invoices for all registered companies"
            >
              <Sparkles className={`w-4 h-4 text-[#F07B2A] ${autoGenerateMutation.isPending ? 'animate-spin' : ''}`} />
              {autoGenerateMutation.isPending ? 'Generating Invoices...' : '⚡ Auto-Generate for All Companies'}
            </button>

            <button
              onClick={() => navigate('/quotes/new')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Invoice (via Quote)
            </button>
          </div>
        </div>
      </Reveal>

      {/* Summary KPI Cards */}
      <Reveal direction="down" delay={0.05}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-medium text-muted">Total Outstanding Balance</span>
            <div className="text-xl font-bold text-foreground mt-1">
              {formatINR(summary.totalOutstanding)}
            </div>
            <span className="text-[11px] text-muted mt-0.5 block">Unpaid across active invoices</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue Receivables
            </span>
            <div className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
              {formatINR(summary.totalOverdue)}
            </div>
            <span className="text-[11px] text-muted mt-0.5 block">
              {summary.countOverdue} invoice{summary.countOverdue === 1 ? '' : 's'} past due date
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-medium text-muted">Total Invoices</span>
            <div className="text-xl font-bold text-foreground mt-1">
              <CountUp value={data?.meta?.total || invoices.length} />
            </div>
            <span className="text-[11px] text-muted mt-0.5 block">Registered records</span>
          </div>
        </div>
      </Reveal>

      {/* Filters Bar */}
      <Reveal direction="down" delay={0.1}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by invoice number or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground placeholder:text-muted"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground font-medium focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue (Past Due)</option>
              <option value="void">Void</option>
            </select>
          </div>
        </div>
      </Reveal>

      {/* Invoices Table */}
      <Reveal direction="up" delay={0.15}>
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] dark:bg-[#202025] flex items-center justify-center text-muted mb-3">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No invoices found</h3>
              <p className="text-xs text-muted mt-1 max-w-sm">
                Invoices can be created directly from accepted quotes or generated from deals.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 text-xs font-semibold text-muted">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Account & Deal</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Paid Amount</th>
                    <th className="py-3 px-4">Balance Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => {
                    const isOverdueRow = inv.status === 'overdue';

                    return (
                      <tr
                        key={inv._id}
                        onClick={() => navigate(`/invoices/${inv._id}`)}
                        className={`cursor-pointer transition-colors ${
                          isOverdueRow
                            ? 'bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30'
                            : 'hover:bg-[#F9F9FB] dark:hover:bg-[#202025]/50'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-foreground">
                          {inv.number}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-foreground">
                            {inv.account?.name || 'Account'}
                          </div>
                          <div className="text-xs text-muted truncate max-w-xs">
                            {inv.deal?.title || 'Deal'}
                          </div>
                        </td>

                        <td className={`py-3.5 px-4 text-xs ${isOverdueRow ? 'font-bold text-red-600' : 'text-muted'}`}>
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {formatINR(inv.total)}
                        </td>

                        <td className="py-3.5 px-4 text-xs font-medium text-emerald-600">
                          {formatINR(inv.paidTotal)}
                        </td>

                        <td className={`py-3.5 px-4 font-bold ${inv.balance > 0 ? (isOverdueRow ? 'text-red-600' : 'text-foreground') : 'text-muted'}`}>
                          {formatINR(inv.balance)}
                        </td>

                        <td className="py-3.5 px-4">
                          {renderStatusBadge(inv.status)}
                        </td>

                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/invoices/${inv._id}`)}
                              title="View Invoice & Record Payment"
                              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#27272A] transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                const token = localStorage.getItem('flowdesk_token') || '';
                                window.open(`/api/invoices/${inv._id}/pdf?token=${encodeURIComponent(token)}`, '_blank');
                              }}
                              title="Download Official PDF"
                              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#27272A] transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* Void button for admin and manager */}
                            {inv.status !== 'void' && inv.status !== 'draft' && (isAdmin || isManager) && (
                              <button
                                onClick={() => setVoidModalInvoice(inv)}
                                title="Void Invoice"
                                className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>

      {/* Void Invoice Modal */}
      {voidModalInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-red-100 text-red-600 dark:bg-red-950/40">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Void Invoice {voidModalInvoice.number}
                </h3>
                <p className="text-xs text-muted">
                  Total: {formatINR(voidModalInvoice.total)}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              In accordance with accounting compliance, sent invoice numbers cannot be deleted or reused. Voiding marks the document invalid and reverses outstanding receivables.
            </p>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Reason for Voiding *
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Billed in error, client cancelled contract, corrected version re-issued"
                className="w-full px-3 py-2 text-xs bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setVoidModalInvoice(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!voidReason.trim() || voidMutation.isPending}
                onClick={() =>
                  voidMutation.mutate({
                    id: voidModalInvoice._id,
                    reason: voidReason,
                  })
                }
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {voidMutation.isPending ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
