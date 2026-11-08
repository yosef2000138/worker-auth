import { Prisma, RequestStatus, UserRole } from '@prisma/client';
import { db } from '../../config/database';
import { revokeSession } from '../../config/redis';
import { disconnectUserSockets } from '../../sockets';
import {
  expireOffersForCancelledRequest,
  lockRequestOfferSlot,
  notifyCancelledOfferRecipients,
} from '../requests/offers.service';

// ─── Dashboard stats ──────────────────────────────────────────────────────────
export async function getDashboard() {
  const [
    totalUsers,
    totalWorkers,
    totalRequests,
    completedRequests,
    pendingRequests,
    totalRevenue,
    topCategories,
  ] = await Promise.all([
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.worker.count(),
    db.serviceRequest.count(),
    db.serviceRequest.count({ where: { status: 'COMPLETED' } }),
    db.serviceRequest.count({ where: { status: 'PENDING' } }),
    db.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    db.serviceRequest.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ]);

  // Resolve category names
  const categoryIds = topCategories.map((c) => c.categoryId);
  const categories = await db.serviceCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true },
  });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return {
    totalUsers,
    totalWorkers,
    totalRequests,
    completedRequests,
    pendingRequests,
    totalRevenue: Number(totalRevenue._sum.amount ?? 0),
    topCategories: topCategories.map((c) => ({
      category: catMap[c.categoryId],
      count: c._count.id,
    })),
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getAnalytics(from?: string, to?: string) {
  const dateFilter: Prisma.ServiceRequestWhereInput = {
    ...(from && { createdAt: { gte: new Date(from) } }),
    ...(to && { createdAt: { lte: new Date(to) } }),
  };

  const [requests, revenue, newUsers, newWorkers] = await Promise.all([
    db.serviceRequest.groupBy({
      by: ['status'],
      where: dateFilter,
      _count: { id: true },
    }),
    db.payment.aggregate({
      where: {
        status: 'COMPLETED',
        ...(from || to
          ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }
          : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.user.count({
      where: {
        role: 'CUSTOMER',
        ...(from && { createdAt: { gte: new Date(from) } }),
        ...(to && { createdAt: { lte: new Date(to) } }),
      },
    }),
    db.worker.count({
      where: {
        ...(from && { createdAt: { gte: new Date(from) } }),
        ...(to && { createdAt: { lte: new Date(to) } }),
      },
    }),
  ]);

  return {
    requests: Object.fromEntries(requests.map((r) => [r.status, r._count.id])),
    revenue: {
      total: Number(revenue._sum.amount ?? 0),
      transactionCount: revenue._count.id,
    },
    newUsers,
    newWorkers,
    period: { from, to },
  };
}

// ─── Users management ─────────────────────────────────────────────────────────
export async function listUsers(opts: {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}) {
  const { role, isActive, search, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [total, items] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: {
        id: true, fullName: true, email: true, phone: true,
        role: true, avatarUrl: true, isVerified: true, isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function getUser(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, email: true, phone: true,
      role: true, avatarUrl: true, isVerified: true, isActive: true, createdAt: true,
      subscriptions: {
        select: {
          id: true,
          provider: true,
          entitlementId: true,
          storeProductId: true,
          platform: true,
          environment: true,
          status: true,
          expirationDate: true,
          willRenew: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      worker: {
        select: {
          id: true, bio: true, ratingAvg: true, totalJobs: true,
          totalReviews: true, isAvailable: true, approvedAt: true,
        },
      },
    },
  });
  if (!user) throw { status: 404, message: 'User not found' };
  return user;
}

export async function suspendUser(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw { status: 404, message: 'User not found' };
  if (user.role === 'ADMIN') throw { status: 403, message: 'Cannot suspend an admin' };

  const suspended = await db.user.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, isActive: true, email: true },
  });
  await revokeSession(id);
  disconnectUserSockets(id);
  return suspended;
}

export async function reinstateUser(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw { status: 404, message: 'User not found' };

  return db.user.update({
    where: { id },
    data: { isActive: true },
    select: { id: true, isActive: true, email: true },
  });
}

// ─── Workers management ───────────────────────────────────────────────────────
export async function listWorkers(opts: {
  approved?: boolean;
  page: number;
  limit: number;
}) {
  const { approved, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: Prisma.WorkerWhereInput = {
    ...(approved === true && { approvedAt: { not: null } }),
    ...(approved === false && { approvedAt: null }),
  };

  const [total, items] = await Promise.all([
    db.worker.count({ where }),
    db.worker.findMany({
      where,
      select: {
        id: true, bio: true, ratingAvg: true, totalJobs: true, totalReviews: true,
        isAvailable: true, approvedAt: true, createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
            subscriptions: {
              select: {
                id: true,
                provider: true,
                entitlementId: true,
                storeProductId: true,
                platform: true,
                environment: true,
                status: true,
                expirationDate: true,
                willRenew: true,
                updatedAt: true,
              },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
        categories: { select: { category: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function approveWorker(id: string) {
  const worker = await db.worker.findUnique({ where: { id } });
  if (!worker) throw { status: 404, message: 'Worker not found' };
  if (worker.approvedAt) throw { status: 409, message: 'Worker already approved' };

  return db.worker.update({
    where: { id },
    data: { approvedAt: new Date() },
    select: { id: true, approvedAt: true, user: { select: { email: true, fullName: true } } },
  });
}

export async function revokeWorkerApproval(id: string) {
  const worker = await db.worker.findUnique({ where: { id } });
  if (!worker) throw { status: 404, message: 'Worker not found' };

  return db.worker.update({
    where: { id },
    data: { approvedAt: null },
    select: { id: true, approvedAt: true },
  });
}

// ─── Jobs / requests management ───────────────────────────────────────────────
export async function listRequestsAdmin(opts: {
  status?: RequestStatus;
  page: number;
  limit: number;
}) {
  const { status, page, limit } = opts;
  const skip = (page - 1) * limit;

  const where: Prisma.ServiceRequestWhereInput = {
    ...(status && { status }),
  };

  const [total, items] = await Promise.all([
    db.serviceRequest.count({ where }),
    db.serviceRequest.findMany({
      where,
      select: {
        id: true, title: true, status: true, paymentMethod: true,
        priceAgreed: true, lat: true, lng: true, address: true,
        createdAt: true, updatedAt: true,
        category: { select: { id: true, name: true } },
        customer: { select: { id: true, fullName: true, email: true } },
        worker: { select: { id: true, user: { select: { id: true, fullName: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function cancelRequestAdmin(id: string) {
  const result = await db.$transaction(async tx => {
    await lockRequestOfferSlot(tx, id);
    const request = await tx.serviceRequest.findUnique({ where: { id } });
    if (!request) throw { status: 404, message: 'Request not found' };
    if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
      throw { status: 422, message: `Cannot cancel a ${request.status.toLowerCase()} request` };
    }

    const changed = await tx.serviceRequest.updateMany({
      where: { id, status: request.status },
      data: { status: 'CANCELLED', activeJobKey: null },
    });
    if (changed.count !== 1) {
      throw { status: 409, code: 'REQUEST_STATUS_CHANGED', message: 'Request status changed. Refresh and try again.' };
    }
    const expiredOffers = await expireOffersForCancelledRequest(tx, id);
    return { request: { id, status: 'CANCELLED' as const }, expiredOffers };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  notifyCancelledOfferRecipients(id, result.expiredOffers);
  return result.request;
}

// ─── Service categories management ───────────────────────────────────────────
export async function listCategories() {
  return db.serviceCategory.findMany({
    select: { id: true, name: true, icon: true, description: true, isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(data: { name: string; icon?: string; description?: string }) {
  const existing = await db.serviceCategory.findFirst({ where: { name: data.name } });
  if (existing) throw { status: 409, message: 'Category with this name already exists' };

  return db.serviceCategory.create({
    data,
    select: { id: true, name: true, icon: true, description: true, isActive: true },
  });
}

export async function updateCategory(
  id: string,
  data: { name?: string; icon?: string; description?: string; isActive?: boolean },
) {
  const cat = await db.serviceCategory.findUnique({ where: { id } });
  if (!cat) throw { status: 404, message: 'Category not found' };

  return db.serviceCategory.update({
    where: { id },
    data,
    select: { id: true, name: true, icon: true, description: true, isActive: true },
  });
}

export async function deleteCategory(id: string) {
  const cat = await db.serviceCategory.findUnique({ where: { id } });
  if (!cat) throw { status: 404, message: 'Category not found' };

  const used = await db.serviceRequest.count({ where: { categoryId: id } });
  if (used > 0) {
    // Soft delete — just deactivate
    await db.serviceCategory.update({ where: { id }, data: { isActive: false } });
    return { message: 'Category deactivated (has associated requests)' };
  }

  await db.serviceCategory.delete({ where: { id } });
  return { message: 'Category deleted' };
}
