import { Prisma } from '@prisma/client';
import { db } from '../../config/database';
import { CreateReviewInput } from './reviews.schema';

const reviewSelect = {
  id: true,
  requestId: true,
  rating: true,
  comment: true,
  createdAt: true,
  reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
  reviewee: { select: { id: true, fullName: true, avatarUrl: true } },
  request: {
    select: {
      id: true,
      title: true,
      category: { select: { id: true, name: true, icon: true } },
    },
  },
} satisfies Prisma.ReviewSelect;

function normalizeComment(comment?: string | null) {
  const trimmed = comment?.trim();
  return trimmed ? trimmed : undefined;
}

async function loadReviewRequest(requestId: string) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      category: { select: { id: true, name: true, icon: true } },
      worker: { include: { user: true } },
      review: { select: reviewSelect },
    },
  });

  if (!request) throw { status: 404, message: 'Request not found' };
  return request;
}

// ─── Rating eligibility ──────────────────────────────────────────────────────
export async function getRatingEligibility(customerId: string, requestId: string) {
  const request = await loadReviewRequest(requestId);

  if (request.customerId !== customerId) {
    throw { status: 403, message: 'Only the customer can review this request' };
  }

  const completed = request.status === 'COMPLETED';
  const hasWorker = Boolean(request.workerId && request.worker);
  const alreadyRated = Boolean(request.review);

  return {
    requestId,
    completed,
    hasWorker,
    alreadyRated,
    canRate: completed && hasWorker && !alreadyRated,
    request: {
      id: request.id,
      title: request.title,
      category: request.category,
      completedAt: completed ? request.updatedAt : null,
    },
    worker: request.worker
      ? {
        id: request.worker.id,
        ratingAvg: request.worker.ratingAvg,
        totalReviews: request.worker.totalReviews,
        user: {
          id: request.worker.user.id,
          fullName: request.worker.user.fullName,
          avatarUrl: request.worker.user.avatarUrl,
        },
      }
      : null,
    review: request.review,
  };
}

// ─── Create review ────────────────────────────────────────────────────────────
export async function createReview(reviewerId: string, input: CreateReviewInput) {
  return createRequestReview(reviewerId, input.requestId, input);
}

export async function createRequestReview(
  reviewerId: string,
  requestId: string,
  input: Pick<CreateReviewInput, 'rating' | 'comment'>,
) {
  try {
    return await db.$transaction(async (tx) => {
      const request = await tx.serviceRequest.findUnique({
        where: { id: requestId },
        include: { worker: true, review: true },
      });

      if (!request) throw { status: 404, message: 'Request not found' };
      if (request.status !== 'COMPLETED') {
        throw { status: 422, message: 'Can only review completed requests' };
      }
      if (request.customerId !== reviewerId) {
        throw { status: 403, message: 'Only the customer can review this request' };
      }
      if (!request.workerId || !request.worker) {
        throw { status: 422, message: 'No worker assigned to this request' };
      }
      if (request.review) throw { status: 409, message: 'Request already reviewed' };

      const review = await tx.review.create({
        data: {
          requestId,
          reviewerId,
          revieweeId: request.worker.userId,
          rating: input.rating,
          comment: normalizeComment(input.comment),
        },
        select: reviewSelect,
      });

      const agg = await tx.review.aggregate({
        where: { revieweeId: request.worker.userId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.worker.update({
        where: { id: request.workerId },
        data: {
          ratingAvg: agg._avg.rating ?? 0,
          totalReviews: agg._count.rating,
        },
      });

      return review;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw { status: 409, message: 'Request already reviewed' };
    }

    throw error;
  }
}

// ─── List reviews for a worker ────────────────────────────────────────────────
export async function getWorkerReviews(
  workerId: string,
  page: number,
  limit: number,
) {
  const worker = await db.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw { status: 404, message: 'Worker not found' };

  const skip = (page - 1) * limit;

  const [total, items] = await Promise.all([
    db.review.count({ where: { revieweeId: worker.userId } }),
    db.review.findMany({
      where: { revieweeId: worker.userId },
      select: {
        id: true,
        requestId: true,
        rating: true,
        comment: true,
        createdAt: true,
        reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
        request: {
          select: {
            id: true,
            title: true,
            category: { select: { id: true, name: true, icon: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    ratingAvg: worker.ratingAvg,
    totalReviews: worker.totalReviews,
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// ─── Get single review ────────────────────────────────────────────────────────
export async function getReview(id: string) {
  const review = await db.review.findUnique({
    where: { id },
    select: {
      id: true,
      requestId: true,
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
      reviewee: { select: { id: true, fullName: true, avatarUrl: true } },
      request: {
        select: {
          id: true,
          title: true,
          category: { select: { id: true, name: true, icon: true } },
        },
      },
    },
  });
  if (!review) throw { status: 404, message: 'Review not found' };
  return review;
}
