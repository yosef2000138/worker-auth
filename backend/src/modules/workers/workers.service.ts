import { Prisma } from '@prisma/client';
import { db } from '../../config/database';
import {
  UpdateWorkerProfileInput,
  SetCategoriesInput,
  SetAvailabilityInput,
} from './workers.schema';

// ─── Shared worker select ─────────────────────────────────────────────────────
const workerSelect = {
  id: true,
  bio: true,
  yearsExp: true,
  hourlyRate: true,
  fixedPrice: true,
  isAvailable: true,
  ratingAvg: true,
  totalReviews: true,
  totalJobs: true,
  workingRadius: true,
  approvedAt: true,
  createdAt: true,
  user: {
    select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
  },
  categories: {
    select: { category: { select: { id: true, name: true, icon: true } } },
  },
  availability: {
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true },
    orderBy: { dayOfWeek: 'asc' as const },
  },
} satisfies Prisma.WorkerSelect;

// ─── Search / list workers ────────────────────────────────────────────────────
export async function searchWorkers(query: {
  categoryId?: string;
  lat?: number;
  lng?: number;
  minRating?: number;
  maxRate?: number;
  page: number;
  limit: number;
  sort?: string;
}) {
  const { page, limit, categoryId, minRating, maxRate, sort } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.WorkerWhereInput = {
    approvedAt: { not: null },
    isAvailable: true,
    ...(categoryId && {
      categories: { some: { categoryId } },
    }),
    ...(minRating !== undefined && { ratingAvg: { gte: minRating } }),
    ...(maxRate !== undefined && {
      OR: [{ hourlyRate: { lte: maxRate } }, { fixedPrice: { lte: maxRate } }],
    }),
  };

  const orderBy: Prisma.WorkerOrderByWithRelationInput =
    sort === 'rating'
      ? { ratingAvg: 'desc' }
      : sort === 'jobs'
      ? { totalJobs: 'desc' }
      : sort === 'rate'
      ? { hourlyRate: 'asc' }
      : { ratingAvg: 'desc' };

  const [total, items] = await Promise.all([
    db.worker.count({ where }),
    db.worker.findMany({
      where,
      select: workerSelect,
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// ─── Get one worker (public profile) ─────────────────────────────────────────
export async function getWorker(id: string) {
  const worker = await db.worker.findUnique({
    where: { id },
    select: workerSelect,
  });
  if (!worker) throw { status: 404, message: 'Worker not found' };
  return worker;
}

// ─── Get own worker profile ───────────────────────────────────────────────────
export async function getMyWorkerProfile(userId: string) {
  const worker = await db.worker.findUnique({
    where: { userId },
    select: workerSelect,
  });
  if (!worker) throw { status: 404, message: 'Worker profile not found' };
  return worker;
}

// ─── Update own worker profile ────────────────────────────────────────────────
export async function updateWorkerProfile(userId: string, input: UpdateWorkerProfileInput) {
  const worker = await db.worker.findUnique({ where: { userId } });
  if (!worker) throw { status: 404, message: 'Worker profile not found' };

  const updated = await db.worker.update({
    where: { userId },
    data: {
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.yearsExp !== undefined && { yearsExp: input.yearsExp }),
      ...(input.hourlyRate !== undefined && { hourlyRate: input.hourlyRate }),
      ...(input.fixedPrice !== undefined && { fixedPrice: input.fixedPrice }),
      ...(input.workingRadius !== undefined && { workingRadius: input.workingRadius }),
    },
    select: workerSelect,
  });

  return updated;
}

// ─── Set categories ───────────────────────────────────────────────────────────
export async function setCategories(userId: string, input: SetCategoriesInput) {
  const worker = await db.worker.findUnique({ where: { userId } });
  if (!worker) throw { status: 404, message: 'Worker profile not found' };

  // Verify all categories exist
  const cats = await db.serviceCategory.findMany({
    where: { id: { in: input.categoryIds }, isActive: true },
  });
  if (cats.length !== input.categoryIds.length) {
    throw { status: 400, message: 'One or more category IDs are invalid' };
  }

  // Replace all categories atomically
  await db.$transaction([
    db.workerCategory.deleteMany({ where: { workerId: worker.id } }),
    db.workerCategory.createMany({
      data: input.categoryIds.map((categoryId) => ({
        workerId: worker.id,
        categoryId,
      })),
    }),
  ]);

  return getMyWorkerProfile(userId);
}

// ─── Set availability ─────────────────────────────────────────────────────────
export async function setAvailability(userId: string, input: SetAvailabilityInput) {
  const worker = await db.worker.findUnique({ where: { userId } });
  if (!worker) throw { status: 404, message: 'Worker profile not found' };

  await db.$transaction([
    db.workerAvailability.deleteMany({ where: { workerId: worker.id } }),
    db.workerAvailability.createMany({
      data: input.slots.map((slot) => ({
        workerId: worker.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    }),
  ]);

  const availability = await db.workerAvailability.findMany({
    where: { workerId: worker.id },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true },
    orderBy: { dayOfWeek: 'asc' },
  });

  return availability;
}

// ─── Toggle availability status ───────────────────────────────────────────────
export async function toggleAvailability(userId: string, isAvailable: boolean) {
  const worker = await db.worker.findUnique({ where: { userId } });
  if (!worker) throw { status: 404, message: 'Worker profile not found' };

  const updated = await db.worker.update({
    where: { userId },
    data: { isAvailable },
    select: { id: true, isAvailable: true },
  });

  return updated;
}

// ─── Worker earnings summary ──────────────────────────────────────────────────
export async function getEarnings(userId: string) {
  const worker = await db.worker.findUnique({ where: { userId } });
  if (!worker) throw { status: 404, message: 'Worker profile not found' };

  const payments = await db.payment.findMany({
    where: {
      request: { worker: { userId } },
      status: 'COMPLETED',
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      createdAt: true,
      request: {
        select: { id: true, title: true, updatedAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalEarnings = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  return {
    totalEarnings,
    totalJobs: worker.totalJobs,
    payments,
  };
}
