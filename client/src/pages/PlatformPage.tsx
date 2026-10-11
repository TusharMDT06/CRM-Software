import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Shield,
  Building,
  Users,
  Database,
  Eye,
  Sliders,
  AlertTriangle,
  CheckCircle,
  LogOut,
  RefreshCw,
  Search,
  History,
  Lock,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Tenant, TenantLimits } from '../types/index.js';

interface TenantUsageItem extends Tenant {
  seatsCount: number;
  recordsCount: number;
  lastActiveAt?: string;
  suspendedReason?: string;
  deletionRequestedAt?: string;
}

export const PlatformPage: React.FC = () => {
  const { isPlatformAdmin, logout } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenantForLimits, setSelectedTenantForLimits] = useState<TenantUsageItem | null>(null);
  const [selectedTenantForStatus, setSelectedTenantForStatus] = useState<TenantUsageItem | null>(null);
  const [suspendedReason, setSuspendedReason] = useState('');
  const [activeTab, setActiveTab] = useState<'tenants' | 'audit'>('tenants');

  // Limit form state
  const [limitForm, setLimitForm] = useState<TenantLimits & { plan: 'free' | 'pro' }>({
    plan: 'free',
    maxSeats: 5,
    maxRecords: 1000,
    aiEnabled: false,
    aiMonthlyRequests: 50,
  });

  // Fetch tenants with usage
  const {
    data: tenants = [],
    isLoading: isTenantsLoading,
    refetch: refetchTenants,
  } = useQuery<TenantUsageItem[]>({
    queryKey: ['platformTenants'],
    queryFn: async () => {
      const res = await api.get('/platform/tenants');
      return res.data;
    },
    enabled: isPlatformAdmin,
  });

  // Fetch platform audit logs
  const { data: auditData, isLoading: isAuditLoading } = useQuery({
    queryKey: ['platformAuditLogs'],
    queryFn: async () => {
      const res = await api.get('/platform/audit-logs');
      return res.data;
    },
    enabled: isPlatformAdmin && activeTab === 'audit',
  });

  // Mutation: Update status (suspend / reactivate)
  const statusMutation = useMutation({
    mutationFn: async ({
      tenantId,
      status,
      reason,
    }: {
      tenantId: string;
      status: 'active' | 'suspended';
      reason?: string;
    }) => {
      const res = await api.patch(`/platform/tenants/${tenantId}/status`, {
        status,
        suspendedReason: reason,
      });
      return res.data;
    },
    onSuccess: (data) => {
      success(data.message || 'Tenant status updated');
      setSelectedTenantForStatus(null);
      setSuspendedReason('');
      queryClient.invalidateQueries({ queryKey: ['platformTenants'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update tenant status');
    },
  });

  // Mutation: Update limits
  const limitsMutation = useMutation({
    mutationFn: async ({
      tenantId,
      payload,
    }: {
      tenantId: string;
      payload: any;
    }) => {
      const res = await api.patch(`/platform/tenants/${tenantId}/limits`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      success(data.message || 'Tenant limits updated');
      setSelectedTenantForLimits(null);
      queryClient.invalidateQueries({ queryKey: ['platformTenants'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update limits');
    },
  });

  // Impersonate tenant
  const handleImpersonate = async (tenant: TenantUsageItem) => {
    try {
      const res = await api.post(`/platform/tenants/${tenant._id}/impersonate`);
      const currentToken = localStorage.getItem('flowdesk_token');
      if (currentToken) {
        localStorage.setItem('flowdesk_platform_token', currentToken);
      }
      localStorage.setItem('flowdesk_token', res.data.token);
      localStorage.setItem('flowdesk_is_impersonating', 'true');
      localStorage.setItem('flowdesk_tenant', JSON.stringify(res.data.tenant));

      success(`Starting read-only session for ${tenant.name} (30 mins)`);
      window.location.href = '/dashboard';
    } catch (err: any) {
      error(err.message || 'Failed to establish impersonation session');
    }
  };

  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-2xl border border-border p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
          <p className="text-xs text-muted leading-relaxed">
            The Flowdesk Platform Area is strictly reserved for platform administrators created via the server CLI.
          </p>
          <Button variant="primary" onClick={() => navigate('/dashboard')} className="w-full">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSeats = tenants.reduce((acc, t) => acc + (t.seatsCount || 0), 0);
  const totalRecords = tenants.reduce((acc, t) => acc + (t.recordsCount || 0), 0);
  const activeCount = tenants.filter((t) => t.status === 'active').length;
  const suspendedCount = tenants.filter((t) => t.status === 'suspended').length;

  return (
    <div className="min-h-screen bg-card-subtle text-foreground">
      {/* Platform Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold shadow-xs">
            <Shield className="w-5 h-5 text-[#F07B2A]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground">Flowdesk Platform</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black font-bold">
                Platform Admin
              </span>
            </div>
            <p className="text-[11px] text-muted">Multi-tenant management & platform infrastructure</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-muted/20 p-0.5 rounded-xl border border-border text-xs">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'tenants'
                  ? 'bg-card text-foreground shadow-2xs font-bold'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Tenants ({tenants.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'audit'
                  ? 'bg-card text-foreground shadow-2xs font-bold'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Audit Logs
            </button>
          </div>

          <button
            onClick={() => logout()}
            className="p-2 text-muted hover:text-red-500 rounded-lg transition-colors border border-border bg-card"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-muted text-xs mb-1.5">
              <span>Total Tenants</span>
              <Building className="w-4 h-4 text-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{tenants.length}</div>
            <div className="text-[11px] text-muted mt-1 flex gap-2">
              <span className="text-emerald-500 font-medium">{activeCount} active</span>
              {suspendedCount > 0 && <span className="text-red-500 font-medium">{suspendedCount} suspended</span>}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-muted text-xs mb-1.5">
              <span>Allocated Seats</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{totalSeats}</div>
            <div className="text-[11px] text-muted mt-1">Across all organizations</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-muted text-xs mb-1.5">
              <span>Total CRM Records</span>
              <Database className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{totalRecords.toLocaleString()}</div>
            <div className="text-[11px] text-muted mt-1">Leads, contacts, deals, invoices</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-muted text-xs mb-1.5">
              <span>Isolation Engine</span>
              <Shield className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-sm font-bold text-emerald-500 flex items-center gap-1.5 mt-1">
              <CheckCircle className="w-4 h-4" /> Enforced
            </div>
            <div className="text-[11px] text-muted mt-1">AsyncLocalStorage + Mongoose</div>
          </div>
        </div>

        {activeTab === 'tenants' ? (
          <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
            {/* Table Toolbar */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search tenants by name or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-card-subtle border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetchTenants()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-medium hover:bg-muted/10 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-muted" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Tenants Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/20 border-b border-border font-semibold text-muted uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3">Tenant / Organization</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Seats</th>
                    <th className="px-4 py-3">Records</th>
                    <th className="px-4 py-3">AI Engine</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isTenantsLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted">
                        Loading tenants...
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted">
                        No tenants match your search filter
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t) => {
                      const isSuspended = t.status === 'suspended';
                      const seatsPct = Math.round(((t.seatsCount || 0) / t.limits.maxSeats) * 100);
                      const recordsPct = Math.round(((t.recordsCount || 0) / t.limits.maxRecords) * 100);

                      return (
                        <tr key={t._id} className="hover:bg-muted/5 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-foreground">{t.name}</div>
                            <div className="text-[11px] text-muted font-mono">slug: {t.slug}</div>
                            {t.deletionRequestedAt && (
                              <span className="inline-block mt-1 text-[10px] bg-red-500/10 text-red-500 font-bold px-1.5 py-0.2 rounded border border-red-500/20">
                                Deletion Pending (14d Grace)
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                isSuspended
                                  ? 'bg-[#FDE4E4] text-[#B42318] dark:bg-[#B42318]/20 dark:text-[#F87171]'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-[#B42318]' : 'bg-emerald-500'}`} />
                              {t.status}
                            </span>
                            {isSuspended && t.suspendedReason && (
                              <div className="text-[10px] text-muted truncate max-w-[140px]" title={t.suspendedReason}>
                                {t.suspendedReason}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                t.plan === 'pro'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-muted/30 text-muted'
                              }`}
                            >
                              {t.plan}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-mono text-[11px] text-foreground">
                              {t.seatsCount || 0} / {t.limits.maxSeats}
                            </div>
                            <div className="w-16 h-1.5 bg-muted/30 rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  seatsPct > 90 ? 'bg-red-500' : 'bg-foreground'
                                }`}
                                style={{ width: `${Math.min(100, seatsPct)}%` }}
                              />
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-mono text-[11px] text-foreground">
                              {(t.recordsCount || 0).toLocaleString()} / {t.limits.maxRecords.toLocaleString()}
                            </div>
                            <div className="w-16 h-1.5 bg-muted/30 rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  recordsPct > 90 ? 'bg-red-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, recordsPct)}%` }}
                              />
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  t.limits.aiEnabled ? 'bg-purple-500' : 'bg-muted/40'
                                }`}
                              />
                              <span className="text-[11px] font-medium text-foreground">
                                {t.limits.aiEnabled ? `${t.limits.aiMonthlyRequests}/mo` : 'Disabled'}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-muted text-[11px]">
                            {t.lastActiveAt ? new Date(t.lastActiveAt).toLocaleDateString() : 'N/A'}
                          </td>

                          <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleImpersonate(t)}
                              title="View as Tenant (Read-only 30 min)"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold text-[11px] hover:opacity-90 transition-opacity shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>

                            <button
                              onClick={() => {
                                setSelectedTenantForLimits(t);
                                setLimitForm({
                                  plan: t.plan,
                                  maxSeats: t.limits.maxSeats,
                                  maxRecords: t.limits.maxRecords,
                                  aiEnabled: t.limits.aiEnabled,
                                  aiMonthlyRequests: t.limits.aiMonthlyRequests,
                                });
                              }}
                              title="Edit Limits"
                              className="p-1 text-muted hover:text-foreground rounded-lg border border-border bg-card transition-colors inline-flex items-center"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedTenantForStatus(t);
                                setSuspendedReason(t.suspendedReason || '');
                              }}
                              title={isSuspended ? 'Reactivate Tenant' : 'Suspend Tenant'}
                              className={`p-1 rounded-lg border transition-colors inline-flex items-center ${
                                isSuspended
                                  ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                                  : 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Audit Logs Tab */
          <div className="bg-card border border-border rounded-2xl shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-foreground" />
                <h3 className="text-sm font-bold text-foreground">Platform Audit Log</h3>
              </div>
              <span className="text-xs text-muted">All administrative interventions</span>
            </div>

            <div className="divide-y divide-border">
              {isAuditLoading ? (
                <div className="py-8 text-center text-xs text-muted">Loading audit entries...</div>
              ) : auditData?.data?.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">No audit events recorded yet.</div>
              ) : (
                auditData?.data?.map((log: any) => (
                  <div key={log._id} className="py-3 flex items-start justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground font-mono">{log.action}</span>
                        <span className="text-[10px] bg-muted/30 px-1.5 py-0.2 rounded text-muted uppercase">
                          {log.entityType}
                        </span>
                        <span className="text-foreground">{log.entityLabel}</span>
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        Actor: {log.actorName || log.actor?.name || 'Platform Admin'}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Edit Limits */}
      {selectedTenantForLimits && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-foreground">Edit Limits & Plan</h3>
                <p className="text-xs text-muted">{selectedTenantForLimits.name}</p>
              </div>
              <button
                onClick={() => setSelectedTenantForLimits(null)}
                className="text-muted hover:text-foreground text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                limitsMutation.mutate({
                  tenantId: selectedTenantForLimits._id,
                  payload: limitForm,
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-foreground mb-1">Plan Tier</label>
                <select
                  value={limitForm.plan}
                  onChange={(e) => {
                    const newPlan = e.target.value as 'free' | 'pro';
                    setLimitForm({
                      ...limitForm,
                      plan: newPlan,
                      maxSeats: newPlan === 'pro' ? 25 : 5,
                      maxRecords: newPlan === 'pro' ? 25000 : 1000,
                      aiEnabled: newPlan === 'pro',
                      aiMonthlyRequests: newPlan === 'pro' ? 500 : 50,
                    });
                  }}
                  className="w-full px-3 py-2 bg-card-subtle border border-border rounded-xl text-foreground"
                >
                  <option value="free">Free Tier (5 seats, 1,000 records)</option>
                  <option value="pro">Pro Tier (25 seats, 25,000 records, AI)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Max Seats</label>
                  <input
                    type="number"
                    min="1"
                    value={limitForm.maxSeats}
                    onChange={(e) => setLimitForm({ ...limitForm, maxSeats: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-card-subtle border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Max Records</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={limitForm.maxRecords}
                    onChange={(e) => setLimitForm({ ...limitForm, maxRecords: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2 bg-card-subtle border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground block">AI Features</span>
                    <span className="text-[11px] text-muted">Claude AI copilot & scoring</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={limitForm.aiEnabled}
                    onChange={(e) => setLimitForm({ ...limitForm, aiEnabled: e.target.checked })}
                    className="rounded border-border text-black focus:ring-black w-4 h-4"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">AI Monthly Requests Cap</label>
                  <input
                    type="number"
                    min="0"
                    value={limitForm.aiMonthlyRequests}
                    onChange={(e) => setLimitForm({ ...limitForm, aiMonthlyRequests: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-card-subtle border border-border rounded-xl text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTenantForLimits(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={limitsMutation.isPending}
                >
                  Save Limits
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal: Suspend / Reactivate */}
      {selectedTenantForStatus && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedTenantForStatus.status === 'suspended'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-red-500/10 text-red-500'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {selectedTenantForStatus.status === 'suspended' ? 'Reactivate Tenant' : 'Suspend Tenant'}
                </h3>
                <p className="text-xs text-muted">{selectedTenantForStatus.name}</p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              {selectedTenantForStatus.status === 'suspended'
                ? 'Reactivating will restore login access and re-enable all public quote and support portal links.'
                : 'Suspending will immediately block member logins and disable all public quote and support links.'}
            </p>

            {selectedTenantForStatus.status === 'active' && (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Suspension (Visible to users on login)
                </label>
                <textarea
                  rows={3}
                  value={suspendedReason}
                  onChange={(e) => setSuspendedReason(e.target.value)}
                  placeholder="e.g. Terms of service violation, billing hold, or security investigation..."
                  className="w-full px-3 py-2 text-xs bg-card-subtle border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedTenantForStatus(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={selectedTenantForStatus.status === 'suspended' ? 'primary' : 'danger'}
                size="sm"
                isLoading={statusMutation.isPending}
                onClick={() => {
                  const newStatus = selectedTenantForStatus.status === 'suspended' ? 'active' : 'suspended';
                  statusMutation.mutate({
                    tenantId: selectedTenantForStatus._id,
                    status: newStatus,
                    reason: suspendedReason,
                  });
                }}
              >
                {selectedTenantForStatus.status === 'suspended' ? 'Confirm Reactivation' : 'Confirm Suspension'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
