import { Request } from 'express';
import { IUser } from '../models/User.js';
import { ITenant } from '../models/Tenant.js';

export interface AuthRequest extends Request {
  user?: IUser;
  tenant?: ITenant;
  isImpersonating?: boolean;
  requestId?: string;
  clientMutationId?: string;
}

export type RealtimeEntityType =
  | 'lead'
  | 'contact'
  | 'account'
  | 'deal'
  | 'task'
  | 'message'
  | 'user'
  | 'leadSource';

export type RealtimeActionType = 'created' | 'updated' | 'deleted' | 'bulk';

export interface EntityChangedPayload {
  entity: RealtimeEntityType;
  action: RealtimeActionType;
  id?: string;
  orgId: string;
  actorId?: string;
  clientMutationId?: string;
  updatedAt?: string | Date;
  data?: any;
}

export interface LeadSourceBarItem {
  source: string;
  count: number;
  percentage: number;
}

export interface ConnectedChannelStatus {
  id: string;
  name: string;
  channel: string;
  status: 'connected' | 'setup_needed' | 'error';
  lastLeadAt?: string | Date | null;
}

export interface LeadSourcesSummaryReport {
  newLeadsThisWeek: number;
  newLeadsDeltaPercent: number;
  totalLeads: number;
  bySource: LeadSourceBarItem[];
  connectedChannels: ConnectedChannelStatus[];
}
