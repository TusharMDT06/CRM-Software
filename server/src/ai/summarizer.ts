import { z } from 'zod';
import { Types } from 'mongoose';
import { RecordSummaryCache, IRecordSummaryCache } from '../models/RecordSummaryCache.js';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Account } from '../models/Account.js';
import { Deal } from '../models/Deal.js';
import { Ticket } from '../models/Ticket.js';
import { Activity } from '../models/Activity.js';
import { IUser } from '../models/User.js';
import { geminiProvider } from './geminiProvider.js';
import { wrapUntrustedData, sanitizeRecordForAi } from './promptSanitizer.js';
import { AiUsageLog } from '../models/AiUsageLog.js';

export const summaryOutputSchema = z.object({
  summary: z.string(),
  keyFacts: z.array(z.string()),
  openIssues: z.array(z.string()),
  nextStep: z.string(),
});

export type SummaryOutput = z.infer<typeof summaryOutputSchema>;

export async function summarizeRecord(
  entityType: 'lead' | 'contact' | 'account' | 'deal' | 'ticket',
  id: string,
  user: IUser
): Promise<SummaryOutput & { fromCache: boolean; cachedAt?: Date }> {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid record ID format');
  }

  // 1. Fetch record based on entityType
  let record: any = null;
  switch (entityType) {
    case 'lead':
      record = await Lead.findById(id).lean();
      break;
    case 'contact':
      record = await Contact.findById(id).lean();
      break;
    case 'account':
      record = await Account.findById(id).lean();
      break;
    case 'deal':
      record = await Deal.findById(id).lean();
      break;
    case 'ticket':
      record = await Ticket.findById(id).lean();
      break;
  }

  if (!record) {
    throw new Error(`${entityType} record not found`);
  }

  const recordUpdatedAt = new Date(record.updatedAt || record.createdAt);

  // 2. Check cache
  const cached = await RecordSummaryCache.findOne({
    tenantId: user.tenantId,
    entityType,
    entityId: new Types.ObjectId(id),
  });

  if (cached && new Date(cached.recordUpdatedAt).getTime() === recordUpdatedAt.getTime()) {
    return {
      summary: cached.summary,
      keyFacts: cached.keyFacts,
      openIssues: cached.openIssues,
      nextStep: cached.nextStep,
      fromCache: true,
      cachedAt: cached.cachedAt,
    };
  }

  // 3. Fetch related context (activities, tickets)
  const activities = await Activity.find({
    entityType,
    entityId: new Types.ObjectId(id),
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  const sanitizedRecord = sanitizeRecordForAi(record);
  const sanitizedActivities = sanitizeRecordForAi(activities);

  const contextData = `
Entity Type: ${entityType}
Record Data:
${wrapUntrustedData(JSON.stringify(sanitizedRecord, null, 2), 'record_fields')}

Timeline and Recent Activities:
${wrapUntrustedData(JSON.stringify(sanitizedActivities, null, 2), 'timeline_activities')}
`;

  const startTime = Date.now();
  const model = geminiProvider.getModelName('strong');

  const systemPrompt = `You are a CRM record summarization specialist.
Analyze the provided CRM record and recent timeline events.
Output a JSON summary strictly matching the schema:
- summary: A concise 2-3 sentence executive summary of the account/lead/deal/ticket status.
- keyFacts: Array of 3-5 high-priority bullet points (dates, values, stakeholders, current status).
- openIssues: Array of unresolved challenges, blockers, pending replies, or overdue items.
- nextStep: The single most impactful recommended next action for the CRM user.`;

  const structured = await geminiProvider.generateStructuredJson<SummaryOutput>({
    model,
    systemPrompt,
    prompt: contextData,
    schema: summaryOutputSchema,
  });

  const latencyMs = Date.now() - startTime;
  await AiUsageLog.create({
    tenantId: user.tenantId,
    userId: user._id,
    feature: 'summarize',
    modelName: model,
    tokensIn: structured.usage.inputTokens,
    tokensOut: structured.usage.outputTokens,
    totalTokens: structured.usage.totalTokens,
    latencyMs,
    estimatedCostPaise: Math.ceil((structured.usage.totalTokens / 1000) * 3),
  });

  // 4. Update cache
  await RecordSummaryCache.findOneAndUpdate(
    {
      tenantId: user.tenantId,
      entityType,
      entityId: new Types.ObjectId(id),
    },
    {
      recordUpdatedAt,
      summary: structured.data.summary,
      keyFacts: structured.data.keyFacts,
      openIssues: structured.data.openIssues,
      nextStep: structured.data.nextStep,
      cachedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return {
    ...structured.data,
    fromCache: false,
    cachedAt: new Date(),
  };
}
