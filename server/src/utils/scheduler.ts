import cron from 'node-cron';
import { Quote } from '../models/Quote.js';
import { Invoice } from '../models/Invoice.js';
import { Task } from '../models/Task.js';
import { AuditLog } from '../models/AuditLog.js';
import { eventBus } from './eventBus.js';
import { sendNotification } from './notificationService.js';
import { logActivity } from './activityHelper.js';
import { recordAudit } from './auditLogger.js';

// Set of entityId:state strings to avoid duplicate event firing across restarts within session
const firedOverdueCache = new Set<string>();

/**
 * 15-Minute Idempotent Job:
 * - Checks quotes past validUntil and marks expired
 * - Checks invoices past dueDate and flips to overdue
 * - Checks tasks past dueDate and emits task_overdue
 */
export async function runPeriodicChecks(): Promise<void> {
  const now = new Date();

  try {
    // 1. Expire Quotes
    const expiredQuotes = await Quote.find({
      status: { $in: ['sent', 'viewed'] },
      validUntil: { $lt: now },
    });

    for (const quote of expiredQuotes) {
      quote.status = 'expired';
      await quote.save();

      if (quote.deal) {
        await logActivity({
          type: 'stage_change',
          subject: `Quote ${quote.number} expired`,
          body: `Valid until date was ${new Date(quote.validUntil).toLocaleDateString()}`,
          entityType: 'deal',
          entityId: quote.deal,
          createdBy: quote.owner,
        });
      }

      if (quote.owner) {
        await sendNotification({
          userId: quote.owner,
          type: 'general',
          title: `Quote ${quote.number} expired`,
          body: `The validity period for quote ${quote.number} ended.`,
          link: `/quotes/${quote._id}`,
          entityType: 'quote',
          entityId: quote._id.toString(),
        });
      }
    }

    // 2. Overdue Invoices
    const overdueInvoices = await Invoice.find({
      status: { $in: ['sent', 'partially_paid'] },
      dueDate: { $lt: now },
    });

    for (const inv of overdueInvoices) {
      const cacheKey = `invoice:${inv._id}:${inv.dueDate.toISOString().split('T')[0]}`;
      inv.status = 'overdue';
      await inv.save();

      if (!firedOverdueCache.has(cacheKey)) {
        firedOverdueCache.add(cacheKey);

        eventBus.emitDomainEvent('invoice_overdue', {
          depth: 0,
          invoiceId: inv._id.toString(),
          number: inv.number,
          balance: inv.balance,
          entityType: 'invoice',
          entityId: inv._id.toString(),
        });

        if (inv.owner) {
          await sendNotification({
            userId: inv.owner,
            type: 'invoice_overdue',
            title: `Invoice ${inv.number} is overdue`,
            body: `Payment for invoice ${inv.number} was due on ${new Date(inv.dueDate).toLocaleDateString()}. Outstanding: ₹${(inv.balance / 100).toLocaleString('en-IN')}`,
            link: `/invoices/${inv._id}`,
            entityType: 'invoice',
            entityId: inv._id.toString(),
          });
        }
      }
    }

    // 3. Overdue Tasks
    const overdueTasks = await Task.find({
      status: 'open',
      dueDate: { $lt: now },
    });

    for (const task of overdueTasks) {
      const cacheKey = `task:${task._id}:${task.dueDate.toISOString().split('T')[0]}`;
      if (!firedOverdueCache.has(cacheKey)) {
        firedOverdueCache.add(cacheKey);

        eventBus.emitDomainEvent('task_overdue', {
          depth: 0,
          taskId: task._id.toString(),
          title: task.title,
          entityType: 'task',
          entityId: task._id.toString(),
        });

        if (task.owner) {
          await sendNotification({
            userId: task.owner,
            type: 'task_overdue',
            title: `Task overdue: ${task.title}`,
            body: `Your task "${task.title}" was due on ${new Date(task.dueDate).toLocaleDateString()}.`,
            link: '/tasks',
            entityType: 'task',
            entityId: task._id.toString(),
          });
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error running periodic 15m checks:', err);
  }
}

/**
 * Daily 8:00 AM Job:
 * - Alerts users about tasks due today
 */
export async function runDailyMorningTasks(): Promise<void> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const todayTasks = await Task.find({
      status: 'open',
      dueDate: { $gte: startOfDay, $lte: endOfDay },
    });

    for (const task of todayTasks) {
      if (task.owner) {
        await sendNotification({
          userId: task.owner,
          type: 'task_due_today',
          title: `Task due today: ${task.title}`,
          body: `You have a task scheduled for completion today.`,
          link: '/tasks',
          entityType: 'task',
          entityId: task._id.toString(),
        });
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error running daily morning task notification job:', err);
  }
}

/**
 * Daily Midnight Job:
 * - Enforces 365-day audit log retention policy
 */
export async function runAuditRetentionCleanup(): Promise<void> {
  const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '365', 10);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    const deleteResult = await AuditLog.deleteMany({
      createdAt: { $lt: cutoff },
    });

    if (deleteResult.deletedCount > 0) {
      await AuditLog.create({
        actor: null,
        actorName: 'System Scheduler',
        source: 'system',
        action: 'delete',
        entityType: 'audit_log',
        entityId: 'retention_cleanup',
        entityLabel: `Cleaned ${deleteResult.deletedCount} logs older than ${retentionDays} days`,
        changes: [],
        createdAt: new Date(),
      });
      console.log(`[Scheduler] Purged ${deleteResult.deletedCount} audit logs older than ${retentionDays} days.`);
    }
  } catch (err) {
    console.error('[Scheduler] Error running audit retention cleanup:', err);
  }
}

/**
 * Initializes all cron schedules
 */
export function initCronJobs(): void {
  // Every 15 minutes: '*/15 * * * *'
  cron.schedule('*/15 * * * *', () => {
    console.log('[Scheduler] Executing 15-minute periodic checks...');
    runPeriodicChecks();
  });

  // Daily 8:00 AM: '0 8 * * *'
  cron.schedule('0 8 * * *', () => {
    console.log('[Scheduler] Executing daily 8:00 AM task reminder job...');
    runDailyMorningTasks();
  });

  // Daily Midnight: '0 0 * * *'
  cron.schedule('0 0 * * *', () => {
    console.log('[Scheduler] Executing daily audit retention cleanup...');
    runAuditRetentionCleanup();
  });

  console.log('[Scheduler] Background cron jobs scheduled successfully.');
}
