import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  CheckCircle,
  XCircle,
  Calendar,
  AlertCircle,
  Landmark,
} from 'lucide-react';
import { fetchPublicQuote, respondPublicQuote } from '../api/phase3.js';
import { formatINR } from '../utils/money.js';
import { Reveal } from '../components/motion/Motion.js';

export const PublicQuotePage: React.FC = () => {
  const { publicToken } = useParams<{ publicToken: string }>();
  const queryClient = useQueryClient();

  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicQuote', publicToken],
    queryFn: () => fetchPublicQuote(publicToken!),
    enabled: Boolean(publicToken),
    retry: 1,
  });

  const respondMutation = useMutation({
    mutationFn: (payload: { action: 'accept' | 'decline'; reason?: string }) =>
      respondPublicQuote(publicToken!, payload),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['publicQuote', publicToken] });
      setShowDeclineModal(false);
      setActionSuccessMessage(
        vars.action === 'accept'
          ? 'Thank you! You have successfully accepted this proposal.'
          : 'Thank you for your response. The proposal has been marked as declined.'
      );
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to submit response. Please try again.');
    },
  });

  const handleDownloadPDF = () => {
    window.open(`/api/quotes/public/${publicToken}/pdf`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121214] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full p-8 bg-card border border-border rounded-3xl shadow-sm space-y-4">
          <div className="h-8 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl w-48" />
          <div className="h-4 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-lg w-72" />
          <div className="h-64 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data?.quote) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121214] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 bg-card border border-border rounded-3xl text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Quote Not Found</h2>
          <p className="text-xs text-muted leading-relaxed">
            This quote proposal link is invalid, has expired, or may have been revoked. Please contact the sender for an updated document.
          </p>
        </div>
      </div>
    );
  }

  const { quote, company } = data;
  const isExpired = quote.status === 'expired' || new Date(quote.validUntil) < new Date();
  const isAccepted = quote.status === 'accepted';
  const isDeclined = quote.status === 'declined';
  const isLocked = isAccepted || isDeclined || isExpired;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121214] py-10 px-4 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-6">
        {/* Brand Header */}
        <Reveal direction="down">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-semibold text-sm shadow-sm">
                <span className="text-[#F07B2A] mr-0.5 font-bold">F</span>D
              </div>
              <span className="text-base font-bold text-foreground">
                {company?.legalName || 'Flowdesk CRM'}
              </span>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          </div>
        </Reveal>

        {/* Action Status Notification Banner */}
        {actionSuccessMessage && (
          <Reveal direction="down">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              {actionSuccessMessage}
            </div>
          </Reveal>
        )}

        {/* Status Callout if Locked */}
        {isLocked && !actionSuccessMessage && (
          <Reveal direction="down">
            <div className="p-4 rounded-2xl bg-[#F4F4F5] dark:bg-[#202025] border border-border text-xs text-muted flex items-center gap-2.5">
              {isAccepted && (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>This quote was <strong>accepted</strong> on {quote.respondedAt ? new Date(quote.respondedAt).toLocaleDateString() : 'earlier'}.</span>
                </>
              )}
              {isDeclined && (
                <>
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>This quote was <strong>declined</strong>. {quote.responseReason ? `Reason: "${quote.responseReason}"` : ''}</span>
                </>
              )}
              {isExpired && !isAccepted && !isDeclined && (
                <>
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>This quote proposal <strong>expired</strong> on {new Date(quote.validUntil).toLocaleDateString()}.</span>
                </>
              )}
            </div>
          </Reveal>
        )}

        {/* Main Document Card */}
        <Reveal direction="up" delay={0.05}>
          <div className="bg-card border border-border rounded-3xl p-8 shadow-sm space-y-8">
            {/* Document Header & Bill To */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-border">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Commercial Proposal
                </span>
                <h1 className="text-2xl font-bold text-foreground mt-0.5">
                  {quote.number}
                </h1>
                <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Valid Until: {new Date(quote.validUntil).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Company Details */}
              <div className="text-left sm:text-right text-xs text-muted space-y-0.5">
                <div className="font-semibold text-foreground text-sm">{company?.legalName}</div>
                <div>{company?.address}</div>
                <div>{company?.state} {company?.gstin ? `• GSTIN: ${company.gstin}` : ''}</div>
                {company?.email && <div>{company.email}</div>}
              </div>
            </div>

            {/* Bill To Info */}
            <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-muted block mb-1">
                  Prepared For:
                </span>
                <div className="font-semibold text-foreground text-sm">
                  {quote.account?.name || 'Client Account'}
                </div>
                {quote.account?.gstin && <div className="text-muted font-mono mt-0.5">GSTIN: {quote.account.gstin}</div>}
              </div>

              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-muted block mb-1">
                  Attention:
                </span>
                <div className="font-semibold text-foreground">
                  {quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName}` : 'Authorized Representative'}
                </div>
                {quote.contact?.email && <div className="text-muted mt-0.5">{quote.contact.email}</div>}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border font-semibold text-muted text-[11px]">
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center w-16">Qty</th>
                    <th className="py-2.5 px-3 text-right w-24">Rate (₹)</th>
                    {quote.discountTotal > 0 && <th className="py-2.5 px-3 text-right w-20">Disc (%)</th>}
                    <th className="py-2.5 px-3 text-right w-20">GST</th>
                    <th className="py-2.5 px-3 text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quote.items.map((it: any, i: number) => {
                    const raw = (it.qty || 1) * (it.unitPrice || 0);
                    const disc = Math.round((raw * (it.discountPct || 0)) / 100);
                    const taxable = raw - disc;
                    const tax = Math.round((taxable * (it.taxRate || 0)) / 100);
                    const lineTotal = taxable + tax;

                    return (
                      <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground">{it.name}</div>
                          {it.description && <div className="text-muted text-[11px] mt-0.5">{it.description}</div>}
                        </td>
                        <td className="py-3 px-3 text-center text-muted">{it.qty}</td>
                        <td className="py-3 px-3 text-right text-muted">{formatINR(it.unitPrice)}</td>
                        {quote.discountTotal > 0 && (
                          <td className="py-3 px-3 text-right text-emerald-600 font-medium">
                            {it.discountPct ? `${it.discountPct}%` : '—'}
                          </td>
                        )}
                        <td className="py-3 px-3 text-right text-muted">{it.taxRate}%</td>
                        <td className="py-3 px-3 text-right font-bold text-foreground">{formatINR(lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-border">
              {/* Notes & Bank Details */}
              <div className="space-y-4 max-w-sm text-xs">
                {quote.notes && (
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] text-muted block mb-1">
                      Notes:
                    </span>
                    <p className="text-muted leading-relaxed">{quote.notes}</p>
                  </div>
                )}

                {company?.bankDetails?.accountNumber && (
                  <div className="p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border space-y-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-foreground flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-muted" />
                      Remittance Bank Details:
                    </span>
                    <div className="text-muted text-[11px]">
                      Account: <strong>{company.bankDetails.accountName}</strong><br />
                      A/C No: <strong className="font-mono">{company.bankDetails.accountNumber}</strong><br />
                      IFSC: <strong className="font-mono">{company.bankDetails.ifsc}</strong> ({company.bankDetails.bankName})
                    </div>
                  </div>
                )}
              </div>

              {/* Totals Breakdown */}
              <div className="w-full sm:w-64 space-y-2 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span className="font-medium text-foreground">{formatINR(quote.subtotal)}</span>
                </div>
                {quote.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-medium">- {formatINR(quote.discountTotal)}</span>
                  </div>
                )}
                {quote.taxMode === 'intra' ? (
                  <>
                    <div className="flex justify-between text-muted">
                      <span>CGST</span>
                      <span className="font-medium text-foreground">{formatINR(quote.cgstTotal || 0)}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>SGST</span>
                      <span className="font-medium text-foreground">{formatINR(quote.sgstTotal || 0)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-muted">
                    <span>IGST</span>
                    <span className="font-medium text-foreground">{formatINR(quote.igstTotal || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-foreground border-t-2 border-border pt-2.5">
                  <span>Total Amount</span>
                  <span>{formatINR(quote.total)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            {quote.terms && (
              <div className="pt-4 border-t border-border text-xs text-muted">
                <span className="font-bold uppercase tracking-wider text-[10px] text-muted block mb-1">
                  Terms & Conditions:
                </span>
                <p className="leading-relaxed whitespace-pre-line">{quote.terms}</p>
              </div>
            )}

            {/* Bottom Actions for Recipient */}
            {!isLocked && (
              <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-muted">
                  By clicking Accept, you approve this commercial estimate and authorization to proceed.
                </p>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowDeclineModal(true)}
                    disabled={respondMutation.isPending}
                    className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-semibold rounded-xl border border-border text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    Decline Quote
                  </button>
                  <button
                    type="button"
                    onClick={() => respondMutation.mutate({ action: 'accept' })}
                    disabled={respondMutation.isPending}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                    {respondMutation.isPending ? 'Submitting...' : 'Accept Quote'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* Decline Reason Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">
              Decline Proposal
            </h3>
            <p className="text-xs text-muted">
              Please let us know why you are declining this quote (pricing, timeline, competitor, or other reason):
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Optional feedback..."
              className="w-full px-3 py-2 text-xs bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => respondMutation.mutate({ action: 'decline', reason: declineReason })}
                disabled={respondMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
