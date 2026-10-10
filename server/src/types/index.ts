import { Request } from 'express';
import { IUser } from '../models/User.js';

export interface AuthRequest extends Request {
  user?: IUser;
}
