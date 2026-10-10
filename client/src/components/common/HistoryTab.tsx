import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ArrowRight, ShieldCheck } from 'lucide-react';
import { fetchEntityAuditHistory } from '../../api/phase3.js';
import { useAuth } from '../../context/AuthContext.js';
import { AuditLog } from '../../types/index.js';

interface HistoryTabProps {
  entityType: string;
  entityId: string;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ entityType, entityId }) => {
  const { isAdmin, isManager } = useAuth();
  const canViewDiffAndActor = isAdmin || isManager;

  const { data, isLoading } = useQuery({
    queryKey: ['entityAuditHistory', entityType, entityId],
    queryFn: () => fetchEntityAuditHistory(entityType, entityId),
  });

  const logs = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-muted">
        No audit log history entries recorded for this record yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          Audit & Modification History ({logs.length})
        </h3>
        {canViewDiffAndActor && (
          <span className="text-[10px] text-muted flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Field diffs visible (Manager / Admin)
          </span>
        )}
      </div>

      <div className="space-y-3">
        {logs.map((log: AuditLog) => (
          <div
            key={log._id}
            className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-2.5 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-100 dark:bg-neutral-800 text-foreground">
                  {log.action}
                </span>
                {canViewDiffAndActor && (
                  <span className="font-semibold text-foreground">
                    by {log.actorName}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted font-mono">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>

            {log.entityLabel && (
              <p className="text-xs text-muted">{log.entityLabel}</p>
            )}

            {/* Field diffs (visible to manager and admin) */}
            {canViewDiffAndActor && log.changes && log.changes.length > 0 && (
              <div className="pt-2 border-t border-border space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted block">
                  Field Changes:
                </span>
                {log.changes.map((ch: any, i: number) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="font-mono font-semibold text-foreground">{ch.field}:</span>
                    <div className="flex items-center gap-2 text-right">
                      <span className="line-through text-red-500 font-mono">
                        {ch.from === null || ch.from === undefined ? 'null' : String(ch.from)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted" />
                      <span className="text-emerald-600 font-mono font-bold">
                        {ch.to === null || ch.to === undefined ? 'null' : String(ch.to)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
