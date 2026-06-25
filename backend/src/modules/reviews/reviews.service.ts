import { db } from '../../config/database';
import { CreateReviewInput } from './reviews.schema';

// ─── Create review ────────────────────────────────────────────────────────────
export async function createReview(reviewerId: string, input: CreateReviewInput) {
  // Request must be completed
  const request = await db.serviceRequest.findUnique({
    where: { id: input.requestId },
    include: { worker: true },
  });

  if (!request) throw { status: 404, message: 'Request not found' };
  if (request.status !== 'COMPLETED') {
    throw { status: 422, message: 'Can only review completed requests' };
  }
  if (request.customerId !== reviewerId) {
    throw { status: 403, message: 'Only the customer can review this request' };
  }
  if (!request.workerId) {
    throw { status: 422, message: 'No worker assigned to this request' };
  }

  // Prevent duplicate reviews
  const existing = await db.review.findUnique({ where: { requestId: input.requestId } });
  if (existing) throw { status: 409, message: 'Request already reviewed' };

  const review = await db.review.create({
    data: {
      requestId: input.requestId,
      reviewerId,
      revieweeId: request.worker!.userId,
      rating: input.rating,
      comment: input.comment,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
      reviewee: { select: { id: true, fullName: true } },
      request: { select: { id: true, title: true } },
    },
  });

  // Recalculate worker rating
  const agg = await db.review.aggregate({
    where: { revieweeId: request.worker!.userId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await db.worker.update({
    where: { id: request.workerId },
    data: {
      ratingAvg: agg._avg.rating ?? 0,
      totalReviews: agg._count.rating,
    },
  });

  return review;
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
        rating: true,
        comment: true,
        createdAt: true,
        reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
        request: { select: { id: true, title: true } },
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
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
      reviewee: { select: { id: true, fullName: true } },
      request: { select: { id: true, title: true } },
    },
  });
  if (!review) throw { status: 404, message: 'Review not found' };
  return review;
}
