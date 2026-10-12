import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Search,
  Download,
  Send,
  ExternalLink,
  CheckCircle,
  Clock,
  Receipt,
  Edit,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import {
  fetchQuotes,
  deleteQuote,
  sendQuote,
  approveQuote,
  convertQuoteToInvoice,
} from '../api/phase3.js';
import { Quote, QuoteStatus } from '../types/index.js';
import { formatINR } from '../utils/money.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Reveal } from '../components/motion/Motion.js';

export const QuotesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [approvalModalQuote, setApprovalModalQuote] = useState<Quote | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [convertInvoiceQuote, setConvertInvoiceQuote] = useState<Quote | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', statusFilter, searchTerm],
    queryFn: () =>
      fetchQuotes({
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: searchTerm || undefined,
      }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => sendQuote(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      success(res.message || 'Quote sent successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to send quote');
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      approveQuote(id, { action, reason }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      success(res.message || 'Quote review processed');
      setApprovalModalQuote(null);
      setApprovalReason('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to process approval');
    },
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => convertQuoteToInvoice(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      success(`Invoice ${res.invoice.number} created from quote!`);
      setConvertInvoiceQuote(null);
      navigate(`/invoices/${res.invoice._id}`);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to convert to invoice');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      success('Quote deleted');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete quote');
    },
  });

  const handleDownloadPDF = (q: Quote) => {
    window.open(`/api/quotes/${q._id}/pdf`, '_blank');
  };

  const handleCopyPublicLink = (q: Quote) => {
    const url = `${window.location.origin}/q/${q.publicToken}`;
    navigator.clipboard.writeText(url);
    success('Public quote link copied to clipboard!');
  };

  const renderStatusBadge = (status: QuoteStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F4F5] text-[#71717A] dark:bg-[#27272A] dark:text-[#A1A1AA]">
            Draft
          </span>
        );
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFFAEB] text-[#B54708] dark:bg-[#7A2E0E]/20 dark:text-[#FEDF89]">
            <Clock className="w-3 h-3" />
            Pending Approval
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF8FF] text-[#175CD3] dark:bg-[#175CD3]/20 dark:text-[#84CAFF]">
            Sent
          </span>
        );
      case 'viewed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F9F5FF] text-[#6941C6] dark:bg-[#6941C6]/20 dark:text-[#D6BBFB]">
            Viewed
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ECFDF3] text-[#027A48] dark:bg-[#027A48]/20 dark:text-[#6CE9A6]">
            <CheckCircle className="w-3 h-3" />
            Accepted
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4F4F5] text-muted line-through dark:bg-[#27272A]">
            Declined
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF3F2] text-[#B42318] dark:bg-[#B42318]/20 dark:text-[#FDA29B]">
            Expired
          </span>
        );
    }
  };

  const quotes = data?.data || [];

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      {/* Top Header */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-foreground" />
              Sales Quotes
            </h1>
            <p className="text-sm text-muted mt-1">
              Create commercial proposals, enforce discount approval policies, and track customer acceptances.
            </p>
          </div>
          <button
            onClick={() => navigate('/quotes/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Quote
          </button>
        </div>
      </Reveal>

      {/* Filters Bar */}
      <Reveal direction="down" delay={0.05}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by quote number or notes..."
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
              <option value="pending_approval">Pending Approval</option>
              <option value="sent">Sent</option>
              <option value="viewed">Viewed</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </Reveal>

      {/* Quotes Table */}
      <Reveal direction="up" delay={0.1}>
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : quotes.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] dark:bg-[#202025] flex items-center justify-center text-muted mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No quotes found</h3>
              <p className="text-xs text-muted mt-1 max-w-sm">
                Generate your first quote proposal to send professional estimates to your clients.
              </p>
              <button
                onClick={() => navigate('/quotes/new')}
                className="mt-4 px-3.5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                Create Quote
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 text-xs font-semibold text-muted">
                    <th className="py-3 px-4">Quote Number</th>
                    <th className="py-3 px-4">Account & Deal</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Total Payable</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Valid Until</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotes.map((q) => (
                    <tr
                      key={q._id}
                      className="hover:bg-[#F9F9FB] dark:hover:bg-[#202025]/50 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                          {q.number}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">
                          Tax: {q.taxMode === 'intra' ? 'Intra (CGST+SGST)' : 'Inter (IGST)'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">
                          {q.account?.name || 'Account'}
                        </div>
                        <div className="text-xs text-muted truncate max-w-xs">
                          {q.deal?.title || 'Deal'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-foreground">
                        {q.contact ? `${q.contact.firstName} ${q.contact.lastName}` : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-foreground">
                        {formatINR(q.total)}
                      </td>

                      <td className="py-3.5 px-4">
                        {renderStatusBadge(q.status)}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-muted">
                        {new Date(q.validUntil).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Manager Approval Actions */}
                          {q.status === 'pending_approval' && (isAdmin || isManager) && (
                            <button
                              onClick={() => setApprovalModalQuote(q)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-xs"
                            >
                              Review
                            </button>
                          )}

                          {/* Convert to Invoice (for accepted quotes) */}
                          {q.status === 'accepted' && (
                            <button
                              onClick={() => setConvertInvoiceQuote(q)}
                              title="Generate Invoice from Quote"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              Create Invoice
                            </button>
                          )}

                          {/* Send quote */}
                          {['draft', 'sent', 'viewed'].includes(q.status) && (
                            <button
                              onClick={() => sendMutation.mutate(q._id)}
                              disabled={sendMutation.isPending}
                              title="Send Quote to Customer"
                              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#27272A] transition-colors"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          {/* Download PDF */}
                          <button
                            onClick={() => handleDownloadPDF(q)}
                            title="Download PDF"
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#27272A] transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Copy Public Link */}
                          <button
                            onClick={() => handleCopyPublicLink(q)}
                            title="Copy Secure Public Link"
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#27272A] transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>

                          {/* Edit (if draft) */}
                          {q.status === 'draft' && (
                            <button
                              onClick={() => navigate(`/quotes/${q._id}`)}
                              title="Edit Quote"
                              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#27272A] transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          {q.status === 'draft' && (
                            <button
                              onClick={() => {
                                if (confirm(`Delete draft quote ${q.number}?`)) {
                                  deleteMutation.mutate(q._id);
                                }
                              }}
                              title="Delete Quote"
                              className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>

      {/* Approval Modal */}
      {approvalModalQuote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Manager Review: Quote {approvalModalQuote.number}
                </h3>
                <p className="text-xs text-muted">
                  Total: {formatINR(approvalModalQuote.total)}
                </p>
              </div>
            </div>

            {approvalModalQuote.approval?.reason && (
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-border text-xs text-muted">
                <span className="font-semibold block text-foreground mb-1">Approval Triggers:</span>
                {approvalModalQuote.approval.reason}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Feedback / Decision Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                placeholder="e.g. Approved with Q4 executive sign-off"
                className="w-full px-3 py-2 text-xs bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setApprovalModalQuote(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  approveMutation.mutate({
                    id: approvalModalQuote._id,
                    action: 'reject',
                    reason: approvalReason,
                  })
                }
                disabled={approveMutation.isPending}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() =>
                  approveMutation.mutate({
                    id: approvalModalQuote._id,
                    action: 'approve',
                    reason: approvalReason,
                  })
                }
                disabled={approveMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 transition-colors shadow-sm"
              >
                Approve & Allow Sending
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Invoice Modal */}
      {convertInvoiceQuote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Create Invoice from Accepted Quote
                </h3>
                <p className="text-xs text-muted">
                  Quote {convertInvoiceQuote.number} ({formatINR(convertInvoiceQuote.total)})
                </p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              This will generate an official tax invoice copying all line items, tax mode, customer details, and terms.
              Also, would you like to move the linked deal to <strong>Won</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setConvertInvoiceQuote(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => convertMutation.mutate(convertInvoiceQuote._id)}
                disabled={convertMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 transition-colors shadow-sm"
              >
                {convertMutation.isPending ? 'Generating...' : 'Confirm & Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
