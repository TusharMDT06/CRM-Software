import assert from 'node:assert';
import { eventBus } from './eventBus.js';
import { evaluateCondition } from './workflowEngine.js';
import { IWorkflowCondition } from '../models/Workflow.js';

console.log('Running Workflow Engine & Loop Guard Tests...\n');

let passedCount = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

// 1. EventBus Depth Guard Tests
test('Loop Guard: Emits event successfully when depth is <= 3', () => {
  let received = false;
  const listener = () => { received = true; };
  eventBus.once('test_depth_ok', listener);

  const emitted = eventBus.emitDomainEvent('test_depth_ok', { depth: 2, test: true });
  assert.strictEqual(emitted, true, 'Event with depth 2 should emit');
  assert.strictEqual(received, true, 'Listener should have received event');
});

test('Loop Guard: Drops event when depth > 3', () => {
  let received = false;
  const listener = () => { received = true; };
  eventBus.once('test_depth_overflow', listener);

  const emitted = eventBus.emitDomainEvent('test_depth_overflow', { depth: 4, test: true });
  assert.strictEqual(emitted, false, 'Event with depth 4 should be dropped');
  assert.strictEqual(received, false, 'Listener must NOT receive event when depth > 3');
});

test('Loop Guard: Defaults depth to 0 when omitted', () => {
  let receivedPayload: any = null;
  const listener = (p: any) => { receivedPayload = p; };
  eventBus.once('test_depth_default', listener);

  const emitted = eventBus.emitDomainEvent('test_depth_default', { test: true });
  assert.strictEqual(emitted, true);
  assert.strictEqual(receivedPayload.depth, 0, 'Depth should default to 0');
});

// 2. Condition Evaluation Tests
test('Condition: equals operator (numeric)', () => {
  const cond: IWorkflowCondition = { field: 'deal.value', operator: 'equals', value: 500000 };
  assert.strictEqual(evaluateCondition({ deal: { value: 500000 } }, cond), true);
  assert.strictEqual(evaluateCondition({ value: 500000 }, cond), true);
  assert.strictEqual(evaluateCondition({ value: 400000 }, cond), false);
});

test('Condition: greater_than operator', () => {
  const cond: IWorkflowCondition = { field: 'amount', operator: 'greater_than', value: 1000000 };
  assert.strictEqual(evaluateCondition({ amount: 1500000 }, cond), true);
  assert.strictEqual(evaluateCondition({ amount: 1000000 }, cond), false);
  assert.strictEqual(evaluateCondition({ amount: 500000 }, cond), false);
});

test('Condition: less_than operator', () => {
  const cond: IWorkflowCondition = { field: 'probability', operator: 'less_than', value: 50 };
  assert.strictEqual(evaluateCondition({ probability: 30 }, cond), true);
  assert.strictEqual(evaluateCondition({ probability: 50 }, cond), false);
  assert.strictEqual(evaluateCondition({ probability: 80 }, cond), false);
});

test('Condition: contains operator (case insensitive)', () => {
  const cond: IWorkflowCondition = { field: 'lead.source', operator: 'contains', value: 'web' };
  assert.strictEqual(evaluateCondition({ lead: { source: 'Website Inquiry' } }, cond), true);
  assert.strictEqual(evaluateCondition({ source: 'WEB_FORM' }, cond), true);
  assert.strictEqual(evaluateCondition({ source: 'Referral' }, cond), false);
});

test('Condition: not_equals operator', () => {
  const cond: IWorkflowCondition = { field: 'stage', operator: 'not_equals', value: 'won' };
  assert.strictEqual(evaluateCondition({ stage: 'lead' }, cond), true);
  assert.strictEqual(evaluateCondition({ stage: 'won' }, cond), false);
});

test('Condition: is_empty operator', () => {
  const cond: IWorkflowCondition = { field: 'description', operator: 'is_empty' };
  assert.strictEqual(evaluateCondition({ description: '' }, cond), true);
  assert.strictEqual(evaluateCondition({ description: null }, cond), true);
  assert.strictEqual(evaluateCondition({}, cond), true);
  assert.strictEqual(evaluateCondition({ description: 'Hello world' }, cond), false);
});

console.log(`\nAll ${passedCount} tests passed successfully!`);
