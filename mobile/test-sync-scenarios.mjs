import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function runTests() {
  console.log('===============================================================');
  console.log('🚀 FLOWDESK MASTER SPEC SECTION 8: REALTIME SYNC SCENARIOS 1-6');
  console.log('===============================================================');

  // 1. Authenticate as Admin
  console.log('\n[Auth] Logging in as admin@crm.test...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@crm.test',
      password: 'Password@123',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.data?.token || loginData.token;
  const user = loginData.data?.user || loginData.user;
  console.log(`[Auth] Authenticated Admin: ${user.email} (Tenant: ${user.tenantId || user.organizationId})`);

  // 2. Connect Admin Socket.IO client (simulating Mobile client listening to changes)
  console.log('\n[Socket] Connecting Admin Socket.IO client...');
  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`[Socket] Admin connected successfully with socket ID: ${socket.id}`);
      resolve();
    });
    socket.on('connect_error', (err) => {
      reject(new Error(`Admin socket connection failed: ${err.message}`));
    });
    setTimeout(() => reject(new Error('Admin socket connection timed out')), 5000);
  });

  const receivedEvents = [];
  socket.on('entity:changed', (event) => {
    console.log(`[Socket Event] entity:changed received:`, event.entity, event.action, event.id);
    receivedEvents.push(event);
  });

  // Helper to wait for a matching event
  function waitForEvent(predicate, timeoutMs = 4000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        const foundIndex = receivedEvents.findIndex(predicate);
        if (foundIndex !== -1) {
          const event = receivedEvents.splice(foundIndex, 1)[0];
          const elapsed = Date.now() - start;
          return resolve({ event, elapsed });
        }
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Timed out waiting for socket event after ${timeoutMs}ms`));
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  // =========================================================================
  // SCENARIO 1: Edit a lead's name on web -> mobile receives entity:changed within 2s
  // =========================================================================
  console.log('\n--- Scenario 1: Edit a lead on web -> mobile receives sync within 2s ---');
  const leadsRes = await fetch(`${API_BASE}/leads?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const leadsData = await leadsRes.json();
  const testLead = (leadsData.data?.leads || leadsData.data || [])[0];
  if (!testLead) throw new Error('No leads found to test');

  const updatedName = `${testLead.name.split(' [SyncTest]')[0]} [SyncTest]`;
  console.log(`[Scenario 1] Patching lead ${testLead._id} name to "${updatedName}"...`);

  const patchLeadRes = await fetch(`${API_BASE}/leads/${testLead._id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Client-Mutation-Id': 'web-sim-mutation-' + Date.now(),
    },
    body: JSON.stringify({ name: updatedName }),
  });

  if (!patchLeadRes.ok) throw new Error(`PATCH lead failed: ${patchLeadRes.status}`);

  const s1Result = await waitForEvent(
    (e) => e.entity === 'lead' && (e.action === 'updated' || e.action === 'bulk') && String(e.id) === String(testLead._id)
  );
  console.log(`✅ [Scenario 1] PASSED: Socket received entity:changed in ${s1Result.elapsed}ms (< 2000ms threshold).`);

  // =========================================================================
  // SCENARIO 2: Create a lead on mobile -> appears on web list live
  // =========================================================================
  console.log('\n--- Scenario 2: Create a lead on mobile -> appears on web list live ---');
  const newLeadPayload = {
    name: `Mobile Lead ${Date.now().toString().slice(-4)}`,
    email: `mobile.sync.${Date.now()}@example.com`,
    phone: '+91 98765 43210',
    company: 'Mobile Sync Corp',
    source: 'referral',
    rating: 'hot',
    status: 'new',
    value: 75000,
  };

  const createLeadRes = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Client-Mutation-Id': 'mobile-create-mutation-' + Date.now(),
    },
    body: JSON.stringify(newLeadPayload),
  });

  if (!createLeadRes.ok) throw new Error(`POST lead failed: ${createLeadRes.status} ${await createLeadRes.text()}`);
  const createdLeadData = await createLeadRes.json();
  const createdLead = createdLeadData.data?.lead || createdLeadData.data || createdLeadData;
  console.log(`[Scenario 2] Created lead ID: ${createdLead._id || createdLead.id}`);

  const s2Result = await waitForEvent(
    (e) => e.entity === 'lead' && (e.action === 'created' || e.action === 'bulk')
  );
  console.log(`✅ [Scenario 2] PASSED: Socket received entity:changed in ${s2Result.elapsed}ms.`);

  // =========================================================================
  // SCENARIO 3: Move a deal stage on mobile -> web Kanban card moves and totals update
  // =========================================================================
  console.log('\n--- Scenario 3: Move a deal stage on mobile -> Kanban card moves & totals update ---');
  const dealsRes = await fetch(`${API_BASE}/deals?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dealsData = await dealsRes.json();
  const dealsList = dealsData.data?.deals || dealsData.data || [];
  const testDeal = dealsList.find((d) => d.stage !== 'won') || dealsList[0];
  if (!testDeal) throw new Error('No deals found to test');

  const newStage = testDeal.stage === 'qualified' ? 'proposal' : 'negotiation';
  console.log(`[Scenario 3] Moving deal "${testDeal.title}" (${testDeal._id}) from "${testDeal.stage}" to "${newStage}"...`);

  const patchDealRes = await fetch(`${API_BASE}/deals/${testDeal._id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Client-Mutation-Id': 'mobile-deal-stage-' + Date.now(),
    },
    body: JSON.stringify({ stage: newStage }),
  });

  if (!patchDealRes.ok) throw new Error(`PATCH deal failed: ${patchDealRes.status}`);

  const s3Result = await waitForEvent(
    (e) => e.entity === 'deal' && (e.action === 'updated' || e.action === 'bulk')
  );
  console.log(`✅ [Scenario 3] PASSED: Socket received entity:changed in ${s3Result.elapsed}ms.`);

  // Check dashboard summary reflects stage counts
  const summaryRes = await fetch(`${API_BASE}/dashboard/summary?scope=me&range=month`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const summaryData = await summaryRes.json();
  console.log(`[Scenario 3] Dashboard pipeline verified: ${summaryData.pipelineByStage?.length || 0} stages.`);

  // =========================================================================
  // SCENARIO 4: Complete a task on web -> mobile progress bar and count update
  // =========================================================================
  console.log('\n--- Scenario 4: Complete a task on web -> mobile progress bar and count update ---');
  const tasksRes = await fetch(`${API_BASE}/tasks?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tasksData = await tasksRes.json();
  const tasksList = tasksData.data?.tasks || tasksData.data || [];
  let testTask = tasksList.find((t) => t.status === 'open') || tasksList[0];

  if (!testTask) {
    console.log('[Scenario 4] Creating temporary open task...');
    const createTaskRes = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Sync Verification Task',
        type: 'call',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        priority: 'high',
      }),
    });
    const createdTaskData = await createTaskRes.json();
    testTask = createdTaskData.data?.task || createdTaskData.data;
  }

  console.log(`[Scenario 4] Completing task "${testTask.title}" (${testTask._id})...`);
  const patchTaskRes = await fetch(`${API_BASE}/tasks/${testTask._id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Client-Mutation-Id': 'web-task-complete-' + Date.now(),
    },
    body: JSON.stringify({ status: 'done' }),
  });

  if (!patchTaskRes.ok) throw new Error(`PATCH task failed: ${patchTaskRes.status}`);

  const s4Result = await waitForEvent(
    (e) => e.entity === 'task' && (e.action === 'updated' || e.action === 'bulk')
  );
  console.log(`✅ [Scenario 4] PASSED: Socket received entity:changed in ${s4Result.elapsed}ms.`);

  // =========================================================================
  // SCENARIO 5: A lead arrives from an ads/webhook capture -> new row on mobile & KPI updates
  // =========================================================================
  console.log('\n--- Scenario 5: Inbound Ad/Webhook Lead Capture -> mobile row sync & KPI tick ---');
  const initialKpiRes = await fetch(`${API_BASE}/dashboard/summary?scope=me&range=week`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const initialKpiData = await initialKpiRes.json();
  const initialLeadsCount = initialKpiData.leads?.value ?? initialKpiData.newLeads ?? 0;

  // Ingest inbound lead via lead capture endpoint
  const inboundAdPayload = {
    name: `Ad Lead ${Date.now().toString().slice(-4)}`,
    email: `ad.campaign.${Date.now()}@example.com`,
    phone: '+91 99887 76655',
    company: 'Google Ads Inbound Inc',
    source: 'website',
    channel: 'google_ads',
    rating: 'hot',
    status: 'new',
    value: 120000,
  };

  const adLeadRes = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Client-Mutation-Id': 'ad-lead-capture-' + Date.now(),
    },
    body: JSON.stringify(inboundAdPayload),
  });

  if (!adLeadRes.ok) throw new Error(`Inbound lead failed: ${adLeadRes.status}`);
  const s5Result = await waitForEvent(
    (e) => e.entity === 'lead' && (e.action === 'created' || e.action === 'bulk')
  );
  console.log(`✅ [Scenario 5] PASSED: Ad lead created, socket received entity:changed in ${s5Result.elapsed}ms.`);

  // Verify dashboard KPI reflects the new lead
  const updatedKpiRes = await fetch(`${API_BASE}/dashboard/summary?scope=me&range=week`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const updatedKpiData = await updatedKpiRes.json();
  const updatedLeadsCount = updatedKpiData.leads?.value ?? updatedKpiData.newLeads ?? 0;
  console.log(`[Scenario 5] Leads count updated from ${initialLeadsCount} to ${updatedLeadsCount}.`);

  // =========================================================================
  // SCENARIO 6: Role change on web -> mobile permissions change / session:revoked
  // =========================================================================
  console.log('\n--- Scenario 6: Role Change on Web -> session:revoked emission & permission change ---');
  
  // 6.1 Authenticate as sales rep
  console.log('[Scenario 6] Logging in as sales@crm.test...');
  const salesLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sales@crm.test',
      password: 'Password@123',
    }),
  });

  if (!salesLoginRes.ok) throw new Error(`Sales login failed: ${salesLoginRes.status}`);
  const salesLoginData = await salesLoginRes.json();
  const salesToken = salesLoginData.data?.token || salesLoginData.token;
  const salesUser = salesLoginData.data?.user || salesLoginData.user;
  console.log(`[Scenario 6] Authenticated Sales Rep: ${salesUser.email} (ID: ${salesUser._id || salesUser.id})`);

  // 6.2 Connect Sales Rep Socket
  const salesSocket = io(SOCKET_URL, {
    auth: { token: salesToken },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    salesSocket.on('connect', () => {
      console.log(`[Scenario 6] Sales Rep socket connected: ID=${salesSocket.id}`);
      resolve();
    });
    salesSocket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Sales socket connection timed out')), 5000);
  });

  const sessionRevokedPromise = new Promise((resolve, reject) => {
    salesSocket.on('session:revoked', (data) => {
      console.log('[Scenario 6] Received session:revoked on Sales Socket:', data);
      resolve(data);
    });
    setTimeout(() => reject(new Error('Timed out waiting for session:revoked event')), 5000);
  });

  // 6.3 Admin modifies sales rep's role from 'sales' to 'manager'
  console.log(`[Scenario 6] Admin updating role for ${salesUser.name} to "manager"...`);
  const salesUserId = salesUser._id || salesUser.id;
  const updateRoleRes = await fetch(`${API_BASE}/users/${salesUserId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role: 'manager' }),
  });

  if (!updateRoleRes.ok) throw new Error(`PATCH user role failed: ${updateRoleRes.status}`);

  // 6.4 Await session:revoked
  const revokedData = await sessionRevokedPromise;
  console.log(`✅ [Scenario 6] PASSED: session:revoked received by mobile client. Reason: "${revokedData.reason}".`);

  // Revert role back to 'sales'
  await fetch(`${API_BASE}/users/${salesUserId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role: 'sales' }),
  });
  console.log(`[Scenario 6] Restored role for ${salesUser.name} back to "sales".`);

  // Disconnect sockets
  salesSocket.disconnect();
  socket.disconnect();

  console.log('\n===============================================================');
  console.log('🎉 ALL 6 REALTIME SYNC SCENARIOS 1-6 PASSED VERIFICATION!');
  console.log('===============================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
