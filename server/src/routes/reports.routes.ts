import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Deal } from '../models/Deal.js';
import { Lead } from '../models/Lead.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { Ticket } from '../models/Ticket.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

export const STAGE_PROBABILITY: Record<string, number> = {
  qualified: 0.2,
  proposal: 0.4,
  negotiation: 0.7,
};

function parseDateRange(fromStr?: string, toStr?: string) {
  const now = new Date();
  const to = toStr ? new Date(toStr) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = fromStr
    ? new Date(fromStr)
    : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); // start of this month default
  return { from, to };
}

function getOwnerMatch(user: any, requestedOwner?: string) {
  if (user.role === 'sales') {
    return { owner: new Types.ObjectId(user._id) };
  }
  if (requestedOwner && Types.ObjectId.isValid(requestedOwner)) {
    return { owner: new Types.ObjectId(requestedOwner) };
  }
  return {};
}

// GET /reports/funnel
reportsRouter.get('/funnel', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { from, to } = parseDateRange(req.query.from as string, req.query.to as string);
    const ownerMatch = getOwnerMatch(user, req.query.owner as string);

    const dealMatch: any = {
      ...ownerMatch,
      createdAt: { $gte: from, $lte: to },
    };

    // Deals by stage aggregation
    const stages = ['qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const dealsAgg = await Deal.aggregate([
      { $match: dealMatch },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]);

    const stageMap = new Map<string, { count: number; amount: number }>();
    dealsAgg.forEach((d) => stageMap.set(d._id, { count: d.count, amount: d.amount }));

    const funnel = stages.map((st) => ({
      stage: st,
      count: stageMap.get(st)?.count || 0,
      amount: stageMap.get(st)?.amount || 0,
    }));

    const totalDeals = funnel.reduce((sum, f) => sum + f.count, 0);
    const totalAmount = funnel.reduce((sum, f) => sum + f.amount, 0);

    // Leads in same period
    const leadMatch: any = {
      ...ownerMatch,
      createdAt: { $gte: from, $lte: to },
    };
    const [totalLeads, convertedLeads] = await Promise.all([
      Lead.countDocuments(leadMatch),
      Lead.countDocuments({ ...leadMatch, status: 'converted' }),
    ]);

    const leadConversionRate =
      totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    res.json({
      funnel,
      totalDeals,
      totalAmount,
      totalLeads,
      convertedLeads,
      leadConversionRate,
      dateRange: { from, to },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate funnel report' });
  }
});

// GET /reports/revenue
reportsRouter.get('/revenue', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { from, to } = parseDateRange(req.query.from as string, req.query.to as string);
    const ownerMatch = getOwnerMatch(user, req.query.owner as string);

    // Won deals in period
    const wonMatch: any = {
      ...ownerMatch,
      stage: 'won',
      closedAt: { $gte: from, $lte: to },
    };

    const monthlyAgg = await Deal.aggregate([
      { $match: wonMatch },
      {
        $group: {
          _id: {
            year: { $year: '$closedAt' },
            month: { $month: '$closedAt' },
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const monthly = monthlyAgg.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      monthLabel: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      amount: item.amount,
      count: item.count,
      avgDealSize: item.count > 0 ? Math.round(item.amount / item.count) : 0,
    }));

    const totalRevenue = monthly.reduce((sum, m) => sum + m.amount, 0);
    const totalDeals = monthly.reduce((sum, m) => sum + m.count, 0);
    const averageDealSize = totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0;

    // Previous period calculation
    const duration = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - duration);

    const prevMatch: any = {
      ...ownerMatch,
      stage: 'won',
      closedAt: { $gte: prevFrom, $lte: prevTo },
    };

    const prevAgg = await Deal.aggregate([
      { $match: prevMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
        },
      },
    ]);

    const previousRevenue = prevAgg[0]?.totalRevenue || 0;
    let changePercent = 0;
    if (previousRevenue > 0) {
      changePercent = Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100);
    } else if (totalRevenue > 0) {
      changePercent = 100;
    }

    res.json({
      monthly,
      totalRevenue,
      totalDeals,
      averageDealSize,
      previousRevenue,
      changePercent,
      dateRange: { from, to },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate revenue report' });
  }
});

// GET /reports/leads
reportsRouter.get('/leads', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { from, to } = parseDateRange(req.query.from as string, req.query.to as string);
    const ownerMatch = getOwnerMatch(user, req.query.owner as string);

    const leadMatch: any = {
      ...ownerMatch,
      createdAt: { $gte: from, $lte: to },
    };

    const [bySourceAgg, byStatusAgg] = await Promise.all([
      Lead.aggregate([
        { $match: leadMatch },
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 },
            converted: {
              $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
            },
            totalValue: { $sum: '$value' },
          },
        },
      ]),
      Lead.aggregate([
        { $match: leadMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$value' },
          },
        },
      ]),
    ]);

    const bySource = bySourceAgg.map((s) => ({
      source: s._id,
      count: s.count,
      converted: s.converted,
      totalValue: s.totalValue,
      conversionRate: s.count > 0 ? Math.round((s.converted / s.count) * 100) : 0,
    }));

    const byStatus = byStatusAgg.map((st) => ({
      status: st._id,
      count: st.count,
      totalValue: st.totalValue,
    }));

    const totalLeads = byStatus.reduce((sum, s) => sum + s.count, 0);
    const totalConverted = bySource.reduce((sum, s) => sum + s.converted, 0);
    const overallConversionRate =
      totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;

    res.json({
      bySource,
      byStatus,
      totalLeads,
      totalConverted,
      overallConversionRate,
      dateRange: { from, to },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate leads report' });
  }
});

// GET /reports/team (Admin / Manager only)
reportsRouter.get('/team', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'sales') {
      res.status(403).json({ message: 'Forbidden: Team leaderboard is for managers and admins only' });
      return;
    }

    const { from, to } = parseDateRange(req.query.from as string, req.query.to as string);

    const activeUsers = await User.find({ active: true }).select('name email role');

    // Aggregate won deals in period per owner
    const wonDealsAgg = await Deal.aggregate([
      {
        $match: {
          stage: 'won',
          closedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$owner',
          dealsWon: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
    ]);

    // Aggregate closed deals in period (won + lost) per owner
    const closedDealsAgg = await Deal.aggregate([
      {
        $match: {
          stage: { $in: ['won', 'lost'] },
          closedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$owner',
          totalClosed: { $sum: 1 },
        },
      },
    ]);

    // Aggregate open pipeline value
    const openPipelineAgg = await Deal.aggregate([
      {
        $match: {
          stage: { $in: ['qualified', 'proposal', 'negotiation'] },
        },
      },
      {
        $group: {
          _id: '$owner',
          openValue: { $sum: '$amount' },
          openCount: { $sum: 1 },
        },
      },
    ]);

    // Aggregate completed tasks in period
    const tasksAgg = await Task.aggregate([
      {
        $match: {
          status: 'done',
          updatedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$owner',
          tasksDone: { $sum: 1 },
        },
      },
    ]);

    const wonMap = new Map(wonDealsAgg.map((w) => [String(w._id), w]));
    const closedMap = new Map(closedDealsAgg.map((c) => [String(c._id), c]));
    const openMap = new Map(openPipelineAgg.map((o) => [String(o._id), o]));
    const taskMap = new Map(tasksAgg.map((t) => [String(t._id), t]));

    const leaderboard = activeUsers.map((u) => {
      const uId = String(u._id);
      const won = wonMap.get(uId);
      const closed = closedMap.get(uId);
      const open = openMap.get(uId);
      const tasks = taskMap.get(uId);

      const dealsWon = won?.dealsWon || 0;
      const revenue = won?.revenue || 0;
      const totalClosed = closed?.totalClosed || 0;
      const winRate = totalClosed > 0 ? Math.round((dealsWon / totalClosed) * 100) : 0;
      const openPipelineValue = open?.openValue || 0;
      const openDealsCount = open?.openCount || 0;
      const tasksCompleted = tasks?.tasksDone || 0;

      return {
        userId: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        dealsWon,
        revenue,
        totalClosed,
        winRate,
        openPipelineValue,
        openDealsCount,
        tasksCompleted,
      };
    });

    // Sort by revenue desc
    leaderboard.sort((a, b) => b.revenue - a.revenue);

    res.json({
      leaderboard,
      dateRange: { from, to },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate team leaderboard' });
  }
});

// GET /reports/forecast
reportsRouter.get('/forecast', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const ownerMatch = getOwnerMatch(user, req.query.owner as string);

    // Open deals
    const openDeals = await Deal.find({
      ...ownerMatch,
      stage: { $in: ['qualified', 'proposal', 'negotiation'] },
    }).sort({ expectedClose: 1 });

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const monthlyMap = new Map<
      string,
      {
        monthLabel: string;
        year: number;
        month: number;
        dealsCount: number;
        totalAmount: number;
        weightedTotal: number;
        stages: Record<string, { count: number; amount: number; weighted: number }>;
      }
    >();

    let grandTotal = 0;
    let grandWeightedTotal = 0;

    for (const d of openDeals) {
      const closeDate = new Date(d.expectedClose);
      const year = closeDate.getFullYear();
      const month = closeDate.getMonth();
      const key = `${year}-${month}`;
      const monthLabel = `${monthNames[month]} ${year}`;

      const prob = STAGE_PROBABILITY[d.stage] || 0;
      const weighted = Math.round(d.amount * prob);

      grandTotal += d.amount;
      grandWeightedTotal += weighted;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          monthLabel,
          year,
          month: month + 1,
          dealsCount: 0,
          totalAmount: 0,
          weightedTotal: 0,
          stages: {
            qualified: { count: 0, amount: 0, weighted: 0 },
            proposal: { count: 0, amount: 0, weighted: 0 },
            negotiation: { count: 0, amount: 0, weighted: 0 },
          },
        });
      }

      const entry = monthlyMap.get(key)!;
      entry.dealsCount += 1;
      entry.totalAmount += d.amount;
      entry.weightedTotal += weighted;

      if (entry.stages[d.stage]) {
        entry.stages[d.stage].count += 1;
        entry.stages[d.stage].amount += d.amount;
        entry.stages[d.stage].weighted += weighted;
      }
    }

    const monthlyForecast = Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    res.json({
      monthlyForecast,
      grandTotal,
      grandWeightedTotal,
      probabilities: STAGE_PROBABILITY,
      totalOpenDeals: openDeals.length,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate forecast report' });
  }
});

// GET /reports/invoices
reportsRouter.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const ownerMatch = getOwnerMatch(user, req.query.owner as string);

    // 1. Monthly collections (from completed Payments or paid invoices)
    const payments = await Payment.find({})
      .populate({
        path: 'invoice',
        match: ownerMatch,
        select: 'number total owner account',
      })
      .sort({ paidAt: 1 });

    const monthlyCollectionsMap = new Map<string, number>();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      monthlyCollectionsMap.set(key, 0);
    }

    payments.forEach((p) => {
      if (p.invoice) {
        const d = new Date(p.paidAt);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlyCollectionsMap.has(key)) {
          const current = monthlyCollectionsMap.get(key) || 0;
          monthlyCollectionsMap.set(key, current + (p.amount || 0));
        }
      }
    });

    const monthlyCollections = Array.from(monthlyCollectionsMap.entries()).map(([month, amountPaise]) => ({
      month,
      amountPaise,
      amountRupees: Math.round(amountPaise / 100),
    }));

    // 2. Outstanding aging buckets (0-30, 31-60, 61-90, 90+ days)
    const activeInvoices = await Invoice.find({
      ...ownerMatch,
      status: { $nin: ['paid', 'void'] },
      balance: { $gt: 0 },
    });

    const agingBuckets = {
      '0-30': { label: '0-30 days', amountPaise: 0, count: 0 },
      '31-60': { label: '31-60 days', amountPaise: 0, count: 0 },
      '61-90': { label: '61-90 days', amountPaise: 0, count: 0 },
      '90+': { label: '90+ days', amountPaise: 0, count: 0 },
    };

    activeInvoices.forEach((inv) => {
      const diffMs = now.getTime() - new Date(inv.dueDate).getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const bal = inv.balance || 0;

      if (diffDays <= 30) {
        agingBuckets['0-30'].amountPaise += bal;
        agingBuckets['0-30'].count += 1;
      } else if (diffDays <= 60) {
        agingBuckets['31-60'].amountPaise += bal;
        agingBuckets['31-60'].count += 1;
      } else if (diffDays <= 90) {
        agingBuckets['61-90'].amountPaise += bal;
        agingBuckets['61-90'].count += 1;
      } else {
        agingBuckets['90+'].amountPaise += bal;
        agingBuckets['90+'].count += 1;
      }
    });

    const aging = Object.values(agingBuckets).map((b) => ({
      range: b.label,
      amountPaise: b.amountPaise,
      amountRupees: Math.round(b.amountPaise / 100),
      count: b.count,
    }));

    // 3. Top customers by revenue
    const allInvoices = await Invoice.find({
      ...ownerMatch,
      status: { $ne: 'void' },
    }).populate('account', 'name industry');

    const customerMap = new Map<string, { accountId: string; name: string; industry: string; totalRevenuePaise: number; invoiceCount: number }>();

    allInvoices.forEach((inv) => {
      const acc = inv.account as any;
      if (acc && acc._id) {
        const idStr = String(acc._id);
        const existing = customerMap.get(idStr) || {
          accountId: idStr,
          name: acc.name || 'Unknown',
          industry: acc.industry || '',
          totalRevenuePaise: 0,
          invoiceCount: 0,
        };
        existing.totalRevenuePaise += (inv.paidTotal || 0);
        existing.invoiceCount += 1;
        customerMap.set(idStr, existing);
      }
    });

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.totalRevenuePaise - a.totalRevenuePaise)
      .slice(0, 10)
      .map((c) => ({
        ...c,
        totalRevenueRupees: Math.round(c.totalRevenuePaise / 100),
      }));

    res.json({
      monthlyCollections,
      aging,
      topCustomers,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate invoice reports' });
  }
});

// GET /reports/support
reportsRouter.get('/support', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { from, to } = parseDateRange(req.query.from as string, req.query.to as string);

    const ticketMatch: any = {
      createdAt: { $gte: from, $lte: to },
    };

    if (user.role === 'sales') {
      ticketMatch.assignee = new Types.ObjectId(user._id);
    } else if (req.query.assignee && Types.ObjectId.isValid(req.query.assignee as string)) {
      ticketMatch.assignee = new Types.ObjectId(req.query.assignee as string);
    }

    const tickets = await Ticket.find(ticketMatch).populate('assignee', 'name email');

    // 1. Status breakdown
    const statusCounts: Record<string, number> = {
      new: 0,
      open: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
    };

    // 2. Priority breakdown
    const priorityCounts: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    // 3. Channel breakdown
    const channelCounts: Record<string, number> = {
      manual: 0,
      portal: 0,
      email: 0,
      whatsapp: 0,
    };

    let totalResponseMinutes = 0;
    let responseCount = 0;
    let totalResolutionMinutes = 0;
    let resolutionCount = 0;
    let resolvedCount = 0;
    let slaMetCount = 0;

    // Agent performance tracking
    const agentStats = new Map<
      string,
      {
        name: string;
        email: string;
        assigned: number;
        resolved: number;
        totalResMin: number;
        breached: number;
      }
    >();

    tickets.forEach((t) => {
      // Status
      if (statusCounts[t.status] !== undefined) statusCounts[t.status]++;
      // Priority
      if (priorityCounts[t.priority] !== undefined) priorityCounts[t.priority]++;
      // Channel
      if (channelCounts[t.channel] !== undefined) channelCounts[t.channel]++;

      // First response time
      if (t.firstResponseAt) {
        const diffMs = t.firstResponseAt.getTime() - t.createdAt.getTime();
        totalResponseMinutes += Math.max(1, Math.round(diffMs / 60000));
        responseCount++;
      }

      // Resolution time & SLA
      if (t.status === 'resolved' || t.status === 'closed') {
        resolvedCount++;
        const isBreached = t.slaBreached?.firstResponse || t.slaBreached?.resolution;
        if (!isBreached) {
          slaMetCount++;
        }
        if (t.resolvedAt) {
          const resMs = t.resolvedAt.getTime() - t.createdAt.getTime();
          totalResolutionMinutes += Math.max(1, Math.round(resMs / 60000));
          resolutionCount++;
        }
      }

      // Agent stats
      const agent = t.assignee as any;
      if (agent && agent._id) {
        const aid = agent._id.toString();
        const stat = agentStats.get(aid) || {
          name: agent.name || 'Agent',
          email: agent.email || '',
          assigned: 0,
          resolved: 0,
          totalResMin: 0,
          breached: 0,
        };
        stat.assigned++;
        if (t.status === 'resolved' || t.status === 'closed') {
          stat.resolved++;
          if (t.resolvedAt) {
            stat.totalResMin += Math.round((t.resolvedAt.getTime() - t.createdAt.getTime()) / 60000);
          }
        }
        if (t.slaBreached?.firstResponse || t.slaBreached?.resolution) {
          stat.breached++;
        }
        agentStats.set(aid, stat);
      }
    });

    const avgFirstResponseHours = responseCount > 0 ? (totalResponseMinutes / responseCount / 60).toFixed(1) : '0';
    const avgResolutionHours = resolutionCount > 0 ? (totalResolutionMinutes / resolutionCount / 60).toFixed(1) : '0';
    const slaCompliancePercent =
      resolvedCount > 0 ? Math.round((slaMetCount / resolvedCount) * 100) : 100;

    const agents = Array.from(agentStats.entries()).map(([id, s]) => ({
      id,
      name: s.name,
      email: s.email,
      assigned: s.assigned,
      resolved: s.resolved,
      avgResolutionHours: s.resolved > 0 ? (s.totalResMin / s.resolved / 60).toFixed(1) : '—',
      compliancePercent: s.assigned > 0 ? Math.round(((s.assigned - s.breached) / s.assigned) * 100) : 100,
    }));

    res.json({
      totalTickets: tickets.length,
      openTickets: statusCounts.new + statusCounts.open + statusCounts.pending,
      resolvedTickets: resolvedCount,
      slaCompliancePercent,
      avgFirstResponseHours,
      avgResolutionHours,
      statusCounts,
      priorityCounts,
      channelCounts,
      agents,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to generate support reports' });
  }
});

// =========================================================================
// MOBILE & SPEC 2.1 AGGREGATION ENDPOINTS
// =========================================================================

// GET /reports/sales-trend?range=week|month|quarter|year
reportsRouter.get('/sales-trend', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const ownerMatch = getOwnerMatch(user, req.query.owner as string);
    const range = (req.query.range as string) || 'month';

    const now = new Date();
    let durationMs = 30 * 24 * 60 * 60 * 1000;
    if (range === 'week') durationMs = 7 * 24 * 60 * 60 * 1000;
    else if (range === 'quarter') durationMs = 90 * 24 * 60 * 60 * 1000;
    else if (range === 'year') durationMs = 365 * 24 * 60 * 60 * 1000;

    const currentFrom = new Date(now.getTime() - durationMs);
    const prevFrom = new Date(currentFrom.getTime() - durationMs);

    // Won deals in current period
    const wonDealsCurrent = await Deal.find({
      ...ownerMatch,
      stage: 'won',
      closedAt: { $gte: currentFrom, $lte: now },
    }).sort({ closedAt: 1 });

    const wonDealsPrevious = await Deal.find({
      ...ownerMatch,
      stage: 'won',
      closedAt: { $gte: prevFrom, $lt: currentFrom },
    });

    const totalRevenue = wonDealsCurrent.reduce((sum, d) => sum + d.amount, 0);
    const previousRevenue = wonDealsPrevious.reduce((sum, d) => sum + d.amount, 0);

    let changePercent = 0;
    if (previousRevenue > 0) {
      changePercent = Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100);
    } else if (totalRevenue > 0) {
      changePercent = 100;
    }

    // Build trend interval buckets
    const intervals: { key: string; start: Date; end: Date; label: string; amount: number; count: number }[] = [];

    if (range === 'week') {
      for (let i = 6; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);
        const label = start.toLocaleDateString('en-US', { weekday: 'short' });
        intervals.push({ key: start.toISOString().split('T')[0], start, end, label, amount: 0, count: 0 });
      }
    } else if (range === 'month') {
      const stepDays = 3;
      for (let i = 9; i >= 0; i--) {
        const start = new Date(now.getTime() - (i * stepDays + stepDays) * 24 * 60 * 60 * 1000);
        const end = new Date(now.getTime() - i * stepDays * 24 * 60 * 60 * 1000);
        const label = `${end.getDate()} ${end.toLocaleDateString('en-US', { month: 'short' })}`;
        intervals.push({ key: end.toISOString().split('T')[0], start, end, label, amount: 0, count: 0 });
      }
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthsCount = range === 'quarter' ? 3 : 12;
      for (let i = monthsCount - 1; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        const label = `${monthNames[start.getMonth()]} ${range === 'year' ? start.getFullYear() : ''}`.trim();
        intervals.push({ key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`, start, end, label, amount: 0, count: 0 });
      }
    }

    wonDealsCurrent.forEach((d) => {
      if (!d.closedAt) return;
      const cDate = new Date(d.closedAt);
      const bucket = intervals.find((inv) => cDate >= inv.start && cDate <= inv.end);
      if (bucket) {
        bucket.amount += d.amount;
        bucket.count += 1;
      } else if (intervals.length > 0) {
        if (cDate < intervals[0].start) {
          intervals[0].amount += d.amount;
          intervals[0].count += 1;
        } else {
          intervals[intervals.length - 1].amount += d.amount;
          intervals[intervals.length - 1].count += 1;
        }
      }
    });

    const trend = intervals.map((inv) => ({
      date: inv.key,
      label: inv.label,
      amount: inv.amount,
      count: inv.count,
    }));

    res.json({
      trend,
      totalRevenue,
      previousRevenue,
      changePercent,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch sales trend' });
  }
});

// GET /reports/stage-analysis?range=week|month|quarter|year
reportsRouter.get('/stage-analysis', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const ownerMatch = getOwnerMatch(user, req.query.owner as string);

    const stages = ['qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const deals = await Deal.find(ownerMatch);

    const totalDeals = deals.length;
    const totalAmount = deals.reduce((sum, d) => sum + d.amount, 0);

    const stagesBreakdown = stages.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage);
      const count = stageDeals.length;
      const amount = stageDeals.reduce((sum, d) => sum + d.amount, 0);
      const percentage = totalDeals > 0 ? Math.round((count / totalDeals) * 100) : 0;
      return {
        stage,
        count,
        amount,
        percentage,
      };
    });

    res.json({
      stages: stagesBreakdown,
      totalDeals,
      totalAmount,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch stage analysis' });
  }
});

// GET /reports/kpis?range=week|month|quarter|year
reportsRouter.get('/kpis', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const ownerMatch = getOwnerMatch(user, req.query.owner as string);
    const range = (req.query.range as string) || 'month';

    const now = new Date();
    let durationMs = 30 * 24 * 60 * 60 * 1000;
    if (range === 'week') durationMs = 7 * 24 * 60 * 60 * 1000;
    else if (range === 'quarter') durationMs = 90 * 24 * 60 * 60 * 1000;
    else if (range === 'year') durationMs = 365 * 24 * 60 * 60 * 1000;

    const currStart = new Date(now.getTime() - durationMs);
    const prevStart = new Date(currStart.getTime() - durationMs);

    // Current period deals
    const [wonCurr, closedCurr, wonPrev, closedPrev] = await Promise.all([
      Deal.find({ ...ownerMatch, stage: 'won', closedAt: { $gte: currStart, $lte: now } }),
      Deal.find({ ...ownerMatch, stage: { $in: ['won', 'lost'] }, closedAt: { $gte: currStart, $lte: now } }),
      Deal.find({ ...ownerMatch, stage: 'won', closedAt: { $gte: prevStart, $lt: currStart } }),
      Deal.find({ ...ownerMatch, stage: { $in: ['won', 'lost'] }, closedAt: { $gte: prevStart, $lt: currStart } }),
    ]);

    // 1. Win Rate
    const currWinRate = closedCurr.length > 0 ? Math.round((wonCurr.length / closedCurr.length) * 100) : 0;
    const prevWinRate = closedPrev.length > 0 ? Math.round((wonPrev.length / closedPrev.length) * 100) : 0;
    const winRateDelta = currWinRate - prevWinRate;

    // 2. Average Deal Size
    const currTotalRev = wonCurr.reduce((sum, d) => sum + d.amount, 0);
    const prevTotalRev = wonPrev.reduce((sum, d) => sum + d.amount, 0);

    const currAvgDeal = wonCurr.length > 0 ? Math.round(currTotalRev / wonCurr.length) : 0;
    const prevAvgDeal = wonPrev.length > 0 ? Math.round(prevTotalRev / wonPrev.length) : 0;
    const avgDealSizeDelta = prevAvgDeal > 0 ? Math.round(((currAvgDeal - prevAvgDeal) / prevAvgDeal) * 100) : (currAvgDeal > 0 ? 100 : 0);

    // 3. Sales Cycle (days from createdAt to closedAt)
    let currCycleDaysTotal = 0;
    wonCurr.forEach((d) => {
      if (d.closedAt) {
        const diffMs = new Date(d.closedAt).getTime() - new Date(d.createdAt).getTime();
        currCycleDaysTotal += Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
      }
    });
    const salesCycleDays = wonCurr.length > 0 ? Math.round(currCycleDaysTotal / wonCurr.length) : 14;

    let prevCycleDaysTotal = 0;
    wonPrev.forEach((d) => {
      if (d.closedAt) {
        const diffMs = new Date(d.closedAt).getTime() - new Date(d.createdAt).getTime();
        prevCycleDaysTotal += Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
      }
    });
    const prevCycleDays = wonPrev.length > 0 ? Math.round(prevCycleDaysTotal / wonPrev.length) : salesCycleDays;
    const salesCycleDelta = salesCycleDays - prevCycleDays;

    res.json({
      winRate: currWinRate,
      winRateDelta,
      averageDealSize: currAvgDeal,
      averageDealSizeDelta: avgDealSizeDelta,
      salesCycleDays,
      salesCycleDelta,
      totalWonDeals: wonCurr.length,
      totalClosedDeals: closedCurr.length,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch KPIs' });
  }
});


