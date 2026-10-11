/**
 * Flowdesk Multi-Tenant Migration Script
 *
 * BACKUP STEP (DOCUMENTED REQUIREMENT):
 * Before running this script on production, ensure you take a snapshot or mongodump:
 *   mongodump --uri="mongodb://127.0.0.1:27017/flowdesk" --out="./backup-$(date +%Y%m%d%H%M%S)"
 *
 * This migration:
 * 1. Creates a default tenant ('Default Organization', slug 'default') if none exists.
 * 2. Backfills tenantId across all existing collections.
 * 3. Drops legacy standalone unique indexes and rebuilds compound per-tenant indexes.
 * 4. Is fully idempotent and safely re-runnable.
 */

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Tenant, DEFAULT_PLAN_LIMITS } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { Task } from '../models/Task.js';
import { Product } from '../models/Product.js';
import { Quote } from '../models/Quote.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { Counter } from '../models/Counter.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { FieldDefinition } from '../models/FieldDefinition.js';
import { EmailTemplate } from '../models/EmailTemplate.js';
import { Workflow } from '../models/Workflow.js';
import { WorkflowRun } from '../models/WorkflowRun.js';
import { Notification } from '../models/Notification.js';
import { NotificationPreference } from '../models/NotificationPreference.js';
import { Activity } from '../models/Activity.js';
import { AuditLog } from '../models/AuditLog.js';
import { runWithTenantContext } from '../utils/tenantContext.js';

async function migrateMultiTenant() {
  console.log('====================================================');
  console.log('🚀 [Flowdesk Migration] Starting Multi-Tenancy Backfill');
  console.log('====================================================');

  try {
    await connectDB();

    await runWithTenantContext({ isBypassTenant: true }, async () => {
      // 1. Ensure Default Tenant
      let defaultTenant = await Tenant.findOne({ slug: 'default' });
      if (!defaultTenant) {
        defaultTenant = await Tenant.create({
          name: 'Flowdesk Technologies',
          slug: 'default',
          status: 'active',
          plan: 'pro',
          limits: { ...DEFAULT_PLAN_LIMITS.pro },
          settings: {},
        });
        console.log(`✅ Created default tenant: "${defaultTenant.name}" (ID: ${defaultTenant._id})`);
      } else {
        console.log(`ℹ️ Default tenant already exists: "${defaultTenant.name}" (ID: ${defaultTenant._id})`);
      }

      const defaultTenantId = defaultTenant._id;

      // 2. Safely drop obsolete single-field unique indexes to avoid E11000 duplicate key errors
      const collectionsToClean = [
        { model: Product, indexName: 'sku_1' },
        { model: Counter, indexName: 'prefix_1_year_1' },
        { model: Quote, indexName: 'number_1' },
        { model: Invoice, indexName: 'number_1' },
        { model: FieldDefinition, indexName: 'entity_1_key_1' },
      ];

      for (const item of collectionsToClean) {
        try {
          const indexes = await item.model.collection.indexes();
          const hasOldIndex = indexes.some((idx) => idx.name === item.indexName);
          if (hasOldIndex) {
            await item.model.collection.dropIndex(item.indexName);
            console.log(`🔄 Dropped legacy index "${item.indexName}" on ${item.model.modelName}`);
          }
        } catch (err: any) {
          // Ignore if index doesn't exist
        }
      }

      // 3. Backfill tenantId on each collection
      const modelsToBackfill = [
        { name: 'Users', model: User, filter: { role: { $ne: 'platform_admin' }, tenantId: { $exists: false } } },
        { name: 'Leads', model: Lead, filter: { tenantId: { $exists: false } } },
        { name: 'Contacts', model: Contact, filter: { tenantId: { $exists: false } } },
        { name: 'Accounts', model: Account, filter: { tenantId: { $exists: false } } },
        { name: 'Deals', model: Deal, filter: { tenantId: { $exists: false } } },
        { name: 'Tasks', model: Task, filter: { tenantId: { $exists: false } } },
        { name: 'Products', model: Product, filter: { tenantId: { $exists: false } } },
        { name: 'Quotes', model: Quote, filter: { tenantId: { $exists: false } } },
        { name: 'Invoices', model: Invoice, filter: { tenantId: { $exists: false } } },
        { name: 'Payments', model: Payment, filter: { tenantId: { $exists: false } } },
        { name: 'Counters', model: Counter, filter: { tenantId: { $exists: false } } },
        { name: 'CompanySettings', model: CompanySettings, filter: { tenantId: { $exists: false } } },
        { name: 'FieldDefinitions', model: FieldDefinition, filter: { tenantId: { $exists: false } } },
        { name: 'EmailTemplates', model: EmailTemplate, filter: { tenantId: { $exists: false } } },
        { name: 'Workflows', model: Workflow, filter: { tenantId: { $exists: false } } },
        { name: 'WorkflowRuns', model: WorkflowRun, filter: { tenantId: { $exists: false } } },
        { name: 'Notifications', model: Notification, filter: { tenantId: { $exists: false } } },
        { name: 'NotificationPreferences', model: NotificationPreference, filter: { tenantId: { $exists: false } } },
        { name: 'Activities', model: Activity, filter: { tenantId: { $exists: false } } },
        { name: 'AuditLogs', model: AuditLog, filter: { tenantId: { $exists: false } } },
      ];

      for (const item of modelsToBackfill) {
        const updateResult = await item.model.collection.updateMany(
          item.filter as any,
          { $set: { tenantId: defaultTenantId } }
        );
        console.log(`📦 ${item.name}: Updated ${updateResult.modifiedCount} records with default tenantId`);
      }

      // 4. Rebuild / Sync all compound indexes
      console.log('🔄 Syncing and rebuilding compound indexes across all collections...');
      for (const item of modelsToBackfill) {
        try {
          await item.model.syncIndexes();
        } catch (err: any) {
          console.warn(`Warning syncing indexes on ${item.name}:`, err.message);
        }
      }

      console.log('====================================================');
      console.log('✅ [Flowdesk Migration] Multi-Tenancy Backfill Completed Successfully!');
      console.log('====================================================');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ [Flowdesk Migration] Failed:', error);
    process.exit(1);
  }
}

migrateMultiTenant();
