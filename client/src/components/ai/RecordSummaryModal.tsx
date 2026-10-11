import React, { useState, useEffect } from 'react';
import {
  Loader2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { summarizeRecordWithAi, submitAiFeedback, RecordSummaryData } from '../../api/ai.js';

interface RecordSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'lead' | 'contact' | 'account' | 'deal' | 'ticket';
  entityId: string;
  recordName: string;
}

export const RecordSummaryModal: React.FC<RecordSummaryModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  recordName,
}) => {
  const [data, setData] = useState<RecordSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const fetchSummary = async () => {
    if (!isOpen || !entityId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await summarizeRecordWithAi(entityType, entityId);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to generate record summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSummary();
      setFeedback(null);
    } else {
      setData(null);
    }
  }, [isOpen, entityType, entityId]);

  const handleCopy = () => {
    if (!data) return;
    const text = `SUMMARY: ${data.summary}\n\nKEY FACTS:\n${data.keyFacts.map((f) => `• ${f}`).join('\n')}\n\nOPEN ISSUES:\n${data.openIssues.map((i) => `• ${i}`).join('\n')}\n\nNEXT STEP: ${data.nextStep}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (rating: 'up' | 'down') => {
    if (!data) return;
    try {
      await submitAiFeedback({
        feature: 'summarize',
        rating,
        responsePreview: data.summary.substring(0, 200),
      });
      setFeedback(rating);
    } catch {
      // non-blocking
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`AI Summary: ${recordName}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!data || loading}
              className="text-xs text-muted hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border hover:bg-card-subtle transition-colors disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Summary
                </>
              )}
            </button>

            {data && (
              <div className="flex items-center gap-1 pl-2">
                <button
                  onClick={() => handleFeedback('up')}
                  className={`p-1 rounded text-muted hover:text-foreground ${
                    feedback === 'up' ? 'text-primary' : ''
                  }`}
                  title="Helpful"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleFeedback('down')}
                  className={`p-1 rounded text-muted hover:text-foreground ${
                    feedback === 'down' ? 'text-rose-500' : ''
                  }`}
                  title="Not helpful"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-muted">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">Analyzing timeline, tickets & communications...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs space-y-2">
            <p className="font-semibold">Unable to generate summary</p>
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchSummary} className="mt-2">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-4 text-xs">
            {/* Header badges */}
            <div className="flex items-center justify-between pb-1 border-b border-border text-[11px] text-muted">
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium text-[10px]">
                AI generated
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                <Database className="w-3 h-3" />
                {data.fromCache ? 'Served from cache (invalidated on edit)' : 'Freshly generated'}
              </span>
            </div>

            {/* Executive Summary */}
            <div className="p-3.5 rounded-xl bg-card-subtle border border-border">
              <p className="text-foreground leading-relaxed font-normal">{data.summary}</p>
            </div>

            {/* Key Facts */}
            {data.keyFacts.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-semibold text-foreground tracking-tight text-xs">Key Facts</span>
                <ul className="space-y-1">
                  {data.keyFacts.map((fact, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span className="text-foreground">{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Open Issues */}
            {data.openIssues.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-semibold text-foreground tracking-tight text-xs flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> Open Issues & Blockers
                </span>
                <ul className="space-y-1">
                  {data.openIssues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span className="text-foreground">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Step */}
            {data.nextStep && (
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1">
                <span className="font-semibold text-primary text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5" /> Suggested Next Step
                </span>
                <p className="text-foreground font-medium">{data.nextStep}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
