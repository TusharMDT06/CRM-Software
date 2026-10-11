import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { Task } from '../models/Task.js';
import { Product } from '../models/Product.js';
import { Quote } from '../models/Quote.js';
import { Invoice } from '../models/Invoice.js';
import { Ticket } from '../models/Ticket.js';
import { runWithTenantContext } from './tenantContext.js';

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanLimitError';
  }
}

/**
 * Checks if tenant has room for a new seat/user
 */
export async function checkSeatLimit(tenantId: string): Promise<void> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const userCount = await runWithTenantContext(
    { tenantId, isBypassTenant: true },
    async () => User.countDocuments({ tenantId, active: true })
  );

  if (userCount >= tenant.limits.maxSeats) {
    throw new PlanLimitError(
      `Plan limit reached: Maximum user seats (${tenant.limits.maxSeats}) reached for ${tenant.plan.toUpperCase()} plan. Please upgrade to add more teammates.`
    );
  }
}

/**
 * Checks if tenant has room for creating a new business record
 */
export async function checkRecordLimit(tenantId: string): Promise<void> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const [
    leadsCount,
    contactsCount,
    accountsCount,
    dealsCount,
    tasksCount,
    productsCount,
    quotesCount,
    invoicesCount,
    ticketsCount,
  ] = await runWithTenantContext({ tenantId, isBypassTenant: true }, async () => {
    return Promise.all([
      Lead.countDocuments({ tenantId }),
      Contact.countDocuments({ tenantId }),
      Account.countDocuments({ tenantId }),
      Deal.countDocuments({ tenantId }),
      Task.countDocuments({ tenantId }),
      Product.countDocuments({ tenantId }),
      Quote.countDocuments({ tenantId }),
      Invoice.countDocuments({ tenantId }),
      Ticket.countDocuments({ tenantId }),
    ]);
  });

  const totalRecords =
    leadsCount +
    contactsCount +
    accountsCount +
    dealsCount +
    tasksCount +
    productsCount +
    quotesCount +
    invoicesCount +
    ticketsCount;

  if (totalRecords >= tenant.limits.maxRecords) {
    throw new PlanLimitError(
      `Plan limit reached: Maximum record limit (${tenant.limits.maxRecords}) reached for your organization. Please upgrade your plan to create more records.`
    );
  }
}

/**
 * Gets aggregated usage stats for a tenant
 */
export async function getTenantUsage(tenantId: string) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const [seatsCount, recordsCount] = await runWithTenantContext(
    { tenantId, isBypassTenant: true },
    async () => {
      const seats = await User.countDocuments({ tenantId, active: true });
      const [
        leads,
        contacts,
        accounts,
        deals,
        tasks,
        products,
        quotes,
        invoices,
      ] = await Promise.all([
        Lead.countDocuments({ tenantId }),
        Contact.countDocuments({ tenantId }),
        Account.countDocuments({ tenantId }),
        Deal.countDocuments({ tenantId }),
        Task.countDocuments({ tenantId }),
        Product.countDocuments({ tenantId }),
        Quote.countDocuments({ tenantId }),
        Invoice.countDocuments({ tenantId }),
      ]);
      return [seats, leads + contacts + accounts + deals + tasks + products + quotes + invoices];
    }
  );

  return {
    tenantId: tenant._id.toString(),
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    status: tenant.status,
    seatsCount,
    maxSeats: tenant.limits.maxSeats,
    recordsCount,
    maxRecords: tenant.limits.maxRecords,
    aiEnabled: tenant.limits.aiEnabled,
    aiMonthlyRequests: tenant.limits.aiMonthlyRequests,
  };
}
