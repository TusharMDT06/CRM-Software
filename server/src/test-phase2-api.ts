import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runSeed } from './seed.js';

dotenv.config();

const PORT = 5000;

async function runTests() {
  console.log('[Test Phase 2 API] Seeding database...');
  await runSeed();

  const baseUrl = `http://localhost:${PORT}/api`;
  console.log(`[Test Phase 2 API] Testing against running server on ${baseUrl}`);

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
    // 1. Authenticate tokens
    const [adminLoginRes, managerLoginRes, salesLoginRes] = await Promise.all([
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@crm.test', password: 'Password@123' }),
      }),
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'manager@crm.test', password: 'Password@123' }),
      }),
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sales@crm.test', password: 'Password@123' }),
      }),
    ]);

    const admin = (await adminLoginRes.json()) as any;
    const manager = (await managerLoginRes.json()) as any;
    const sales = (await salesLoginRes.json()) as any;

    const adminToken = admin.token;
    const managerToken = manager.token;
    const salesToken = sales.token;

    console.log('\n--- 1. Custom Fields Definition & Validation Tests ---');
    // Admin creates custom field on account
    const cfRes = await fetch(`${baseUrl}/custom-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        entity: 'account',
        key: 'pan_number',
        label: 'PAN Number',
        type: 'text',
        required: false,
      }),
    });
    const cfData = (await cfRes.json()) as any;
    assert(cfRes.status === 201 && cfData.key === 'pan_number', 'Admin can create custom field definition');

    // Sales cannot create custom field
    const salesCfRes = await fetch(`${baseUrl}/custom-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        entity: 'account',
        key: 'unauthorized_key',
        label: 'Unauthorized',
        type: 'text',
      }),
    });
    assert(salesCfRes.status === 403, 'Sales is forbidden from creating custom field definitions (403)');

    // Account creation with unknown custom field is rejected
    const badAccRes = await fetch(`${baseUrl}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Test Co With Bad Field',
        industry: 'Tech',
        custom: { unknown_xyz: 'value' },
      }),
    });
    assert(badAccRes.status === 400, 'Creation with unknown custom field is rejected with 400');

    // Account creation with valid custom field succeeds
    const goodAccRes = await fetch(`${baseUrl}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Wipro Enterprise Tech',
        industry: 'IT Services',
        custom: { gst_number: '27AABCT3518Q1ZV' },
      }),
    });
    const goodAcc = (await goodAccRes.json()) as any;
    assert(goodAccRes.status === 201 && goodAcc.custom?.gst_number === '27AABCT3518Q1ZV', 'Account created with valid custom field');

    console.log('\n--- 2. Activity Timeline & Scoping Tests ---');
    // Fetch a sales lead
    const salesLeadsRes = await fetch(`${baseUrl}/leads`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const salesLeads = (await salesLeadsRes.json()) as any;
    const myLead = salesLeads.data[0];

    // Sales creates a call activity on their lead
    const callActRes = await fetch(`${baseUrl}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        type: 'call',
        subject: 'Introductory Discovery Call',
        body: 'Discussed cloud migration timeline and enterprise SLA.',
        entityType: 'lead',
        entityId: myLead._id,
        durationMins: 25,
        outcome: 'connected',
      }),
    });
    const callAct = (await callActRes.json()) as any;
    assert(callActRes.status === 201 && callAct.outcome === 'connected', 'Sales user logged a call activity');

    // Fetch activities for that lead
    const getActRes = await fetch(`${baseUrl}/activities?entityType=lead&entityId=${myLead._id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const getAct = (await getActRes.json()) as any;
    assert(getActRes.status === 200 && getAct.data.length >= 1, 'GET /activities returns logged activity for lead');

    // Fetch an admin lead that sales does NOT own
    const adminLeadsRes = await fetch(`${baseUrl}/leads`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminLeads = (await adminLeadsRes.json()) as any;
    const notMyLead = adminLeads.data.find((l: any) => l.owner._id !== sales.user._id);

    // Sales tries to access activities on non-owned lead -> 404
    const forbiddenActRes = await fetch(`${baseUrl}/activities?entityType=lead&entityId=${notMyLead._id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    assert(forbiddenActRes.status === 404, 'Sales cannot access activities for non-owned record (returns 404)');

    // Sales tries to log activity on non-owned lead -> 404
    const forbiddenCreateActRes = await fetch(`${baseUrl}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        type: 'note',
        subject: 'Snooping note',
        entityType: 'lead',
        entityId: notMyLead._id,
      }),
    });
    assert(forbiddenCreateActRes.status === 404, 'Sales cannot log activity on non-owned record (returns 404)');

    console.log('\n--- 3. Email Templates & Send Endpoint Tests ---');
    // Admin creates shared email template
    const createTmplRes = await fetch(`${baseUrl}/emails/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Enterprise Proposal Introduction',
        subject: 'Proposal for {{account.name}}: {{deal.title}}',
        body: 'Hi {{contact.firstName}},\n\nPlease review our proposal for {{deal.title}} valued at {{deal.amount}}.\n\nBest regards,\n{{owner.name}}',
        category: 'proposal',
        shared: true,
      }),
    });
    const tmplData = (await createTmplRes.json()) as any;
    assert(createTmplRes.status === 201 && tmplData.shared === true, 'Admin created shared email template');

    // Sales can view shared template
    const salesTmplRes = await fetch(`${baseUrl}/emails/templates`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const salesTmpls = (await salesTmplRes.json()) as any;
    assert(salesTmpls.some((t: any) => t._id === tmplData._id), 'Sales can view shared template created by Admin');

    // Sales cannot edit someone else's shared template
    const salesEditTmplRes = await fetch(`${baseUrl}/emails/templates/${tmplData._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({ name: 'Tampered Template' }),
    });
    assert(salesEditTmplRes.status === 403, 'Sales is forbidden from editing shared template owned by Admin (403)');

    // Duplicate template
    const dupRes = await fetch(`${baseUrl}/emails/templates/${tmplData._id}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const dupData = (await dupRes.json()) as any;
    assert(dupRes.status === 201 && dupData.owner._id === sales.user._id, 'Sales duplicated shared template into own private copy');

    // Test send email (when SMTP not configured, returns 503 with mailtoUrl and resolved merge fields)
    const sendRes = await fetch(`${baseUrl}/emails/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        to: myLead.email,
        subject: 'Intro for {{lead.company}}',
        body: 'Hi {{lead.name}},\nExcited to connect with {{lead.company}}.',
        entityType: 'lead',
        entityId: myLead._id,
      }),
    });
    const sendData = (await sendRes.json()) as any;
    assert(
      sendRes.status === 503 &&
        typeof sendData.mailtoUrl === 'string' &&
        sendData.resolvedSubject.includes(myLead.company),
      'POST /emails/send resolves merge fields and returns 503 with mailto fallback when SMTP is not configured'
    );

    // Test log-sent endpoint
    const logSentRes = await fetch(`${baseUrl}/emails/log-sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        to: myLead.email,
        subject: 'Sent proposal copy',
        body: 'Sent PDF over client app',
        entityType: 'lead',
        entityId: myLead._id,
      }),
    });
    assert(logSentRes.status === 201, 'POST /emails/log-sent records email activity');

    console.log('\n--- 4. CSV Export & Import Tests ---');
    // Export leads
    const exportRes = await fetch(`${baseUrl}/leads/export`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const arrayBuf = await exportRes.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    const csvContent = buf.toString('utf-8');
    assert(
      exportRes.status === 200 &&
        hasBom &&
        csvContent.includes('Company'),
      'GET /leads/export streams UTF-8 CSV with BOM'
    );

    // Import dryRun
    const importDryRunRes = await fetch(`${baseUrl}/leads/import?dryRun=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        rows: [
          {
            name: 'New Import Prospect',
            email: 'newimport@prospect.in',
            phone: '+91 99887 76655',
            company: 'Prospect Labs',
            source: 'website',
            value: 400000,
          },
          {
            name: 'Invalid Prospect (Missing Company & Email)',
            phone: '123',
          },
        ],
      }),
    });
    const dryRunData = (await importDryRunRes.json()) as any;
    console.log('DryRun Status:', importDryRunRes.status, 'Data:', JSON.stringify(dryRunData));
    assert(
      importDryRunRes.status === 200 &&
        dryRunData.summary.valid === 1 &&
        dryRunData.summary.errors === 1,
      'POST /leads/import?dryRun=true validates rows and reports valid and error counts'
    );

    // Actual Import
    const actualImportRes = await fetch(`${baseUrl}/leads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        rows: [
          {
            name: 'Import Prospect One',
            email: 'importone@prospect.in',
            phone: '+91 99887 76655',
            company: 'Prospect Labs One',
            source: 'website',
            value: 400000,
          },
        ],
      }),
    });
    const importData = (await actualImportRes.json()) as any;
    console.log('Actual Import Status:', actualImportRes.status, 'Data:', JSON.stringify(importData));
    assert(actualImportRes.status === 200 && importData.summary.created === 1, 'POST /leads/import imports valid rows');

    console.log('\n--- 5. Reports Aggregation Endpoints Tests ---');
    // Funnel report
    const funnelRes = await fetch(`${baseUrl}/reports/funnel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const funnelData = (await funnelRes.json()) as any;
    assert(funnelRes.status === 200 && Array.isArray(funnelData.funnel), 'GET /reports/funnel returns stage funnel');

    // Revenue report
    const revenueRes = await fetch(`${baseUrl}/reports/revenue`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const revenueData = (await revenueRes.json()) as any;
    assert(revenueRes.status === 200 && typeof revenueData.totalRevenue === 'number', 'GET /reports/revenue returns won revenue and comparisons');

    // Leads report
    const leadsReportRes = await fetch(`${baseUrl}/reports/leads`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const leadsReportData = (await leadsReportRes.json()) as any;
    assert(leadsReportRes.status === 200 && Array.isArray(leadsReportData.bySource), 'GET /reports/leads returns bySource and byStatus');

    // Team leaderboard (Admin allowed)
    const teamRes = await fetch(`${baseUrl}/reports/team`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const teamData = (await teamRes.json()) as any;
    assert(teamRes.status === 200 && Array.isArray(teamData.leaderboard), 'GET /reports/team returns team leaderboard for Admin');

    // Team leaderboard (Sales forbidden)
    const salesTeamRes = await fetch(`${baseUrl}/reports/team`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    assert(salesTeamRes.status === 403, 'GET /reports/team is forbidden for Sales (403)');

    // Forecast report
    const forecastRes = await fetch(`${baseUrl}/reports/forecast`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const forecastData = (await forecastRes.json()) as any;
    assert(
      forecastRes.status === 200 &&
        typeof forecastData.grandWeightedTotal === 'number' &&
        Array.isArray(forecastData.monthlyForecast),
      'GET /reports/forecast computes weighted probability forecast'
    );

    console.log('\n========================================');
    console.log(`Phase 2 Server Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================\n');

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('[Test Phase 2 API] Error during test run:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
