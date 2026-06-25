import { Request, Response, NextFunction } from 'express';
import * as service from './users.service';

// GET /api/v1/users/profile
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getProfile(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/users/profile
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateProfile(req.user!.sub, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/users/change-password
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.changePassword(req.user!.sub, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/users/favorites
export async function getFavorites(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getFavorites(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/users/favorites/:workerId
export async function addFavorite(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.addFavorite(req.user!.sub, req.params.workerId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/users/favorites/:workerId
export async function removeFavorite(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.removeFavorite(req.user!.sub, req.params.workerId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/users/history
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const data = await service.getRequestHistory(req.user!.sub, req.user!.role, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
