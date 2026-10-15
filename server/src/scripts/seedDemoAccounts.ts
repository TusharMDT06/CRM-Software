import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { runWithTenantContext } from '../utils/tenantContext.js';

dotenv.config();

export async function seedDemoAccounts() {
  await connectDB();

  const defaultTenant = await runWithTenantContext({ isBypassTenant: true }, async () => {
    let tenant = await Tenant.findOne({ slug: 'default' });
    if (!tenant) {
      tenant = await Tenant.findOne({});
    }
    return tenant;
  });

  if (!defaultTenant) {
    console.error('No tenant found in database.');
    process.exit(1);
  }

  const tenantId = defaultTenant._id;
  const hashStandard = await bcrypt.hash('Password@123', 10);

  const demoUsers = [
    { name: 'Aarav Sharma (Admin)', email: 'admin@flowdesk.com', role: 'admin' },
    { name: 'Priya Patel (Manager)', email: 'manager@flowdesk.com', role: 'manager' },
    { name: 'Rohan Mehta (Sales)', email: 'sales@flowdesk.com', role: 'sales' },
    { name: 'Aarav Sharma (Admin)', email: 'admin@crm.test', role: 'admin' },
    { name: 'Priya Patel (Manager)', email: 'manager@crm.test', role: 'manager' },
    { name: 'Rohan Mehta (Sales)', email: 'sales@crm.test', role: 'sales' },
  ];

  for (const demo of demoUsers) {
    await runWithTenantContext({ isBypassTenant: true }, async () => {
      const existing = await User.findOne({ email: demo.email.toLowerCase() });
      if (existing) {
        existing.passwordHash = hashStandard;
        existing.active = true;
        existing.isVerified = true;
        existing.role = demo.role as any;
        if (!existing.tenantId) existing.tenantId = tenantId;
        await existing.save();
        console.log(`[Demo] Updated ${demo.email} with Password@123`);
      } else {
        await User.create({
          name: demo.name,
          email: demo.email.toLowerCase(),
          passwordHash: hashStandard,
          role: demo.role,
          active: true,
          isVerified: true,
          tenantId: tenantId,
        });
        console.log(`[Demo] Created ${demo.email} with Password@123`);
      }
    });
  }

  console.log('[Demo] All demo accounts are active and ready!');
}

seedDemoAccounts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
