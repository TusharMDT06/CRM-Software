import React from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DocumentBuilder } from '../components/billing/DocumentBuilder.js';
import { fetchQuote, createQuote, updateQuote } from '../api/phase3.js';
import { useToast } from '../context/ToastContext.js';
import { Reveal } from '../components/motion/Motion.js';
import { FileText, ArrowLeft } from 'lucide-react';

export const QuoteBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const prefillDealId = searchParams.get('deal') || undefined;
  const navigate = useNavigate();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const isEditing = Boolean(id && id !== 'new');

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchQuote(id!),
    enabled: isEditing,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) {
        return await updateQuote(id!, payload);
      } else {
        return await createQuote(payload);
      }
    },
    onSuccess: (savedQuote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      success(
        isEditing ? 'Quote updated successfully' : `Quote ${savedQuote.number} created successfully`
      );
      navigate(`/quotes`);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save quote');
    },
  });

  if (isEditing && isLoading) {
    return (
      <div className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="h-10 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl w-64" />
        <div className="h-96 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full gap-6">
      {/* Header */}
      <Reveal direction="down">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/quotes')}
              className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <FileText className="w-6 h-6 text-foreground" />
                {isEditing ? `Edit Quote (${quote?.number})` : 'New Sales Quote'}
              </h1>
              <p className="text-xs text-muted mt-0.5">
                {isEditing
                  ? 'Update line items, tax mode, or client terms.'
                  : 'Assemble products, configure discount rules, and calculate GST totals.'}
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Builder Component */}
      <Reveal direction="up" delay={0.05}>
        <DocumentBuilder
          type="quote"
          initialData={quote}
          onSave={async (payload) => {
            await saveMutation.mutateAsync(payload);
          }}
          isSaving={saveMutation.isPending}
          prefillDealId={prefillDealId}
        />
      </Reveal>
    </div>
  );
};
