import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { checkRecordLimit } from '../utils/planLimits.js';

export async function requireWithinRecordLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.user?.tenantId) {
      await checkRecordLimit(req.user.tenantId.toString());
    }
    next();
  } catch (error: any) {
    if (error.name === 'PlanLimitError') {
      res.status(403).json({ message: error.message });
      return;
    }
    next(error);
  }
}
