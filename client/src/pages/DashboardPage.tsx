import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  Trophy,
  UserPlus,
  ArrowUpRight,
  Plus,
  Clock,
  CheckSquare,
  AlertTriangle,
  Users2,
  Calendar,
  Building,
} from 'lucide-react';
import { PageTransition } from '../components/motion/PageTransition.js';
import { Reveal } from '../components/motion/Reveal.js';
import { CountUp } from '../components/motion/CountUp.js';
import { motion, useReducedMotion } from 'motion/react';
import { DashboardSummary } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge.js';
import { SegmentedMeter } from '../components/ui/SegmentedMeter.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard.js';
import { formatINR, formatCompactINR, formatDate, isOverdue } from '../utils/formatters.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  // Query Dashboard Summary
  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary');
      return res.data;
    },
    refetchInterval: 30000, // auto refresh every 30s
  });

  // Query Invoices Summary for Receivables
  const { data: invoicesData } = useQuery({
    queryKey: ['dashboard-invoices-summary'],
    queryFn: async () => {
      const res = await api.get('/invoices?limit=1');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const invSummary = invoicesData?.summary;
  const totalOutstandingPaise = invSummary?.totalOutstandingPaise ?? 0;
  const totalOverduePaise = invSummary?.totalOverduePaise ?? 0;
  const overdueCount = invSummary?.overdueCount ?? 0;
  const overduePct = totalOutstandingPaise > 0
    ? Math.min(100, Math.round((totalOverduePaise / totalOutstandingPaise) * 100))
    : 0;

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const isUp = (summary?.revenueChangePercent || 0) >= 0;

  return (
    <PageTransition className="space-y-6">
      {/* Two Columns Grid: Main Column + 320px Right Column */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        {/* ================= MAIN COLUMN ================= */}
        <div className="space-y-6 min-w-0">
          {/* 1. Row of 4 KPI Cards */}
          <Reveal ready={!isLoading} delay={0}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Revenue (Won this month) */}
              <div className="p-4 bg-card rounded-card border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted mb-2">
                  <span className="text-xs font-medium">Revenue</span>
                  <div className="w-7 h-7 rounded-lg bg-[#E6EEFF] dark:bg-[#3B5BDB]/20 text-[#3B5BDB] dark:text-[#829BF8] flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {isLoading ? (
                    <Skeleton className="h-7 w-28" />
                  ) : (
                    <CountUp
                      value={summary?.wonThisMonth.amount || 0}
                      formatFn={formatCompactINR}
                      ready={!isLoading}
                    />
                  )}
                </div>
                <div className="mt-2.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      isUp
                        ? 'bg-[#DDF6E8] text-[#15803D] dark:bg-[#15803D]/25 dark:text-[#4ADE80]'
                        : 'bg-[#FDE4E4] text-[#B42318] dark:bg-[#B42318]/25 dark:text-[#F87171]'
                    }`}
                  >
                    {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isUp ? `+${summary?.revenueChangePercent || 0}%` : `${summary?.revenueChangePercent || 0}%`} vs last month
                  </span>
                </div>
              </div>

              {/* KPI 2: Pipeline Value */}
              <div className="p-4 bg-card rounded-card border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted mb-2">
                  <span className="text-xs font-medium">Pipeline Value</span>
                  <div className="w-7 h-7 rounded-lg bg-[#F0EEFF] dark:bg-[#8B7FE0]/20 text-[#8B7FE0] flex items-center justify-center">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {isLoading ? (
                    <Skeleton className="h-7 w-28" />
                  ) : (
                    <CountUp
                      value={summary?.pipelineValue || 0}
                      formatFn={formatCompactINR}
                      ready={!isLoading}
                    />
                  )}
                </div>
                <div className="mt-2.5">
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E6EEFF] text-[#3B5BDB] dark:bg-[#3B5BDB]/20 dark:text-[#829BF8]">
                    {summary?.openDealCount || 0} active deals
                  </span>
                </div>
              </div>

              {/* KPI 3: Deals Won */}
              <div className="p-4 bg-card rounded-card border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted mb-2">
                  <span className="text-xs font-medium">Deals Won</span>
                  <div className="w-7 h-7 rounded-lg bg-[#DDF6E8] dark:bg-[#15803D]/20 text-[#15803D] dark:text-[#4ADE80] flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {isLoading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <CountUp
                      value={summary?.dealsWon || 0}
                      ready={!isLoading}
                    />
                  )}
                </div>
                <div className="mt-2.5">
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#DDF6E8] text-[#15803D] dark:bg-[#15803D]/25 dark:text-[#4ADE80]">
                    {summary?.winRate || 0}% win rate
                  </span>
                </div>
              </div>

              {/* KPI 4: New Leads */}
              <div className="p-4 bg-card rounded-card border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted mb-2">
                  <span className="text-xs font-medium">New Leads</span>
                  <div className="w-7 h-7 rounded-lg bg-[#FDEBDD] dark:bg-[#F07B2A]/20 text-[#F07B2A] flex items-center justify-center">
                    <UserPlus className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {isLoading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <CountUp
                      value={summary?.newLeads || 0}
                      ready={!isLoading}
                    />
                  )}
                </div>
                <div className="mt-2.5">
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FDEBDD] text-[#B45309] dark:bg-[#F07B2A]/20 dark:text-[#F59E0B]">
                    waiting for first call
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* 2. Card: Revenue Growth (Smooth Area Chart) */}
          <Reveal ready={!isLoading} delay={0.06}>
            <div className="p-5 bg-card rounded-card border border-border shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Revenue growth</h3>
                  <p className="text-xs text-muted">Won deals over the last 6 calendar months</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8B7FE0]" />
                  <span className="text-xs text-muted font-medium">Actual Closed Won</span>
                </div>
              </div>

              <div className="h-64 w-full">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Skeleton className="h-48 w-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={summary?.revenueByMonth || []}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="revenueGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B7FE0" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#8B7FE0" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" vertical={false} opacity={0.6} />
                      <XAxis
                        dataKey="shortMonth"
                        tick={{ fill: '#6B6B76', fontSize: 11 }}
                        axisLine={{ stroke: '#ECECEF' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#6B6B76', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => formatCompactINR(val)}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-3 bg-[#111111] text-white rounded-xl shadow-xl text-xs space-y-1 border border-neutral-700">
                                <p className="font-semibold">{data.month}</p>
                                <p className="text-[#A79CFA] font-medium text-sm">
                                  {formatINR(data.amount)}
                                </p>
                                <p className="text-[10px] text-neutral-400">
                                  {data.count} deals won
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#8B7FE0"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#revenueGrowthGradient)"
                        isAnimationActive={!reducedMotion}
                        animationDuration={900}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </Reveal>

          {/* 3. Row of 4 Health & Financial Cards */}
          <Reveal ready={!isLoading} delay={0.12}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Health 1: Pipeline Health (Green) */}
              <div className="p-4 bg-card rounded-card border border-border shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-foreground mb-1">
                    <h4 className="text-xs font-semibold">Pipeline health</h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted" />
                  </div>
                  <p className="text-[11px] text-muted">On-track open opportunities</p>
                  <div className="text-2xl font-bold text-foreground mt-2">
                    {summary?.pipelineHealth ?? 100}%
                  </div>
                </div>

                <div className="mt-3">
                  <SegmentedMeter percentage={summary?.pipelineHealth ?? 100} color="green" />
                  <div className="flex items-center justify-between text-[11px] text-muted mt-2 pt-1 border-t border-border/50">
                    <span>{summary?.openDealCount ?? 0} active deals</span>
                    <span>{summary?.dealsAtRisk?.count ?? 0} flagged</span>
                  </div>
                </div>
              </div>

              {/* Health 2: Deals at Risk (Orange) */}
              <div className="p-4 bg-card rounded-card border border-border shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-foreground mb-1">
                    <h4 className="text-xs font-semibold">Deals at risk</h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted" />
                  </div>
                  <p className="text-[11px] text-muted">Overdue expected close</p>
                  <div className="text-2xl font-bold text-foreground mt-2">
                    {summary?.dealsAtRisk?.percentage ?? 0}%
                  </div>
                </div>

                <div className="mt-3">
                  <SegmentedMeter percentage={summary?.dealsAtRisk?.percentage ?? 0} color="orange" />
                  <div className="flex items-center justify-between text-[11px] text-muted mt-2 pt-1 border-t border-border/50">
                    <span>{summary?.dealsAtRisk?.count ?? 0} deals need review</span>
                    <span>{formatCompactINR(summary?.dealsAtRisk?.amount ?? 0)} at risk</span>
                  </div>
                </div>
              </div>

              {/* Health 3: Tasks Status (Blue) */}
              <div className="p-4 bg-card rounded-card border border-border shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-foreground mb-1">
                    <h4 className="text-xs font-semibold">Tasks status</h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted" />
                  </div>
                  <p className="text-[11px] text-muted">Action completion rate</p>
                  <div className="text-2xl font-bold text-foreground mt-2">
                    {summary?.taskStats?.doneRate ?? 0}%
                  </div>
                </div>

                <div className="mt-3">
                  <SegmentedMeter percentage={summary?.taskStats?.doneRate ?? 0} color="blue" />
                  <div className="flex items-center justify-between text-[11px] text-muted mt-2 pt-1 border-t border-border/50">
                    <span>{summary?.taskStats?.open ?? 0} open</span>
                    <span className="text-[#B42318] dark:text-[#F87171]">
                      {summary?.taskStats?.overdue ?? 0} overdue
                    </span>
                  </div>
                </div>
              </div>

              {/* Health 4: Receivables (Meter card) */}
              <div
                onClick={() => navigate('/invoices')}
                className="p-4 bg-card rounded-card border border-border shadow-xs flex flex-col justify-between cursor-pointer hover:border-foreground/30 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between text-foreground mb-1">
                    <h4 className="text-xs font-semibold">Receivables</h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted" />
                  </div>
                  <p className="text-[11px] text-muted">Outstanding receivables</p>
                  <div className="text-2xl font-bold text-foreground mt-2">
                    {formatCompactINR(totalOutstandingPaise / 100)}
                  </div>
                </div>

                <div className="mt-3">
                  <SegmentedMeter
                    percentage={overduePct}
                    color={overduePct > 50 ? 'orange' : overduePct > 0 ? 'orange' : 'green'}
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted mt-2 pt-1 border-t border-border/50">
                    <span className={overdueCount > 0 ? 'text-[#B42318] dark:text-[#F87171] font-semibold' : ''}>
                      {overdueCount} overdue
                    </span>
                    <span className={totalOverduePaise > 0 ? 'text-[#B42318] dark:text-[#F87171] font-medium' : ''}>
                      {formatCompactINR(totalOverduePaise / 100)} overdue
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* 4. Card: Active Deals Table */}
          <Reveal ready={!isLoading} delay={0.18}>
            <div className="p-5 bg-card rounded-card border border-border shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Active deals</h3>
                  <p className="text-xs text-muted">Key ongoing client transactions</p>
                </div>
                <button
                  onClick={() => navigate('/deals')}
                  className="text-xs font-medium text-foreground hover:text-brand transition-colors flex items-center gap-1"
                >
                  <span>View all</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">Client / Account</th>
                      <th className="py-2.5 px-3">Deal</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted">
                          Loading deals...
                        </td>
                      </tr>
                    ) : summary?.recentDeals?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted">
                          No active deals found.
                        </td>
                      </tr>
                    ) : (
                      summary?.recentDeals?.map((deal) => {
                        const accountName =
                          typeof deal.account === 'object' ? deal.account?.name : 'Account';
                        const overdue =
                          deal.stage !== 'won' &&
                          deal.stage !== 'lost' &&
                          isOverdue(deal.expectedClose);

                        return (
                          <tr
                            key={deal._id}
                            onClick={() => navigate('/deals')}
                            className="hover:bg-[#F8F8FA] dark:hover:bg-[#202026] cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-3 font-medium text-foreground flex items-center gap-2">
                              <Building className="w-3.5 h-3.5 text-muted shrink-0" />
                              <span>{accountName}</span>
                            </td>
                            <td className="py-3 px-3 text-foreground font-medium truncate max-w-[180px]">
                              {deal.title}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`flex items-center gap-1 ${
                                  overdue
                                    ? 'text-[#B42318] dark:text-[#F87171] font-semibold'
                                    : 'text-muted'
                                }`}
                              >
                                <Calendar className="w-3 h-3 opacity-60" />
                                {formatDate(deal.expectedClose)}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-foreground">
                              {formatINR(deal.amount)}
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant={getStatusBadgeVariant(deal.stage)}>
                                {deal.stage === 'proposal'
                                  ? 'In Progress'
                                  : deal.stage === 'negotiation'
                                  ? 'Pending'
                                  : deal.stage === 'won'
                                  ? 'Completed'
                                  : deal.stage}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>

        {/* ================= 320PX RIGHT COLUMN ================= */}
        <div className="space-y-6 shrink-0">
          {/* Greeting Card with Live indicator */}
          <Reveal ready={!isLoading} delay={0.06}>
            <div className="p-5 bg-card rounded-card border border-border shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {getGreeting()}, {firstName}
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#DDF6E8] text-[#15803D] dark:bg-[#15803D]/25 dark:text-[#4ADE80]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] dark:bg-[#4ADE80] animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-xs text-muted mb-4">
                Here is your active sales desk pulse for today:
              </p>

              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8F8FA] dark:bg-[#202026] text-xs">
                  <div className="w-7 h-7 rounded-lg bg-[#FDEBDD] dark:bg-[#F07B2A]/20 text-[#F07B2A] flex items-center justify-center shrink-0">
                    <UserPlus className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {summary?.insights?.newLeadsWaiting ?? 0} new leads
                    </p>
                    <p className="text-[11px] text-muted">Awaiting initial outreach call</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8F8FA] dark:bg-[#202026] text-xs">
                  <div className="w-7 h-7 rounded-lg bg-[#E6EEFF] dark:bg-[#3B5BDB]/20 text-[#3B5BDB] dark:text-[#829BF8] flex items-center justify-center shrink-0">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {summary?.insights?.dealsInNegotiation ?? 0} deals
                    </p>
                    <p className="text-[11px] text-muted">In active commercial negotiation</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8F8FA] dark:bg-[#202026] text-xs">
                  <div className="w-7 h-7 rounded-lg bg-[#FDE4E4] dark:bg-[#B42318]/20 text-[#B42318] dark:text-[#F87171] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {summary?.insights?.overdueTasks ?? 0} tasks overdue
                    </p>
                    <p className="text-[11px] text-muted">Require priority follow-up</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* 2x2 Quick-action Tiles */}
          <Reveal ready={!isLoading} delay={0.12}>
            <div className="p-5 bg-card rounded-card border border-border shadow-xs">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/leads')}
                  className="p-3.5 rounded-xl border border-border hover:border-black dark:hover:border-white bg-[#FAFAFA] dark:bg-[#1E1E24] hover:bg-card flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#FDEBDD] dark:bg-[#F07B2A]/20 text-[#F07B2A] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Add lead</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/deals')}
                  className="p-3.5 rounded-xl border border-border hover:border-black dark:hover:border-white bg-[#FAFAFA] dark:bg-[#1E1E24] hover:bg-card flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F0EEFF] dark:bg-[#8B7FE0]/20 text-[#8B7FE0] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Create deal</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/tasks')}
                  className="p-3.5 rounded-xl border border-border hover:border-black dark:hover:border-white bg-[#FAFAFA] dark:bg-[#1E1E24] hover:bg-card flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#E6EEFF] dark:bg-[#3B5BDB]/20 text-[#3B5BDB] dark:text-[#829BF8] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Add task</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/contacts')}
                  className="p-3.5 rounded-xl border border-border hover:border-black dark:hover:border-white bg-[#FAFAFA] dark:bg-[#1E1E24] hover:bg-card flex flex-col items-center justify-center text-center gap-1.5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#DDF6E8] dark:bg-[#15803D]/20 text-[#15803D] dark:text-[#4ADE80] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">Add contact</span>
                </motion.button>
              </div>
            </div>
          </Reveal>

          {/* Open Tasks Card (Next 6 tasks with due dates, overdue in red) */}
          <Reveal ready={!isLoading} delay={0.18}>
            <div className="p-5 bg-card rounded-card border border-border shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Open tasks</h3>
                <button
                  onClick={() => navigate('/tasks')}
                  className="text-[11px] text-muted hover:text-foreground font-medium"
                >
                  View all ({summary?.taskStats?.open ?? 0})
                </button>
              </div>

              <div className="space-y-2.5">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : summary?.openTasks?.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">No open tasks due.</p>
                ) : (
                  summary?.openTasks?.map((task) => {
                    const overdue = isOverdue(task.dueDate);
                    return (
                      <div
                        key={task._id}
                        onClick={() => navigate('/tasks')}
                        className="p-2.5 rounded-xl border border-border/80 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors cursor-pointer group bg-card"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-foreground group-hover:text-brand transition-colors line-clamp-1 leading-snug">
                            {task.title}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[10px]">
                          <span
                            className={`flex items-center gap-1 font-medium ${
                              overdue
                                ? 'text-[#B42318] dark:text-[#F87171] font-semibold'
                                : 'text-muted'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                            {overdue && <span>(Overdue)</span>}
                          </span>
                          <Badge size="sm" variant={getStatusBadgeVariant(task.priority)}>
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Reveal>

          {/* Recent Activity Card (Last 8 items) */}
          <Reveal ready={!isLoading} delay={0.24}>
            <RecentActivityCard />
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
};
