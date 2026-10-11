import { z } from 'zod';
import { Types } from 'mongoose';
import { Lead } from '../models/Lead.js';
import { Contact } from '../models/Contact.js';
import { Deal } from '../models/Deal.js';
import { EmailTemplate } from '../models/EmailTemplate.js';
import { IUser } from '../models/User.js';
import { geminiProvider } from './geminiProvider.js';
import { wrapUntrustedData, sanitizeRecordForAi } from './promptSanitizer.js';
import { AiUsageLog } from '../models/AiUsageLog.js';

export const draftEmailRequestSchema = z.object({
  goal: z.string().min(3),
  tone: z.enum(['friendly', 'formal', 'short']).default('friendly'),
  entityType: z.enum(['lead', 'contact', 'deal']).optional(),
  entityId: z.string().optional(),
  templateId: z.string().optional(),
  recipientEmail: z.string().optional(),
});

export type DraftEmailRequest = z.infer<typeof draftEmailRequestSchema>;

export const draftEmailOutputSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type DraftEmailOutput = z.infer<typeof draftEmailOutputSchema>;

export async function generateEmailDraft(
  params: DraftEmailRequest,
  user: IUser
): Promise<DraftEmailOutput> {
  let recordContext = '';

  if (params.entityType && params.entityId && Types.ObjectId.isValid(params.entityId)) {
    let record: any = null;
    if (params.entityType === 'lead') {
      record = await Lead.findById(params.entityId).lean();
    } else if (params.entityType === 'contact') {
      record = await Contact.findById(params.entityId).populate('account', 'name').lean();
    } else if (params.entityType === 'deal') {
      record = await Deal.findById(params.entityId)
        .populate('account', 'name')
        .populate('contact', 'name email')
        .lean();
    }

    if (record) {
      recordContext = wrapUntrustedData(
        JSON.stringify(sanitizeRecordForAi(record), null, 2),
        `${params.entityType}_details`
      );
    }
  }

  let templateContext = '';
  if (params.templateId && Types.ObjectId.isValid(params.templateId)) {
    const template = await EmailTemplate.findById(params.templateId).lean();
    if (template) {
      templateContext = `
Reference Template Structure:
Subject Pattern: ${template.subject}
Body Structure:
${template.body}
`;
    }
  }

  const prompt = `Draft a high-conversion sales email based on the following specifications:
Goal: ${params.goal}
Tone: ${params.tone}
Sender Name: ${user.name}
${params.recipientEmail ? `Recipient: ${params.recipientEmail}` : ''}

${recordContext ? `Customer Context:\n${recordContext}\n` : ''}
${templateContext ? templateContext : ''}

Output valid JSON matching:
{
  "subject": "Email subject line",
  "body": "Complete email body including professional greeting, paragraph spacing, and sign-off."
}`;

  const startTime = Date.now();
  const model = geminiProvider.getModelName('fast');

  const systemPrompt = `You are an expert sales copywriter writing personalized B2B emails for Flowdesk CRM.
Adopt the requested tone (${params.tone}). Keep the copy crisp, persuasive, and completely respectful of customer context. Never include raw markdown tags in the subject.`;

  const structured = await geminiProvider.generateStructuredJson<DraftEmailOutput>({
    model,
    systemPrompt,
    prompt,
    schema: draftEmailOutputSchema,
  });

  const latencyMs = Date.now() - startTime;
  await AiUsageLog.create({
    tenantId: user.tenantId,
    userId: user._id,
    feature: 'draft_email',
    modelName: model,
    tokensIn: structured.usage.inputTokens,
    tokensOut: structured.usage.outputTokens,
    totalTokens: structured.usage.totalTokens,
    latencyMs,
    estimatedCostPaise: Math.ceil((structured.usage.totalTokens / 1000) * 2),
  });

  return structured.data;
}
