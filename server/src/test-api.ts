import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runSeed } from './seed.js';

dotenv.config();

const PORT = 5000;

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const existingUsersCount = await mongoose.connection.collection('users').countDocuments().catch(() => 0);
  if (process.env.FORCE_SEED === 'true' || existingUsersCount === 0) {
    console.log('[Test API] Running seed first...');
    await runSeed();
  } else {
    console.log('[Test API] Existing data found, skipping destructive re-seed.');
  }

  const baseUrl = `http://localhost:${PORT}/api`;
  console.log(`[Test API] Testing against running server on ${baseUrl}`);

  let failed = 0;
  let passed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Test Login Admin
    console.log('\n--- 1. Authentication Tests ---');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@crm.test', password: 'Password@123' }),
    });
    const adminLogin = (await adminLoginRes.json()) as any;
    assert(adminLoginRes.status === 200 && !!adminLogin.token, 'Admin login succeeded and received token');
    const adminToken = adminLogin.token;

    // 2. Test Login Manager
    const managerLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@crm.test', password: 'Password@123' }),
    });
    const managerLogin = (await managerLoginRes.json()) as any;
    assert(managerLoginRes.status === 200 && !!managerLogin.token, 'Manager login succeeded');
    const managerToken = managerLogin.token;

    // 3. Test Login Sales
    const salesLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sales@crm.test', password: 'Password@123' }),
    });
    const salesLogin = (await salesLoginRes.json()) as any;
    assert(salesLoginRes.status === 200 && !!salesLogin.token, 'Sales login succeeded');
    const salesToken = salesLogin.token;

    // 4. Test Login Disabled User
    const disabledLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'disabled@crm.test', password: 'Password@123' }),
    });
    assert(disabledLoginRes.status === 403, 'Disabled user login is rejected with 403');

    // 5. Test Auth /me
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const meData = (await meRes.json()) as any;
    assert(meRes.status === 200 && meData.user.role === 'sales', 'GET /auth/me returns current sales user');

    // 6. Test Bootstrap blocked when users exist
    const bootstrapRes = await fetch(`${baseUrl}/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacker', email: 'hacker@crm.test', password: 'Password@123' }),
    });
    assert(bootstrapRes.status === 400, 'POST /auth/bootstrap is blocked when users already exist');

    // 7. Test RBAC Scoping for Leads
    console.log('\n--- 2. RBAC Scoping Tests ---');
    const adminLeadsRes = await fetch(`${baseUrl}/leads`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminLeads = (await adminLeadsRes.json()) as any;

    const salesLeadsRes = await fetch(`${baseUrl}/leads`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const salesLeads = (await salesLeadsRes.json()) as any;

    assert(adminLeads.data.length > salesLeads.data.length, 'Admin sees all leads while Sales sees only owned leads');
    assert(
      salesLeads.data.every((l: any) => l.owner._id === salesLogin.user._id),
      'All leads returned to Sales belong strictly to Sales user'
    );

    // 8. Test Delete RBAC (Sales Forbidden, Manager Allowed)
    console.log('\n--- 3. Delete RBAC Tests ---');
    // First, let's create a temporary lead owned by Sales
    const createLeadRes = await fetch(`${baseUrl}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        name: 'Temp Lead For Deletion',
        email: 'templead@test.com',
        phone: '+91 99999 88888',
        company: 'Delete Test Co',
        source: 'website',
        value: 100000,
      }),
    });
    const createdLead = (await createLeadRes.json()) as any;
    assert(createLeadRes.status === 201, 'Sales created a lead');

    // Sales tries to delete
    const salesDeleteRes = await fetch(`${baseUrl}/leads/${createdLead._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    assert(salesDeleteRes.status === 403, 'Sales cannot delete records (returns 403)');

    // Manager deletes
    const managerDeleteRes = await fetch(`${baseUrl}/leads/${createdLead._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(managerDeleteRes.status === 200, 'Manager can delete records (returns 200)');

    // 9. Test Lead Convert Endpoint
    console.log('\n--- 4. Lead Convert Tests ---');
    // Create lead to convert
    const leadToConvertRes = await fetch(`${baseUrl}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        name: 'Suresh Raina',
        email: 'suresh@cricketinfra.in',
        phone: '+91 98200 11223',
        company: 'Cricket Infra Tech',
        source: 'referral',
        value: 2500000,
      }),
    });
    const leadToConvert = (await leadToConvertRes.json()) as any;

    const convertRes = await fetch(`${baseUrl}/leads/${leadToConvert._id}/convert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const convertData = (await convertRes.json()) as any;
    assert(convertRes.status === 200, 'Lead converted successfully');
    assert(convertData.lead.status === 'converted', 'Converted lead status is updated to converted');
    assert(convertData.deal.amount === 2500000, 'Created deal amount matches lead value');
    assert(convertData.account.name === 'Cricket Infra Tech', 'Created account name matches lead company');
    assert(convertData.contact.firstName === 'Suresh', 'Created contact firstName is parsed correctly');

    // 10. Test Dashboard Summary
    console.log('\n--- 5. Dashboard Summary Tests ---');
    const summaryRes = await fetch(`${baseUrl}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const summary = (await summaryRes.json()) as any;
    assert(summaryRes.status === 200, 'GET /dashboard/summary returns 200');
    assert(typeof summary.wonThisMonth.amount === 'number', 'wonThisMonth has amount');
    assert(typeof summary.pipelineValue === 'number', 'pipelineValue is computed');
    assert(typeof summary.pipelineHealth === 'number', 'pipelineHealth percentage is computed');
    assert(summary.dealsAtRisk.count >= 2, 'dealsAtRisk detects overdue deals');
    assert(summary.revenueByMonth.length === 6, 'revenueByMonth has 6 months history');
    assert(summary.recentDeals.length <= 6, 'recentDeals contains up to 6 deals');
    assert(summary.openTasks.length <= 6, 'openTasks contains up to 6 open tasks');

    // 11. Test User Management (Team Page)
    console.log('\n--- 6. User Management Tests ---');
    // Sales tries to get all users
    const salesUsersRes = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const salesUsers = (await salesUsersRes.json()) as any;
    assert(salesUsers.length === 1, 'Sales sees only self on /users');

    // Admin sees all users
    const adminUsersRes = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminUsers = (await adminUsersRes.json()) as any;
    assert(adminUsers.length >= 5, 'Admin sees all team users on /users');

    // Sales cannot create user
    const salesCreateUserRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        name: 'Intruder',
        email: 'intruder@crm.test',
        password: 'Password@123',
        role: 'sales',
      }),
    });
    assert(salesCreateUserRes.status === 403, 'Sales cannot create users (returns 403)');

    // Admin creates user
    const adminCreateUserRes = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Karan Johar',
        email: 'karan@crm.test',
        password: 'Password@123',
        role: 'sales',
      }),
    });
    const createdUser = (await adminCreateUserRes.json()) as any;
    assert(adminCreateUserRes.status === 201, 'Admin can create user (returns 201)');

    // Admin toggles active status
    const adminToggleUserRes = await fetch(`${baseUrl}/users/${createdUser._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ active: false }),
    });
    const updatedUser = (await adminToggleUserRes.json()) as any;
    assert(updatedUser.active === false, 'Admin can toggle user active state');

    // 12. Test Zod Validation Error Format
    console.log('\n--- 7. Zod Validation Error Tests ---');
    const badLeadRes = await fetch(`${baseUrl}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: '' }), // missing email, company, phone
    });
    const badLead = (await badLeadRes.json()) as any;
    assert(badLeadRes.status === 400 && typeof badLead.message === 'string', 'Zod returns 400 with { message }');

    console.log('\n========================================');
    console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('[Test API] Error during test run:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
