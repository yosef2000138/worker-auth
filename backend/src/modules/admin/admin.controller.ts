import { Request, Response, NextFunction } from 'express';
import { RequestStatus, UserRole } from '@prisma/client';
import * as service from './admin.service';

// GET /api/v1/admin/dashboard
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getDashboard();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/v1/admin/analytics
export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getAnalytics(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listUsers({
      role: req.query.role as UserRole | undefined,
      isActive: typeof req.query.isActive === 'boolean' ? req.query.isActive : undefined,
      search: req.query.search as string | undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getUser(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.suspendUser(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function reinstateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.reinstateUser(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Workers ──────────────────────────────────────────────────────────────────

export async function listWorkers(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listWorkers({
      approved: typeof req.query.approved === 'boolean' ? req.query.approved : undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function approveWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.approveWorker(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function revokeWorker(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.revokeWorkerApproval(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export async function listRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listRequestsAdmin({
      status: req.query.status as RequestStatus | undefined,
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function cancelRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.cancelRequestAdmin(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listCategories();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createCategory(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateCategory(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.deleteCategory(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
