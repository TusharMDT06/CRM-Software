import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Send,
  CreditCard,
  Plus,
  Trash2,
  AlertTriangle,
  Ban,
  X,
} from 'lucide-react';
import {
  fetchInvoice,
  recordPayment,
  deletePayment,
  sendInvoice,
  voidInvoice,
} from '../api/phase3.js';
import { PaymentMethod } from '../types/index.js';
import { formatINR, paiseToRupees, rupeesToPaise } from '../utils/money.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Reveal } from '../components/motion/Motion.js';
import { OriginalTaxInvoice } from '../components/billing/OriginalTaxInvoice.js';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [activeTab, setActiveTab] = useState<'invoice' | 'manage'>('invoice');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchInvoice(id!),
    enabled: Boolean(id),
  });

  const invoice = data?.invoice;
  const payments = data?.payments || [];

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => recordPayment(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      success('Payment recorded successfully');
      setIsPaymentDrawerOpen(false);
      setPaymentAmountRupees(0);
      setPaymentReference('');
      setPaymentNotes('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to record payment');
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => deletePayment(id!, paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      success('Payment deleted and invoice balance recomputed');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete payment');
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => sendInvoice(id!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      success(res.message || 'Invoice sent to client');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to dispatch invoice');
    },
  });

  const voidMutation = useMutation({
    mutationFn: (reason: string) => voidInvoice(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      success('Invoice voided successfully');
      setShowVoidModal(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to void invoice');
    },
  });

  const handleOpenPaymentDrawer = () => {
    if (!invoice) return;
    setPaymentAmountRupees(paiseToRupees(invoice.balance));
    setIsPaymentDrawerOpen(true);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    const amountPaise = rupeesToPaise(paymentAmountRupees);
    if (amountPaise <= 0) {
      error('Payment amount must be greater than zero');
      return;
    }
    if (amountPaise > invoice.balance) {
      error(`Payment amount cannot exceed remaining balance of ${formatINR(invoice.balance)}`);
      return;
    }

    recordPaymentMutation.mutate({
      amount: amountPaise,
      method: paymentMethod,
      reference: paymentReference.trim(),
      notes: paymentNotes.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="h-10 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl w-64" />
        <div className="h-96 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="flex-1 p-8 max-w-md mx-auto w-full text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Invoice Not Found</h2>
        <button
          onClick={() => navigate('/invoices')}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black"
        >
          Return to Invoices
        </button>
      </div>
    );
  }

  const isOverdue = invoice.status === 'overdue';
  const isPaid = invoice.status === 'paid';
  const isVoid = invoice.status === 'void';

  return (
    <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full gap-6">
      {/* Header & Quick Action Buttons */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/invoices')}
              className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {invoice.number}
                </h1>
                {isPaid && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                    Paid
                  </span>
                )}
                {isOverdue && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 animate-pulse">
                    Overdue
                  </span>
                )}
                {isVoid && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-200 text-neutral-600 line-through dark:bg-neutral-800 dark:text-neutral-400">
                    Voided
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-1">
                Issued: {new Date(invoice.issueDate).toLocaleDateString()} • Due: {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Record Payment Button */}
            {!isPaid && !isVoid && (
              <button
                onClick={handleOpenPaymentDrawer}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Record Payment
              </button>
            )}

            {/* Send Invoice */}
            {!isVoid && (
              <button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                {invoice.status === 'sent' || invoice.status === 'partially_paid' ? 'Send Reminder' : 'Send Invoice'}
              </button>
            )}

            {/* Download PDF with auth token */}
            <button
              onClick={() => {
                const token = localStorage.getItem('flowdesk_token') || '';
                window.open(`/api/invoices/${invoice._id}/pdf?token=${encodeURIComponent(token)}`, '_blank');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>

            {/* Void Invoice (admin / manager) */}
            {!isVoid && (isAdmin || isManager) && (
              <button
                onClick={() => setShowVoidModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shadow-xs"
              >
                <Ban className="w-3.5 h-3.5" />
                Void
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {/* View Switcher Tabs (Print Hidden) */}
      <div className="print:hidden flex items-center border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('invoice')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'invoice'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          📄 Original Tax Invoice Sheet (कर चालान)
        </button>

        <button
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'manage'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          ⚙️ Manage & Payments Log ({payments.length})
        </button>
      </div>

      {activeTab === 'invoice' ? (
        <OriginalTaxInvoice
          invoice={invoice}
          onRecordPayment={handleOpenPaymentDrawer}
          onSendInvoice={() => sendMutation.mutate()}
        />
      ) : (
        <>

      {/* KPI Cards: Total, Paid, Balance */}
      <Reveal direction="down" delay={0.05}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-medium text-muted">Total Invoice Amount</span>
            <div className="text-xl font-bold text-foreground mt-1">
              {formatINR(invoice.total)}
            </div>
            <span className="text-[11px] text-muted mt-0.5 block">
              {invoice.taxMode === 'intra' ? 'Intra-State GST (CGST+SGST)' : 'Inter-State GST (IGST)'}
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Total Collected</span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatINR(invoice.paidTotal)}
            </div>
            <span className="text-[11px] text-muted mt-0.5 block">
              {payments.length} payment installment{payments.length === 1 ? '' : 's'} recorded
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-medium text-muted">Remaining Balance Due</span>
            <div className={`text-xl font-bold mt-1 ${invoice.balance > 0 ? (isOverdue ? 'text-red-600' : 'text-foreground') : 'text-muted'}`}>
              {formatINR(invoice.balance)}
            </div>
            <span className="text-[11px] text-muted mt-0.5 block">
              {invoice.balance === 0 ? 'Fully Settled' : `Due on ${new Date(invoice.dueDate).toLocaleDateString()}`}
            </span>
          </div>
        </div>
      </Reveal>

      {/* Main Grid: Details + Payments History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Invoice Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bill-to card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted pb-2 border-b border-border">
              Customer & Entity References
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Account</span>
                <span className="font-semibold text-foreground text-sm">{invoice.account?.name || '—'}</span>
                {invoice.account?.gstin && <div className="text-muted font-mono mt-0.5">GSTIN: {invoice.account.gstin}</div>}
              </div>

              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Deal Reference</span>
                <span className="font-semibold text-foreground">{invoice.deal?.title || '—'}</span>
              </div>

              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Contact</span>
                <span className="font-semibold text-foreground">
                  {invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName}` : '—'}
                </span>
                {invoice.contact?.email && <div className="text-muted">{invoice.contact.email}</div>}
              </div>
            </div>
          </div>

          {/* Line items table */}
          <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Billed Line Items</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 font-semibold text-muted text-[11px]">
                  <th className="py-2.5 px-4">Item & Description</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-right">GST</th>
                  <th className="py-2.5 px-4 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items.map((it: any, i: number) => {
                  const raw = (it.qty || 1) * (it.unitPrice || 0);
                  const disc = Math.round((raw * (it.discountPct || 0)) / 100);
                  const taxable = raw - disc;
                  const tax = Math.round((taxable * (it.taxRate || 0)) / 100);
                  const total = taxable + tax;

                  return (
                    <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{it.name}</div>
                        {it.description && <div className="text-muted text-[11px] mt-0.5">{it.description}</div>}
                      </td>
                      <td className="py-3 px-3 text-center text-muted">{it.qty}</td>
                      <td className="py-3 px-3 text-right text-muted">{formatINR(it.unitPrice)}</td>
                      <td className="py-3 px-3 text-right text-muted">
                        {it.discountPct ? `${it.discountPct}%` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-muted">{it.taxRate}%</td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">{formatINR(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Payments Log & Recording */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Payment History
                </h3>
              </div>
              {!isPaid && !isVoid && (
                <button
                  onClick={handleOpenPaymentDrawer}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                No payments recorded yet. Click "Record Payment" to log collections.
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div
                    key={p._id}
                    className="p-3.5 rounded-xl border border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/40 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-foreground text-sm">
                        {formatINR(p.amount)}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        <span className="capitalize font-medium text-foreground">{p.method.replace('_', ' ')}</span>
                        {p.reference && <span> • Ref: <span className="font-mono">{p.reference}</span></span>}
                      </div>
                      <div className="text-[10px] text-muted mt-1">
                        {new Date(p.paidAt).toLocaleDateString()} • Recorded by {p.recordedBy?.name || 'User'}
                      </div>
                    </div>

                    {/* Admin delete payment button */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          if (confirm('Delete this payment record? The invoice status will be automatically recalculated.')) {
                            deletePaymentMutation.mutate(p._id);
                          }
                        }}
                        title="Delete Payment (Admin only)"
                        className="p-1 text-muted hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Record Payment Drawer / Modal */}
      {isPaymentDrawerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-foreground">Record Payment</h3>
              </div>
              <button
                onClick={() => setIsPaymentDrawerOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Amount (₹) * (Max Balance: {formatINR(invoice.balance)})
                </label>
                <input
                  type="number"
                  min="0.01"
                  max={paiseToRupees(invoice.balance)}
                  step="0.01"
                  required
                  value={paymentAmountRupees}
                  onChange={(e) => setPaymentAmountRupees(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl font-bold focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3.5 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-hidden"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="upi">UPI</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Transaction Reference / UTR Number
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. UTR-91827461928"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional notes regarding this payment installment..."
                  className="w-full px-3.5 py-2 text-xs bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsPaymentDrawerOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Invoice Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">
              Void Invoice {invoice.number}
            </h3>
            <p className="text-xs text-muted">
              Voiding marks this document invalid and reverses remaining receivables.
            </p>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Void Reason *
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason for voiding..."
                className="w-full px-3 py-2 text-xs bg-transparent border border-border rounded-xl focus:outline-hidden"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!voidReason.trim() || voidMutation.isPending}
                onClick={() => voidMutation.mutate(voidReason)}
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
