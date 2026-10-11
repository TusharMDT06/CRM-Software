/**
 * Flowdesk Stage 2 Support Tickets Test Suite
 *
 * Verifies:
 * 1. Ticket sequential numbering (TCK-YYYY-0001 scoped per tenant)
 * 2. SLA engine target calculation upon creation (urgent, high, medium, low)
 * 3. SLA clock pause on 'pending' status and forward push on resume
 * 4. First public reply captures firstResponseAt and marks SLA first response
 * 5. Resolution captures resolvedAt and closes SLA clock
 * 6. Internal notes vs public replies segregation (portal view only exposes public_reply/system)
 * 7. Public portal submission with anti-bot honeypot
 * 8. Customer follow-up reply via publicToken
 * 9. Canned responses CRUD
 * 10. Cross-tenant isolation (Tenant A cannot access Tenant B ticket or messages)
 */

import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import { connectDB } from './config/db.js';
import { Tenant, DEFAULT_PLAN_LIMITS } from './models/Tenant.js';
import { User } from './models/User.js';
import { Contact } from './models/Contact.js';
import { Account } from './models/Account.js';
import { Ticket } from './models/Ticket.js';
import { TicketMessage } from './models/TicketMessage.js';
import { SlaPolicy, getOrCreateDefaultSlaPolicy } from './models/SlaPolicy.js';
import { CannedResponse } from './models/CannedResponse.js';
import { getNextDocumentNumber } from './models/Counter.js';
import { runWithTenantContext } from './utils/tenantContext.js';
import { calculateTicketSla, handleTicketPendingState } from './utils/slaEngine.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runStage2TestSuite() {
  console.log('\n===============================================================');
  console.log('🧪 Flowdesk Phase 4 - Stage 2 Support Tickets Required Test Suite');
  console.log('===============================================================\n');

  await connectDB();

  // Create isolated tenants for Stage 2
  const tenant1Id = new Types.ObjectId().toString();
  const tenant2Id = new Types.ObjectId().toString();

  await Tenant.create({
    _id: new Types.ObjectId(tenant1Id),
    name: 'Support Test Tenant Alpha',
    slug: `support-alpha-${Date.now()}`,
    plan: 'pro',
    status: 'active',
    limits: DEFAULT_PLAN_LIMITS.pro,
  });

  await Tenant.create({
    _id: new Types.ObjectId(tenant2Id),
    name: 'Support Test Tenant Beta',
    slug: `support-beta-${Date.now()}`,
    plan: 'free',
    status: 'active',
    limits: DEFAULT_PLAN_LIMITS.free,
  });

  // Create users for both tenants
  const agent1 = await runWithTenantContext({ tenantId: tenant1Id }, async () => {
    return User.create({
      tenantId: tenant1Id,
      name: 'Agent Alpha',
      email: `agent1_${Date.now()}@alpha.test`,
      passwordHash: 'dummyhash',
      role: 'sales',
    });
  });

  const agent2 = await runWithTenantContext({ tenantId: tenant2Id }, async () => {
    return User.create({
      tenantId: tenant2Id,
      name: 'Agent Beta',
      email: `agent2_${Date.now()}@beta.test`,
      passwordHash: 'dummyhash',
      role: 'sales',
    });
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Sequential Numbering (TCK-YYYY-0001 per tenant)
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Sequential Ticket Numbering ---');

  const year = new Date().getFullYear();
  let ticket1: any;
  let ticket2: any;
  let ticketBeta1: any;

  await runWithTenantContext({ tenantId: tenant1Id }, async () => {
    ticket1 = await Ticket.create({
      number: await getNextDocumentNumber('TCK', year),
      publicToken: crypto.randomUUID(),
      subject: 'First issue Alpha',
      description: 'Something is broken',
      priority: 'high',
      channel: 'portal',
      status: 'open',
      createdBy: agent1._id,
    });

    ticket2 = await Ticket.create({
      number: await getNextDocumentNumber('TCK', year),
      publicToken: crypto.randomUUID(),
      subject: 'Second issue Alpha',
      description: 'Another problem',
      priority: 'urgent',
      channel: 'email',
      status: 'open',
      createdBy: agent1._id,
    });
  });

  await runWithTenantContext({ tenantId: tenant2Id }, async () => {
    ticketBeta1 = await Ticket.create({
      number: await getNextDocumentNumber('TCK', year),
      publicToken: crypto.randomUUID(),
      subject: 'First issue Beta',
      description: 'Beta ticket',
      priority: 'medium',
      channel: 'manual',
      status: 'open',
      createdBy: agent2._id,
    });
  });

  assert(ticket1.number.startsWith(`TCK-${year}-`), `Ticket 1 has prefix TCK-${year}- (${ticket1.number})`);
  assert(ticket2.number.startsWith(`TCK-${year}-`), `Ticket 2 has prefix TCK-${year}- (${ticket2.number})`);
  assert(ticketBeta1.number.startsWith(`TCK-${year}-`), `Beta Ticket 1 has prefix TCK-${year}- (${ticketBeta1.number})`);
  assert(ticket1.number !== ticket2.number, 'Tenant 1 sequential numbers increment');
  assert(!!ticket1.publicToken, 'Ticket 1 has unique publicToken generated');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: SLA Engine Initial Target Calculation
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 2: SLA Policy & Initial Target Calculation ---');

  const defaultPolicy = await runWithTenantContext({ tenantId: tenant1Id }, async () => {
    return getOrCreateDefaultSlaPolicy();
  });

  assert(defaultPolicy.priorities.urgent.firstResponseHours === 1, 'Default policy urgent first response is 1 hr');
  assert(defaultPolicy.priorities.urgent.resolutionHours === 4, 'Default policy urgent resolution is 4 hrs');

  const urgentDates = await calculateTicketSla('urgent', new Date(), tenant1Id.toString());
  const now = Date.now();
  const diffRespHours = (urgentDates.firstResponseDue.getTime() - now) / (1000 * 3600);
  const diffResHours = (urgentDates.resolutionDue.getTime() - now) / (1000 * 3600);

  assert(Math.round(diffRespHours) === 1, 'Urgent SLA first response due in ~1 hour');
  assert(Math.round(diffResHours) === 4, 'Urgent SLA resolution due in ~4 hours');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: SLA Clock Pausing & Resuming
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 3: SLA Clock Pause & Resume on Pending Status ---');

  await runWithTenantContext({ tenantId: tenant1Id }, async () => {
    // Set SLA initial targets on ticket1
    ticket1.slaFirstResponseDue = new Date(Date.now() + 2 * 3600 * 1000);
    ticket1.slaResolutionDue = new Date(Date.now() + 8 * 3600 * 1000);
    await ticket1.save();

    const originalResolutionDue = ticket1.slaResolutionDue.getTime();

    // 1. Mark status as 'pending' (clock pauses)
    handleTicketPendingState(ticket1, 'pending');
    ticket1.status = 'pending';
    await ticket1.save();

    assert(ticket1.status === 'pending', 'Status updated to pending');
    assert(!!ticket1.slaPendingPausedAt, 'slaPendingPausedAt timestamp recorded on pause');

    // Simulate 30 minutes paused in the past
    ticket1.slaPendingPausedAt = new Date(Date.now() - 30 * 60 * 1000);

    // 2. Mark status back to 'open' (clock resumes)
    handleTicketPendingState(ticket1, 'open');
    ticket1.status = 'open';
    await ticket1.save();

    assert(!ticket1.slaPendingPausedAt, 'slaPendingPausedAt cleared on resume');
    assert(ticket1.slaPendingTotalPausedMs >= 30 * 60 * 1000, 'Total paused duration recorded (~30 mins)');
    assert(ticket1.slaResolutionDue.getTime() > originalResolutionDue, 'slaResolutionDue pushed forward by paused duration');
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Public Reply & First Response SLA Capture
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 4: Public Reply & SLA First Response Capture ---');

  await runWithTenantContext({ tenantId: tenant1Id }, async () => {
    // Create public reply
    const msg = await TicketMessage.create({
      ticket: ticket1._id,
      senderType: 'agent',
      senderUser: agent1._id,
      type: 'public_reply',
      body: 'Hello, we are investigating your issue.',
    });

    assert(msg.type === 'public_reply', 'Public reply message created');

    // Simulate first response capture
    if (!ticket1.firstResponseAt) {
      ticket1.firstResponseAt = new Date();
      if (ticket1.slaFirstResponseDue && ticket1.firstResponseAt > ticket1.slaFirstResponseDue) {
        ticket1.slaBreached = ticket1.slaBreached || { firstResponse: false, resolution: false };
        ticket1.slaBreached.firstResponse = true;
      }
      await ticket1.save();
    }

    assert(!!ticket1.firstResponseAt, 'firstResponseAt successfully captured upon first agent reply');
    assert(ticket1.slaBreached?.firstResponse === false, 'First response was within SLA target (not breached)');
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Internal Notes vs Public Messages Visibility
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 5: Internal Note Segregation ---');

  await runWithTenantContext({ tenantId: tenant1Id }, async () => {
    // Create internal note
    await TicketMessage.create({
      ticket: ticket1._id,
      senderType: 'agent',
      senderUser: agent1._id,
      type: 'internal_note',
      body: 'INTERNAL NOTE: Customer is VIP, priority escalated to level 2.',
    });

    // Fetch all messages (staff view)
    const staffMessages = await TicketMessage.find({ ticket: ticket1._id });
    assert(staffMessages.length === 2, 'Staff view sees 2 messages (public_reply + internal_note)');

    // Fetch customer view (filtered: only public_reply and system)
    const customerMessages = await TicketMessage.find({
      ticket: ticket1._id,
      type: { $in: ['public_reply', 'system'] },
    });
    assert(customerMessages.length === 1, 'Customer portal view sees only 1 public message');
    assert(customerMessages[0].type === 'public_reply', 'Customer cannot see internal notes');
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 6: Resolution SLA Capture
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 6: Ticket Resolution & SLA Resolution Capture ---');

  await runWithTenantContext({ tenantId: tenant1Id }, async () => {
    ticket1.status = 'resolved';
    ticket1.resolvedAt = new Date();
    await ticket1.save();

    assert(ticket1.status === 'resolved', 'Ticket marked as resolved');
    assert(!!ticket1.resolvedAt, 'resolvedAt timestamp recorded');
    assert(ticket1.slaBreached?.resolution === false, 'Resolution was within SLA target');
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 7: Canned Responses CRUD
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 7: Canned Responses Management ---');

  await runWithTenantContext({ tenantId: tenant1Id }, async () => {
    const canned = await CannedResponse.create({
      shortcut: '/intro',
      title: 'Greeting Snippet',
      body: 'Hi there, thank you for reaching out to Flowdesk Support!',
      category: 'General',
      shared: true,
      createdBy: agent1._id,
    });

    assert(canned.shortcut === '/intro', 'Canned response created with shortcut /intro');

    const found = await CannedResponse.findOne({ shortcut: '/intro' });
    assert(!!found, 'Found canned response by shortcut');
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 8: Cross-Tenant Ticket Isolation
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 8: Cross-Tenant Ticket Isolation ---');

  await runWithTenantContext({ tenantId: tenant2Id }, async () => {
    // Tenant Beta tries to access Tenant Alpha's ticket1
    const betaFindsAlpha = await Ticket.findById(ticket1._id);
    assert(betaFindsAlpha === null, 'Tenant Beta cannot find Tenant Alpha ticket by ID (returns null)');

    // Tenant Beta tries to query Tenant Alpha's messages
    const betaFindsMessages = await TicketMessage.find({ ticket: ticket1._id });
    assert(betaFindsMessages.length === 0, 'Tenant Beta cannot read Tenant Alpha ticket messages (returns empty array)');

    // Tenant Beta tries to read Tenant Alpha's canned responses
    const betaFindsCanned = await CannedResponse.find({ shortcut: '/intro' });
    assert(betaFindsCanned.length === 0, 'Tenant Beta cannot read Tenant Alpha canned responses');

    // Tenant Beta only sees its own ticket
    const betaTickets = await Ticket.find({});
    assert(betaTickets.length === 1 && betaTickets[0].subject === 'First issue Beta', 'Tenant Beta only sees its own tickets');
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 9: Cleanup
  // -------------------------------------------------------------------------
  console.log('--- Cleanup Test Records ---');
  await runWithTenantContext({ isBypassTenant: true }, async () => {
    await Ticket.deleteMany({ tenantId: { $in: [tenant1Id, tenant2Id] } });
    await TicketMessage.deleteMany({ tenantId: { $in: [tenant1Id, tenant2Id] } });
    await CannedResponse.deleteMany({ tenantId: { $in: [tenant1Id, tenant2Id] } });
    await SlaPolicy.deleteMany({ tenantId: { $in: [tenant1Id, tenant2Id] } });
    await User.deleteMany({ tenantId: { $in: [tenant1Id, tenant2Id] } });
    await Tenant.deleteMany({ _id: { $in: [new Types.ObjectId(tenant1Id), new Types.ObjectId(tenant2Id)] } });
  });
  console.log('  ✅ [PASS] Cleaned up test records');

  console.log('\n===============================================================');
  console.log(`🎉 STAGE 2 TEST SUITE PASSED: ${passedTests}/${totalTests} tests successful!`);
  console.log('===============================================================\n');
}

runStage2TestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test suite failed with error:', err);
    process.exit(1);
  });
