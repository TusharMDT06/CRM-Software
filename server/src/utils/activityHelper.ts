import { Types } from 'mongoose';
import { Activity, ActivityType, EntityType, CallOutcome } from '../models/Activity.js';

interface LogActivityParams {
  type: ActivityType;
  subject: string;
  body?: string;
  entityType: EntityType;
  entityId: string | Types.ObjectId;
  createdBy: string | Types.ObjectId;
  occurredAt?: Date;
  durationMins?: number;
  outcome?: CallOutcome;
  messageId?: string;
}

export async function logActivity(params: LogActivityParams) {
  try {
    return await Activity.create({
      type: params.type,
      subject: params.subject,
      body: params.body || '',
      entityType: params.entityType,
      entityId: params.entityId,
      createdBy: params.createdBy,
      occurredAt: params.occurredAt || new Date(),
      durationMins: params.durationMins,
      outcome: params.outcome,
      messageId: params.messageId,
    });
  } catch (error) {
    console.error('[Activity Logging Error]', error);
    return null;
  }
}
