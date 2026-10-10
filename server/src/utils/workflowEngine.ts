import { Types } from 'mongoose';
import { Resend } from 'resend';
import {
  Workflow,
  IWorkflow,
  IWorkflowCondition,
  IWorkflowAction,
  WorkflowTriggerType,
} from '../models/Workflow.js';
import { WorkflowRun } from '../models/WorkflowRun.js';
import { Lead } from '../models/Lead.js';
import { Deal } from '../models/Deal.js';
import { Task } from '../models/Task.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { EmailTemplate } from '../models/EmailTemplate.js';
import { User } from '../models/User.js';
import { eventBus, DomainEventPayload } from './eventBus.js';
import { sendNotification, notifyAdmins, notifyManagersAndAdmins } from './notificationService.js';
import { logActivity } from './activityHelper.js';
import { resolveMergeFields, MergeContext } from './mergeFields.js';

// In-memory rate limiting and cooldown trackers
// 1. Record cooldown: `${workflowId}:${entityType}:${entityId}` -> timestamp
const recordCooldownMap = new Map<string, number>();

// 2. Rolling 60s run history: workflowId -> timestamps[]
const runHistoryMap = new Map<string, number[]>();

export function clearWorkflowTracking(): void {
  recordCooldownMap.clear();
  runHistoryMap.clear();
}

/**
 * Extract field value from record supporting dotted prefixes (e.g. 'deal.amount' or 'amount')
 */
function extractFieldValue(record: any, fieldPath: string): any {
  if (!record) return undefined;
  if (record[fieldPath] !== undefined) return record[fieldPath];

  // Try stripping common entity prefix e.g. 'deal.amount' -> 'amount'
  const parts = fieldPath.split('.');
  if (parts.length === 2 && record[parts[1]] !== undefined) {
    return record[parts[1]];
  }

  // Nested property navigation
  let current = record;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Evaluates a single condition against the target record
 */
export function evaluateCondition(record: any, cond: IWorkflowCondition): boolean {
  const actualValue = extractFieldValue(record, cond.field);
  const targetValue = cond.value;

  switch (cond.operator) {
    case 'is_empty':
      return (
        actualValue === undefined ||
        actualValue === null ||
        actualValue === '' ||
        (Array.isArray(actualValue) && actualValue.length === 0)
      );

    case 'equals': {
      if (typeof actualValue === 'number' && typeof targetValue === 'number') {
        return actualValue === targetValue;
      }
      if (typeof actualValue === 'boolean') {
        return actualValue === Boolean(targetValue);
      }
      return String(actualValue ?? '').trim().toLowerCase() === String(targetValue ?? '').trim().toLowerCase();
    }

    case 'not_equals': {
      if (typeof actualValue === 'number' && typeof targetValue === 'number') {
        return actualValue !== targetValue;
      }
      return String(actualValue ?? '').trim().toLowerCase() !== String(targetValue ?? '').trim().toLowerCase();
    }

    case 'greater_than': {
      const numAct = Number(actualValue);
      const numTarget = Number(targetValue);
      return !isNaN(numAct) && !isNaN(numTarget) && numAct > numTarget;
    }

    case 'less_than': {
      const numAct = Number(actualValue);
      const numTarget = Number(targetValue);
      return !isNaN(numAct) && !isNaN(numTarget) && numAct < numTarget;
    }

    case 'contains': {
      const strAct = String(actualValue ?? '').toLowerCase();
      const strTarget = String(targetValue ?? '').toLowerCase();
      return strAct.includes(strTarget);
    }

    default:
      return true;
  }
}

/**
 * Dry-run test against a single record
 */
export async function dryRunWorkflow(
  workflowId: string,
  entityType: string,
  entityId: string
): Promise<{
  matched: boolean;
  conditionResults: { field: string; operator: string; expected: any; actual: any; passed: boolean }[];
  plannedActions: { type: string; config: any }[];
}> {
  const workflow = await Workflow.findById(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const record = await fetchEntityRecord(entityType, entityId);
  if (!record) {
    throw new Error(`Record ${entityType}:${entityId} not found`);
  }

  const conditionResults = (workflow.conditions || []).map((cond) => {
    const actual = extractFieldValue(record, cond.field);
    const passed = evaluateCondition(record, cond);
    return {
      field: cond.field,
      operator: cond.operator,
      expected: cond.value,
      actual,
      passed,
    };
  });

  const matched = conditionResults.every((c) => c.passed);

  return {
    matched,
    conditionResults,
    plannedActions: matched ? workflow.actions : [],
  };
}

/**
 * Fetch entity document by type and id
 */
async function fetchEntityRecord(type: string, id: string): Promise<any> {
  switch (type.toLowerCase()) {
    case 'lead':
      return await Lead.findById(id).populate('owner').lean();
    case 'deal':
      return await Deal.findById(id).populate('owner').populate('account').populate('contact').lean();
    case 'task':
      return await Task.findById(id).populate('assignedTo').lean();
    case 'contact':
      return await Contact.findById(id).populate('owner').populate('account').lean();
    case 'account':
      return await Account.findById(id).populate('owner').lean();
    default:
      return null;
  }
}

/**
 * Execute a single workflow against an event
 */
async function executeWorkflow(
  workflow: IWorkflow,
  entityType: string,
  entityId: string,
  record: any,
  depth: number
): Promise<void> {
  const workflowIdStr = workflow._id.toString();
  const now = Date.now();

  // 1. Loop Guard: Deduplicate triggering same record within 60s
  const cooldownKey = `${workflowIdStr}:${entityType}:${entityId}`;
  const lastTriggered = recordCooldownMap.get(cooldownKey) || 0;
  if (now - lastTriggered < 60_000) {
    await WorkflowRun.create({
      workflow: workflow._id,
      triggerEntity: { type: entityType, id: entityId },
      status: 'skipped',
      steps: [
        {
          action: 'trigger',
          status: 'skipped',
          message: 'Skipped: Same record triggered this workflow within last 60 seconds.',
        },
      ],
      startedAt: new Date(now),
      finishedAt: new Date(),
    });
    return;
  }
  recordCooldownMap.set(cooldownKey, now);

  // 2. Loop Guard: Cap 50 runs per workflow per minute
  let timestamps = runHistoryMap.get(workflowIdStr) || [];
  timestamps = timestamps.filter((t) => now - t < 60_000);
  if (timestamps.length >= 50) {
    // Exceeded 50 runs/min -> auto-disable workflow and notify admins
    workflow.enabled = false;
    await workflow.save();

    await notifyAdmins({
      type: 'workflow_disabled',
      title: `Workflow auto-disabled: ${workflow.name}`,
      body: `Workflow exceeded the safety limit of 50 runs per minute and was automatically disabled to protect system performance.`,
      link: '/automations',
      entityType: 'workflow',
      entityId: workflowIdStr,
    });

    await WorkflowRun.create({
      workflow: workflow._id,
      triggerEntity: { type: entityType, id: entityId },
      status: 'failed',
      steps: [
        {
          action: 'rate_limit',
          status: 'failed',
          message: 'Rate limit exceeded: >50 runs in 60 seconds. Workflow disabled.',
        },
      ],
      startedAt: new Date(now),
      finishedAt: new Date(),
      error: 'Exceeded rate limit of 50 runs/min',
    });
    return;
  }
  timestamps.push(now);
  runHistoryMap.set(workflowIdStr, timestamps);

  // 3. Condition check: all must match
  const conditionsMatch = (workflow.conditions || []).every((cond) => evaluateCondition(record, cond));
  if (!conditionsMatch) {
    await WorkflowRun.create({
      workflow: workflow._id,
      triggerEntity: { type: entityType, id: entityId },
      status: 'skipped',
      steps: [
        {
          action: 'condition_check',
          status: 'skipped',
          message: 'Skipped: Conditions did not match.',
        },
      ],
      startedAt: new Date(now),
      finishedAt: new Date(),
    });
    return;
  }

  // 4. Execute Actions
  const runSteps: { action: string; status: 'success' | 'failed' | 'skipped'; message?: string }[] = [];
  let overallFailed = false;
  let runError = '';

  for (const action of workflow.actions) {
    try {
      const stepResult = await executeAction(workflow, action, entityType, entityId, record, depth);
      runSteps.push({
        action: action.type,
        status: 'success',
        message: stepResult || 'Completed successfully',
      });
    } catch (stepErr: any) {
      overallFailed = true;
      runError = stepErr.message || 'Action failed';
      runSteps.push({
        action: action.type,
        status: 'failed',
        message: runError,
      });

      if (workflow.stopOnError) {
        break;
      }
    }
  }

  // Record workflow run and increment counter
  await WorkflowRun.create({
    workflow: workflow._id,
    triggerEntity: { type: entityType, id: entityId },
    status: overallFailed ? 'failed' : 'success',
    steps: runSteps,
    startedAt: new Date(now),
    finishedAt: new Date(),
    error: runError,
  });

  workflow.lastRunAt = new Date();
  workflow.runCount = (workflow.runCount || 0) + 1;
  await workflow.save();
}

/**
 * Execute an individual workflow action
 */
async function executeAction(
  workflow: IWorkflow,
  action: IWorkflowAction,
  entityType: string,
  entityId: string,
  record: any,
  depth: number
): Promise<string> {
  const cfg = action.config || {};

  switch (action.type) {
    case 'create_task': {
      const titleTemplate = cfg.taskTitle || 'Follow up with {record.name}';
      const resolvedTitle = resolveMergeTokens(titleTemplate, record);
      const days = Number(cfg.taskDueInDays) || 1;
      const dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      let assigneeId: any = record.owner?._id || record.owner || workflow.owner;
      if (cfg.taskAssignee && cfg.taskAssignee !== 'owner') {
        assigneeId = new Types.ObjectId(cfg.taskAssignee);
      }

      const task = await Task.create({
        title: resolvedTitle,
        dueDate,
        priority: 'high',
        status: 'open',
        owner: assigneeId,
        deal: entityType.toLowerCase() === 'deal' ? new Types.ObjectId(entityId) : null,
      });

      const validEntityType = (entityType === 'deal' || entityType === 'lead' || entityType === 'contact' || entityType === 'account') ? entityType : 'deal';

      await logActivity({
        type: 'task',
        subject: `Automation: Task created (${task.title})`,
        body: `Created automatically by workflow "${workflow.name}"`,
        entityType: validEntityType,
        entityId,
        createdBy: null as any,
      });

      return `Created task "${task.title}" due in ${days} days`;
    }

    case 'send_email': {
      if (!cfg.templateId) {
        throw new Error('Email template ID is required for send_email action');
      }
      const template = await EmailTemplate.findById(cfg.templateId);
      if (!template) {
        throw new Error(`Email template ${cfg.templateId} not found`);
      }

      let toEmail = cfg.customEmail || record.email;
      if (!toEmail && record.contact?.email) {
        toEmail = record.contact.email;
      }
      if (!toEmail) {
        throw new Error('No recipient email available for send_email action');
      }

      const mergeCtx: MergeContext = {
        lead: entityType === 'lead' ? { name: record.name, company: record.company } : undefined,
        deal: entityType === 'deal' ? { title: record.title, amount: record.amount } : undefined,
        owner: record.owner ? { name: record.owner.name, email: record.owner.email } : undefined,
      };

      const resolvedSubject = resolveMergeFields(template.subject, mergeCtx);
      const resolvedBody = resolveMergeFields(template.body, mergeCtx);

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const emailFrom = process.env.EMAIL_FROM || 'Flowdesk CRM <notifications@resend.dev>';
        await resend.emails.send({
          from: emailFrom,
          to: [toEmail],
          subject: resolvedSubject,
          html: resolvedBody.replace(/\r?\n/g, '<br />'),
          text: resolvedBody,
        });
      }

      const validEntityType = (entityType === 'deal' || entityType === 'lead' || entityType === 'contact' || entityType === 'account') ? entityType : 'deal';

      await logActivity({
        type: 'email',
        subject: `Automation: Email sent "${resolvedSubject}"`,
        body: resolvedBody,
        entityType: validEntityType,
        entityId,
        createdBy: null as any,
      });

      return `Sent email "${resolvedSubject}" to ${toEmail}`;
    }

    case 'send_notification': {
      const title = cfg.notificationTitle || `Workflow notification: ${workflow.name}`;
      const body = cfg.notificationBody || `Triggered for ${entityType} ${record.name || record.title || entityId}`;

      if (cfg.notificationRecipient === 'managers') {
        await notifyManagersAndAdmins({
          type: 'general',
          title,
          body,
          link: `/${entityType.toLowerCase()}s/${entityId}`,
          entityType,
          entityId,
        });
        return `Sent notification to all managers`;
      } else {
        const targetUserId =
          cfg.notificationRecipient === 'owner'
            ? record.owner?._id || record.owner
            : cfg.notificationRecipient;

        if (targetUserId) {
          await sendNotification({
            userId: targetUserId,
            type: 'general',
            title,
            body,
            link: `/${entityType.toLowerCase()}s/${entityId}`,
            entityType,
            entityId,
          });
          return `Sent notification to user ${targetUserId}`;
        }
        return 'No recipient found for notification';
      }
    }

    case 'update_field': {
      const { targetField, targetValue } = cfg;
      if (!targetField || targetValue === undefined) {
        throw new Error('targetField and targetValue are required');
      }

      // Whitelist enforcement: lead.status, deal.stage, owner
      if (targetField === 'lead.status') {
        await Lead.findByIdAndUpdate(entityId, { status: targetValue });
        await logActivity({
          type: 'stage_change',
          subject: `Automation: Updated lead status to ${targetValue}`,
          entityType: 'lead',
          entityId,
          createdBy: null as any,
        });
        return `Updated lead status to ${targetValue}`;
      } else if (targetField === 'deal.stage') {
        const prevDeal = await Deal.findById(entityId);
        const prevStage = prevDeal?.stage;
        await Deal.findByIdAndUpdate(entityId, { stage: targetValue });

        await logActivity({
          type: 'stage_change',
          subject: `Automation: Updated deal stage to ${targetValue}`,
          entityType: 'deal',
          entityId,
          createdBy: null as any,
        });

        // Trigger deal_stage_changed event with depth + 1 for loop safety
        eventBus.emitDomainEvent('deal_stage_changed', {
          depth: depth + 1,
          causedByWorkflow: workflow._id.toString(),
          dealId: entityId,
          fromStage: prevStage,
          toStage: targetValue,
        });

        return `Updated deal stage to ${targetValue}`;
      } else if (targetField === 'owner') {
        const newOwnerId = new Types.ObjectId(targetValue);
        if (entityType === 'lead') {
          await Lead.findByIdAndUpdate(entityId, { owner: newOwnerId });
        } else if (entityType === 'deal') {
          await Deal.findByIdAndUpdate(entityId, { owner: newOwnerId });
        }
        return `Updated owner to ${targetValue}`;
      } else {
        throw new Error(`Field update "${targetField}" is not whitelisted`);
      }
    }

    case 'assign_owner': {
      const salesIds = cfg.salesUserIds || [];
      if (!salesIds || salesIds.length === 0) {
        // Fallback: query active sales users
        const salesUsers = await User.find({ role: 'sales', active: true });
        salesIds.push(...salesUsers.map((u) => u._id.toString()));
      }

      if (salesIds.length === 0) {
        throw new Error('No sales users available for round-robin assignment');
      }

      const idx = (workflow.roundRobinIndex || 0) % salesIds.length;
      const assignedUserId = salesIds[idx];

      // Update round robin index
      workflow.roundRobinIndex = (idx + 1) % salesIds.length;
      await workflow.save();

      const newOwnerObjId = new Types.ObjectId(assignedUserId);
      if (entityType === 'lead') {
        await Lead.findByIdAndUpdate(entityId, { owner: newOwnerObjId });
      } else if (entityType === 'deal') {
        await Deal.findByIdAndUpdate(entityId, { owner: newOwnerObjId });
      }

      const validEntityType = (entityType === 'deal' || entityType === 'lead' || entityType === 'contact' || entityType === 'account') ? entityType : 'lead';

      await logActivity({
        type: 'system',
        subject: `Automation: Reassigned owner via round robin`,
        entityType: validEntityType,
        entityId,
        createdBy: null as any,
      });

      await sendNotification({
        userId: assignedUserId,
        type: entityType === 'lead' ? 'general' : 'deal_assigned',
        title: `New ${entityType} assigned to you`,
        body: `You were assigned as owner for ${record.name || record.title || entityId}`,
        link: `/${entityType.toLowerCase()}s/${entityId}`,
        entityType,
        entityId,
      });

      return `Assigned to user ${assignedUserId} (Round Robin)`;
    }

    default:
      throw new Error(`Unsupported action type: ${(action as any).type}`);
  }
}

/**
 * Basic token replacement e.g. "{name}" or "{title}"
 */
function resolveMergeTokens(text: string, record: any): string {
  if (!text) return '';
  return text.replace(/\{([\w.]+)\}/g, (_, token) => {
    const val = extractFieldValue(record, token);
    return val !== undefined && val !== null ? String(val) : `{${token}}`;
  });
}

/**
 * Handle incoming domain event and dispatch to workflows
 */
export async function handleWorkflowEvent(
  eventType: WorkflowTriggerType,
  payload: DomainEventPayload
): Promise<void> {
  const depth = payload.depth || 0;
  if (depth > 3) {
    console.warn(`[WorkflowEngine] Loop Guard: Dropping event "${eventType}" at depth ${depth}`);
    return;
  }

  // Find enabled workflows matching this trigger type
  const workflows = await Workflow.find({
    enabled: true,
    'trigger.type': eventType,
  });

  if (workflows.length === 0) return;

  const entityType = payload.entityType || (payload.dealId ? 'deal' : payload.leadId ? 'lead' : payload.taskId ? 'task' : 'general');
  const entityId = payload.entityId || payload.dealId || payload.leadId || payload.taskId || '';

  if (!entityId) return;

  const record = payload.record || (await fetchEntityRecord(entityType, entityId));
  if (!record) return;

  for (const workflow of workflows) {
    // Specific trigger configuration checks (e.g. deal_stage_changed from -> to)
    if (eventType === 'deal_stage_changed') {
      const cfg = workflow.trigger.config || {};
      if (cfg.fromStage && cfg.fromStage !== payload.fromStage) continue;
      if (cfg.toStage && cfg.toStage !== payload.toStage) continue;
    }

    try {
      await executeWorkflow(workflow, entityType, entityId, record, depth);
    } catch (err) {
      console.error(`[WorkflowEngine] Error executing workflow "${workflow.name}":`, err);
    }
  }
}

/**
 * Register all event listeners on the event bus
 */
export function registerWorkflowListeners(): void {
  const events: WorkflowTriggerType[] = [
    'lead_created',
    'deal_created',
    'deal_stage_changed',
    'deal_won',
    'deal_lost',
    'task_overdue',
    'quote_accepted',
    'quote_declined',
    'invoice_overdue',
    'invoice_paid',
  ];

  for (const ev of events) {
    eventBus.on(ev, (payload: DomainEventPayload) => {
      handleWorkflowEvent(ev, payload).catch((err) => {
        console.error(`[WorkflowEngine] Unhandled error for event ${ev}:`, err);
      });
    });
  }

  console.log('[WorkflowEngine] Workflow event bus listeners registered.');
}
