import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { Deal } from '../models/Deal.js';
import { User } from '../models/User.js';
import { recordAudit } from '../utils/auditLogger.js';

function getOwnerMatch(user: any, requestedOwner?: string) {
  if (user.role === 'sales') {
    return { owner: new Types.ObjectId(user._id) };
  }
  if (requestedOwner && Types.ObjectId.isValid(requestedOwner)) {
    return { owner: new Types.ObjectId(requestedOwner) };
  }
  return {};
}

export const forecastsRouter = Router();

forecastsRouter.use(authenticate);

const STAGE_PROBABILITIES: Record<string, number> = {
  qualified: 0.2,
  proposal: 0.6,
  negotiation: 0.8,
  won: 1.0,
  lost: 0.0,
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// In-memory / tenant quota store for custom user quotas per period
const tenantQuotaStore = new Map<string, number>();

function getQuotaKey(tenantId: string, year: number, period: string, ownerId?: string): string {
  return `${tenantId}-${year}-${period}-${ownerId || 'all'}`;
}

// GET /forecasts - Main Zoho-style sales forecast dashboard data
forecastsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenantId ? user.tenantId.toString() : 'default';

    const now = new Date();
    const currentYear = now.getFullYear();
    const year = parseInt(req.query.year as string, 10) || currentYear;
    const period = (req.query.period as string) || 'Q4'; // Q1, Q2, Q3, Q4, or month number (1-12) or 'all'
    const ownerFilter = req.query.owner as string | undefined;

    // Date range bounds
    let startDate: Date;
    let endDate: Date;

    if (period === 'Q1') {
      startDate = new Date(year, 0, 1, 0, 0, 0);
      endDate = new Date(year, 2, 31, 23, 59, 59, 999);
    } else if (period === 'Q2') {
      startDate = new Date(year, 3, 1, 0, 0, 0);
      endDate = new Date(year, 5, 30, 23, 59, 59, 999);
    } else if (period === 'Q3') {
      startDate = new Date(year, 6, 1, 0, 0, 0);
      endDate = new Date(year, 8, 30, 23, 59, 59, 999);
    } else if (period === 'Q4') {
      startDate = new Date(year, 9, 1, 0, 0, 0);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    } else if (period === 'all') {
      startDate = new Date(year, 0, 1, 0, 0, 0);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    } else {
      // Numerical month (1-12)
      const m = Math.max(1, Math.min(12, parseInt(period, 10) || now.getMonth() + 1)) - 1;
      startDate = new Date(year, m, 1, 0, 0, 0);
      endDate = new Date(year, m + 1, 0, 23, 59, 59, 999);
    }

    // Role-based owner scoping
    const ownerMatch = getOwnerMatch(user, ownerFilter);

    // 1. Fetch Open Deals with expected close in this window
    const openDeals = await Deal.find({
      ...ownerMatch,
      stage: { $in: ['qualified', 'proposal', 'negotiation'] },
      expectedClose: { $gte: startDate, $lte: endDate },
    })
      .populate('account', 'name industry')
      .populate('owner', 'name email avatar')
      .sort({ expectedClose: 1 });

    // 2. Fetch Won Deals closed in this window
    const wonDeals = await Deal.find({
      ...ownerMatch,
      stage: 'won',
      $or: [
        { closedAt: { $gte: startDate, $lte: endDate } },
        { closedAt: null, expectedClose: { $gte: startDate, $lte: endDate } },
      ],
    })
      .populate('account', 'name industry')
      .populate('owner', 'name email avatar')
      .sort({ closedAt: -1, expectedClose: -1 });

    // 3. Fetch Lost Deals in this window (for analytics)
    const lostDeals = await Deal.find({
      ...ownerMatch,
      stage: 'lost',
      expectedClose: { $gte: startDate, $lte: endDate },
    }).countDocuments();

    // Calculate Summary Metrics
    let closedWonAmount = 0;
    for (const d of wonDeals) {
      closedWonAmount += d.amount || 0;
    }

    let committedAmount = 0; // Deals in negotiation (high probability)
    let committedCount = 0;

    let bestCaseAmount = 0; // Sum of probability-weighted amounts
    let totalPipelineAmount = 0; // Gross unweighted sum

    const stageMap: Record<
      string,
      { count: number; totalAmount: number; weightedAmount: number; probability: number }
    > = {
      qualified: { count: 0, totalAmount: 0, weightedAmount: 0, probability: 20 },
      proposal: { count: 0, totalAmount: 0, weightedAmount: 0, probability: 60 },
      negotiation: { count: 0, totalAmount: 0, weightedAmount: 0, probability: 80 },
      won: { count: wonDeals.length, totalAmount: closedWonAmount, weightedAmount: closedWonAmount, probability: 100 },
      lost: { count: lostDeals, totalAmount: 0, weightedAmount: 0, probability: 0 },
    };

    // Monthly breakdown map
    const monthlyMap = new Map<
      string,
      {
        monthKey: string;
        monthLabel: string;
        year: number;
        monthIndex: number;
        wonAmount: number;
        committedAmount: number;
        weightedAmount: number;
        grossAmount: number;
        dealsCount: number;
      }
    >();

    // Initialize months in range
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const k = `${y}-${m}`;
      if (!monthlyMap.has(k)) {
        monthlyMap.set(k, {
          monthKey: k,
          monthLabel: `${MONTH_NAMES[m]} ${y}`,
          year: y,
          monthIndex: m + 1,
          wonAmount: 0,
          committedAmount: 0,
          weightedAmount: 0,
          grossAmount: 0,
          dealsCount: 0,
        });
      }
      cur.setMonth(cur.getMonth() + 1);
    }

    // Accumulate won deals into monthly map
    for (const d of wonDeals) {
      const date = d.closedAt ? new Date(d.closedAt) : new Date(d.expectedClose);
      const k = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthlyMap.has(k)) {
        const entry = monthlyMap.get(k)!;
        entry.wonAmount += d.amount || 0;
      }
    }

    // Accumulate open deals
    const dealsList = [];
    const highRiskDeals = [];
    const closingSoonDeals = [];

    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    for (const d of openDeals) {
      const prob = STAGE_PROBABILITIES[d.stage] || 0.2;
      const weighted = Math.round((d.amount || 0) * prob);

      totalPipelineAmount += d.amount || 0;
      bestCaseAmount += weighted;

      if (d.stage === 'negotiation') {
        committedAmount += d.amount || 0;
        committedCount += 1;
      }

      if (stageMap[d.stage]) {
        stageMap[d.stage].count += 1;
        stageMap[d.stage].totalAmount += d.amount || 0;
        stageMap[d.stage].weightedAmount += weighted;
      }

      // Add to monthly map
      const closeDate = new Date(d.expectedClose);
      const k = `${closeDate.getFullYear()}-${closeDate.getMonth()}`;
      if (monthlyMap.has(k)) {
        const entry = monthlyMap.get(k)!;
        entry.dealsCount += 1;
        entry.grossAmount += d.amount || 0;
        entry.weightedAmount += weighted;
        if (d.stage === 'negotiation') {
          entry.committedAmount += d.amount || 0;
        }
      }

      const dealItem = {
        _id: d._id,
        title: d.title,
        amount: d.amount,
        stage: d.stage,
        probability: Math.round(prob * 100),
        weightedAmount: weighted,
        expectedClose: d.expectedClose,
        account: d.account,
        owner: d.owner,
        aiRisk: d.aiRisk,
      };

      dealsList.push(dealItem);

      if (d.aiRisk && (d.aiRisk.level === 'high' || d.aiRisk.score >= 60)) {
        highRiskDeals.push(dealItem);
      }

      if (closeDate >= now && closeDate <= twoWeeksFromNow) {
        closingSoonDeals.push(dealItem);
      }
    }

    // Determine target quota for period
    const quotaKey = getQuotaKey(tenantId, year, period, ownerFilter);
    let targetQuota = tenantQuotaStore.get(quotaKey);

    if (!targetQuota) {
      // Dynamic baseline target if not explicitly set
      // E.g., for Q4 default target: won + 60% of open pipeline, or default 25-50 lakhs
      const dynamicBaseline = Math.max(
        2500000,
        Math.round((closedWonAmount + totalPipelineAmount * 0.65) / 100000) * 100000
      );
      targetQuota = dynamicBaseline;
    }

    const attainmentPercent = targetQuota > 0 ? Math.round((closedWonAmount / targetQuota) * 100) : 0;
    const gapAmount = Math.max(0, targetQuota - closedWonAmount);
    const coverageRatio =
      gapAmount > 0
        ? Number((totalPipelineAmount / gapAmount).toFixed(1))
        : Number(((totalPipelineAmount + closedWonAmount) / (targetQuota || 1)).toFixed(1));

    // Sales Rep Performance Leaderboard
    const repMap = new Map<
      string,
      {
        owner: any;
        wonAmount: number;
        wonCount: number;
        pipelineAmount: number;
        weightedAmount: number;
        dealsCount: number;
      }
    >();

    const users = await User.find({ active: true }, '_id name email role');
    for (const u of users) {
      repMap.set(u._id.toString(), {
        owner: { _id: u._id, name: u.name, email: u.email, role: u.role },
        wonAmount: 0,
        wonCount: 0,
        pipelineAmount: 0,
        weightedAmount: 0,
        dealsCount: 0,
      });
    }

    for (const d of wonDeals) {
      const oId = (d.owner as any)?._id?.toString() || (d.owner as any)?.toString();
      if (oId && repMap.has(oId)) {
        const r = repMap.get(oId)!;
        r.wonAmount += d.amount || 0;
        r.wonCount += 1;
      }
    }

    for (const d of openDeals) {
      const oId = (d.owner as any)?._id?.toString() || (d.owner as any)?.toString();
      if (oId && repMap.has(oId)) {
        const r = repMap.get(oId)!;
        const prob = STAGE_PROBABILITIES[d.stage] || 0.2;
        r.pipelineAmount += d.amount || 0;
        r.weightedAmount += Math.round((d.amount || 0) * prob);
        r.dealsCount += 1;
      }
    }

    const repLeaderboard = Array.from(repMap.values())
      .filter((r) => r.wonCount > 0 || r.dealsCount > 0)
      .sort((a, b) => b.wonAmount + b.weightedAmount - (a.wonAmount + a.weightedAmount));

    // AI Forecast Intelligence Summary
    const expectedFinalRevenue = closedWonAmount + bestCaseAmount;
    const predictedAttainment = targetQuota > 0 ? Math.round((expectedFinalRevenue / targetQuota) * 100) : 0;

    let aiStatus = 'On Track';
    let aiRecommendation =
      'Healthy pipeline balance. Ensure timely follow-up with deals in Negotiation stage.';

    if (predictedAttainment < 85) {
      aiStatus = 'At Risk';
      aiRecommendation = `Target gap is ₹${(gapAmount / 100000).toFixed(1)}L. Focus SDR prospecting on high-velocity deals and resolve blocker items on high-risk proposals.`;
    } else if (predictedAttainment > 115) {
      aiStatus = 'Exceeding Target';
      aiRecommendation =
        'Strong pipeline momentum! Multiple high-value deals are poised to close ahead of target schedule.';
    }

    res.json({
      period,
      year,
      summary: {
        targetQuota,
        closedWonAmount,
        closedWonCount: wonDeals.length,
        committedAmount,
        committedCount,
        bestCaseAmount,
        totalPipelineAmount,
        totalPipelineCount: openDeals.length,
        attainmentPercent,
        gapAmount,
        coverageRatio,
      },
      aiInsights: {
        status: aiStatus,
        predictedAttainment,
        expectedFinalRevenue,
        recommendation: aiRecommendation,
        highRiskCount: highRiskDeals.length,
        closingSoonCount: closingSoonDeals.length,
        highRiskDeals: highRiskDeals.slice(0, 5),
        closingSoonDeals: closingSoonDeals.slice(0, 5),
      },
      stageBreakdown: stageMap,
      monthlyBreakdown: Array.from(monthlyMap.values()),
      deals: dealsList,
      repLeaderboard,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch sales forecast data' });
  }
});

// POST /forecasts/quota - Set target quota for period
forecastsRouter.post('/quota', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenantId ? user.tenantId.toString() : 'default';

    const { year = new Date().getFullYear(), period = 'Q4', quota, ownerId } = req.body;

    if (typeof quota !== 'number' || quota < 0) {
      return res.status(400).json({ message: 'Valid non-negative quota amount is required' });
    }

    const quotaKey = getQuotaKey(tenantId, year, period, ownerId);
    tenantQuotaStore.set(quotaKey, quota);

    await recordAudit({
      req,
      action: 'update',
      entityType: 'forecast',
      entityLabel: `Quota ${period} ${year}`,
      after: { year, period, quota, ownerId },
    });

    res.json({ success: true, quotaKey, quota });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update target quota' });
  }
});
