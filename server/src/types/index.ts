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
