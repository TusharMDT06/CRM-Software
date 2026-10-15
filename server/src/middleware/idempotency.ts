import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { ClientMutation } from '../models/ClientMutation.js';
import { logger } from '../utils/logger.js';

export async function idempotencyMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const mutationIdHeader = req.headers['x-client-mutation-id'];
  if (!mutationIdHeader) {
    return next();
  }

  const clientMutationId = String(mutationIdHeader).trim();
  if (!clientMutationId) {
    return next();
  }

  req.clientMutationId = clientMutationId;

  try {
    const existingMutation = await ClientMutation.findOne({ clientMutationId });
    if (existingMutation) {
      logger.info(`[Idempotency] Replaying cached response for mutation ${clientMutationId}`);
      res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_REPLAY');
      res.status(existingMutation.responseStatus).json(existingMutation.responseBody);
      return;
    }

    // Intercept response to persist on success
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Save asynchronously in background so we don't block response delivery
        ClientMutation.create({
          clientMutationId,
          tenantId: req.tenant?._id,
          userId: req.user?._id,
          path: req.originalUrl,
          method: req.method,
          responseStatus: res.statusCode,
          responseBody: body,
        }).catch((err) => {
          logger.warn(`[Idempotency] Failed to store client mutation ${clientMutationId}:`, err);
        });
      }
      return originalJson(body);
    };

    next();
  } catch (err: any) {
    logger.warn('[Idempotency] Error checking mutation record:', err);
    next();
  }
}
