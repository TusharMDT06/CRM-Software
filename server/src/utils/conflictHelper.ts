import { Response } from 'express';

export function hasVersionConflict(existingDoc: any, incomingPayload: any): boolean {
  if (!incomingPayload) return false;

  if (incomingPayload.updatedAt) {
    const incomingTime = new Date(incomingPayload.updatedAt).getTime();
    const existingTime = new Date(existingDoc.updatedAt).getTime();
    // Allow a small 500ms grace window for clock drift
    if (existingTime - incomingTime > 500) {
      return true;
    }
  }

  return false;
}

export function sendConflictResponse(res: Response, latestDoc: any): void {
  res.status(409).json({
    message: 'Conflict: Record has been updated on another client. Please review the latest changes.',
    error: 'VERSION_CONFLICT',
    currentDocument: latestDoc,
  });
}
