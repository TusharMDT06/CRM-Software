import { z } from 'zod';
import { Types } from 'mongoose';
import { ToolDefinition } from './provider.js';
import { sanitizeRecordForAi } from './promptSanitizer.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { Task } from '../models/Task.js';
import { Activity } from '../models/Activity.js';
import { Ticket } from '../models/Ticket.js';
import { IUser } from '../models/User.js';
import { buildOwnerFilter } from '../utils/queryHelper.js';

export interface ToolExecutionContext {
  user: IUser;
  tenantId: string;
}

// ========================
// ZOD VALIDATION SCHEMAS
// ========================

export const searchLeadsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export const searchContactsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export const searchDealsSchema = z.object({
  query: z.string().optional(),
  stage: z.enum(['qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export const getRecordSchema = z.object({
  entityType: z.enum(['lead', 'contact', 'account', 'deal', 'ticket']),
  id: z.string().min(1),
});

export const overdueTasksSchema = z.object({
  limit: z.number().int().min(1).max(20).default(5),
});

export const recentActivitySchema = z.object({
  limit: z.number().int().min(1).max(20).default(10),
});

export const proposeCreateTaskSchema = z.object({
  title: z.string().min(1),
  dueDate: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  entityType: z.enum(['lead', 'contact', 'account', 'deal']).optional(),
  entityId: z.string().optional(),
  notes: z.string().optional(),
});

export const proposeChangeDealStageSchema = z.object({
  dealId: z.string().min(1),
  stage: z.enum(['qualified', 'proposal', 'negotiation', 'won', 'lost']),
  reason: z.string().optional(),
});

export const proposeDraftEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export const proposeCreateTicketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  customerEmail: z.string().email().optional(),
});

// ========================
// TOOL DECLARATIONS
// ========================

export const COPILOT_TOOLS: ToolDefinition[] = [
  {
    name: 'search_leads',
    description: 'Search for leads matching name, email, company, or status.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for name, email or company' },
        status: {
          type: 'string',
          enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
          description: 'Filter by lead status',
        },
        limit: { type: 'number', description: 'Max records to return (1-20, default 5)' },
      },
    },
  },
  {
    name: 'search_contacts',
    description: 'Search for contacts by name, email, or company.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword' },
        limit: { type: 'number', description: 'Max records to return (1-20, default 5)' },
      },
    },
  },
  {
    name: 'search_deals',
    description: 'Search for deals by title, stage, or amount range.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Deal title keyword' },
        stage: {
          type: 'string',
          enum: ['qualified', 'proposal', 'negotiation', 'won', 'lost'],
          description: 'Pipeline stage filter',
        },
        minAmount: { type: 'number', description: 'Minimum deal amount in INR' },
        maxAmount: { type: 'number', description: 'Maximum deal amount in INR' },
        limit: { type: 'number', description: 'Max records to return (1-20, default 5)' },
      },
    },
  },
  {
    name: 'get_record',
    description: 'Fetch complete details for a specific CRM record by type and ID.',
    parameters: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          enum: ['lead', 'contact', 'account', 'deal', 'ticket'],
          description: 'The type of entity',
        },
        id: { type: 'string', description: 'MongoDB ObjectId string of the record' },
      },
      required: ['entityType', 'id'],
    },
  },
  {
    name: 'pipeline_summary',
    description: 'Get an aggregated summary of active pipeline deals grouped by stage and values.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'overdue_tasks',
    description: 'Get pending overdue tasks requiring immediate attention.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max tasks to return (default 5)' },
      },
    },
  },
  {
    name: 'recent_activity',
    description: 'Get recent activities (calls, meetings, notes, tasks) in the CRM.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max items to return (default 10)' },
      },
    },
  },
  {
    name: 'ticket_summary',
    description: 'Get an overview of open and pending support tickets categorized by priority and status.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'revenue_summary',
    description: 'Get overall revenue summary metrics including pipeline value, won deals, and average deal size.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'propose_create_task',
    description: 'Propose creating a follow-up task. Returns a proposal card for user confirmation. Does NOT save automatically.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title or summary' },
        dueDate: { type: 'string', description: 'Due date in ISO format YYYY-MM-DD' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' },
        entityType: { type: 'string', enum: ['lead', 'contact', 'account', 'deal'], description: 'Associated entity' },
        entityId: { type: 'string', description: 'ID of the associated entity' },
        notes: { type: 'string', description: 'Optional task notes' },
      },
      required: ['title', 'dueDate'],
    },
  },
  {
    name: 'propose_change_deal_stage',
    description: 'Propose updating a deal stage. Returns a proposal card for user confirmation. Does NOT mutate the database.',
    parameters: {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'ID of the deal to change' },
        stage: {
          type: 'string',
          enum: ['qualified', 'proposal', 'negotiation', 'won', 'lost'],
          description: 'New stage for the deal',
        },
        reason: { type: 'string', description: 'Reason for the stage transition' },
      },
      required: ['dealId', 'stage'],
    },
  },
  {
    name: 'propose_draft_email',
    description: 'Propose drafting an email to a contact/lead. Returns a draft card for user review and sending.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body text' },
        entityType: { type: 'string', description: 'Optional entity type (lead/contact/deal)' },
        entityId: { type: 'string', description: 'Optional entity ID' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'propose_create_ticket',
    description: 'Propose creating a support ticket. Returns a proposal card for user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Ticket subject' },
        description: { type: 'string', description: 'Detailed problem description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority level' },
        customerEmail: { type: 'string', description: 'Customer email address' },
      },
      required: ['subject', 'description'],
    },
  },
];

// ========================
// TOOL EXECUTOR
// ========================

export async function executeAiTool(
  toolName: string,
  rawArgs: Record<string, any>,
  context: ToolExecutionContext
): Promise<any> {
  const { user } = context;

  switch (toolName) {
    case 'search_leads': {
      const args = searchLeadsSchema.parse(rawArgs);
      const filter: any = { ...buildOwnerFilter(user) };

      if (args.status) {
        filter.status = args.status;
      }
      if (args.query) {
        const q = args.query.trim();
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { company: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ];
      }

      const leads = await Lead.find(filter)
        .select('name company email phone status value aiScore createdAt')
        .limit(args.limit)
        .lean();

      return {
        count: leads.length,
        leads: sanitizeRecordForAi(leads),
      };
    }

    case 'search_contacts': {
      const args = searchContactsSchema.parse(rawArgs);
      const filter: any = { ...buildOwnerFilter(user) };

      if (args.query) {
        const q = args.query.trim();
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { title: { $regex: q, $options: 'i' } },
        ];
      }

      const contacts = await Contact.find(filter)
        .select('name title email phone account')
        .populate('account', 'name')
        .limit(args.limit)
        .lean();

      return {
        count: contacts.length,
        contacts: sanitizeRecordForAi(contacts),
      };
    }

    case 'search_deals': {
      const args = searchDealsSchema.parse(rawArgs);
      const filter: any = { ...buildOwnerFilter(user) };

      if (args.stage) {
        filter.stage = args.stage;
      }
      if (args.query) {
        filter.title = { $regex: args.query.trim(), $options: 'i' };
      }
      if (args.minAmount !== undefined || args.maxAmount !== undefined) {
        filter.amount = {};
        if (args.minAmount !== undefined) filter.amount.$gte = args.minAmount;
        if (args.maxAmount !== undefined) filter.amount.$lte = args.maxAmount;
      }

      const deals = await Deal.find(filter)
        .select('title amount stage expectedClose aiRisk')
        .populate('account', 'name')
        .limit(args.limit)
        .lean();

      return {
        count: deals.length,
        deals: sanitizeRecordForAi(deals),
      };
    }

    case 'get_record': {
      const args = getRecordSchema.parse(rawArgs);
      if (!Types.ObjectId.isValid(args.id)) {
        return { error: 'Invalid record ID format' };
      }

      let record: any = null;
      const ownerFilter = buildOwnerFilter(user);

      switch (args.entityType) {
        case 'lead':
          record = await Lead.findOne({ _id: args.id, ...ownerFilter }).lean();
          break;
        case 'contact':
          record = await Contact.findOne({ _id: args.id, ...ownerFilter }).lean();
          break;
        case 'account':
          record = await Account.findOne({ _id: args.id, ...ownerFilter }).lean();
          break;
        case 'deal':
          record = await Deal.findOne({ _id: args.id, ...ownerFilter })
            .populate('account', 'name')
            .populate('contact', 'name email phone')
            .lean();
          break;
        case 'ticket':
          record = await Ticket.findOne({ _id: args.id }).lean();
          break;
      }

      if (!record) {
        return { error: `${args.entityType} with ID ${args.id} not found or access denied` };
      }

      return {
        entityType: args.entityType,
        record: sanitizeRecordForAi(record),
      };
    }

    case 'pipeline_summary': {
      const ownerFilter = buildOwnerFilter(user);
      const deals = await Deal.find(ownerFilter).select('stage amount').lean();

      const summary: Record<string, { count: number; totalAmount: number }> = {
        qualified: { count: 0, totalAmount: 0 },
        proposal: { count: 0, totalAmount: 0 },
        negotiation: { count: 0, totalAmount: 0 },
        won: { count: 0, totalAmount: 0 },
        lost: { count: 0, totalAmount: 0 },
      };

      for (const d of deals) {
        if (summary[d.stage]) {
          summary[d.stage].count += 1;
          summary[d.stage].totalAmount += d.amount || 0;
        }
      }

      return {
        stages: summary,
        totalDeals: deals.length,
      };
    }

    case 'overdue_tasks': {
      const args = overdueTasksSchema.parse(rawArgs);
      const ownerFilter = buildOwnerFilter(user);
      const now = new Date();

      const tasks = await Task.find({
        ...ownerFilter,
        dueDate: { $lt: now },
        status: { $ne: 'completed' },
      })
        .select('title dueDate priority status entityType entityId')
        .sort({ dueDate: 1 })
        .limit(args.limit)
        .lean();

      return {
        count: tasks.length,
        tasks: sanitizeRecordForAi(tasks),
      };
    }

    case 'recent_activity': {
      const args = recentActivitySchema.parse(rawArgs);
      const ownerFilter = buildOwnerFilter(user);

      const activities = await Activity.find(ownerFilter)
        .select('type title description createdAt')
        .sort({ createdAt: -1 })
        .limit(args.limit)
        .lean();

      return {
        count: activities.length,
        activities: sanitizeRecordForAi(activities),
      };
    }

    case 'ticket_summary': {
      const [openTickets, pendingTickets, urgentTickets] = await Promise.all([
        Ticket.countDocuments({ status: 'open' }),
        Ticket.countDocuments({ status: 'pending' }),
        Ticket.countDocuments({ priority: 'urgent', status: { $ne: 'resolved' } }),
      ]);

      return {
        open: openTickets,
        pending: pendingTickets,
        urgent: urgentTickets,
      };
    }

    case 'revenue_summary': {
      const ownerFilter = buildOwnerFilter(user);
      const deals = await Deal.find(ownerFilter).select('stage amount createdAt').lean();

      let pipelineTotal = 0;
      let wonTotal = 0;
      let wonCount = 0;

      for (const d of deals) {
        if (d.stage === 'won') {
          wonTotal += d.amount || 0;
          wonCount += 1;
        } else if (d.stage !== 'lost') {
          pipelineTotal += d.amount || 0;
        }
      }

      return {
        pipelineTotal,
        wonTotal,
        wonCount,
        avgDealSize: wonCount > 0 ? Math.round(wonTotal / wonCount) : 0,
      };
    }

    // Write tools return PROPOSED ACTIONS ONLY - No direct DB mutations!
    case 'propose_create_task': {
      const args = proposeCreateTaskSchema.parse(rawArgs);
      const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      return {
        proposedAction: {
          id: actionId,
          type: 'create_task',
          title: `Create Task: ${args.title}`,
          description: `Due on ${args.dueDate} with ${args.priority} priority`,
          params: args,
          status: 'pending',
        },
      };
    }

    case 'propose_change_deal_stage': {
      const args = proposeChangeDealStageSchema.parse(rawArgs);
      const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      return {
        proposedAction: {
          id: actionId,
          type: 'change_deal_stage',
          title: `Move Deal to "${args.stage.toUpperCase()}"`,
          description: args.reason ? `Reason: ${args.reason}` : `Update pipeline stage to ${args.stage}`,
          params: args,
          status: 'pending',
        },
      };
    }

    case 'propose_draft_email': {
      const args = proposeDraftEmailSchema.parse(rawArgs);
      const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      return {
        proposedAction: {
          id: actionId,
          type: 'draft_email',
          title: `Draft Email: "${args.subject}"`,
          description: `To ${args.to} with generated content ready for manual review`,
          params: args,
          status: 'pending',
        },
      };
    }

    case 'propose_create_ticket': {
      const args = proposeCreateTicketSchema.parse(rawArgs);
      const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      return {
        proposedAction: {
          id: actionId,
          type: 'create_ticket',
          title: `Create Ticket: ${args.subject}`,
          description: `Priority: ${args.priority}`,
          params: args,
          status: 'pending',
        },
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

export const executeToolCall = executeAiTool;
