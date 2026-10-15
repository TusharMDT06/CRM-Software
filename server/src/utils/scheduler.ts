import cron from 'node-cron';
import { Tenant } from '../models/Tenant.js';
import { Quote } from '../models/Quote.js';
import { Invoice } from '../models/Invoice.js';
import { Task } from '../models/Task.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { Product } from '../models/Product.js';
import { Payment } from '../models/Payment.js';
import { Counter } from '../models/Counter.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { FieldDefinition } from '../models/FieldDefinition.js';
import { EmailTemplate } from '../models/EmailTemplate.js';
import { Workflow } from '../models/Workflow.js';
import { WorkflowRun } from '../models/WorkflowRun.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';
import { NotificationPreference } from '../models/NotificationPreference.js';
import { Ticket } from '../models/Ticket.js';
import { TicketMessage } from '../models/TicketMessage.js';
import { SlaPolicy } from '../models/SlaPolicy.js';
import { CannedResponse } from '../models/CannedResponse.js';
import { eventBus } from './eventBus.js';
import { sendNotification } from './notificationService.js';
import { logActivity } from './activityHelper.js';
import { recordAudit } from './auditLogger.js';
import { runWithTenantContext } from './tenantContext.js';
import { runSlaMonitorJob } from './slaEngine.js';
import { evaluateAllTenantScores } from '../ai/scoringEngine.js';

// Set of entityId:state strings to avoid duplicate event firing across restarts within session
const firedOverdueCache = new Set<string>();

/**
 * 15-Minute Idempotent Job:
 * Loops per active tenant in its own isolated AsyncLocalStorage context.
 * - Checks quotes past validUntil and marks expired
 * - Checks invoices past dueDate and flips to overdue
 * - Checks tasks past dueDate and emits task_overdue
 */
export async function runPeriodicChecks(): Promise<void> {
  const now = new Date();

  try {
    const activeTenants = await runWithTenantContext({ isBypassTenant: true }, async () => {
      return Tenant.find({ status: 'active' });
    });

    for (const tenant of activeTenants) {
      const tenantIdStr = tenant._id.toString();

      await runWithTenantContext({ tenantId: tenantIdStr }, async () => {
        // 1. Expire Quotes for this tenant
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

        // 2. Overdue Invoices for this tenant
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
              tenantId: tenantIdStr,
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

        // 3. Overdue Tasks for this tenant
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
              tenantId: tenantIdStr,
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
                link: `/tasks/${task._id}`,
                entityType: 'task',
                entityId: task._id.toString(),
              });
            }
          }
        }

        // 4. Tasks due in 30 minutes for this tenant
        const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
        const dueSoonTasks = await Task.find({
          status: 'open',
          dueDate: { $gte: now, $lte: in30Minutes },
        });

        for (const task of dueSoonTasks) {
          const cacheKey = `task_due_30m:${task._id}`;
          if (!firedOverdueCache.has(cacheKey)) {
            firedOverdueCache.add(cacheKey);

            if (task.owner) {
              await sendNotification({
                userId: task.owner,
                type: 'task_due_today',
                title: `Task due in 30 min: ${task.title}`,
                body: `Your task "${task.title}" is due soon.`,
                link: `/tasks/${task._id}`,
                entityType: 'task',
                entityId: task._id.toString(),
              });
            }
          }
        }
      });
    }
  } catch (err) {
    console.error('[Scheduler] Error running periodic 15m checks:', err);
  }
}

/**
 * Daily 8:00 AM Job:
 * Loops per active tenant to alert users about tasks due today.
 */
export async function runDailyMorningTasks(): Promise<void> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const activeTenants = await runWithTenantContext({ isBypassTenant: true }, async () => {
      return Tenant.find({ status: 'active' });
    });

    for (const tenant of activeTenants) {
      await runWithTenantContext({ tenantId: tenant._id.toString() }, async () => {
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
              link: `/tasks/${task._id}`,
              entityType: 'task',
              entityId: task._id.toString(),
            });
          }
        }
      });
    }
  } catch (err) {
    console.error('[Scheduler] Error running daily morning task notification job:', err);
  }
}

/**
 * Daily Midnight Job:
 * 1. Enforces 365-day audit log retention policy
 * 2. Purges soft-deleted tenants whose 14-day grace period has passed
 */
export async function runMidnightMaintenance(): Promise<void> {
  const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    // 1. Audit Retention Cleanup
    await runWithTenantContext({ isBypassTenant: true }, async () => {
      const deleteResult = await AuditLog.deleteMany({
        createdAt: { $lt: cutoff },
      });

      if (deleteResult.deletedCount > 0) {
        console.log(`[Scheduler] Purged ${deleteResult.deletedCount} audit logs older than ${retentionDays} days.`);
      }
    });

    // 2. 14-Day Tenant Purge Job
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const tenantsToPurge = await runWithTenantContext({ isBypassTenant: true }, async () => {
      return Tenant.find({
        deletionRequestedAt: { $lt: fourteenDaysAgo },
      });
    });

    for (const t of tenantsToPurge) {
      const tid = t._id;
      console.log(`[Scheduler] Purging tenant ${t.name} (${t.slug}) after 14-day grace period...`);

      await runWithTenantContext({ isBypassTenant: true }, async () => {
        await Promise.all([
          User.deleteMany({ tenantId: tid }),
          Lead.deleteMany({ tenantId: tid }),
          Contact.deleteMany({ tenantId: tid }),
          Account.deleteMany({ tenantId: tid }),
          Deal.deleteMany({ tenantId: tid }),
          Task.deleteMany({ tenantId: tid }),
          Product.deleteMany({ tenantId: tid }),
          Quote.deleteMany({ tenantId: tid }),
          Invoice.deleteMany({ tenantId: tid }),
          Payment.deleteMany({ tenantId: tid }),
          Counter.deleteMany({ tenantId: tid }),
          CompanySettings.deleteMany({ tenantId: tid }),
          FieldDefinition.deleteMany({ tenantId: tid }),
          EmailTemplate.deleteMany({ tenantId: tid }),
          Workflow.deleteMany({ tenantId: tid }),
          WorkflowRun.deleteMany({ tenantId: tid }),
          Notification.deleteMany({ tenantId: tid }),
          NotificationPreference.deleteMany({ tenantId: tid }),
          Activity.deleteMany({ tenantId: tid }),
          AuditLog.deleteMany({ tenantId: tid }),
          Ticket.deleteMany({ tenantId: tid }),
          TicketMessage.deleteMany({ tenantId: tid }),
          SlaPolicy.deleteMany({ tenantId: tid }),
          CannedResponse.deleteMany({ tenantId: tid }),
        ]);

        await Tenant.findByIdAndDelete(tid);
      });

      console.log(`[Scheduler] Successfully purged tenant ${t.name}.`);
    }
  } catch (err) {
    console.error('[Scheduler] Error running midnight maintenance job:', err);
  }
}

/**
 * Nightly Scoring Job (1:00 AM):
 * Evaluates deterministic lead scores (hot/warm/cold) and deal risk (low/medium/high)
 * Emits deal_risk_high trigger and notification on high risk transitions.
 */
export async function runNightlyScoringJob(): Promise<void> {
  try {
    const activeTenants = await runWithTenantContext({ isBypassTenant: true }, async () => {
      return Tenant.find({ status: 'active' });
    });

    for (const tenant of activeTenants) {
      await runWithTenantContext({ tenantId: tenant._id.toString() }, async () => {
        await evaluateAllTenantScores(tenant._id.toString());
      });
    }
    console.log('[Scheduler] Nightly lead and deal risk evaluation completed successfully.');
  } catch (err) {
    console.error('[Scheduler] Error running nightly scoring job:', err);
  }
}

/**
 * Initializes all cron schedules
 */
export function initCronJobs(): void {
  // Every 5 minutes: SLA Monitoring Engine
  cron.schedule('*/5 * * * *', () => {
    runSlaMonitorJob();
  });

  // Every 15 minutes: '*/15 * * * *'
  cron.schedule('*/15 * * * *', () => {
    runPeriodicChecks();
  });

  // Daily 8:00 AM: '0 8 * * *'
  cron.schedule('0 8 * * *', () => {
    runDailyMorningTasks();
  });

  // Daily 1:00 AM: Nightly Scoring Job '0 1 * * *'
  cron.schedule('0 1 * * *', () => {
    runNightlyScoringJob();
  });

  // Daily Midnight: '0 0 * * *'
  cron.schedule('0 0 * * *', () => {
    runMidnightMaintenance();
  });

  console.log('[Scheduler] Multi-tenant background cron jobs scheduled successfully.');
}
