import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Deal, DealStage } from '../models/Deal.js';
import { Lead } from '../models/Lead.js';
import { Task } from '../models/Task.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter } from '../utils/queryHelper.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const ownerFilter = buildOwnerFilter(user, req.query.owner as string);

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Deals queries
    const dealQuery: FilterQuery<any> = { ...ownerFilter };
    const allDeals = await Deal.find(dealQuery)
      .populate('account', 'name industry')
      .populate('contact', 'firstName lastName email phone')
      .populate('owner', 'name email role')
      .sort({ createdAt: -1 });

    const openStages: DealStage[] = ['qualified', 'proposal', 'negotiation'];
    const openDeals = allDeals.filter(d => openStages.includes(d.stage));
    const wonDeals = allDeals.filter(d => d.stage === 'won');
    const lostDeals = allDeals.filter(d => d.stage === 'lost');

    // wonThisMonth
    const wonThisMonthDeals = wonDeals.filter(d => d.closedAt && new Date(d.closedAt) >= startOfThisMonth && new Date(d.closedAt) <= now);
    const wonThisMonthAmount = wonThisMonthDeals.reduce((sum, d) => sum + d.amount, 0);
    const wonThisMonth = {
      amount: wonThisMonthAmount,
      count: wonThisMonthDeals.length,
    };

    // wonLastMonth
    const wonLastMonthDeals = wonDeals.filter(
      d => d.closedAt && new Date(d.closedAt) >= startOfLastMonth && new Date(d.closedAt) <= endOfLastMonth
    );
    const wonLastMonthAmount = wonLastMonthDeals.reduce((sum, d) => sum + d.amount, 0);
    const wonLastMonth = {
      amount: wonLastMonthAmount,
      count: wonLastMonthDeals.length,
    };

    let revenueChangePercent = 0;
    if (wonLastMonthAmount > 0) {
      revenueChangePercent = Math.round(((wonThisMonthAmount - wonLastMonthAmount) / wonLastMonthAmount) * 100);
    } else if (wonThisMonthAmount > 0) {
      revenueChangePercent = 100;
    }

    // Pipeline Value & counts
    const pipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
    const openDealCount = openDeals.length;
    const dealsWonCount = wonDeals.length;
    const totalClosed = dealsWonCount + lostDeals.length;
    const winRate = totalClosed > 0 ? Math.round((dealsWonCount / totalClosed) * 100) : (allDeals.length > 0 ? Math.round((dealsWonCount / allDeals.length) * 100) : 0);

    // Overdue open deals (at risk)
    const overdueOpenDeals = openDeals.filter(d => new Date(d.expectedClose) < now);
    const healthyOpenDeals = openDeals.filter(d => new Date(d.expectedClose) >= now);

    const pipelineHealth = openDealCount > 0 ? Math.round((healthyOpenDeals.length / openDealCount) * 100) : 100;
    const dealsAtRiskAmount = overdueOpenDeals.reduce((sum, d) => sum + d.amount, 0);
    const dealsAtRiskPercent = openDealCount > 0 ? Math.round((overdueOpenDeals.length / openDealCount) * 100) : 0;
    const dealsAtRisk = {
      count: overdueOpenDeals.length,
      amount: dealsAtRiskAmount,
      percentage: dealsAtRiskPercent,
      activeCount: openDealCount,
      healthyCount: healthyOpenDeals.length,
    };

    // Leads query
    const leadQuery: FilterQuery<any> = { ...ownerFilter };
    const [newLeadsCount, totalLeadsCount] = await Promise.all([
      Lead.countDocuments({ ...leadQuery, status: 'new' }),
      Lead.countDocuments(leadQuery),
    ]);

    // Tasks query
    const taskQuery: FilterQuery<any> = { ...ownerFilter };
    const allTasks = await Task.find(taskQuery)
      .populate('deal', 'title stage amount')
      .populate('owner', 'name email role')
      .sort({ dueDate: 1 });

    const openTasksList = allTasks.filter(t => t.status === 'open');
    const doneTasksList = allTasks.filter(t => t.status === 'done');
    const overdueTasksList = openTasksList.filter(t => new Date(t.dueDate) < now);

    const taskStats = {
      total: allTasks.length,
      doneRate: allTasks.length > 0 ? Math.round((doneTasksList.length / allTasks.length) * 100) : 0,
      open: openTasksList.length,
      done: doneTasksList.length,
      overdue: overdueTasksList.length,
    };

    // Deals by stage
    const stages: DealStage[] = ['qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const dealsByStage = stages.map(stage => {
      const stageDeals = allDeals.filter(d => d.stage === stage);
      return {
        stage,
        count: stageDeals.length,
        amount: stageDeals.reduce((sum, d) => sum + d.amount, 0),
      };
    });

    // Revenue by month (last 6 calendar months from won deals' closedAt)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueByMonth = [];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mYear = targetDate.getFullYear();
      const mMonth = targetDate.getMonth();
      const mStart = new Date(mYear, mMonth, 1);
      const mEnd = new Date(mYear, mMonth + 1, 0, 23, 59, 59, 999);

      const mWonDeals = wonDeals.filter(d => {
        if (!d.closedAt) return false;
        const cDate = new Date(d.closedAt);
        return cDate >= mStart && cDate <= mEnd;
      });

      const amount = mWonDeals.reduce((sum, d) => sum + d.amount, 0);
      revenueByMonth.push({
        month: `${monthNames[mMonth]} ${mYear}`,
        shortMonth: monthNames[mMonth],
        year: mYear,
        amount,
        count: mWonDeals.length,
      });
    }

    // 6 recent deals and 6 open tasks (soonest due)
    const recentDeals = allDeals.slice(0, 6);
    const openTasks = openTasksList.slice(0, 6);

    // Insights for greeting card
    const dealsInNegotiation = allDeals.filter(d => d.stage === 'negotiation').length;

    res.json({
      wonThisMonth,
      wonLastMonth,
      revenueChangePercent,
      pipelineValue,
      openDealCount,
      dealsWon: dealsWonCount,
      winRate,
      newLeads: newLeadsCount,
      totalLeads: totalLeadsCount,
      pipelineHealth,
      dealsAtRisk,
      taskStats,
      dealsByStage,
      revenueByMonth,
      recentDeals,
      openTasks,
      insights: {
        newLeadsWaiting: newLeadsCount,
        dealsInNegotiation,
        overdueTasks: overdueTasksList.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch dashboard summary' });
  }
});
