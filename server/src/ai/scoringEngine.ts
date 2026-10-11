import { Lead, ILead } from '../models/Lead.js';
import { Deal, IDeal } from '../models/Deal.js';
import { Task } from '../models/Task.js';
import { Activity } from '../models/Activity.js';
import { IUser } from '../models/User.js';
import { geminiProvider } from './geminiProvider.js';
import { AiUsageLog } from '../models/AiUsageLog.js';
import { emitWorkflowEvent } from '../utils/eventBus.js';
import { sendNotification } from '../utils/notificationService.js';
import { wrapUntrustedData } from './promptSanitizer.js';

export interface LeadScoreResult {
  score: number;
  grade: 'hot' | 'warm' | 'cold';
  reasons: string[];
  scoredAt: Date;
}

export interface DealRiskResult {
  level: 'low' | 'medium' | 'high';
  score: number;
  reasons: string[];
  evaluatedAt: Date;
}

/**
 * Deterministically calculates a lead score (0-100) and grade (hot, warm, cold)
 */
export function calculateLeadScore(lead: ILead, recentActivities: any[] = []): LeadScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Source (0 - 25)
  if (lead.source === 'referral') {
    score += 25;
    reasons.push('High-conversion referral source');
  } else if (lead.source === 'event') {
    score += 20;
    reasons.push('Direct industry event engagement');
  } else if (lead.source === 'website') {
    score += 15;
    reasons.push('Inbound website inquiry');
  } else if (lead.source === 'social' || lead.source === 'email') {
    score += 10;
    reasons.push('Digital outreach campaign response');
  } else {
    score += 5;
    reasons.push('General marketing lead');
  }

  // 2. Value (0 - 25)
  const val = lead.value || 0;
  if (val >= 500000) {
    score += 25;
    reasons.push('High enterprise estimated value (₹5,00,000+)');
  } else if (val >= 100000) {
    score += 20;
    reasons.push('Significant deal value (₹1,00,000+)');
  } else if (val >= 25000) {
    score += 12;
    reasons.push('Standard commercial value');
  } else {
    score += 5;
  }

  // 3. Status progression (0 - 25)
  if (lead.status === 'qualified') {
    score += 25;
    reasons.push('Formally qualified prospect');
  } else if (lead.status === 'contacted') {
    score += 15;
    reasons.push('Initial communication established');
  } else {
    score += 10;
    reasons.push('Fresh new prospect awaiting first contact');
  }

  // 4. Activity recency (0 - 25)
  const now = Date.now();
  if (recentActivities.length > 0) {
    const latestDate = new Date(recentActivities[0].createdAt).getTime();
    const daysSince = (now - latestDate) / (1000 * 60 * 60 * 24);

    if (daysSince <= 3) {
      score += 25;
      reasons.push('Frequent engagement within the last 3 days');
    } else if (daysSince <= 7) {
      score += 15;
      reasons.push('Active touchpoint in the past week');
    } else if (daysSince <= 14) {
      score += 8;
      reasons.push('Touchpoint in the last two weeks');
    } else {
      reasons.push('No contact in over 14 days');
    }
  } else {
    reasons.push('No logged activities yet');
  }

  score = Math.min(100, Math.max(0, score));

  let grade: 'hot' | 'warm' | 'cold' = 'cold';
  if (score >= 70) grade = 'hot';
  else if (score >= 40) grade = 'warm';

  return {
    score,
    grade,
    reasons: reasons.slice(0, 4),
    scoredAt: new Date(),
  };
}

/**
 * Deterministically calculates a deal risk (0-100) and level (low, medium, high)
 */
export function calculateDealRisk(
  deal: IDeal,
  recentActivities: any[] = [],
  pendingTasks: any[] = [],
  medianStageDays: number = 30
): DealRiskResult {
  let riskScore = 0;
  const reasons: string[] = [];
  const now = Date.now();

  // 1. Inactivity check
  if (recentActivities.length === 0) {
    riskScore += 25;
    reasons.push('No logged activities on this deal');
  } else {
    const latestActivity = new Date(recentActivities[0].createdAt).getTime();
    const daysSinceActivity = (now - latestActivity) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 14) {
      riskScore += 30;
      reasons.push(`No CRM activity in ${Math.floor(daysSinceActivity)} days`);
    } else if (daysSinceActivity > 7) {
      riskScore += 15;
      reasons.push('No activity recorded in the past week');
    }
  }

  // 2. Overdue expected close
  if (deal.expectedClose) {
    const expectedTime = new Date(deal.expectedClose).getTime();
    if (expectedTime < now) {
      riskScore += 30;
      reasons.push('Target close date has passed without closure');
    }
  }

  // 3. Stagnant in current stage
  const dealAgeDays = (now - new Date(deal.updatedAt || deal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (dealAgeDays > medianStageDays) {
    riskScore += 20;
    reasons.push(`Stagnant in ${deal.stage} stage for over ${Math.floor(dealAgeDays)} days`);
  }

  // 4. Missing next scheduled task
  if (pendingTasks.length === 0) {
    riskScore += 15;
    reasons.push('No upcoming follow-up task scheduled');
  }

  // 5. High-stake exposure
  if (deal.amount >= 500000 && riskScore >= 20) {
    riskScore += 10;
    reasons.push('High value deal (> ₹5,00,000) with delayed progression');
  }

  riskScore = Math.min(100, Math.max(0, riskScore));

  let level: 'low' | 'medium' | 'high' = 'low';
  if (riskScore >= 60) level = 'high';
  else if (riskScore >= 30) level = 'medium';

  return {
    level,
    score: riskScore,
    reasons: reasons.slice(0, 4),
    evaluatedAt: new Date(),
  };
}

/**
 * Evaluates all leads and deals in a tenant, emitting deal_risk_high if triggered
 */
export async function evaluateAllTenantScores(tenantId: string): Promise<{
  leadsUpdated: number;
  dealsUpdated: number;
  highRiskDeals: number;
}> {
  // 1. Leads
  const leads = await Lead.find({ status: { $ne: 'converted' } });
  let leadsUpdated = 0;

  for (const lead of leads) {
    const activities = await Activity.find({
      entityType: 'lead',
      entityId: lead._id,
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    const scoreResult = calculateLeadScore(lead, activities);
    lead.aiScore = {
      score: scoreResult.score,
      grade: scoreResult.grade,
      reasons: scoreResult.reasons,
      scoredAt: scoreResult.scoredAt,
      explanation: lead.aiScore?.explanation,
    };
    await lead.save();
    leadsUpdated++;
  }

  // 2. Deals
  const deals = await Deal.find({
    stage: { $nin: ['won', 'lost'] },
  });

  let dealsUpdated = 0;
  let highRiskDeals = 0;

  for (const deal of deals) {
    const previousRiskLevel = deal.aiRisk?.level || 'low';

    const [activities, tasks] = await Promise.all([
      Activity.find({ entityType: 'deal', entityId: deal._id })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
      Task.find({ entityType: 'deal', entityId: deal._id, status: { $ne: 'completed' } }).lean(),
    ]);

    const riskResult = calculateDealRisk(deal, activities, tasks, 30);
    deal.aiRisk = {
      level: riskResult.level,
      score: riskResult.score,
      reasons: riskResult.reasons,
      evaluatedAt: riskResult.evaluatedAt,
      explanation: deal.aiRisk?.explanation,
    };
    await deal.save();
    dealsUpdated++;

    if (riskResult.level === 'high') {
      highRiskDeals++;

      // Trigger workflow and notification if new transition to high
      if (previousRiskLevel !== 'high') {
        emitWorkflowEvent('deal_risk_high', {
          tenantId,
          entityType: 'deal',
          entityId: deal._id.toString(),
          dealId: deal._id.toString(),
          record: deal,
        });

        if (deal.owner) {
          sendNotification({
            userId: deal.owner.toString(),
            type: 'deal_risk_high',
            title: `High Risk Deal: ${deal.title}`,
            body: `Deal "${deal.title}" flagged at high risk (${riskResult.score}/100). Top factors: ${riskResult.reasons.join(', ')}.`,
            link: `/deals/${deal._id}`,
            entityType: 'deal',
            entityId: deal._id.toString(),
          }).catch((err) => console.error('[ScoringEngine] Notification error:', err));
        }
      }
    }
  }

  return { leadsUpdated, dealsUpdated, highRiskDeals };
}

/**
 * On-demand AI explanation generator for lead scores or deal risk
 */
export async function explainScoreWithAi(
  entityType: 'lead' | 'deal',
  id: string,
  user: IUser
): Promise<string> {
  const startTime = Date.now();
  const fastModel = geminiProvider.getModelName('fast');

  if (entityType === 'lead') {
    const lead = await Lead.findById(id);
    if (!lead) throw new Error('Lead not found');

    const scoreData = lead.aiScore || calculateLeadScore(lead);
    const prompt = `Explain the following CRM lead score to a sales rep.
Lead: ${wrapUntrustedData(lead.name, 'lead_name')}
Company: ${wrapUntrustedData(lead.company, 'company')}
Value: ₹${lead.value}
Score: ${scoreData.score}/100 (${scoreData.grade.toUpperCase()})
Deterministic Reasons: ${scoreData.reasons.join(', ')}

Provide exactly two sentences:
1. Clear explanation of why this lead received this score.
2. One specific next action the sales rep should take today.`;

    const result = await geminiProvider.generateText({
      model: fastModel,
      prompt,
      temperature: 0.3,
      maxOutputTokens: 200,
    });

    const latencyMs = Date.now() - startTime;
    await AiUsageLog.create({
      tenantId: user.tenantId,
      userId: user._id,
      feature: 'scoring',
      modelName: fastModel,
      tokensIn: result.usage.inputTokens,
      tokensOut: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      latencyMs,
      estimatedCostPaise: Math.ceil((result.usage.totalTokens / 1000) * 2),
    });

    if (!lead.aiScore) {
      lead.aiScore = {
        score: scoreData.score,
        grade: scoreData.grade,
        reasons: scoreData.reasons,
        scoredAt: scoreData.scoredAt,
        explanation: result.text,
      };
    } else {
      lead.aiScore.explanation = result.text;
    }
    await lead.save();

    return result.text;
  } else {
    const deal = await Deal.findById(id);
    if (!deal) throw new Error('Deal not found');

    const riskData = deal.aiRisk || calculateDealRisk(deal);
    const prompt = `Explain the following CRM deal risk to an account executive.
Deal: ${wrapUntrustedData(deal.title, 'deal_title')}
Amount: ₹${deal.amount}
Stage: ${deal.stage}
Risk Level: ${riskData.level.toUpperCase()} (${riskData.score}/100)
Identified Risk Factors: ${riskData.reasons.join(', ')}

Provide exactly two sentences:
1. Clear explanation of the main bottleneck or threat to this deal.
2. One decisive mitigation action the rep should take immediately to save the deal.`;

    const result = await geminiProvider.generateText({
      model: fastModel,
      prompt,
      temperature: 0.3,
      maxOutputTokens: 200,
    });

    const latencyMs = Date.now() - startTime;
    await AiUsageLog.create({
      tenantId: user.tenantId,
      userId: user._id,
      feature: 'explain_risk',
      modelName: fastModel,
      tokensIn: result.usage.inputTokens,
      tokensOut: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      latencyMs,
      estimatedCostPaise: Math.ceil((result.usage.totalTokens / 1000) * 2),
    });

    if (!deal.aiRisk) {
      deal.aiRisk = {
        level: riskData.level,
        score: riskData.score,
        reasons: riskData.reasons,
        evaluatedAt: riskData.evaluatedAt,
        explanation: result.text,
      };
    } else {
      deal.aiRisk.explanation = result.text;
    }
    await deal.save();

    return result.text;
  }
}
