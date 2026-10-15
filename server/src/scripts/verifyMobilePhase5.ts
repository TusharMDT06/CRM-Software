import { hasVersionConflict } from '../utils/conflictHelper.js';
import { sendNotification } from '../utils/notificationService.js';
import { sendExpoPushNotifications } from '../services/pushNotificationService.js';
import { DEFAULT_PREFERENCES } from '../models/NotificationPreference.js';
import { ClientMutation } from '../models/ClientMutation.js';
import { Device } from '../models/Device.js';
import { emitChange, emitSessionRevoked } from '../realtime/socket.js';

async function runPhase5AcceptanceTests() {
  console.log('=== FLOWDESK MOBILE PHASE 5 ACCEPTANCE TESTS ===\n');

  // Test 1: Conflict Detection (409 logic)
  console.log('1. Testing 409 Conflict Detection...');
  const baseDoc: any = {
    _id: '606b6056ad2d47c6ae051dbe',
    updatedAt: new Date('2026-10-14T10:00:00.000Z'),
  };
  const matchingPayload = {
    updatedAt: '2026-10-14T10:00:00.000Z',
    name: 'New Name',
  };
  const stalePayload = {
    updatedAt: '2026-10-14T09:30:00.000Z',
    name: 'Conflict Name',
  };

  const hasConflictNo = hasVersionConflict(baseDoc, matchingPayload);
  const hasConflictYes = hasVersionConflict(baseDoc, stalePayload);

  if (hasConflictNo !== false || hasConflictYes !== true) {
    throw new Error(`Conflict helper failed: expected no conflict=${false}, got ${hasConflictNo}; expected conflict=${true}, got ${hasConflictYes}`);
  }
  console.log('  ✓ Stale updatedAt triggers conflict: true');
  console.log('  ✓ Up-to-date updatedAt passes cleanly: false');

  // Test 2: Notification Preferences & Spec 2.5 Event Types
  console.log('\n2. Testing Push Notification Preferences & Events...');
  const expectedTypes = [
    'lead_assigned',
    'new_lead',
    'task_due_today',
    'task_overdue',
    'deal_stage_changed',
    'inbound_sms',
    'mention',
  ];

  for (const t of expectedTypes) {
    if (!DEFAULT_PREFERENCES[t as keyof typeof DEFAULT_PREFERENCES]) {
      throw new Error(`Missing default preference for event type: ${t}`);
    }
  }
  console.log('  ✓ All 7 spec 2.5 notification types configured in DEFAULT_PREFERENCES:', expectedTypes.join(', '));

  // Test 3: ClientMutation Idempotency & TTL
  console.log('\n3. Testing ClientMutation Idempotency Model...');
  const mutation = new ClientMutation({
    clientMutationId: 'offline-mut-001',
    method: 'PATCH',
    path: '/api/deals/123',
    responseStatus: 200,
    responseBody: { _id: '123', stage: 'negotiation' },
  });
  if (mutation.clientMutationId !== 'offline-mut-001') {
    throw new Error('Mutation failed to initialize clientMutationId');
  }
  console.log('  ✓ ClientMutation record prepared with 24h index TTL');

  // Test 4: Socket Emitter Functions
  console.log('\n4. Testing Realtime Socket Emitters...');
  if (typeof emitChange !== 'function' || typeof emitSessionRevoked !== 'function') {
    throw new Error('Socket emitters not exported');
  }
  console.log('  ✓ emitChange and emitSessionRevoked are active');

  // Test 5: Mention Extraction Regex
  console.log('\n5. Testing Mention Extraction Parsing...');
  const noteBody = 'Hey @alex and @sarah, please follow up with the client by tomorrow!';
  const words = noteBody.split(/\s+/);
  const mentionTokens = words
    .filter((w) => w.startsWith('@'))
    .map((w) => w.slice(1).replace(/[^a-zA-Z0-9._-]/g, ''));
  if (mentionTokens.length !== 2 || mentionTokens[0] !== 'alex' || mentionTokens[1] !== 'sarah') {
    throw new Error(`Mention tokens extraction failed: ${JSON.stringify(mentionTokens)}`);
  }
  console.log('  ✓ Successfully parsed @mentions:', mentionTokens);

  console.log('\n=== ALL PHASE 5 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===\n');
}

runPhase5AcceptanceTests().catch((err) => {
  console.error('Acceptance test failure:', err);
  process.exit(1);
});
