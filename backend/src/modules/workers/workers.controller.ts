import { Request, Response, NextFunction } from 'express';
import * as service from './workers.service';

// GET /api/v1/workers  — public search
export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.searchWorkers({
      categoryId: req.query.categoryId as string | undefined,
      lat: req.query.lat ? Number(req.query.lat) : undefined,
      lng: req.query.lng ? Number(req.query.lng) : undefined,
      minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
      maxRate: req.query.maxRate ? Number(req.query.maxRate) : undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 10),
      sort: req.query.sort as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/workers/me  — authenticated worker's own profile
export async function getMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getMyWorkerProfile(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/workers/:id  — public worker profile
export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getWorker(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/workers/me  — update own profile
export async function updateMyProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateWorkerProfile(req.user!.sub, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/workers/me/categories  — set categories
export async function setCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.setCategories(req.user!.sub, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/workers/me/availability  — set availability slots
export async function setAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.setAvailability(req.user!.sub, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/workers/me/availability-status
export async function toggleAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.toggleAvailability(req.user!.sub, req.body.isAvailable);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/workers/me/earnings
export async function getEarnings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getEarnings(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
