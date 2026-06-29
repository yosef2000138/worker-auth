import { NextFunction, Request, Response } from 'express';
import { getMySubscriptionStatus } from './subscriptions.service';

export async function requireWorkerPro(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await getMySubscriptionStatus(req.user!.sub);

    if (!status.enabled) {
      res.status(402).json({
        success: false,
        message: 'Worker Pro is not available yet.',
        error: {
          code: 'WORKER_PRO_NOT_AVAILABLE',
          message: 'Worker Pro is not available yet.',
        },
      });
      return;
    }

    if (!status.hasAccess) {
      res.status(402).json({
        success: false,
        message: 'Worker Pro is required for this feature.',
        error: {
          code: 'WORKER_PRO_REQUIRED',
          message: 'Worker Pro is required for this feature.',
        },
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
