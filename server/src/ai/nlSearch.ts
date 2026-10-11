import { z } from 'zod';
import { geminiProvider } from './geminiProvider.js';
import { Lead } from '../models/Lead.js';
import { Deal } from '../models/Deal.js';
import { Contact } from '../models/Contact.js';
import { Ticket } from '../models/Ticket.js';
import { IUser } from '../models/User.js';
import { buildOwnerFilter } from '../utils/queryHelper.js';
import { AiUsageLog } from '../models/AiUsageLog.js';
import { sanitizeRecordForAi } from './promptSanitizer.js';

// ================================
// WHITELIST OF PERMITTED CRITERIA
// ================================

export const ALLOWED_ENTITIES = ['leads', 'deals', 'contacts', 'tickets'] as const;
export type AllowedEntity = (typeof ALLOWED_ENTITIES)[number];

export const ALLOWED_OPERATORS = [
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'contains',
] as const;
export type AllowedOperator = (typeof ALLOWED_OPERATORS)[number];

export const ALLOWED_FIELDS_BY_ENTITY: Record<AllowedEntity, Set<string>> = {
  leads: new Set(['status', 'source', 'value', 'createdAt', 'aiScore.grade', 'aiScore.score', 'company', 'name']),
  deals: new Set(['stage', 'amount', 'expectedClose', 'createdAt', 'aiRisk.level', 'aiRisk.score', 'title']),
  contacts: new Set(['title', 'createdAt', 'name', 'email']),
  tickets: new Set(['status', 'priority', 'createdAt', 'subject']),
};

export const nlFilterConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(ALLOWED_OPERATORS),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  label: z.string(),
});

export type NlFilterCondition = z.infer<typeof nlFilterConditionSchema>;

export const nlSearchResponseSchema = z.object({
  entity: z.enum(ALLOWED_ENTITIES),
  explanation: z.string(),
  conditions: z.array(nlFilterConditionSchema),
  sort: z
    .object({
      field: z.string(),
      order: z.enum(['asc', 'desc']),
    })
    .optional(),
});

export type NlSearchResponse = z.infer<typeof nlSearchResponseSchema>;

/**
 * Validates the model output strictly against whitelist
 */
export function validateNlSearchFilter(data: NlSearchResponse): NlSearchResponse {
  const allowedFields = ALLOWED_FIELDS_BY_ENTITY[data.entity];
  if (!allowedFields) {
    throw new Error(`Invalid search entity: ${data.entity}`);
  }

  // Filter out any conditions that use fields not in the whitelist
  const validConditions = data.conditions.filter((cond) => {
    return allowedFields.has(cond.field);
  });

  // Validate sort field
  let validSort = data.sort;
  if (validSort && !allowedFields.has(validSort.field)) {
    validSort = undefined;
  }

  return {
    entity: data.entity,
    explanation: data.explanation,
    conditions: validConditions,
    sort: validSort,
  };
}

/**
 * Executes a whitelisted natural language query using standard scoped Mongoose queries
 */
export async function executeNaturalLanguageSearch(
  userQuery: string,
  user: IUser
): Promise<{
  entity: AllowedEntity;
  explanation: string;
  chips: NlFilterCondition[];
  results: any[];
  total: number;
}> {
  const startTime = Date.now();
  const fastModel = geminiProvider.getModelName('fast');

  const systemPrompt = `You convert natural language search queries for an enterprise CRM into strict structured JSON filter criteria.
Allowed Entities: leads, deals, contacts, tickets.
Allowed Fields:
- leads: status (new, contacted, qualified, converted, lost), source (website, referral, social, email, event, other), value (number in INR), createdAt (ISO date), aiScore.grade (hot, warm, cold), aiScore.score (0-100), company, name.
- deals: stage (qualified, proposal, negotiation, won, lost), amount (number in INR), expectedClose (ISO date), createdAt (ISO date), aiRisk.level (low, medium, high), aiRisk.score (0-100), title.
- contacts: title, createdAt, name, email.
- tickets: status (open, pending, resolved, closed), priority (low, medium, high, urgent), createdAt, subject.
Operators: eq, ne, gt, gte, lt, lte, in, contains.
Current date reference: 2026-10-10.
Provide user-friendly chip labels (e.g. "Hot leads", "Amount > ₹5,00,000", "Closing this week").`;

  const structured = await geminiProvider.generateStructuredJson<NlSearchResponse>({
    model: fastModel,
    systemPrompt,
    prompt: `Parse natural language search query: "${userQuery}"`,
    schema: nlSearchResponseSchema,
  });

  const latencyMs = Date.now() - startTime;
  await AiUsageLog.create({
    tenantId: user.tenantId,
    userId: user._id,
    feature: 'nl_search',
    modelName: fastModel,
    tokensIn: structured.usage.inputTokens,
    tokensOut: structured.usage.outputTokens,
    totalTokens: structured.usage.totalTokens,
    latencyMs,
    estimatedCostPaise: Math.ceil((structured.usage.totalTokens / 1000) * 2),
  });

  const validatedFilter = validateNlSearchFilter(structured.data);
  const mongoQuery: any = { ...buildOwnerFilter(user) };

  for (const cond of validatedFilter.conditions) {
    switch (cond.operator) {
      case 'eq':
        mongoQuery[cond.field] = cond.value;
        break;
      case 'ne':
        mongoQuery[cond.field] = { $ne: cond.value };
        break;
      case 'gt':
        mongoQuery[cond.field] = { $gt: cond.value };
        break;
      case 'gte':
        mongoQuery[cond.field] = { $gte: cond.value };
        break;
      case 'lt':
        mongoQuery[cond.field] = { $lt: cond.value };
        break;
      case 'lte':
        mongoQuery[cond.field] = { $lte: cond.value };
        break;
      case 'in':
        mongoQuery[cond.field] = { $in: Array.isArray(cond.value) ? cond.value : [cond.value] };
        break;
      case 'contains':
        mongoQuery[cond.field] = { $regex: String(cond.value), $options: 'i' };
        break;
    }
  }

  const sortOption: any = {};
  if (validatedFilter.sort) {
    sortOption[validatedFilter.sort.field] = validatedFilter.sort.order === 'asc' ? 1 : -1;
  } else {
    sortOption.createdAt = -1;
  }

  let results: any[] = [];
  let total = 0;

  switch (validatedFilter.entity) {
    case 'leads':
      [results, total] = await Promise.all([
        Lead.find(mongoQuery).sort(sortOption).limit(50).lean(),
        Lead.countDocuments(mongoQuery),
      ]);
      break;
    case 'deals':
      [results, total] = await Promise.all([
        Deal.find(mongoQuery).populate('account', 'name').sort(sortOption).limit(50).lean(),
        Deal.countDocuments(mongoQuery),
      ]);
      break;
    case 'contacts':
      [results, total] = await Promise.all([
        Contact.find(mongoQuery).populate('account', 'name').sort(sortOption).limit(50).lean(),
        Contact.countDocuments(mongoQuery),
      ]);
      break;
    case 'tickets':
      [results, total] = await Promise.all([
        Ticket.find(mongoQuery).sort(sortOption).limit(50).lean(),
        Ticket.countDocuments(mongoQuery),
      ]);
      break;
  }

  return {
    entity: validatedFilter.entity,
    explanation: validatedFilter.explanation,
    chips: validatedFilter.conditions,
    results: sanitizeRecordForAi(results),
    total,
  };
}
