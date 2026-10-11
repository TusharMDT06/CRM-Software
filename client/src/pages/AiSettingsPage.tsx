import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Cpu,
  Layers,
  ExternalLink,
  Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Reveal } from '../components/motion/Motion.js';
import { Button } from '../components/ui/Button.js';
import {
  getAiStatus,
  updateAiConsent,
  getAiUsageAnalytics,
  AiStatusResponse,
  AiUsageAnalyticsResponse,
} from '../api/ai.js';

export const AiSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();

  // Query AI Status
  const { data: aiStatus, refetch: refetchStatus } = useQuery<AiStatusResponse>({
    queryKey: ['aiStatus'],
    queryFn: () => getAiStatus(),
  });

  // Query AI Usage Analytics (Admin only)
  const {
    data: usageData,
    isLoading: usageLoading,
    refetch: refetchUsage,
  } = useQuery<AiUsageAnalyticsResponse>({
    queryKey: ['aiUsage'],
    queryFn: () => getAiUsageAnalytics(),
    enabled: Boolean(aiStatus?.aiEnabled && user?.role === 'admin'),
  });

  const [aiEnabledToggle, setAiEnabledToggle] = useState(false);
  const [aiNoticeAccepted, setAiNoticeAccepted] = useState(false);

  useEffect(() => {
    if (aiStatus) {
      setAiEnabledToggle(Boolean(aiStatus.aiEnabled));
    }
  }, [aiStatus]);

  const aiConsentMutation = useMutation({
    mutationFn: async ({ enabled, acceptedNotice }: { enabled: boolean; acceptedNotice: boolean }) => {
      return updateAiConsent(enabled, acceptedNotice);
    },
    onSuccess: () => {
      success('AI privacy settings and consent updated successfully.');
      refetchStatus();
      refetchUsage();
      queryClient.invalidateQueries({ queryKey: ['aiStatus'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update AI consent settings');
    },
  });

  const settingsTabs = [
    { label: 'Company Settings', to: '/settings/company' },
    { label: 'AI Intelligence & Usage', to: '/settings/ai', active: true },
    { label: 'Notifications', to: '/settings/notifications' },
    { label: 'Custom Fields', to: '/settings/custom-fields' },
  ];

  const getFeatureBadgeVariant = (feature: string) => {
    switch (feature) {
      case 'copilot':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300';
      case 'summarize':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
      case 'draft_email':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'nl_search':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
      case 'explain_score':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
      default:
        return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
    }
  };

  const getLatencyBadge = (latencyMs: number) => {
    if (latencyMs < 1000) return 'text-emerald-600 dark:text-emerald-400 font-mono';
    if (latencyMs < 2500) return 'text-amber-600 dark:text-amber-400 font-mono';
    return 'text-rose-600 dark:text-rose-400 font-mono';
  };

  const formatCost = (paise?: number) => {
    if (!paise) return '₹0.00';
    return `₹${(paise / 100).toFixed(4)}`;
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full gap-6">
      {/* Top Header */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-primary" />
              AI Intelligence & Privacy (Google Gemini)
            </h1>
            <p className="text-xs text-muted mt-1">
              Configure tenant AI enablement, review data privacy disclosures, monitor API usage, and inspect usage logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchStatus();
                refetchUsage();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-card-subtle text-xs font-medium text-foreground transition-colors shadow-2xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </Reveal>

      {/* Settings Navigation Tabs */}
      <div className="border-b border-border flex gap-2">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab.to === location.pathname
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Main Content Sections */}
      <div className="space-y-6">
        {/* API Key Configuration Status Banner */}
        {!aiStatus?.isConfigured ? (
          <Reveal delay={0.05}>
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-2">
              <div className="font-bold flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Gemini API Key is not configured on the server
              </div>
              <p className="text-muted leading-relaxed">
                To unlock AI Copilot, smart email drafting, record summaries, and natural-language search, set <code>GEMINI_API_KEY</code> in the server <code>.env</code> file. All AI UI elements remain gracefully hidden across the CRM until an API key is configured.
              </p>
              <div className="pt-2 text-[11px] font-mono text-muted">
                Documentation: <a href="https://ai.google.dev/gemini-api/docs" target="_blank" rel="noreferrer" className="underline hover:text-foreground">ai.google.dev/gemini-api/docs</a>
              </div>
            </div>
          </Reveal>
        ) : (
          <Reveal delay={0.05}>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    Google Gemini 2.0 Provider
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Configured & Active
                    </span>
                  </h3>
                  <div className="text-[11px] text-muted flex items-center gap-3 mt-0.5">
                    <span>Strong Model: <code className="text-foreground">{aiStatus.models.strong}</code></span>
                    <span>•</span>
                    <span>Fast Model: <code className="text-foreground">{aiStatus.models.fast}</code></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground underline"
                >
                  Google AI Studio <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </Reveal>
        )}

        {/* ======================================================== */}
        {/* 1. DATA PRIVACY GATE & TENANT CONFIRMATION               */}
        {/* ======================================================== */}
        <Reveal delay={0.1}>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Data Privacy Gate & Google Terms Acknowledgment
                </h2>
              </div>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                Tenant Privacy Shield
              </span>
            </div>

            {/* Master Tenant Enablement Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card-subtle">
              <div>
                <h3 className="text-xs font-bold text-foreground">
                  Enable AI Features for Organization
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  Controls Copilot assistant, email drafts, record summaries, and natural language filters for all users.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiEnabledToggle}
                  onChange={(e) => setAiEnabledToggle(e.target.checked)}
                  disabled={!aiStatus?.isConfigured}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Transparent Data Transmission Notice */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>Exact Data Transmitted to Google Gemini API:</span>
              </div>

              <div className="space-y-2 text-foreground leading-relaxed text-[11px]">
                <p>
                  When AI assistance is requested by a user (e.g., Copilot chat, record summary, email drafting), only the minimum necessary CRM context is sent to the Google Gemini API:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-muted">
                  <li><strong>Record details:</strong> Lead/Contact names, companies, deals amounts, and pipeline stages.</li>
                  <li><strong>Timeline context:</strong> Past activity notes, communication logs, and customer interaction history.</li>
                  <li><strong>Correspondence:</strong> Email subject/body snippets and support ticket problem descriptions.</li>
                </ul>
                <p className="text-amber-700 dark:text-amber-300 font-medium pt-1">
                  <strong>Zero Database Writes:</strong> Gemini can NEVER directly mutate your database. Any write operation is rendered as an interactive proposal card requiring human confirmation.
                </p>
                <p className="text-muted border-t border-border/50 pt-2">
                  <strong>Google AI Studio Terms & Tier Notice:</strong> On the free (unpaid) API tier, prompts and responses may be processed to improve Google products and reviewed by human reviewers. On paid-tier (billing-enabled) API keys, data is NOT used for training or human review. We recommend a paid-tier key for real customer data.
                </p>
              </div>

              {/* Confirmation Checkbox & Save Button */}
              <div className="pt-3 border-t border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={aiNoticeAccepted}
                    onChange={(e) => setAiNoticeAccepted(e.target.checked)}
                    disabled={!aiStatus?.isConfigured}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                  />
                  <span>I have reviewed the data privacy notice and authorize enabling AI for this tenant.</span>
                </label>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={
                    aiConsentMutation.isPending ||
                    !aiStatus?.isConfigured ||
                    (aiEnabledToggle && !aiNoticeAccepted)
                  }
                  isLoading={aiConsentMutation.isPending}
                  onClick={() =>
                    aiConsentMutation.mutate({
                      enabled: aiEnabledToggle,
                      acceptedNotice: aiNoticeAccepted,
                    })
                  }
                  className="shrink-0 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save AI Consent</span>
                </Button>
              </div>

              {/* Audit Trail Stamp */}
              {aiStatus?.aiConsentConfirmedAt && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Consent confirmed & audit-logged on{' '}
                    <strong>{new Date(aiStatus.aiConsentConfirmedAt).toLocaleString()}</strong>
                  </span>
                  {aiStatus.aiConsentConfirmedBy && (
                    <span className="text-[10px] text-muted">
                      Admin ID: {aiStatus.aiConsentConfirmedBy}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* ======================================================== */}
        {/* 2. QUOTAS, LIMITS & FEATURE BREAKDOWN                    */}
        {/* ======================================================== */}
        {aiStatus?.aiEnabled && (
          <Reveal delay={0.15}>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Monthly Quotas & Consumption
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-muted">
                  Plan: <span className="capitalize font-semibold text-foreground">{aiStatus.limits.plan}</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted">Monthly AI Requests Used</span>
                  <span className="font-mono text-foreground">
                    {aiStatus.limits.monthlyUsed} / {aiStatus.limits.monthlyMax} requests
                  </span>
                </div>
                <div className="w-full bg-card-subtle rounded-full h-2.5 border border-border overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (aiStatus.limits.monthlyUsed / (aiStatus.limits.monthlyMax || 50)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Feature Totals Cards */}
              {usageData?.featureTotals && usageData.featureTotals.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {usageData.featureTotals.map((f) => (
                    <div key={f._id} className="p-3.5 rounded-xl border border-border bg-card-subtle space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted truncate block">
                        {f._id.replace('_', ' ')}
                      </span>
                      <div className="text-lg font-bold text-foreground">
                        {f.count.toLocaleString()} <span className="text-xs font-normal text-muted">calls</span>
                      </div>
                      <div className="text-[10px] text-muted flex items-center justify-between pt-1 border-t border-border/50">
                        <span>{f.totalTokens.toLocaleString()} tokens</span>
                        <span>{Math.round(f.avgLatencyMs)}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* ======================================================== */}
        {/* 3. ADMIN AUDIT & USAGE LOG TABLE                         */}
        {/* ======================================================== */}
        {aiStatus?.aiEnabled && user?.role === 'admin' && (
          <Reveal delay={0.2}>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                      AI Usage Audit Log
                    </h2>
                    <p className="text-[11px] text-muted">
                      Audit trail of recent requests: user, feature, model, token usage, latency, and estimated cost.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-muted">
                  {usageData?.recentLogs?.length || 0} recent requests
                </span>
              </div>

              {/* Usage Table */}
              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-card-subtle border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Feature</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3 text-right">Tokens</th>
                      <th className="py-2.5 px-3 text-right">Latency</th>
                      <th className="py-2.5 px-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usageLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted">
                          Loading AI usage logs...
                        </td>
                      </tr>
                    ) : !usageData?.recentLogs || usageData.recentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted">
                          No AI requests logged yet this billing cycle.
                        </td>
                      </tr>
                    ) : (
                      usageData.recentLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-card-subtle transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted font-mono text-[11px]">
                            {new Date(log.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            {log.userId?.name || log.userId?.email || 'System'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getFeatureBadgeVariant(
                                log.feature
                              )}`}
                            >
                              {log.feature.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted">
                            {log.modelName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-foreground">
                            {log.totalTokens.toLocaleString()}
                            <span className="text-[10px] text-muted block">
                              {log.promptTokens} in / {log.responseTokens} out
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right ${getLatencyBadge(log.latencyMs)}`}>
                            {log.latencyMs}ms
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted">
                            {formatCost(log.estimatedCostPaise)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
};
export default AiSettingsPage;
