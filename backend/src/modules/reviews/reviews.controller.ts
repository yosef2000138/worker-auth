import { Request, Response, NextFunction } from 'express';
import * as service from './reviews.service';

// POST /api/v1/reviews
export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createReview({ id: req.user!.sub, role: req.user!.role }, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/reviews/worker/:workerId
export async function getWorkerReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getWorkerReviews(
      req.params.workerId,
      Number(req.query.page ?? 1),
      Number(req.query.limit ?? 10),
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/reviews/:id
export async function getReview(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getReview(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
