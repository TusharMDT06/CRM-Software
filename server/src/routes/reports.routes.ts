import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Deal } from '../models/Deal.js';
import { Lead } from '../models/Lead.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
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
