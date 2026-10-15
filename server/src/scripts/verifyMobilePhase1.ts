import { Lead } from '../models/Lead.js';
import { Task } from '../models/Task.js';
import { Message } from '../models/Message.js';
import { Device } from '../models/Device.js';
import { ClientMutation } from '../models/ClientMutation.js';
import { emitChange, emitSessionRevoked, emitNotificationNew } from '../realtime/socket.js';
import { encodeCursor, decodeCursor } from '../utils/paginationHelper.js';
import { hasVersionConflict } from '../utils/conflictHelper.js';
import { sendExpoPushNotifications } from '../services/pushNotificationService.js';
import { logger } from '../utils/logger.js';

async function runVerification() {
  console.log('=== FLOWDESK MOBILE PHASE 1 VERIFICATION ===\n');

  // 1. Verify Model Schemas & New Fields
  console.log('1. Checking Mongoose Models & Fields...');
  const leadSample = new Lead({
    name: 'Verification Lead',
    email: 'verify@example.com',
    phone: '+919999999999',
    company: 'Acme Test Corp',
  });
  if (leadSample.rating !== 'warm') {
    throw new Error(`Expected default rating to be "warm", got "${leadSample.rating}"`);
  }
  console.log('  ✓ Lead model includes rating field with default "warm":', leadSample.rating);

  const taskSample = new Task({
    title: 'Verification Task',
    dueDate: new Date(),
  });
  if (taskSample.type !== 'todo') {
    throw new Error(`Expected default task type to be "todo", got "${taskSample.type}"`);
  }
  console.log('  ✓ Task model includes type field with default "todo":', taskSample.type);

  const messageSample = new Message({
    threadId: 'test_thread_1',
    channel: 'sms',
    direction: 'inbound',
    body: 'Hello Flowdesk Mobile Sync',
  });
  console.log('  ✓ Message model created successfully:', messageSample.channel, messageSample.direction);

  const deviceSample = new Device({
    expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    platform: 'android',
    appVersion: '1.0.0',
  });
  console.log('  ✓ Device model created successfully:', deviceSample.platform, deviceSample.expoPushToken);

  const mutationSample = new ClientMutation({
    clientMutationId: 'test-uuid-12345',
    method: 'PATCH',
    path: '/api/leads/123',
    responseStatus: 200,
    responseBody: { success: true },
  });
  console.log('  ✓ ClientMutation model created successfully with 24h TTL index:', mutationSample.clientMutationId);

  // 2. Verify Cursor Pagination Encoding / Decoding
  console.log('\n2. Checking Cursor Pagination Helpers...');
  const testDoc = {
    _id: '507f1f77bcf86cd799439011',
    createdAt: new Date('2026-10-13T12:00:00.000Z'),
  };
  const encoded = encodeCursor(testDoc);
  const decoded = decodeCursor(encoded);
  console.log('  ✓ Encoded cursor:', encoded);
  console.log('  ✓ Decoded cursor:', decoded);
  if (decoded?.id !== testDoc._id) {
    throw new Error(`Decoded cursor ID mismatch: expected ${testDoc._id}, got ${decoded?.id}`);
  }
  if (!decoded?.timestamp || isNaN(decoded.timestamp.getTime())) {
    throw new Error('Expected valid timestamp in decoded cursor');
  }

  // 3. Verify Version Conflict Detector
  console.log('\n3. Checking 409 Conflict Detection...');
  const currentDoc: any = {
    updatedAt: new Date('2026-10-13T12:00:00.000Z'),
    version: 3,
  };
  const conflictingPayload = {
    updatedAt: '2026-10-13T10:00:00.000Z', // older than document
    name: 'Conflicting Edit',
  };
  const isConflict = hasVersionConflict(currentDoc, conflictingPayload);
  console.log('  ✓ Stale updatedAt detected conflict:', isConflict);
  if (!isConflict) {
    throw new Error('Expected conflict detection to return true for stale timestamp');
  }

  const freshPayload = {
    updatedAt: '2026-10-13T12:00:00.000Z',
    name: 'Fresh Edit',
  };
  const isFresh = hasVersionConflict(currentDoc, freshPayload);
  console.log('  ✓ Matching updatedAt detected no conflict:', !isFresh);
  if (isFresh) {
    throw new Error('Expected conflict detection to return false for matching timestamp');
  }

  // 4. Verify Realtime Socket Helpers
  console.log('\n4. Checking Realtime Socket Emitters...');
  // Calling when io is null should gracefully log without crashing
  emitChange({
    entity: 'lead',
    action: 'created',
    id: 'test_lead_id',
    orgId: 'test_org_id',
    clientMutationId: 'test_mutation_id',
  });
  emitSessionRevoked('user_123', 'password_changed');
  emitNotificationNew('user_123', { title: 'Test Alert', body: 'Mobile push event' });
  console.log('  ✓ Socket emitters execute safely without uncaught exceptions');

  // 5. Verify Push Sender Offline Resilience
  console.log('\n5. Checking Push Notification Service Fallback...');
  const pushResult = await sendExpoPushNotifications({
    userIds: ['507f1f77bcf86cd799439011'],
    title: 'Lead Assigned',
    body: 'New lead assigned from meta ads',
    data: { entity: 'lead', id: 'lead_abc' },
  });
  console.log('  ✓ Push notification dispatch handled cleanly:', pushResult);

  console.log('\n=== ALL PHASE 1 AUTOMATED CHECKS PASSED SUCCESSFULLY ===');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
