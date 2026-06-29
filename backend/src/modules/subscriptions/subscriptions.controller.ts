import { Request, Response, NextFunction } from 'express';
import * as service from './subscriptions.service';

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getMySubscriptionStatus(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function revenueCatWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const authorization = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    const data = await service.handleRevenueCatWebhook(req.body, authorization);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
