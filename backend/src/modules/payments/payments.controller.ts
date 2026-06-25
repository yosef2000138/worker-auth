import { Request, Response, NextFunction } from 'express';
import * as service from './payments.service';

// POST /api/v1/payments/create-intent
export async function createIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createPaymentIntent(req.user!.sub, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/payments/confirm
export async function confirm(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.confirmPayment(req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/payments/cash
export async function recordCash(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.recordCashPayment(
      req.user!.sub,
      req.body.requestId,
      req.body.amount,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/payments/request/:requestId
export async function getByRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getPaymentByRequest(req.params.requestId, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/payments/history
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getPaymentHistory(
      req.user!.sub,
      req.user!.role,
      Number(req.query.page ?? 1),
      Number(req.query.limit ?? 10),
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
