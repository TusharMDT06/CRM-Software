import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Target,
  Trophy,
  Handshake,
  BarChart3,
  Sparkles,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Download,
  RefreshCw,
  CheckCircle2,
  Building2,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { ForecastDashboardData } from '../types/index.js';

function formatINR(val?: number): string {
  if (val === undefined || val === null) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

function formatCompactINR(val?: number): string {
  if (!val) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  return `₹${val}`;
}

export const ForecastsPage: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [period, setPeriod] = useState<string>('Q4'); // Q1, Q2, Q3, Q4, all
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchDeal, setSearchDeal] = useState<string>('');

  // Target Quota Modal State
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [newQuotaValue, setNewQuotaValue] = useState<string>('5000000');

  // Fetch Team Users for owner dropdown
  const { data: teamUsers = [] } = useQuery({
    queryKey: ['team-users-forecast'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data?.users || res.data || [];
    },
  });

  // Fetch Forecasts Data
  const { data, isLoading, refetch, isFetching } = useQuery<ForecastDashboardData>({
    queryKey: ['sales-forecasts', year, period, ownerFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('year', String(year));
      params.append('period', period);
      if (ownerFilter) params.append('owner', ownerFilter);

      const res = await api.get(`/forecasts?${params.toString()}`);
      return res.data;
    },
  });

  // Mutation to update Target Quota
  const quotaMutation = useMutation({
    mutationFn: async (quotaAmount: number) => {
      const res = await api.post('/forecasts/quota', {
        year,
        period,
        quota: quotaAmount,
        ownerId: ownerFilter || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-forecasts'] });
      showToast('Sales target quota updated successfully', 'success');
      setQuotaModalOpen(false);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update quota', 'error');
    },
  });

  const handleSaveQuota = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(newQuotaValue.replace(/,/g, ''));
    if (isNaN(num) || num < 0) {
      showToast('Please enter a valid target amount', 'error');
      return;
    }
    quotaMutation.mutate(num);
  };

  // Export Table as CSV
  const handleExportCSV = () => {
    if (!data || !data.deals.length) {
      showToast('No deals in current forecast to export', 'error');
      return;
    }
    const headers = [
      'Deal Title',
      'Account',
      'Stage',
      'Probability %',
      'Amount (INR)',
      'Weighted Forecast (INR)',
      'Expected Close',
      'AI Risk Score',
      'Owner',
    ];
    const rows = data.deals.map((d) => [
      `"${d.title.replace(/"/g, '""')}"`,
      `"${(d.account?.name || '').replace(/"/g, '""')}"`,
      d.stage,
      `${d.probability}%`,
      d.amount,
      d.weightedAmount,
      d.expectedClose ? new Date(d.expectedClose).toLocaleDateString('en-IN') : '',
      d.aiRisk?.score || 'N/A',
      `"${(d.owner?.name || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_forecast_${period}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Forecast report exported to CSV', 'success');
  };

  // Filtered Deals
  const filteredDeals = (data?.deals || []).filter((d) => {
    if (stageFilter !== 'all' && d.stage !== stageFilter) return false;
    if (searchDeal) {
      const q = searchDeal.toLowerCase();
      const matchTitle = d.title.toLowerCase().includes(q);
      const matchAccount = (d.account?.name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchAccount) return false;
    }
    return true;
  });

  const summary = data?.summary || {
    targetQuota: 5000000,
    closedWonAmount: 0,
    closedWonCount: 0,
    committedAmount: 0,
    committedCount: 0,
    bestCaseAmount: 0,
    totalPipelineAmount: 0,
    totalPipelineCount: 0,
    attainmentPercent: 0,
    gapAmount: 5000000,
    coverageRatio: 0,
  };

  const ai = data?.aiInsights;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Period Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#F07B2A]/10 text-[#F07B2A]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Sales Forecasts
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FDEBDD] text-[#F07B2A] dark:bg-[#F07B2A]/20">
                  Zoho CRM Style
                </span>
              </h1>
              <p className="text-xs text-muted">
                Track target quotas, committed pipelines, probability-weighted revenue & AI risk
              </p>
            </div>
          </div>
        </div>

        {/* Period tabs & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
          >
            <option value={2026}>FY 2026</option>
            <option value={2025}>FY 2025</option>
            <option value={2024}>FY 2024</option>
          </select>

          {/* Period Tabs */}
          <div className="flex items-center bg-muted/20 border border-border rounded-xl p-0.5">
            {[
              { id: 'Q1', label: 'Q1' },
              { id: 'Q2', label: 'Q2' },
              { id: 'Q3', label: 'Q3' },
              { id: 'Q4', label: 'Q4' },
              { id: 'all', label: 'Full Year' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  period === p.id
                    ? 'bg-[#F07B2A] text-white shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Owner Filter */}
          {(isAdmin || isManager) && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="text-xs bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A] max-w-[150px] truncate"
            >
              <option value="">All Sales Reps</option>
              {teamUsers.map((u: any) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          {/* Action Buttons */}
          {(isAdmin || isManager) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewQuotaValue(String(summary.targetQuota || 5000000));
                setQuotaModalOpen(true);
              }}
              className="text-xs font-medium border-border"
            >
              <Target className="w-3.5 h-3.5 mr-1.5 text-[#F07B2A]" />
              Set Quota
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs font-medium border-border"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            CSV
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs font-medium p-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 2. Zoho CRM KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Target Quota */}
        <div className="p-4 bg-card border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Target Quota
            </span>
            <span className="p-1.5 rounded-lg bg-orange-500/10 text-[#F07B2A]">
              <Target className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tracking-tight">
              {formatCompactINR(summary.targetQuota)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted font-medium">
              <span>Goal for {period}</span>
            </div>
          </div>
        </div>

        {/* Closed Won */}
        <div className="p-4 bg-card border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Closed Won
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Trophy className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCompactINR(summary.closedWonAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted font-medium">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {summary.attainmentPercent}%
              </span>
              <span>• {summary.closedWonCount} deals</span>
            </div>
          </div>
        </div>

        {/* Committed Forecast */}
        <div className="p-4 bg-card border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Committed
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Handshake className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              {formatCompactINR(summary.committedAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted font-medium">
              <span>80% Win Prob</span>
              <span>• {summary.committedCount} deals</span>
            </div>
          </div>
        </div>

        {/* Best Case Forecast */}
        <div className="p-4 bg-card border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Best Case
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">
              {formatCompactINR(summary.bestCaseAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted font-medium">
              <span>Probability-Weighted</span>
            </div>
          </div>
        </div>

        {/* Total Pipeline */}
        <div className="p-4 bg-card border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Gross Pipeline
            </span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold text-foreground tracking-tight">
              {formatCompactINR(summary.totalPipelineAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted font-medium">
              <span>{summary.totalPipelineCount} open deals</span>
            </div>
          </div>
        </div>

        {/* Pipeline Gap / Coverage */}
        <div className="p-4 bg-card border border-border rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Target Gap
            </span>
            <span
              className={`p-1.5 rounded-lg ${
                summary.gapAmount === 0
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div
              className={`text-xl font-bold tracking-tight ${
                summary.gapAmount === 0 ? 'text-emerald-600' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary.gapAmount === 0 ? 'Quota Met' : formatCompactINR(summary.gapAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted font-medium">
              <span>Coverage: {summary.coverageRatio}x</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Zoho Multi-Segment Attainment Progress Bar */}
      <div className="p-5 bg-card border border-border rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Quota Attainment Trajectory</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/30 font-medium">
              Target: {formatINR(summary.targetQuota)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Closed Won ({formatCompactINR(summary.closedWonAmount)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Committed ({formatCompactINR(summary.committedAmount)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Weighted Pipeline ({formatCompactINR(summary.bestCaseAmount)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <span>Target Gap ({formatCompactINR(summary.gapAmount)})</span>
            </div>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="h-4 w-full bg-muted/30 rounded-full overflow-hidden flex relative">
          {/* Closed Won */}
          <div
            style={{
              width: `${Math.min(
                100,
                (summary.closedWonAmount / (summary.targetQuota || 1)) * 100
              )}%`,
            }}
            className="h-full bg-emerald-500 transition-all duration-500"
            title={`Closed Won: ${formatINR(summary.closedWonAmount)}`}
          />
          {/* Committed */}
          <div
            style={{
              width: `${Math.min(
                Math.max(
                  0,
                  100 - (summary.closedWonAmount / (summary.targetQuota || 1)) * 100
                ),
                (summary.committedAmount / (summary.targetQuota || 1)) * 100
              )}%`,
            }}
            className="h-full bg-amber-500 transition-all duration-500"
            title={`Committed: ${formatINR(summary.committedAmount)}`}
          />
          {/* Best Case Remaining */}
          <div
            style={{
              width: `${Math.min(
                Math.max(
                  0,
                  100 -
                    ((summary.closedWonAmount + summary.committedAmount) /
                      (summary.targetQuota || 1)) *
                      100
                ),
                (summary.bestCaseAmount / (summary.targetQuota || 1)) * 100
              )}%`,
            }}
            className="h-full bg-indigo-500 transition-all duration-500"
            title={`Weighted Pipeline: ${formatINR(summary.bestCaseAmount)}`}
          />
        </div>
      </div>

      {/* 4. Zoho Zia-Style AI Pipeline Intelligence Card */}
      {ai && (
        <div className="p-5 bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-transparent border border-[#F07B2A]/20 rounded-2xl shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-[#F07B2A] text-white shadow-xs shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#F07B2A] uppercase tracking-wider">
                    Zia AI Pipeline Prediction
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ai.status === 'Exceeding Target'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : ai.status === 'On Track'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-rose-500/10 text-rose-600'
                    }`}
                  >
                    {ai.status}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground mt-0.5">
                  Projected End-of-Period Revenue: {formatINR(ai.expectedFinalRevenue)}{' '}
                  <span className="text-xs font-normal text-muted">
                    ({ai.predictedAttainment}% of Target Quota)
                  </span>
                </h3>
                <p className="text-xs text-muted mt-1 max-w-2xl">{ai.recommendation}</p>
              </div>
            </div>

            {/* AI Warning Pills */}
            <div className="flex items-center gap-3 shrink-0">
              {ai.highRiskCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>
                    {ai.highRiskCount} {ai.highRiskCount === 1 ? 'Deal' : 'Deals'} High AI Risk
                  </span>
                </div>
              )}
              {ai.closingSoonCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>
                    {ai.closingSoonCount} Closing in &lt;14d
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Monthly Pipeline Chart & Stage Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Breakdown Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 bg-card border border-border rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Timeline Forecast & Attainment</h3>
              <p className="text-xs text-muted">
                Gross pipeline vs probability-weighted forecast vs closed won revenue
              </p>
            </div>
            <span className="text-xs font-medium text-muted">{period} {year}</span>
          </div>

          <div className="h-64 w-full">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-muted">
                Loading forecast trends...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.monthlyBreakdown || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCompactINR(v)} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [formatINR(v)]}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="grossAmount" name="Gross Pipeline" fill="#D4D4D8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="weightedAmount" name="Weighted Forecast" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="wonAmount" name="Closed Won" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Stage Distribution Breakdown (1 col) */}
        <div className="p-5 bg-card border border-border rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Pipeline Stage Weighting</h3>
            <p className="text-xs text-muted mb-4">
              Zoho standard probability weighting by deal stage
            </p>

            <div className="space-y-3">
              {[
                { key: 'negotiation', name: 'Negotiation', prob: '80%', color: 'amber' },
                { key: 'proposal', name: 'Proposal / Quote', prob: '60%', color: 'indigo' },
                { key: 'qualified', name: 'Qualified Lead', prob: '20%', color: 'blue' },
              ].map((s) => {
                const stageData = data?.stageBreakdown?.[s.key] || {
                  count: 0,
                  totalAmount: 0,
                  weightedAmount: 0,
                };
                return (
                  <div
                    key={s.key}
                    className="p-3 rounded-xl border border-border bg-muted/15 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">{s.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-muted/40 text-muted">
                          {s.prob}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {stageData.count} {stageData.count === 1 ? 'deal' : 'deals'} • Total:{' '}
                        {formatCompactINR(stageData.totalAmount)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-foreground">
                        {formatINR(stageData.weightedAmount)}
                      </div>
                      <span className="text-[10px] text-muted">Weighted</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>Total Weighted Pipeline:</span>
            <span className="font-bold text-foreground">{formatINR(summary.bestCaseAmount)}</span>
          </div>
        </div>
      </div>

      {/* 6. Rep Attainment Leaderboard (Zoho CRM Quota Table) */}
      {(isAdmin || isManager) && (data?.repLeaderboard || []).length > 0 && (
        <div className="p-5 bg-card border border-border rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Sales Rep Forecast Contribution</h3>
              <p className="text-xs text-muted">
                Individual quota attainment, active pipeline & weighted forecast by sales representative
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted font-medium">
                <tr>
                  <th className="py-2.5 px-3">Sales Rep</th>
                  <th className="py-2.5 px-3">Open Deals</th>
                  <th className="py-2.5 px-3">Active Pipeline</th>
                  <th className="py-2.5 px-3">Weighted Forecast</th>
                  <th className="py-2.5 px-3">Closed Won</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {(data?.repLeaderboard || []).map((rep) => (
                  <tr key={rep.owner._id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#F07B2A]/10 text-[#F07B2A] flex items-center justify-center font-bold text-xs shrink-0">
                          {rep.owner.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{rep.owner.name}</div>
                          <div className="text-[10px] text-muted">{rep.owner.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted">{rep.dealsCount} deals</td>
                    <td className="py-3 px-3 text-foreground font-semibold">
                      {formatINR(rep.pipelineAmount)}
                    </td>
                    <td className="py-3 px-3 text-indigo-600 dark:text-indigo-400 font-bold">
                      {formatINR(rep.weightedAmount)}
                    </td>
                    <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatINR(rep.wonAmount)} ({rep.wonCount})
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setOwnerFilter(rep.owner._id)}
                        className="text-xs text-[#F07B2A] hover:underline font-semibold"
                      >
                        View Pipeline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Deals In Forecast Pipeline (Zoho CRM Drilldown Table) */}
      <div className="p-5 bg-card border border-border rounded-2xl shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Deals in Forecast Pipeline ({filteredDeals.length})
            </h3>
            <p className="text-xs text-muted">
              Individual deals closing within this period contributing to the forecast
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search deal or account..."
              value={searchDeal}
              onChange={(e) => setSearchDeal(e.target.value)}
              className="text-xs bg-muted/20 border border-border rounded-xl px-3 py-1.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
            />

            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="text-xs bg-muted/20 border border-border rounded-xl px-3 py-1.5 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
            >
              <option value="all">All Stages</option>
              <option value="negotiation">Negotiation (80%)</option>
              <option value="proposal">Proposal (60%)</option>
              <option value="qualified">Qualified (20%)</option>
            </select>
          </div>
        </div>

        {/* Deals Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border text-muted font-medium">
              <tr>
                <th className="py-2.5 px-3">Deal Title</th>
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3">Stage & Probability</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Weighted Value</th>
                <th className="py-2.5 px-3">Expected Close</th>
                <th className="py-2.5 px-3">AI Risk</th>
                <th className="py-2.5 px-3">Owner</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-muted">
                    No deals match the selected forecast criteria.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal) => {
                  const stageColors: Record<string, string> = {
                    negotiation:
                      'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                    proposal:
                      'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
                    qualified:
                      'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                  };

                  const riskColors: Record<string, string> = {
                    high: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
                    medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                    low: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                  };

                  return (
                    <tr key={deal._id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-3">
                        <Link
                          to={`/deals/${deal._id}`}
                          className="font-bold text-foreground hover:text-[#F07B2A] transition-colors flex items-center gap-1 group"
                        >
                          <span>{deal.title}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-muted flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-muted shrink-0" />
                        <span className="truncate max-w-[140px]">{deal.account?.name || '—'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border capitalize ${
                            stageColors[deal.stage] || 'bg-muted/30 text-muted'
                          }`}
                        >
                          {deal.stage} ({deal.probability}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-foreground font-semibold">
                        {formatINR(deal.amount)}
                      </td>
                      <td className="py-3 px-3 text-indigo-600 dark:text-indigo-400 font-bold">
                        {formatINR(deal.weightedAmount)}
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {deal.expectedClose
                          ? new Date(deal.expectedClose).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-3 px-3">
                        {deal.aiRisk ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${
                              riskColors[deal.aiRisk.level] || 'bg-muted/30 text-muted'
                            }`}
                          >
                            {deal.aiRisk.level} ({deal.aiRisk.score})
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted">Normal</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted truncate max-w-[120px]">
                        {deal.owner?.name || 'Unassigned'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/deals/${deal._id}`}
                          className="text-xs text-[#F07B2A] hover:underline font-semibold"
                        >
                          View Deal
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. Target Quota Setup Modal */}
      {quotaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-[#F07B2A]">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Set Target Quota</h3>
                  <p className="text-xs text-muted">
                    Configure sales target quota for {period} {year}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuotaModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuota} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">
                  Target Quota Amount (INR ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={newQuotaValue}
                    onChange={(e) => setNewQuotaValue(e.target.value)}
                    required
                    className="w-full pl-8 pr-3 py-2 text-sm bg-muted/20 border border-border rounded-xl text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-[#F07B2A]"
                  />
                </div>
                <p className="text-[11px] text-muted mt-1.5">
                  Formatted preview: {formatINR(Number(newQuotaValue) || 0)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/15 border border-border text-xs text-muted space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Dynamic Real-time Recalculation</span>
                </div>
                <p className="text-[11px]">
                  Setting this quota instantly recalibrates attainment percentages, target gaps, and
                  coverage multiples across the entire forecast dashboard.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuotaModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#F07B2A] text-white hover:bg-[#d96b20]"
                  disabled={quotaMutation.isPending}
                >
                  {quotaMutation.isPending ? 'Saving...' : 'Save Target Quota'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForecastsPage;
