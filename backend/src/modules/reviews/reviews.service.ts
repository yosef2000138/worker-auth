import { Prisma, RequestStatus } from '@prisma/client';
import { db } from '../../config/database';
import { CreateReviewInput } from './reviews.schema';

type ReviewActor = {
  id: string;
  role: string;
};

type ReviewEligibilityRequest = {
  id?: string;
  customerId: string;
  status: RequestStatus;
  workerId: string | null;
  worker?: { id: string; userId: string } | null;
  review?: { id: string } | null;
};

type RatingDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

export const publicReviewSelect = {
  id: true,
  requestId: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
  reviewee: { select: { id: true, fullName: true, avatarUrl: true } },
  request: {
    select: {
      id: true,
      category: { select: { id: true, name: true, icon: true } },
    },
  },
} satisfies Prisma.ReviewSelect;

export const requestReviewSelect = {
  id: true,
  requestId: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
} satisfies Prisma.ReviewSelect;

function apiError(status: number, code: string, message: string, details?: unknown) {
  return {
    status,
    code,
    message,
    ...(details !== undefined && { details }),
  };
}

export function normalizeReviewComment(comment?: string | null) {
  const trimmed = comment?.trim();
  return trimmed ? trimmed : null;
}

export function assertReviewEligibility(actor: ReviewActor | null | undefined, request: ReviewEligibilityRequest) {
  if (!actor) {
    throw apiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  if (actor.role !== 'CUSTOMER') {
    throw apiError(403, 'REVIEW_NOT_ALLOWED', 'Only customers can review completed requests');
  }

  if (request.customerId !== actor.id) {
    throw apiError(403, 'REVIEW_NOT_ALLOWED', 'Only the customer can review this request');
  }

  if (request.status !== 'COMPLETED') {
    throw apiError(400, 'REQUEST_NOT_COMPLETED', 'Request must be completed before it can be reviewed');
  }

  if (!request.workerId || !request.worker) {
    throw apiError(400, 'REQUEST_HAS_NO_WORKER', 'Request has no assigned worker');
  }

  if (request.worker.userId === actor.id) {
    throw apiError(403, 'REVIEW_NOT_ALLOWED', 'Customers cannot review themselves');
  }

  if (request.review) {
    throw apiError(409, 'REVIEW_ALREADY_EXISTS', 'Request already reviewed');
  }

  return {
    customerId: actor.id,
    workerId: request.workerId,
    workerUserId: request.worker.userId,
  };
}

export function emptyRatingDistribution(): RatingDistribution {
  return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
}

export function buildRatingSummary(ratings: number[]) {
  const ratingDistribution = emptyRatingDistribution();
  for (const rating of ratings) {
    const key = String(rating) as keyof RatingDistribution;
    if (key in ratingDistribution) ratingDistribution[key] += 1;
  }

  const reviewCount = ratings.length;
  const averageRating = reviewCount > 0
    ? ratings.reduce((sum, rating) => sum + rating, 0) / reviewCount
    : null;

  return {
    averageRating,
    reviewCount,
    ratingDistribution,
  };
}

export function mapReviewCreateError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return apiError(409, 'REVIEW_ALREADY_EXISTS', 'Request already reviewed');
  }

  return error;
}

export function buildWorkerReviewsWhere(workerUserId: string) {
  return { revieweeId: workerUserId };
}

async function getWorkerRatingSummary(
  client: Prisma.TransactionClient | typeof db,
  workerUserId: string,
) {
  const [aggregate, grouped] = await Promise.all([
    client.review.aggregate({
      where: buildWorkerReviewsWhere(workerUserId),
      _avg: { rating: true },
      _count: { rating: true },
    }),
    client.review.groupBy({
      by: ['rating'],
      where: buildWorkerReviewsWhere(workerUserId),
      _count: { rating: true },
    }),
  ]);

  const ratingDistribution = emptyRatingDistribution();
  grouped.forEach(row => {
    const key = String(row.rating) as keyof RatingDistribution;
    if (key in ratingDistribution) ratingDistribution[key] = row._count.rating;
  });

  const reviewCount = aggregate._count.rating;

  return {
    averageRating: reviewCount > 0 ? aggregate._avg.rating : null,
    reviewCount,
    ratingDistribution,
  };
}

async function updateWorkerRating(
  client: Prisma.TransactionClient,
  workerId: string,
  workerUserId: string,
) {
  const summary = await getWorkerRatingSummary(client, workerUserId);

  await client.worker.update({
    where: { id: workerId },
    data: {
      ratingAvg: summary.averageRating ?? 0,
      totalReviews: summary.reviewCount,
    },
  });

  return summary;
}

async function loadReviewRequest(requestId: string) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      category: { select: { id: true, name: true, icon: true } },
      worker: { include: { user: true } },
      review: { select: publicReviewSelect },
    },
  });

  if (!request) throw apiError(404, 'REQUEST_NOT_FOUND', 'Request not found');
  return request;
}

export async function getRatingEligibility(actor: ReviewActor, requestId: string) {
  const request = await loadReviewRequest(requestId);

  if (actor.role !== 'CUSTOMER') {
    throw apiError(403, 'REVIEW_NOT_ALLOWED', 'Only customers can review completed requests');
  }

  if (request.customerId !== actor.id) {
    throw apiError(403, 'REVIEW_NOT_ALLOWED', 'Only the customer can review this request');
  }

  const completed = request.status === 'COMPLETED';
  const hasWorker = Boolean(request.workerId && request.worker);
  const alreadyRated = Boolean(request.review);
  const selfReview = Boolean(request.worker?.userId === actor.id);

  return {
    requestId,
    completed,
    hasWorker,
    alreadyRated,
    canRate: completed && hasWorker && !alreadyRated && !selfReview,
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

export async function getRequestReview(actor: ReviewActor, requestId: string) {
  const eligibility = await getRatingEligibility(actor, requestId);

  return {
    requestId,
    canReview: eligibility.canRate,
    review: eligibility.review,
    eligibility,
  };
}

export async function createReview(actor: ReviewActor, input: CreateReviewInput) {
  return createRequestReview(actor, input.requestId, input);
}

export async function createRequestReview(
  actor: ReviewActor,
  requestId: string,
  input: Pick<CreateReviewInput, 'rating' | 'comment'>,
) {
  try {
    return await db.$transaction(async (tx) => {
      const request = await tx.serviceRequest.findUnique({
        where: { id: requestId },
        include: {
          worker: { include: { user: true } },
          review: { select: { id: true } },
        },
      });

      if (!request) throw apiError(404, 'REQUEST_NOT_FOUND', 'Request not found');

      const reviewContext = assertReviewEligibility(actor, request);
      const review = await tx.review.create({
        data: {
          requestId,
          reviewerId: reviewContext.customerId,
          revieweeId: reviewContext.workerUserId,
          rating: input.rating,
          comment: normalizeReviewComment(input.comment),
        },
        select: publicReviewSelect,
      });

      const workerRating = await updateWorkerRating(
        tx,
        reviewContext.workerId,
        reviewContext.workerUserId,
      );

      return {
        review,
        workerRating,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    throw mapReviewCreateError(error);
  }
}

export async function getWorkerReviews(
  workerId: string,
  page: number,
  limit: number,
) {
  const worker = await db.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw apiError(404, 'REQUEST_NOT_FOUND', 'Worker not found');

  const skip = (page - 1) * limit;
  const where = buildWorkerReviewsWhere(worker.userId);

  const [summary, total, items] = await Promise.all([
    getWorkerRatingSummary(db, worker.userId),
    db.review.count({ where }),
    db.review.findMany({
      where,
      select: {
        id: true,
        requestId: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
        request: {
          select: {
            id: true,
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
    averageRating: summary.averageRating,
    reviewCount: summary.reviewCount,
    ratingDistribution: summary.ratingDistribution,
    ratingAvg: summary.averageRating,
    totalReviews: summary.reviewCount,
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function getReview(id: string) {
  const review = await db.review.findUnique({
    where: { id },
    select: publicReviewSelect,
  });

  if (!review) throw apiError(404, 'REQUEST_NOT_FOUND', 'Review not found');
  return review;
}
