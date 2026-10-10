const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('====================================================');
  console.log('  FLOWDESK PHASE 2 COMPREHENSIVE END-TO-END VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Authenticate all three roles
  console.log('1. Authenticating Roles (Admin, Manager, Sales)...');
  const [adminAuth, managerAuth, salesAuth] = await Promise.all([
    fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@crm.test', password: 'Password@123' }),
    }).then((r) => r.json()) as any,
    fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@crm.test', password: 'Password@123' }),
    }).then((r) => r.json()) as any,
    fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sales@crm.test', password: 'Password@123' }),
    }).then((r) => r.json()) as any,
  ]);

  const adminToken = adminAuth.token;
  const managerToken = managerAuth.token;
  const salesToken = salesAuth.token;

  assert(!!adminToken && adminAuth.user.role === 'admin', 'Admin authenticated successfully');
  assert(!!managerToken && managerAuth.user.role === 'manager', 'Manager authenticated successfully');
  assert(!!salesToken && salesAuth.user.role === 'sales', 'Sales authenticated successfully');

  // Fetch reference records
  const [leadsRes, dealsRes, accountsRes, contactsRes] = await Promise.all([
    fetch(`${BASE_URL}/leads`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json()) as any,
    fetch(`${BASE_URL}/deals`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json()) as any,
    fetch(`${BASE_URL}/accounts`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json()) as any,
    fetch(`${BASE_URL}/contacts`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.json()) as any,
  ]);

  const allDeals = dealsRes.data;
  const salesDeal = allDeals.find((d: any) => typeof d.owner === 'object' ? d.owner._id === salesAuth.user._id : d.owner === salesAuth.user._id);
  const managerDeal = allDeals.find((d: any) => typeof d.owner === 'object' ? d.owner._id === managerAuth.user._id : d.owner === managerAuth.user._id);

  console.log('\n2. Testing Record Detail & Strict Owner Scoping (Part 1)...');
  // Admin accesses any deal
  const adminDealRes = await fetch(`${BASE_URL}/deals/${managerDeal._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminDealRes.status === 200, 'Admin can view any deal detail (200 OK)');

  // Sales accesses owned deal
  const salesOwnedDealRes = await fetch(`${BASE_URL}/deals/${salesDeal._id}`, {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert(salesOwnedDealRes.status === 200, 'Sales can view owned deal detail (200 OK)');

  // Sales accesses non-owned deal -> MUST RETURN 404
  const salesUnownedDealRes = await fetch(`${BASE_URL}/deals/${managerDeal._id}`, {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert(salesUnownedDealRes.status === 404, 'Sales accessing unowned record receives 404 Not Found (scoping enforced)');

  console.log('\n3. Testing Activity Timeline & System Activities (Part 2)...');
  // Log note on owned deal
  const logNoteRes = await fetch(`${BASE_URL}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      type: 'note',
      subject: 'Client sync summary',
      body: 'Discussed procurement approval timeline with finance lead.',
      entityType: 'deal',
      entityId: salesDeal._id,
    }),
  });
  assert(logNoteRes.status === 201, 'Sales user successfully logged a Note activity (201 Created)');

  // Log call with outcome and duration
  const logCallRes = await fetch(`${BASE_URL}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      type: 'call',
      subject: 'Commercial clarification call',
      body: 'Verified billing GST details.',
      entityType: 'deal',
      entityId: salesDeal._id,
      durationMins: 15,
      outcome: 'connected',
    }),
  });
  assert(logCallRes.status === 201, 'Sales user successfully logged a Call activity with duration & outcome');

  // Verify activities returned on record
  const dealActivitiesRes = await fetch(`${BASE_URL}/activities?entityType=deal&entityId=${salesDeal._id}`, {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  const dealActivities = (await dealActivitiesRes.json()) as any;
  assert(dealActivitiesRes.status === 200 && dealActivities.data.length >= 2, 'GET /activities returns timeline items');

  // Test dashboard recent activities widget
  const recentActivitiesRes = await fetch(`${BASE_URL}/activities?limit=8`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const recentActivities = (await recentActivitiesRes.json()) as any;
  assert(recentActivitiesRes.status === 200 && recentActivities.data.length > 0, 'Dashboard Recent Activity widget query succeeds');

  console.log('\n4. Testing Email Templates, Merge Tokens & Send Fallback (Part 3)...');
  // Get templates
  const templatesRes = await fetch(`${BASE_URL}/emails/templates`, {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  const templates = (await templatesRes.json()) as any;
  assert(templatesRes.status === 200 && templates.length >= 5, 'GET /emails/templates returns seeded templates');

  // Get email config (Resend test domain flag)
  const configRes = await fetch(`${BASE_URL}/emails/config`, {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  const configData = (await configRes.json()) as any;
  assert(configRes.status === 200 && typeof configData.isTestDomain === 'boolean', 'GET /emails/config returns provider config status');

  // Sales attempts to send email with merge fields without SMTP
  const sendEmailRes = await fetch(`${BASE_URL}/emails/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      to: 'kavita.reddy@tatadigital.com',
      subject: 'Executive Proposal: {{deal.title}}',
      body: 'Dear {{contact.firstName}}, proposal for {{deal.title}} valued at {{deal.amount}}.',
      entityType: 'deal',
      entityId: salesDeal._id,
    }),
  });
  const sendEmailData = (await sendEmailRes.json()) as any;
  assert(
    sendEmailRes.status === 503 && !!sendEmailData.mailtoUrl && sendEmailData.mailtoUrl.startsWith('mailto:'),
    'POST /emails/send returns 503 with mailto fallback when SMTP is unconfigured',
  );

  // Log sent email fallback
  const logSentRes = await fetch(`${BASE_URL}/emails/log-sent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      to: 'kavita.reddy@tatadigital.com',
      subject: 'Executive Proposal: Tata Digital',
      body: 'Sent via mailto fallback client.',
      entityType: 'deal',
      entityId: salesDeal._id,
    }),
  });
  assert(logSentRes.status === 201, 'POST /emails/log-sent successfully logs email activity');

  console.log('\n5. Testing CSV Export & Import Wizard (Part 4)...');
  // Leads export with BOM and formula injection protection
  const exportRes = await fetch(`${BASE_URL}/leads/export`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const exportBuffer = Buffer.from(await exportRes.arrayBuffer());
  const hasBOM = exportBuffer[0] === 0xef && exportBuffer[1] === 0xbb && exportBuffer[2] === 0xbf;
  const exportText = exportBuffer.toString('utf-8');
  assert(
    exportRes.status === 200 && hasBOM,
    'GET /leads/export streams UTF-8 CSV with Excel BOM (\\uFEFF)',
  );
  assert(exportText.includes('custom.budget_range'), 'CSV Export includes custom fields headers');

  // Leads import dry-run validation
  const importDryRunRes = await fetch(`${BASE_URL}/leads/import?dryRun=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      rows: [
        {
          name: 'Valid Enterprise Lead',
          email: 'valid.enterprise@corp.in',
          company: 'Corp Technologies',
          phone: '+91 99887 66554',
          source: 'website',
          status: 'new',
          value: 2500000,
        },
        {
          name: 'Invalid Row (Missing email & company)',
          phone: '123',
        },
      ],
    }),
  });
  const importDryRunData = (await importDryRunRes.json()) as any;
  assert(
    importDryRunRes.status === 200 &&
      importDryRunData.summary.valid === 1 &&
      importDryRunData.summary.errors === 1,
    'POST /leads/import?dryRun=true reports valid and invalid rows correctly',
  );

  console.log('\n6. Testing Custom Fields System (Part 5)...');
  // Admin reads custom fields
  const cfListRes = await fetch(`${BASE_URL}/custom-fields?entity=account`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const cfList = (await cfListRes.json()) as any;
  assert(cfListRes.status === 200 && cfList.length >= 3, 'GET /custom-fields returns active field definitions');

  // Sales attempts to create custom field -> MUST RETURN 403
  const salesCreateCfRes = await fetch(`${BASE_URL}/custom-fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      entity: 'account',
      key: 'unauthorized_key',
      label: 'Unauthorized Field',
      type: 'text',
    }),
  });
  assert(salesCreateCfRes.status === 403, 'Sales role is forbidden from managing custom fields (403)');

  console.log('\n7. Testing Reports Aggregations & Role Permissions (Part 6)...');
  // 1. Funnel
  const funnelRes = await fetch(`${BASE_URL}/reports/funnel`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const funnelData = (await funnelRes.json()) as any;
  assert(funnelRes.status === 200 && Array.isArray(funnelData.funnel), 'GET /reports/funnel computes sales funnel');

  // 2. Won Revenue
  const revenueRes = await fetch(`${BASE_URL}/reports/revenue`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const revenueData = (await revenueRes.json()) as any;
  assert(revenueRes.status === 200 && typeof revenueData.totalRevenue === 'number', 'GET /reports/revenue computes won revenue');

  // 3. Leads
  const leadsReportRes = await fetch(`${BASE_URL}/reports/leads`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const leadsReportData = (await leadsReportRes.json()) as any;
  assert(leadsReportRes.status === 200 && Array.isArray(leadsReportData.bySource), 'GET /reports/leads computes source distribution');

  // 4. Team Leaderboard (Admin allowed, Sales forbidden)
  const teamAdminRes = await fetch(`${BASE_URL}/reports/team`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(teamAdminRes.status === 200, 'Admin can access Team Leaderboard report');

  const teamSalesRes = await fetch(`${BASE_URL}/reports/team`, {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert(teamSalesRes.status === 403, 'Sales is forbidden from Team Leaderboard report (403)');

  // 5. Forecast
  const forecastRes = await fetch(`${BASE_URL}/reports/forecast`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const forecastData = (await forecastRes.json()) as any;
  assert(forecastRes.status === 200 && typeof forecastData.grandWeightedTotal === 'number', 'GET /reports/forecast computes probability-weighted pipeline');

  console.log('\n====================================================');
  console.log(`  E2E ROLE VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal E2E error:', e);
  process.exit(1);
});
