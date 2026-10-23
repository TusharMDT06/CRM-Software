import React from 'react';
import { Invoice } from '../../types/index.js';
import { formatINR, numberToIndianWords } from '../../utils/money.js';
import { Printer, Download, ShieldCheck, Building2, CreditCard, Send } from 'lucide-react';

interface OriginalTaxInvoiceProps {
  invoice: Invoice;
  onRecordPayment?: () => void;
  onSendInvoice?: () => void;
}

export const OriginalTaxInvoice: React.FC<OriginalTaxInvoiceProps> = ({
  invoice,
  onRecordPayment,
  onSendInvoice,
}) => {
  const isPaid = invoice.status === 'paid' || invoice.balance === 0;
  const isOverdue = invoice.status === 'overdue' || (new Date(invoice.dueDate) < new Date() && invoice.balance > 0);
  const token = localStorage.getItem('flowdesk_token') || '';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.open(`/api/invoices/${invoice._id}/pdf?token=${encodeURIComponent(token)}`, '_blank');
  };

  // State code mapping for GST
  const getStateCode = (stateName?: string): string => {
    const s = (stateName || '').toLowerCase();
    if (s.includes('maharashtra') || s.includes('mumbai') || s.includes('pune')) return '27-Maharashtra';
    if (s.includes('karnataka') || s.includes('bengaluru') || s.includes('bangalore')) return '29-Karnataka';
    if (s.includes('delhi') || s.includes('gurugram') || s.includes('noida')) return '07-Delhi';
    if (s.includes('tamil') || s.includes('chennai')) return '33-Tamil Nadu';
    if (s.includes('telangana') || s.includes('hyderabad')) return '36-Telangana';
    if (s.includes('gujarat') || s.includes('ahmedabad')) return '24-Gujarat';
    return stateName || '27-Maharashtra';
  };

  const isIntra = invoice.taxMode === 'intra';
  const customerState = getStateCode(invoice.account?.state || invoice.account?.city);

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar (Hidden in Print) */}
      <div className="print:hidden flex items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-xs flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Original Tax Invoice Document Preview
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!isPaid && onRecordPayment && (
            <button
              onClick={onRecordPayment}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Record Payment
            </button>
          )}

          {onSendInvoice && (
            <button
              onClick={onSendInvoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card text-foreground text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Send to Client
            </button>
          )}

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>

          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card text-foreground text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Official PDF
          </button>
        </div>
      </div>

      {/* Printable Original Tax Invoice Sheet */}
      <div className="original-invoice-sheet bg-white text-neutral-900 p-8 sm:p-12 rounded-2xl shadow-xl border border-neutral-200 max-w-4xl mx-auto font-sans relative overflow-hidden print:m-0 print:p-6 print:border-none print:shadow-none print:w-full print:max-w-none">
        
        {/* Paid / Overdue Status Stamp */}
        {isPaid && (
          <div className="absolute top-12 right-12 pointer-events-none rotate-[-12deg] border-4 border-emerald-600 text-emerald-700 font-black text-2xl tracking-widest px-6 py-2 rounded-xl uppercase opacity-85 print:opacity-100 bg-emerald-50/50 backdrop-blur-xs">
            ✓ PAID & SETTLED
          </div>
        )}
        {isOverdue && !isPaid && (
          <div className="absolute top-12 right-12 pointer-events-none rotate-[-12deg] border-4 border-red-600 text-red-600 font-black text-2xl tracking-widest px-6 py-2 rounded-xl uppercase opacity-85 print:opacity-100 bg-red-50/50 backdrop-blur-xs">
            ⚠ OVERDUE PAYMENT
          </div>
        )}

        {/* 1. Header: Seller Branding & Recipient Copy */}
        <div className="border-b-2 border-neutral-900 pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm">
                  FD
                </div>
                <h1 className="text-xl font-extrabold tracking-tight text-neutral-950 uppercase">
                  Flowdesk Technologies Pvt. Ltd.
                </h1>
              </div>
              <p className="text-xs text-neutral-600 mt-1 max-w-sm">
                Tower 4, Equinox Business Tech Park, LBS Marg, Kurla West, Mumbai, Maharashtra 400070, India
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700 mt-2 font-medium">
                <span><strong>GSTIN:</strong> 27AABCF1234F1Z5</span>
                <span><strong>PAN:</strong> AABCF1234F</span>
                <span><strong>CIN:</strong> U72900MH2024PTC123456</span>
              </div>
              <div className="text-xs text-neutral-600 mt-0.5">
                <span><strong>Email:</strong> billing@flowdesk.in</span> | <span><strong>Tel:</strong> +91 22 4912 8000</span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-neutral-100 border border-neutral-300 rounded text-[10px] font-bold tracking-wider text-neutral-700 uppercase">
                ORIGINAL FOR RECIPIENT
              </span>
              <h2 className="text-2xl font-black text-neutral-900 tracking-tight mt-2">
                TAX INVOICE
              </h2>
              <span className="text-[11px] text-neutral-500 font-medium block">
                [ Issued under Section 31 of CGST Act, 2017 ]
              </span>
            </div>
          </div>
        </div>

        {/* 2. Invoice Meta Details Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-neutral-50 border border-neutral-200 rounded-xl mb-6 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">Invoice Number</span>
            <span className="font-mono font-bold text-sm text-neutral-900">{invoice.number}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">Invoice Date</span>
            <span className="font-semibold text-neutral-800">
              {new Date(invoice.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">Payment Due Date</span>
            <span className={`font-semibold ${isOverdue ? 'text-red-600 font-bold' : 'text-neutral-800'}`}>
              {new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">Place of Supply</span>
            <span className="font-semibold text-neutral-800">{customerState}</span>
            <span className="text-[10px] text-neutral-500 block">Reverse Charge: No</span>
          </div>
        </div>

        {/* 3. Billed To & Shipped To Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 p-4 border border-neutral-200 rounded-xl">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-wider text-neutral-500 pb-1.5 border-b border-neutral-200 mb-2">
              BILLED TO (BUYER DETAILS)
            </h3>
            <div className="text-sm font-bold text-neutral-900">
              {invoice.account?.name || 'Customer Enterprise'}
            </div>
            <div className="text-xs text-neutral-600 mt-1">
              {invoice.account?.city ? `${invoice.account.city}, ` : ''}{invoice.account?.state || 'India'}
            </div>
            {invoice.account?.custom?.gst_number && (
              <div className="text-xs font-mono font-semibold text-neutral-800 mt-1">
                GSTIN / UIN: {invoice.account.custom.gst_number}
              </div>
            )}
            <div className="text-xs text-neutral-600 mt-1 pt-1 border-t border-neutral-100">
              <span><strong>Contact:</strong> {invoice.contact ? `${invoice.contact.firstName} ${invoice.contact.lastName || ''}`.trim() : 'Accounts Payable'}</span>
              {invoice.contact?.email && <span className="block"><strong>Email:</strong> {invoice.contact.email}</span>}
              {invoice.contact?.phone && <span className="block"><strong>Phone:</strong> {invoice.contact.phone}</span>}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-black uppercase tracking-wider text-neutral-500 pb-1.5 border-b border-neutral-200 mb-2">
              DISPATCHED / SHIPPED TO
            </h3>
            <div className="text-sm font-bold text-neutral-900">
              {invoice.account?.name || 'Customer Enterprise'}
            </div>
            <div className="text-xs text-neutral-600 mt-1">
              Cloud SaaS Provisioning & Digital Delivery Suite
            </div>
            <div className="text-xs text-neutral-600 mt-1">
              State: {customerState}
            </div>
            <div className="text-xs text-neutral-600 mt-1">
              Country of Supply: India
            </div>
            {invoice.deal && (
              <div className="text-xs text-neutral-700 mt-1.5 pt-1 border-t border-neutral-100">
                <strong>Project / Deal Ref:</strong> {invoice.deal.title}
              </div>
            )}
          </div>
        </div>

        {/* 4. Itemized GST Line Items Table */}
        <div className="border border-neutral-300 rounded-xl overflow-hidden mb-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100 text-neutral-800 font-bold border-b border-neutral-300 text-[11px]">
                <th className="py-2.5 px-3 w-8 text-center border-r border-neutral-200">#</th>
                <th className="py-2.5 px-3 border-r border-neutral-200">Item Description</th>
                <th className="py-2.5 px-3 w-20 text-center border-r border-neutral-200">HSN/SAC</th>
                <th className="py-2.5 px-2 w-12 text-center border-r border-neutral-200">Qty</th>
                <th className="py-2.5 px-3 w-24 text-right border-r border-neutral-200">Rate (₹)</th>
                <th className="py-2.5 px-2 w-16 text-center border-r border-neutral-200">Disc %</th>
                <th className="py-2.5 px-3 w-24 text-right border-r border-neutral-200">Taxable (₹)</th>
                <th className="py-2.5 px-3 w-20 text-center border-r border-neutral-200">
                  {isIntra ? 'CGST + SGST' : 'IGST'}
                </th>
                <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {(invoice.items || []).map((it: any, idx: number) => {
                const raw = (it.qty || 1) * (it.unitPrice || 0);
                const disc = Math.round((raw * (it.discountPct || 0)) / 100);
                const taxable = raw - disc;
                const tax = Math.round((taxable * (it.taxRate || 18)) / 100);
                const lineTotal = taxable + tax;

                return (
                  <tr key={idx} className="hover:bg-neutral-50/50">
                    <td className="py-3 px-3 text-center text-neutral-500 border-r border-neutral-200">{idx + 1}</td>
                    <td className="py-3 px-3 border-r border-neutral-200">
                      <div className="font-bold text-neutral-900">{it.name}</div>
                      {it.description && <div className="text-[11px] text-neutral-500 mt-0.5">{it.description}</div>}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-neutral-600 border-r border-neutral-200">
                      998313
                    </td>
                    <td className="py-3 px-2 text-center font-semibold border-r border-neutral-200">{it.qty}</td>
                    <td className="py-3 px-3 text-right font-mono border-r border-neutral-200">
                      {formatINR(it.unitPrice)}
                    </td>
                    <td className="py-3 px-2 text-center text-neutral-600 border-r border-neutral-200">
                      {it.discountPct ? `${it.discountPct}%` : '0%'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium border-r border-neutral-200">
                      {formatINR(taxable)}
                    </td>
                    <td className="py-3 px-3 text-center text-[11px] font-mono border-r border-neutral-200">
                      {isIntra ? '9% + 9%' : `${it.taxRate || 18}%`}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-neutral-950">
                      {formatINR(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. Bottom Financial Summary & Bank Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-6">
          {/* Left Side: Amount in Words & Bank Details */}
          <div className="space-y-4">
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Total Invoice Value in Words
              </span>
              <p className="text-xs font-semibold text-neutral-900 mt-0.5 capitalize">
                {numberToIndianWords(invoice.total)}
              </p>
            </div>

            {/* Official Bank Details */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200 font-bold text-neutral-900 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-neutral-700" />
                  BANK DETAILS FOR NEFT / RTGS / IMPS
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Verified Current A/C
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-neutral-700">
                <div><strong>Bank Name:</strong> HDFC Bank Ltd.</div>
                <div><strong>Account Name:</strong> Flowdesk Tech Pvt Ltd</div>
                <div><strong>A/C No:</strong> 50200084920192</div>
                <div><strong>IFSC Code:</strong> HDFC0000123</div>
                <div><strong>Branch:</strong> BKC, Mumbai - 400051</div>
                <div><strong>UPI VPA:</strong> flowdesk@hdfcbank</div>
              </div>
            </div>

            {/* Terms and conditions */}
            <div className="text-[11px] text-neutral-500 space-y-1">
              <span className="font-bold text-neutral-700 block uppercase tracking-wider text-[10px]">
                Terms & Conditions:
              </span>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Payment is due within 30 days of the invoice issuance date.</li>
                <li>Interest @ 18% p.a. will be levied on overdue payments past the maturity date.</li>
                <li>Subject to Mumbai jurisdiction only.</li>
              </ol>
            </div>
          </div>

          {/* Right Side: Totals Calculation Box & Signatures */}
          <div className="space-y-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal (Pre-Tax):</span>
                <span className="font-mono">{formatINR(invoice.subtotal)}</span>
              </div>

              {invoice.discountTotal > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Volume / Promotional Discount:</span>
                  <span className="font-mono text-emerald-600">-{formatINR(invoice.discountTotal)}</span>
                </div>
              )}

              {isIntra ? (
                <>
                  <div className="flex justify-between text-neutral-600">
                    <span>Central GST (CGST @ 9%):</span>
                    <span className="font-mono">{formatINR(invoice.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>State GST (SGST @ 9%):</span>
                    <span className="font-mono">{formatINR(invoice.sgstTotal)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-neutral-600">
                  <span>Integrated GST (IGST @ 18%):</span>
                  <span className="font-mono">{formatINR(invoice.igstTotal || invoice.taxTotal)}</span>
                </div>
              )}

              <div className="pt-2 border-t-2 border-neutral-900 flex justify-between items-center text-sm font-extrabold text-neutral-950">
                <span>TOTAL INVOICE AMOUNT:</span>
                <span className="text-base font-mono">{formatINR(invoice.total)}</span>
              </div>

              {invoice.paidTotal > 0 && (
                <div className="pt-1.5 flex justify-between text-emerald-700 font-semibold text-xs border-t border-neutral-200">
                  <span>Total Amount Received:</span>
                  <span className="font-mono">-{formatINR(invoice.paidTotal)}</span>
                </div>
              )}

              <div className={`pt-2 flex justify-between items-center font-bold text-xs border-t border-neutral-200 ${invoice.balance > 0 ? (isOverdue ? 'text-red-600' : 'text-neutral-900') : 'text-emerald-700'}`}>
                <span>NET BALANCE PAYABLE:</span>
                <span className="text-sm font-mono">{formatINR(invoice.balance)}</span>
              </div>
            </div>

            {/* Authorized Signature & Digital Seal */}
            <div className="pt-4 border-t border-neutral-200 flex justify-between items-end">
              <div className="flex items-center gap-2 text-neutral-500 text-[10px]">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-bold text-neutral-700">Digital Tax Certified</div>
                  <div>Digitally Generated & Verified</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-neutral-500 mb-6">
                  For <strong>Flowdesk Technologies Pvt. Ltd.</strong>
                </div>
                <div className="font-serif italic text-neutral-700 text-sm font-bold tracking-wider">
                  Tushar M.
                </div>
                <div className="text-[10px] text-neutral-600 font-bold border-t border-neutral-400 pt-1 mt-1">
                  Authorized Signatory & Comptroller
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
