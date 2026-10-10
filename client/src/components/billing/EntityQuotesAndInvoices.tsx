import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Receipt,
  Plus,
  Download,
} from 'lucide-react';
import { fetchQuotes, fetchInvoices } from '../../api/phase3.js';
import { formatINR } from '../../utils/money.js';

interface EntityQuotesAndInvoicesProps {
  type: 'quotes' | 'invoices';
  filter: { deal?: string; account?: string };
  dealId?: string;
}

export const EntityQuotesAndInvoices: React.FC<EntityQuotesAndInvoicesProps> = ({
  type,
  filter,
  dealId,
}) => {
  const navigate = useNavigate();

  const isQuotes = type === 'quotes';

  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ['entity-quotes', filter],
    queryFn: () => fetchQuotes(filter),
    enabled: isQuotes,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['entity-invoices', filter],
    queryFn: () => fetchInvoices(filter),
    enabled: !isQuotes,
  });

  const isLoading = isQuotes ? quotesLoading : invoicesLoading;
  const items = isQuotes ? quotesData?.data || [] : invoicesData?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Header & Action */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          {isQuotes ? <FileText className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
          {isQuotes ? `Proposals & Quotes (${items.length})` : `Invoices & Billing (${items.length})`}
        </h3>

        {isQuotes && (
          <button
            onClick={() => navigate(dealId ? `/quotes/new?deal=${dealId}` : '/quotes/new')}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New Quote
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted">
          {isQuotes
            ? 'No quotes generated for this record yet.'
            : 'No invoices issued for this record yet.'}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 font-semibold text-muted text-[11px]">
                <th className="py-2.5 px-3">Document #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Total Amount</th>
                {!isQuotes && <th className="py-2.5 px-3">Balance Due</th>}
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it: any) => (
                <tr
                  key={it._id}
                  onClick={() => navigate(isQuotes ? `/quotes/${it._id}` : `/invoices/${it._id}`)}
                  className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3 font-mono font-bold text-foreground">
                    {it.number}
                  </td>
                  <td className="py-3 px-3 text-muted">
                    {new Date(isQuotes ? it.validUntil : it.dueDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 font-semibold text-foreground">
                    {formatINR(it.total)}
                  </td>
                  {!isQuotes && (
                    <td className="py-3 px-3 font-bold text-foreground">
                      {formatINR(it.balance)}
                    </td>
                  )}
                  <td className="py-3 px-3">
                    <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-foreground">
                      {it.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        window.open(
                          isQuotes ? `/api/quotes/${it._id}/pdf` : `/api/invoices/${it._id}/pdf`,
                          '_blank'
                        )
                      }
                      title="Download PDF"
                      className="p-1 text-muted hover:text-foreground"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
