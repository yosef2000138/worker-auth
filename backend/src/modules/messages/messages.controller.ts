import { Request, Response, NextFunction } from 'express';
import * as service from './messages.service';

// GET /api/v1/messages/:requestId
export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listMessages(req.params.requestId, req.user!.sub, {
      before: req.query.before as string | undefined,
      limit: Number(req.query.limit ?? 50),
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/messages/:requestId
export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.sendMessage(
      req.params.requestId,
      req.user!.sub,
      req.body.content,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/messages/:requestId/read
export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.markRead(req.params.requestId, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/messages/unread-count
export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getUnreadCount(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
