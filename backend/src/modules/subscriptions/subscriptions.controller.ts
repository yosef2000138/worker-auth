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
    const signature = Array.isArray(req.headers['x-revenuecat-webhook-signature'])
      ? req.headers['x-revenuecat-webhook-signature'][0]
      : req.headers['x-revenuecat-webhook-signature'];
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const data = await service.handleRevenueCatWebhook(req.body, authorization, rawBody, signature);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
