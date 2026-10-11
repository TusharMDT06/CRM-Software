import { SlaPolicy, DEFAULT_SLA_TARGETS } from '../models/SlaPolicy.js';
import { Ticket, ITicket, TicketPriority } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { emitWorkflowEvent } from './eventBus.js';
import { sendNotification } from './notificationService.js';
import { runWithTenantContext } from './tenantContext.js';
import { Tenant } from '../models/Tenant.js';

export interface SlaDueCalculation {
  slaFirstResponseDue: Date;
  slaResolutionDue: Date;
  firstResponseDue: Date;
  resolutionDue: Date;
}

/**
 * Calculates SLA due timestamps based on priority and tenant SLA policy
 */
export async function calculateTicketSla(
  priority: TicketPriority,
  startTime: Date = new Date(),
  tenantId?: string
): Promise<SlaDueCalculation> {
  let policy: any = null;
  if (tenantId) {
    try {
      policy = await runWithTenantContext({ tenantId }, async () => {
        return SlaPolicy.findOne({ isDefault: true }).lean();
      });
    } catch {
      // Fallback to default targets
    }
  }

  const targets = policy?.priorities?.[priority] || DEFAULT_SLA_TARGETS[priority] || DEFAULT_SLA_TARGETS.medium;

  const firstResponseHours = targets.firstResponseHours || 8;
  const resolutionHours = targets.resolutionHours || 24;

  const slaFirstResponseDue = new Date(startTime.getTime() + firstResponseHours * 3600 * 1000);
  const slaResolutionDue = new Date(startTime.getTime() + resolutionHours * 3600 * 1000);

  return {
    slaFirstResponseDue,
    slaResolutionDue,
    firstResponseDue: slaFirstResponseDue,
    resolutionDue: slaResolutionDue,
  };
}

/**
 * Adjusts ticket SLA clocks when entering or exiting 'pending' status
 */
export function handleTicketPendingState(ticket: ITicket, newStatus: string): void {
  const oldStatus = ticket.status;
  const now = new Date();

  // Entering pending: pause SLA clock
  if (newStatus === 'pending' && oldStatus !== 'pending') {
    ticket.slaPendingPausedAt = now;
  }

  // Resuming from pending: push due dates forward by the paused duration
  if (oldStatus === 'pending' && newStatus !== 'pending' && ticket.slaPendingPausedAt) {
    const pausedMs = now.getTime() - new Date(ticket.slaPendingPausedAt).getTime();
    if (pausedMs > 0) {
      ticket.slaPendingTotalPausedMs = (ticket.slaPendingTotalPausedMs || 0) + pausedMs;

      if (ticket.slaFirstResponseDue) {
        ticket.slaFirstResponseDue = new Date(new Date(ticket.slaFirstResponseDue).getTime() + pausedMs);
      }
      if (ticket.slaResolutionDue) {
        ticket.slaResolutionDue = new Date(new Date(ticket.slaResolutionDue).getTime() + pausedMs);
      }
    }
    ticket.slaPendingPausedAt = undefined;
  }

  // Resolving ticket
  if (['resolved', 'closed'].includes(newStatus) && !ticket.resolvedAt) {
    ticket.resolvedAt = now;
  } else if (!['resolved', 'closed'].includes(newStatus) && ticket.resolvedAt) {
    ticket.resolvedAt = undefined;
  }
}

// In-memory cache to prevent duplicate SLA warning alerts per ticket
const slaWarnedCache = new Set<string>();

/**
 * Background 5-minute job to check SLA risks and breaches across all active tenants
 */
export async function runSlaMonitorJob(): Promise<void> {
  const activeTenants = await runWithTenantContext({ isBypassTenant: true }, async () => {
    return Tenant.find({ status: 'active' }).select('_id name');
  });

  const now = new Date();

  for (const t of activeTenants) {
    const tenantIdStr = t._id.toString();

    await runWithTenantContext({ tenantId: tenantIdStr }, async () => {
      // Find open active tickets with SLA tracking
      const tickets = await Ticket.find({
        status: { $in: ['new', 'open'] },
      }).populate('assignee', 'name email');

      const managersAndAdmins = await User.find({
        role: { $in: ['admin', 'manager'] },
        active: true,
      }).select('_id');

      for (const ticket of tickets) {
        let isModified = false;

        // 1. Check First Response SLA
        if (!ticket.firstResponseAt && ticket.slaFirstResponseDue) {
          const dueTime = new Date(ticket.slaFirstResponseDue).getTime();
          const createdTime = new Date(ticket.createdAt).getTime();
          const totalDuration = dueTime - createdTime;
          const elapsed = now.getTime() - createdTime;

          // Breached first response
          if (now.getTime() > dueTime && !ticket.slaBreached?.firstResponse) {
            ticket.slaBreached.firstResponse = true;
            isModified = true;

            emitWorkflowEvent('ticket_sla_breached', {
              ticketId: ticket._id.toString(),
              number: ticket.number,
              subject: ticket.subject,
              type: 'first_response',
              assignee: ticket.assignee,
            });

            // Send in-app notification to assignee and managers
            const recipientIds = [
              ...(ticket.assignee ? [ticket.assignee._id] : []),
              ...managersAndAdmins.map((m) => m._id),
            ];

            for (const rId of recipientIds) {
              await sendNotification({
                userId: rId,
                type: 'ticket_sla_breached',
                title: `SLA Breached: Ticket ${ticket.number}`,
                body: `First response SLA breached for "${ticket.subject}".`,
                link: `/tickets/${ticket._id}`,
                entityType: 'ticket',
                entityId: ticket._id.toString(),
              });
            }
          } else if (!ticket.slaBreached?.firstResponse && totalDuration > 0) {
            // Nearing breach (>= 80% elapsed)
            const warningKey = `${ticket._id}_first_response`;
            if (elapsed / totalDuration >= 0.8 && !slaWarnedCache.has(warningKey)) {
              slaWarnedCache.add(warningKey);

              emitWorkflowEvent('ticket_sla_warning', {
                ticketId: ticket._id.toString(),
                number: ticket.number,
                subject: ticket.subject,
                type: 'first_response',
                assignee: ticket.assignee,
              });

              if (ticket.assignee) {
                await sendNotification({
                  userId: ticket.assignee._id,
                  type: 'ticket_sla_warning',
                  title: `SLA Warning: Ticket ${ticket.number}`,
                  body: `Ticket "${ticket.subject}" is at 80% SLA time without first response.`,
                  link: `/tickets/${ticket._id}`,
                  entityType: 'ticket',
                  entityId: ticket._id.toString(),
                });
              }
            }
          }
        }

        // 2. Check Resolution SLA
        if (!ticket.resolvedAt && ticket.slaResolutionDue) {
          const dueTime = new Date(ticket.slaResolutionDue).getTime();
          const createdTime = new Date(ticket.createdAt).getTime();
          const totalDuration = dueTime - createdTime;
          const elapsed = now.getTime() - createdTime;

          if (now.getTime() > dueTime && !ticket.slaBreached?.resolution) {
            ticket.slaBreached.resolution = true;
            isModified = true;

            emitWorkflowEvent('ticket_sla_breached', {
              ticketId: ticket._id.toString(),
              number: ticket.number,
              subject: ticket.subject,
              type: 'resolution',
              assignee: ticket.assignee,
            });

            const recipientIds = [
              ...(ticket.assignee ? [ticket.assignee._id] : []),
              ...managersAndAdmins.map((m) => m._id),
            ];

            for (const rId of recipientIds) {
              await sendNotification({
                userId: rId,
                type: 'ticket_sla_breached',
                title: `Resolution SLA Breached: Ticket ${ticket.number}`,
                body: `Resolution time exceeded for ticket "${ticket.subject}".`,
                link: `/tickets/${ticket._id}`,
                entityType: 'ticket',
                entityId: ticket._id.toString(),
              });
            }
          } else if (!ticket.slaBreached?.resolution && totalDuration > 0) {
            const warningKey = `${ticket._id}_resolution`;
            if (elapsed / totalDuration >= 0.8 && !slaWarnedCache.has(warningKey)) {
              slaWarnedCache.add(warningKey);

              emitWorkflowEvent('ticket_sla_warning', {
                ticketId: ticket._id.toString(),
                number: ticket.number,
                subject: ticket.subject,
                type: 'resolution',
                assignee: ticket.assignee,
              });

              if (ticket.assignee) {
                await sendNotification({
                  userId: ticket.assignee._id,
                  type: 'ticket_sla_warning',
                  title: `Resolution SLA Warning: Ticket ${ticket.number}`,
                  body: `Ticket "${ticket.subject}" resolution SLA is nearing breach (>80%).`,
                  link: `/tickets/${ticket._id}`,
                  entityType: 'ticket',
                  entityId: ticket._id.toString(),
                });
              }
            }
          }
        }

        if (isModified) {
          await ticket.save();
        }
      }
    });
  }
}
