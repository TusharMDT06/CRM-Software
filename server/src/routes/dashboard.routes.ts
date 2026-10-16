import { Router, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Deal, DealStage } from '../models/Deal.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Task } from '../models/Task.js';
import { Ticket } from '../models/Ticket.js';
import { Invoice } from '../models/Invoice.js';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import { buildOwnerFilter } from '../utils/queryHelper.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

// GET /dashboard/summary?scope=me|team&range=week|month|quarter|year
dashboardRouter.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const scope = (req.query.scope as string) || (user.role === 'sales' ? 'me' : 'team');
    const range = (req.query.range as string) || 'month';

    // Owner filter respecting scope parameter
    let explicitOwner = req.query.owner as string;
    let ownerFilter: FilterQuery<any> = {};

    if (explicitOwner) {
      ownerFilter = { owner: explicitOwner };
    } else if (scope === 'me') {
      if (user.role === 'admin') {
        ownerFilter = {};
      } else {
        ownerFilter = { owner: user._id };
      }
    } else {
      if (user.role === 'admin' || user.role === 'manager') {
        ownerFilter = {};
      } else {
        ownerFilter = buildOwnerFilter(user);
      }
    }

    const now = new Date();
    let durationMs = 30 * 24 * 60 * 60 * 1000;
    if (range === 'week') durationMs = 7 * 24 * 60 * 60 * 1000;
    else if (range === 'quarter') durationMs = 90 * 24 * 60 * 60 * 1000;
    else if (range === 'year') durationMs = 365 * 24 * 60 * 60 * 1000;

    const currentPeriodStart = new Date(now.getTime() - durationMs);
    const prevPeriodStart = new Date(currentPeriodStart.getTime() - durationMs);

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

    // wonThisMonth & wonLastMonth for web backwards compatibility
    const wonThisMonthDeals = wonDeals.filter(d => d.closedAt && new Date(d.closedAt) >= startOfThisMonth && new Date(d.closedAt) <= now);
    const wonThisMonthAmount = wonThisMonthDeals.reduce((sum, d) => sum + d.amount, 0);
    const wonThisMonth = {
      amount: wonThisMonthAmount,
      count: wonThisMonthDeals.length,
    };

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

    // Dynamic Period Revenue (range based)
    const currWonDeals = wonDeals.filter(d => d.closedAt && new Date(d.closedAt) >= currentPeriodStart && new Date(d.closedAt) <= now);
    const currWonAmount = currWonDeals.reduce((sum, d) => sum + d.amount, 0);
    const prevWonDeals = wonDeals.filter(d => d.closedAt && new Date(d.closedAt) >= prevPeriodStart && new Date(d.closedAt) < currentPeriodStart);
    const prevWonAmount = prevWonDeals.reduce((sum, d) => sum + d.amount, 0);

    let rangeRevenueDeltaPercent = 0;
    if (prevWonAmount > 0) {
      rangeRevenueDeltaPercent = Math.round(((currWonAmount - prevWonAmount) / prevWonAmount) * 100);
    } else if (currWonAmount > 0) {
      rangeRevenueDeltaPercent = 100;
    }

    // Pipeline Value & counts
    const pipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
    const openDealCount = openDeals.length;
    const dealsWonCount = wonDeals.length;
    const totalClosed = dealsWonCount + lostDeals.length;
    const winRate = totalClosed > 0 ? Math.round((dealsWonCount / totalClosed) * 100) : (allDeals.length > 0 ? Math.round((dealsWonCount / allDeals.length) * 100) : 0);

    // Deals period delta
    const currDealsCreated = allDeals.filter(d => new Date(d.createdAt) >= currentPeriodStart && new Date(d.createdAt) <= now).length;
    const prevDealsCreated = allDeals.filter(d => new Date(d.createdAt) >= prevPeriodStart && new Date(d.createdAt) < currentPeriodStart).length;
    let dealsDeltaPercent = 0;
    if (prevDealsCreated > 0) {
      dealsDeltaPercent = Math.round(((currDealsCreated - prevDealsCreated) / prevDealsCreated) * 100);
    } else if (currDealsCreated > 0) {
      dealsDeltaPercent = 100;
    }

    // High-risk open deals
    const atRiskOpenDeals = openDeals.filter(
      d => d.aiRisk?.level === 'high' || (d.aiRisk?.score !== undefined && d.aiRisk.score >= 60) || new Date(d.expectedClose) < now
    );
    const healthyOpenDeals = openDeals.filter(
      d => !atRiskOpenDeals.includes(d)
    );

    const pipelineHealth = openDealCount > 0 ? Math.round((healthyOpenDeals.length / openDealCount) * 100) : 100;
    const dealsAtRiskAmount = atRiskOpenDeals.reduce((sum, d) => sum + d.amount, 0);
    const dealsAtRiskPercent = openDealCount > 0 ? Math.round((atRiskOpenDeals.length / openDealCount) * 100) : 0;
    const dealsAtRisk = {
      count: atRiskOpenDeals.length,
      amount: dealsAtRiskAmount,
      percentage: dealsAtRiskPercent,
      activeCount: openDealCount,
      healthyCount: healthyOpenDeals.length,
      highRiskCount: openDeals.filter(d => d.aiRisk?.level === 'high').length,
      mediumRiskCount: openDeals.filter(d => d.aiRisk?.level === 'medium').length,
      lowRiskCount: openDeals.filter(d => d.aiRisk?.level === 'low').length,
    };

    // Leads query
    const leadQuery: FilterQuery<any> = { ...ownerFilter };
    const [newLeadsCount, totalLeadsCount, currLeadsCreated, prevLeadsCreated] = await Promise.all([
      Lead.countDocuments({ ...leadQuery, status: 'new' }),
      Lead.countDocuments(leadQuery),
      Lead.countDocuments({ ...leadQuery, createdAt: { $gte: currentPeriodStart, $lte: now } }),
      Lead.countDocuments({ ...leadQuery, createdAt: { $gte: prevPeriodStart, $lt: currentPeriodStart } }),
    ]);

    let leadsDeltaPercent = 0;
    if (prevLeadsCreated > 0) {
      leadsDeltaPercent = Math.round(((currLeadsCreated - prevLeadsCreated) / prevLeadsCreated) * 100);
    } else if (currLeadsCreated > 0) {
      leadsDeltaPercent = 100;
    }

    // Contacts query
    const contactQuery: FilterQuery<any> = { ...ownerFilter };
    const [totalContactsCount, currContactsCreated, prevContactsCreated] = await Promise.all([
      Contact.countDocuments(contactQuery),
      Contact.countDocuments({ ...contactQuery, createdAt: { $gte: currentPeriodStart, $lte: now } }),
      Contact.countDocuments({ ...contactQuery, createdAt: { $gte: prevPeriodStart, $lt: currentPeriodStart } }),
    ]);

    let contactsDeltaPercent = 0;
    if (prevContactsCreated > 0) {
      contactsDeltaPercent = Math.round(((currContactsCreated - prevContactsCreated) / prevContactsCreated) * 100);
    } else if (currContactsCreated > 0) {
      contactsDeltaPercent = 100;
    }

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

    // Deals by stage with percentages (including won and lost across the full sales pipeline)
    const allStages: DealStage[] = ['qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const pipelineByStage = allStages.map((stage) => {
      const stageDeals = allDeals.filter((d) => d.stage === stage);
      return {
        stage,
        count: stageDeals.length,
        amount: stageDeals.reduce((sum, d) => sum + d.amount, 0),
        percentage: allDeals.length > 0 ? Math.round((stageDeals.length / allDeals.length) * 100) : 0,
      };
    });
    const dealsByStage = pipelineByStage;

    // Revenue by month (last 6 calendar months)
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

    const recentDeals = openDeals.slice(0, 6);
    const openTasks = openTasksList.slice(0, 6);
    const upNextTask = openTasksList.length > 0 ? openTasksList[0] : null;

    const dealsInNegotiation = allDeals.filter(d => d.stage === 'negotiation').length;

    const [openTicketsCount, breachedTicketsCount] = await Promise.all([
      Ticket.countDocuments({ status: { $nin: ['resolved', 'closed'] } }),
      Ticket.countDocuments({ status: { $nin: ['resolved', 'closed'] }, slaBreached: true }),
    ]);

    // Invoices / Receivables metrics calculation
    const invoiceQuery: FilterQuery<any> = { ...ownerFilter };
    const allInvoices = await Invoice.find(invoiceQuery, {
      status: 1,
      total: 1,
      paidTotal: 1,
      balance: 1,
      dueDate: 1,
    });

    let totalOutstandingPaise = 0;
    let totalOverduePaise = 0;
    let overdueCount = 0;

    allInvoices.forEach((inv) => {
      if (inv.status !== 'void') {
        if (inv.status !== 'paid') {
          totalOutstandingPaise += inv.balance || 0;
          if (inv.status === 'overdue' || (new Date(inv.dueDate) < now && (inv.balance || 0) > 0)) {
            totalOverduePaise += inv.balance || 0;
            overdueCount++;
          }
        }
      }
    });

    const overduePct = totalOutstandingPaise > 0
      ? Math.min(100, Math.round((totalOverduePaise / totalOutstandingPaise) * 100))
      : 0;

    const receivables = {
      totalOutstandingPaise,
      totalOverduePaise,
      overdueCount,
      overduePct,
    };

    // Unified response satisfying both mobile spec section 2.1 and web dashboard
    res.json({
      // Mobile spec 2.1 fields:
      leads: {
        value: totalLeadsCount,
        changePercent: leadsDeltaPercent,
        count: currLeadsCreated,
      },
      deals: {
        value: openDealCount,
        changePercent: dealsDeltaPercent,
        count: openDealCount,
      },
      contacts: {
        value: totalContactsCount,
        changePercent: contactsDeltaPercent,
        count: currContactsCreated,
      },
      revenue: {
        value: range === 'month' ? wonThisMonthAmount : (currWonAmount > 0 ? currWonAmount : wonThisMonthAmount),
        changePercent: range === 'month' ? revenueChangePercent : (rangeRevenueDeltaPercent !== 0 ? rangeRevenueDeltaPercent : revenueChangePercent),
        count: range === 'month' ? wonThisMonth.count : currWonDeals.length,
      },
      pipelineByStage,
      upNextTask,

      // Legacy web dashboard fields (backward compatibility):
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
      receivables,
      ticketStats: {
        open: openTicketsCount,
        breached: breachedTicketsCount,
      },
      dealsByStage,
      revenueByMonth,
      recentDeals,
      openTasks,
      insights: {
        newLeadsWaiting: newLeadsCount,
        dealsInNegotiation,
        overdueTasks: overdueTasksList.length,
        openTickets: openTicketsCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch dashboard summary' });
  }
});
