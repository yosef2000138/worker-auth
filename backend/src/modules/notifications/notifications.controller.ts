import { Request, Response, NextFunction } from 'express';
import * as service from './notifications.service';

// GET /api/v1/notifications
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listNotifications(req.user!.sub, {
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
      unreadOnly: (req.query as Record<string, unknown>).unreadOnly === true,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/notifications/:id/read
export async function markOneRead(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.markOneRead(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/notifications/read-all
export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.markAllRead(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/notifications/:id
export async function deleteOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.deleteNotification(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
