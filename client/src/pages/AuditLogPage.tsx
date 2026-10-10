import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  Search,
  Download,
  ArrowRight,
  X,
  FileCode,
} from 'lucide-react';
import { fetchAuditLogs } from '../api/phase3.js';
import { AuditLog } from '../types/index.js';
import { Reveal } from '../components/motion/Motion.js';

export const AuditLogPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', actionFilter, entityTypeFilter, searchTerm, page],
    queryFn: () =>
      fetchAuditLogs({
        action: actionFilter || undefined,
        entityType: entityTypeFilter || undefined,
        q: searchTerm || undefined,
        page,
        limit: 25,
      }),
  });

  const logs = data?.data || [];
  const meta = data?.meta;

  const handleExportCSV = () => {
    window.open('/api/audit-log/export', '_blank');
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Created</span>;
      case 'update':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">Updated</span>;
      case 'delete':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">Deleted</span>;
      case 'approve':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400">Approved</span>;
      case 'reject':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">Rejected</span>;
      case 'payment_recorded':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400">Payment</span>;
      case 'export':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Export</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{action}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      {/* Header */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-foreground" />
              Compliance & Security Audit Log
            </h1>
            <p className="text-sm text-muted mt-1">
              Append-only tamper-evident security history with field-level diffs and export tracking.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs shrink-0"
          >
            <Download className="w-4 h-4" />
            Export Audit CSV
          </button>
        </div>
      </Reveal>

      {/* Filter and Search Bar */}
      <Reveal direction="down" delay={0.05}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by entity label..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground placeholder:text-muted"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="send">Send</option>
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
              <option value="payment_recorded">Payment Recorded</option>
              <option value="export">Export</option>
              <option value="login">Login</option>
            </select>

            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground"
            >
              <option value="">All Entity Types</option>
              <option value="lead">Lead</option>
              <option value="contact">Contact</option>
              <option value="account">Account</option>
              <option value="deal">Deal</option>
              <option value="task">Task</option>
              <option value="product">Product</option>
              <option value="quote">Quote</option>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="workflow">Workflow</option>
            </select>
          </div>
        </div>
      </Reveal>

      {/* Audit Log Table */}
      <Reveal direction="up" delay={0.1}>
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted">
              No audit log entries matched your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 font-semibold text-muted text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Entity Details / Changes</th>
                    <th className="py-3 px-4 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr
                      key={log._id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-[#F9F9FB] dark:hover:bg-[#202025]/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">{log.actorName}</div>
                        <div className="text-[10px] text-muted capitalize">{log.source}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {getActionBadge(log.action)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-foreground capitalize block">{log.entityType}</span>
                        {log.entityLabel && (
                          <span className="text-muted line-clamp-1 text-[11px]">{log.entityLabel}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-muted">
                        {log.changes?.length > 0 ? (
                          <span className="font-medium text-foreground">
                            {log.changes.length} field{log.changes.length === 1 ? '' : 's'} modified ({log.changes.map((c) => c.field).slice(0, 3).join(', ')}{log.changes.length > 3 ? '...' : ''})
                          </span>
                        ) : (
                          <span>Record event</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-border text-muted hover:text-foreground"
                        >
                          View Diff
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs">
              <span className="text-muted">
                Page {page} of {meta.totalPages} ({meta.total} total logs)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Previous
                </button>
                <button
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </Reveal>

      {/* Field-by-Field Diff Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-3xl max-w-xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-foreground" />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Audit Entry Details
                  </h3>
                  <p className="text-xs text-muted">
                    {new Date(selectedLog.createdAt).toLocaleString()} by {selectedLog.actorName}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded-lg text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border text-xs">
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Action</span>
                <span className="font-bold text-foreground uppercase">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Entity Type</span>
                <span className="font-semibold text-foreground capitalize">{selectedLog.entityType}</span>
              </div>
              {selectedLog.ip && (
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">IP Address</span>
                  <span className="font-mono text-muted">{selectedLog.ip}</span>
                </div>
              )}
              {selectedLog.userAgent && (
                <div className="col-span-2">
                  <span className="text-muted block text-[10px] uppercase font-bold">Client User-Agent</span>
                  <span className="text-[10px] text-muted truncate block">{selectedLog.userAgent}</span>
                </div>
              )}
            </div>

            {/* Field Diff List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                Field-by-Field Diff ({selectedLog.changes?.length || 0})
              </h4>

              {selectedLog.changes?.length === 0 ? (
                <p className="text-xs text-muted italic">No specific field-level modifications logged for this event.</p>
              ) : (
                <div className="space-y-2">
                  {selectedLog.changes.map((ch, i) => (
                    <div key={i} className="p-3 rounded-xl border border-border bg-card space-y-1.5 text-xs">
                      <div className="font-bold font-mono text-foreground text-[11px]">
                        {ch.field}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Old Value */}
                        <div className="flex-1 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 font-mono text-[11px] line-through break-all">
                          {ch.from === null || ch.from === undefined ? 'null' : JSON.stringify(ch.from)}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                        {/* New Value */}
                        <div className="flex-1 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold break-all">
                          {ch.to === null || ch.to === undefined ? 'null' : JSON.stringify(ch.to)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
