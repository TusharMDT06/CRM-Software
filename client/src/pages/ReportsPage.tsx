import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Download,
  Trophy,
} from 'lucide-react';
import Papa from 'papaparse';
import {
  FunnelReportData,
  RevenueReportData,
  LeadsReportData,
  TeamLeaderboardReportData,
  ForecastReportData,
  User,
} from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/ui/Button.js';
import { formatINR, formatCompactINR } from '../utils/formatters.js';
import { PageTransition } from '../components/motion/PageTransition.js';
import { Reveal } from '../components/motion/Reveal.js';

type DatePreset = 'this_month' | 'last_30_days' | 'this_quarter' | 'this_year' | 'custom';

export const ReportsPage: React.FC = () => {
  const { isAdmin, isManager } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'funnel' | 'revenue' | 'leads' | 'team' | 'forecast' | 'invoices'
  >('funnel');

  const [preset, setPreset] = useState<DatePreset>('this_year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');

  // Fetch users for owner filter (admin/manager)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: isAdmin || isManager,
  });

  // Calculate Date Bounds based on preset
  const dateParams = React.useMemo(() => {
    const now = new Date();
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (preset === 'this_month') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (preset === 'last_30_days') {
      fromDate = new Date(now.getTime() - 30 * 86400000);
      toDate = now;
    } else if (preset === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      fromDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
      toDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59);
    } else if (preset === 'this_year') {
      fromDate = new Date(now.getFullYear(), 0, 1);
      toDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (preset === 'custom' && customFrom && customTo) {
      fromDate = new Date(customFrom);
      toDate = new Date(customTo);
    }

    const params = new URLSearchParams();
    if (fromDate) params.append('from', fromDate.toISOString());
    if (toDate) params.append('to', toDate.toISOString());
    if (ownerFilter) params.append('owner', ownerFilter);
    return params.toString();
  }, [preset, customFrom, customTo, ownerFilter]);

  // Query Funnel
  const { data: funnelData } = useQuery<FunnelReportData>({
    queryKey: ['report-funnel', dateParams],
    queryFn: async () => {
      const res = await api.get(`/reports/funnel?${dateParams}`);
      return res.data;
    },
    enabled: activeTab === 'funnel',
  });

  // Query Revenue
  const { data: revenueData } = useQuery<RevenueReportData>({
    queryKey: ['report-revenue', dateParams],
    queryFn: async () => {
      const res = await api.get(`/reports/revenue?${dateParams}`);
      return res.data;
    },
    enabled: activeTab === 'revenue',
  });

  // Query Leads
  const { data: leadsData } = useQuery<LeadsReportData>({
    queryKey: ['report-leads', dateParams],
    queryFn: async () => {
      const res = await api.get(`/reports/leads?${dateParams}`);
      return res.data;
    },
    enabled: activeTab === 'leads',
  });

  // Query Team Leaderboard
  const { data: teamData } = useQuery<TeamLeaderboardReportData>({
    queryKey: ['report-team', dateParams],
    queryFn: async () => {
      const res = await api.get(`/reports/team?${dateParams}`);
      return res.data;
    },
    enabled: activeTab === 'team' && (isAdmin || isManager),
  });

  // Query Forecast
  const { data: forecastData } = useQuery<ForecastReportData>({
    queryKey: ['report-forecast', dateParams],
    queryFn: async () => {
      const res = await api.get(`/reports/forecast?${dateParams}`);
      return res.data;
    },
    enabled: activeTab === 'forecast',
  });

  // Query Invoices
  const { data: invoiceReportsData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['report-invoices', ownerFilter],
    queryFn: async () => {
      const res = await api.get(`/reports/invoices${ownerFilter ? `?owner=${ownerFilter}` : ''}`);
      return res.data;
    },
    enabled: activeTab === 'invoices',
  });

  // Helper to export CSV from arbitrary tabular data
  const exportTableAsCSV = (filename: string, rows: Record<string, any>[]) => {
    if (!rows || rows.length === 0) return;
    const csv = Papa.unparse(rows);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const STAGE_COLORS = ['#3B5BDB', '#8B7FE0', '#F07B2A', '#15803D', '#B42318'];

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-brand" />
              <span>Reports & Analytics</span>
            </h1>
            <p className="text-xs text-muted mt-1">
              Track pipeline conversion, revenue velocity, lead sources, rep leaderboards, and close forecasts.
            </p>
          </div>
        </div>
      </Reveal>

      {/* Shared Filter Bar */}
      <Reveal delay={0.06}>
        <div className="p-3 bg-card border border-border rounded-card flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider pl-1">
            Period:
          </span>
          <div className="flex items-center gap-1 bg-[#F4F4F5] dark:bg-[#202025] p-1 rounded-xl">
            {(
              [
                { id: 'this_month', label: 'This Month' },
                { id: 'last_30_days', label: 'Last 30 Days' },
                { id: 'this_quarter', label: 'This Quarter' },
                { id: 'this_year', label: 'This Year' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  preset === p.id
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 bg-card border border-border rounded-lg text-foreground focus:outline-none"
              />
              <span className="text-muted">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 bg-card border border-border rounded-lg text-foreground focus:outline-none"
              />
            </div>
          )}
        </div>

        {(isAdmin || isManager) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Owner:</span>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none"
            >
              <option value="">All Team Members</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      </Reveal>

      {/* Tabs */}
      <Reveal delay={0.12}>
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        {[
          { id: 'funnel', label: 'Sales Funnel' },
          { id: 'revenue', label: 'Won Revenue' },
          { id: 'leads', label: 'Leads Analysis' },
          ...((isAdmin || isManager) ? [{ id: 'team', label: 'Team Leaderboard' }] : []),
          { id: 'forecast', label: 'Forecast' },
          { id: 'invoices', label: 'Invoices & Receivables' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================= 1. SALES FUNNEL TAB ================= */}
      {activeTab === 'funnel' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pipeline Funnel Progression</h3>
              <p className="text-xs text-muted">
                Conversion rate from Lead to Closed Deal:{' '}
                <span className="font-semibold text-foreground">
                  {funnelData?.conversion?.rate ?? 0}%
                </span>{' '}
                ({funnelData?.conversion?.convertedLeads ?? 0} of {funnelData?.conversion?.totalLeads ?? 0} leads converted)
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportTableAsCSV(
                  'sales_funnel_report',
                  (funnelData?.funnel || []).map((f) => ({
                    Stage: f.stage,
                    'Deal Count': f.count,
                    'Total Amount (INR)': f.amount,
                    'Percentage (%)': `${f.percentage}%`,
                  }))
                )
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart */}
            <div className="p-5 bg-card border border-border rounded-card h-80">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
                Deals Amount by Stage
              </span>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={funnelData?.funnel || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(val) => formatCompactINR(val)}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(val: number) => [formatINR(val), 'Amount']}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {(funnelData?.funnel || []).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STAGE_COLORS[index % STAGE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="p-5 bg-card border border-border rounded-card">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
                Funnel Breakdown
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted">
                    <tr>
                      <th className="py-2.5 font-medium">Stage</th>
                      <th className="py-2.5 font-medium">Deals Count</th>
                      <th className="py-2.5 font-medium">Pipeline Value</th>
                      <th className="py-2.5 font-medium">Stage Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(funnelData?.funnel || []).map((row, idx) => (
                      <tr key={row.stage} className="hover:bg-[#F8F8FA] dark:hover:bg-[#1E1E24]">
                        <td className="py-2.5 font-semibold text-foreground capitalize flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: STAGE_COLORS[idx % STAGE_COLORS.length] }}
                          />
                          {row.stage}
                        </td>
                        <td className="py-2.5 text-muted">{row.count}</td>
                        <td className="py-2.5 font-semibold text-foreground">
                          {formatINR(row.amount)}
                        </td>
                        <td className="py-2.5 text-muted">{row.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. REVENUE TAB ================= */}
      {activeTab === 'revenue' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-muted block">Total Won Revenue</span>
                <span className="text-lg font-bold text-foreground">
                  {formatINR(revenueData?.summary?.total || 0)}
                </span>
              </div>
              <div className="h-8 w-[1px] bg-border" />
              <div>
                <span className="text-xs text-muted block">Avg Deal Size</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatINR(revenueData?.summary?.avgDealSize || 0)}
                </span>
              </div>
              <div className="h-8 w-[1px] bg-border" />
              <div>
                <span className="text-xs text-muted block">Growth vs Prev Period</span>
                <span
                  className={`text-xs font-semibold ${
                    (revenueData?.summary?.percentageChange || 0) >= 0
                      ? 'text-emerald-600'
                      : 'text-red-500'
                  }`}
                >
                  {(revenueData?.summary?.percentageChange || 0) >= 0 ? '+' : ''}
                  {revenueData?.summary?.percentageChange || 0}%
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportTableAsCSV(
                  'won_revenue_report',
                  (revenueData?.months || []).map((m) => ({
                    Month: m.month,
                    'Won Revenue (INR)': m.amount,
                    'Deals Won': m.count,
                    'Prev Period Amount': m.prevAmount,
                  }))
                )
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>

          <div className="p-5 bg-card border border-border rounded-card h-80">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
              Monthly Won Revenue Progression
            </span>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={revenueData?.months || []}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803D" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#15803D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(val) => formatCompactINR(val)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(val: number) => [formatINR(val), 'Won Revenue']}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#15803D"
                  fillOpacity={1}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Table */}
          <div className="p-5 bg-card border border-border rounded-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
              Monthly Revenue Performance
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted">
                  <tr>
                    <th className="py-2.5 font-medium">Month</th>
                    <th className="py-2.5 font-medium">Deals Won</th>
                    <th className="py-2.5 font-medium">Won Revenue</th>
                    <th className="py-2.5 font-medium">Previous Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(revenueData?.months || []).map((m) => (
                    <tr key={m.month} className="hover:bg-[#F8F8FA] dark:hover:bg-[#1E1E24]">
                      <td className="py-2.5 font-semibold text-foreground">{m.month}</td>
                      <td className="py-2.5 text-muted">{m.count}</td>
                      <td className="py-2.5 font-semibold text-foreground">{formatINR(m.amount)}</td>
                      <td className="py-2.5 text-muted">{formatINR(m.prevAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. LEADS TAB ================= */}
      {activeTab === 'leads' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              Overall Lead Conversion Rate:{' '}
              <span className="font-semibold text-foreground">
                {leadsData?.overallConversionRate ?? 0}%
              </span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportTableAsCSV(
                  'leads_by_source_report',
                  (leadsData?.bySource || []).map((s) => ({
                    Source: s.source,
                    'Total Leads': s.count,
                    'Converted Leads': s.converted,
                    'Conversion Rate (%)': `${s.rate}%`,
                  }))
                )
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* By Source Chart */}
            <div className="p-5 bg-card border border-border rounded-card h-80">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
                Leads by Source
              </span>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={leadsData?.bySource || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="count" fill="#3B5BDB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By Status Chart */}
            <div className="p-5 bg-card border border-border rounded-card h-80">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
                Leads by Status
              </span>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={leadsData?.byStatus || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="count" fill="#F07B2A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Conversion Rate per Source Table */}
          <div className="p-5 bg-card border border-border rounded-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
              Conversion Efficiency by Acquisition Source
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted">
                  <tr>
                    <th className="py-2.5 font-medium">Source</th>
                    <th className="py-2.5 font-medium">Total Leads</th>
                    <th className="py-2.5 font-medium">Converted</th>
                    <th className="py-2.5 font-medium">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(leadsData?.bySource || []).map((src) => (
                    <tr key={src.source} className="hover:bg-[#F8F8FA] dark:hover:bg-[#1E1E24]">
                      <td className="py-2.5 font-semibold text-foreground capitalize">{src.source}</td>
                      <td className="py-2.5 text-muted">{src.count}</td>
                      <td className="py-2.5 text-foreground">{src.converted}</td>
                      <td className="py-2.5 font-bold text-foreground">{src.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. TEAM LEADERBOARD TAB (Admin/Manager) ================= */}
      {activeTab === 'team' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Sales Rep Performance Leaderboard</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportTableAsCSV(
                  'team_leaderboard_report',
                  (teamData?.leaderboard || []).map((rep) => ({
                    'Rep Name': rep.owner.name,
                    Email: rep.owner.email,
                    'Deals Won': rep.wonCount,
                    'Won Revenue (INR)': rep.wonRevenue,
                    'Win Rate (%)': `${rep.winRate}%`,
                    'Open Pipeline (INR)': rep.pipelineValue,
                    'Tasks Completed': rep.tasksCompleted,
                  }))
                )
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>

          <div className="p-5 bg-card border border-border rounded-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted">
                  <tr>
                    <th className="py-2.5 font-medium">Sales Rep</th>
                    <th className="py-2.5 font-medium">Deals Won</th>
                    <th className="py-2.5 font-medium">Won Revenue</th>
                    <th className="py-2.5 font-medium">Win Rate</th>
                    <th className="py-2.5 font-medium">Open Pipeline</th>
                    <th className="py-2.5 font-medium">Tasks Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(teamData?.leaderboard || []).map((rep, idx) => (
                    <tr key={rep.owner._id} className="hover:bg-[#F8F8FA] dark:hover:bg-[#1E1E24]">
                      <td className="py-3 font-semibold text-foreground flex items-center gap-2">
                        {idx === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                        <div>
                          <p>{rep.owner.name}</p>
                          <p className="text-[10px] text-muted font-normal">{rep.owner.email}</p>
                        </div>
                      </td>
                      <td className="py-3 text-muted">{rep.wonCount}</td>
                      <td className="py-3 font-bold text-foreground">
                        {formatINR(rep.wonRevenue)}
                      </td>
                      <td className="py-3 font-medium text-foreground">{rep.winRate}%</td>
                      <td className="py-3 text-muted">{formatINR(rep.pipelineValue)}</td>
                      <td className="py-3 text-muted">{rep.tasksCompleted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 5. FORECAST TAB ================= */}
      {activeTab === 'forecast' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-muted block">Total Open Pipeline</span>
                <span className="text-base font-bold text-foreground">
                  {formatINR(forecastData?.summary?.totalAmount || 0)}
                </span>
              </div>
              <div className="h-8 w-[1px] bg-border" />
              <div>
                <span className="text-xs text-muted block">Weighted Probability Forecast</span>
                <span className="text-base font-bold text-brand">
                  {formatINR(forecastData?.summary?.weightedAmount || 0)}
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportTableAsCSV(
                  'sales_forecast_report',
                  (forecastData?.months || []).map((f) => ({
                    Month: f.month,
                    'Deals Count': f.count,
                    'Gross Value (INR)': f.totalAmount,
                    'Weighted Forecast (INR)': f.weightedAmount,
                  }))
                )
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>

          <div className="p-5 bg-card border border-border rounded-card h-80">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
              Gross Amount vs Weighted Probability Forecast
            </span>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={forecastData?.months || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(val) => formatCompactINR(val)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(val: number) => [formatINR(val)]}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Bar dataKey="totalAmount" name="Gross Amount" fill="#D4D4D8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weightedAmount" name="Weighted Forecast" fill="#F07B2A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Table */}
          <div className="p-5 bg-card border border-border rounded-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block mb-4">
              Expected Close Timeline Breakdown
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted">
                  <tr>
                    <th className="py-2.5 font-medium">Close Month</th>
                    <th className="py-2.5 font-medium">Open Deals</th>
                    <th className="py-2.5 font-medium">Total Pipeline Value</th>
                    <th className="py-2.5 font-medium">Weighted Forecast</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(forecastData?.months || []).map((m) => (
                    <tr key={m.month} className="hover:bg-[#F8F8FA] dark:hover:bg-[#1E1E24]">
                      <td className="py-2.5 font-semibold text-foreground">{m.month}</td>
                      <td className="py-2.5 text-muted">{m.count}</td>
                      <td className="py-2.5 text-muted">{formatINR(m.totalAmount)}</td>
                      <td className="py-2.5 font-bold text-foreground">
                        {formatINR(m.weightedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. INVOICES & RECEIVABLES TAB ================= */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Invoices & Cashflow</h3>
              <p className="text-xs text-muted">
                Collections history, accounts receivable aging analysis, and top revenue clients
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const rows = (invoiceReportsData?.topCustomers || []).map((c: any) => ({
                  'Account Name': c.name,
                  Industry: c.industry,
                  'Invoice Count': c.invoiceCount,
                  'Total Revenue (₹)': c.totalRevenueRupees,
                }));
                exportTableAsCSV('top_customers_revenue', rows);
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Top Customers</span>
            </Button>
          </div>

          {/* Aging Buckets Grid */}
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Outstanding Aging Buckets
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(invoiceReportsData?.aging || [
                { range: '0-30 days', amountRupees: 0, count: 0 },
                { range: '31-60 days', amountRupees: 0, count: 0 },
                { range: '61-90 days', amountRupees: 0, count: 0 },
                { range: '90+ days', amountRupees: 0, count: 0 },
              ]).map((b: any, idx: number) => {
                const borderColors = [
                  'border-emerald-500/30 bg-emerald-500/5',
                  'border-amber-500/30 bg-amber-500/5',
                  'border-orange-500/30 bg-orange-500/5',
                  'border-rose-500/30 bg-rose-500/5',
                ];
                const badgeColors = [
                  'text-emerald-700 dark:text-emerald-400',
                  'text-amber-700 dark:text-amber-400',
                  'text-orange-700 dark:text-orange-400',
                  'text-rose-700 dark:text-rose-400',
                ];

                return (
                  <div
                    key={b.range}
                    className={`p-4 rounded-card border ${borderColors[idx % 4]} flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground">{b.range}</span>
                        <span className={`text-[11px] font-bold ${badgeColors[idx % 4]}`}>
                          {b.count} {b.count === 1 ? 'inv' : 'invs'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted">Overdue balance</p>
                    </div>
                    <div className="text-xl font-bold text-foreground mt-3">
                      {formatINR(b.amountRupees || 0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Collected per Month Bar Chart */}
          <div className="p-5 bg-card border border-border rounded-card space-y-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Collections by Month (Last 6 Months)
            </h4>
            <div className="h-64 w-full">
              {invoicesLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-muted">
                  Loading collections data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invoiceReportsData?.monthlyCollections || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" opacity={0.6} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#71717A' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#71717A' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCompactINR(v)}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val)), 'Collected']}
                      contentStyle={{
                        backgroundColor: '#18181B',
                        borderRadius: 8,
                        border: 'none',
                        color: '#FAFAFA',
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="amountRupees"
                      name="Collected Amount"
                      fill="#8B7FE0"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Customers by Revenue Table */}
          <div className="p-5 bg-card border border-border rounded-card space-y-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Top Customers by Revenue
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-border text-muted">
                  <tr>
                    <th className="py-2.5 font-medium">#</th>
                    <th className="py-2.5 font-medium">Customer / Account</th>
                    <th className="py-2.5 font-medium">Industry</th>
                    <th className="py-2.5 font-medium">Invoices</th>
                    <th className="py-2.5 font-medium text-right">Revenue Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(invoiceReportsData?.topCustomers || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted">
                        No customer invoice data available yet.
                      </td>
                    </tr>
                  ) : (
                    (invoiceReportsData?.topCustomers || []).map((c: any, index: number) => (
                      <tr key={c.accountId || index} className="hover:bg-[#F8F8FA] dark:hover:bg-[#1E1E24]">
                        <td className="py-2.5 font-mono text-muted">{index + 1}</td>
                        <td className="py-2.5 font-semibold text-foreground">{c.name}</td>
                        <td className="py-2.5 text-muted">{c.industry || '—'}</td>
                        <td className="py-2.5 text-muted">{c.invoiceCount}</td>
                        <td className="py-2.5 font-bold text-foreground text-right">
                          {formatINR(c.totalRevenueRupees)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </Reveal>
    </PageTransition>
  );
};
