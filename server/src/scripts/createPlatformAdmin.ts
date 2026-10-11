import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { runWithTenantContext } from '../utils/tenantContext.js';

async function createPlatformAdmin() {
  const args = process.argv.slice(2);
  const email = (args[0] || 'platform.admin@flowdesk.test').toLowerCase().trim();
  const password = args[1] || 'PlatformSecret@123';
  const name = args[2] || 'Platform Super Admin';

  try {
    await connectDB();

    await runWithTenantContext({ isBypassTenant: true }, async () => {
      let existing = await User.findOne({ email });
      const passwordHash = await bcrypt.hash(password, 10);

      if (existing) {
        existing.role = 'platform_admin';
        existing.passwordHash = passwordHash;
        existing.name = name;
        existing.active = true;
        existing.isVerified = true;
        existing.tenantId = undefined; // platform admin has no tenant
        await existing.save();
        console.log(`✅ [Platform Admin] Existing user "${email}" updated to platform_admin.`);
      } else {
        await User.create({
          name,
          email,
          passwordHash,
          role: 'platform_admin',
          active: true,
          isVerified: true,
        });
        console.log(`✅ [Platform Admin] Created new platform_admin: "${email}".`);
      }
    });

    console.log(`Credential summary:\n- Email: ${email}\n- Role: platform_admin`);
    process.exit(0);
  } catch (error) {
    console.error('❌ [Platform Admin] Error creating platform admin:', error);
    process.exit(1);
  }
}

createPlatformAdmin();
