import { Request, Response, NextFunction } from 'express';
import * as service from './requests.service';
import { RequestStatus } from '@prisma/client';

// POST /api/v1/requests
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const request = await service.createRequest(req.user!.sub, req.body, files);
    res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/requests
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listRequests(
      req.user!.sub,
      req.user!.role as 'CUSTOMER' | 'WORKER',
      {
        status: req.query.status as RequestStatus | undefined,
        page:   Number(req.query.page  ?? 1),
        limit:  Number(req.query.limit ?? 10),
      },
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/requests/:id
export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await service.getRequest(
      req.params.id,
      req.user!.sub,
      req.user!.role,
    );
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/requests/:id/status
export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await service.updateStatus(
      req.params.id,
      req.user!.sub,
      req.user!.role as 'CUSTOMER' | 'WORKER',
      req.body.status as RequestStatus,
      req.body.cancellationReason,
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/requests/:id/cancel
export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await service.cancelRequest(
      req.params.id,
      req.user!.sub,
      req.user!.role as 'CUSTOMER' | 'WORKER',
      req.body.reason,
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}