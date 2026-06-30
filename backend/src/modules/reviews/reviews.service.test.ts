import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, RequestStatus } from '@prisma/client';
import { createRequestReviewSchema } from '../requests/requests.schema';
import {
  assertReviewEligibility,
  buildRatingSummary,
  buildWorkerReviewsWhere,
  mapReviewCreateError,
  normalizeReviewComment,
} from './reviews.service';

const params = { id: '11111111-1111-4111-8111-111111111111' };
const customer = { id: 'customer-1', role: 'CUSTOMER' };
const otherCustomer = { id: 'customer-2', role: 'CUSTOMER' };
const workerActor = { id: 'worker-user-1', role: 'WORKER' };

function reviewRequest(overrides: Partial<{
  id: string;
  customerId: string;
  status: RequestStatus;
  workerId: string | null;
  worker: { id: string; userId: string } | null;
  review: { id: string } | null;
}> = {}) {
  return {
    id: 'request-1',
    customerId: customer.id,
    status: 'COMPLETED' as RequestStatus,
    workerId: 'worker-profile-1',
    worker: { id: 'worker-profile-1', userId: 'worker-user-1' },
    review: null,
    ...overrides,
  };
}

function expectReviewError(fn: () => unknown, code: string, status: number) {
  assert.throws(fn, (error: unknown) => {
    const typed = error as { code?: string; status?: number };
    return typed.code === code && typed.status === status;
  });
}

test('owning customer can review their completed request', () => {
  const context = assertReviewEligibility(customer, reviewRequest());

  assert.equal(context.customerId, customer.id);
  assert.equal(context.workerId, 'worker-profile-1');
  assert.equal(context.workerUserId, 'worker-user-1');
});

test('rating 1 is accepted', () => {
  const parsed = createRequestReviewSchema.parse({ params, body: { rating: 1 } });
  assert.equal(parsed.body.rating, 1);
});

test('rating 5 is accepted', () => {
  const parsed = createRequestReviewSchema.parse({ params, body: { rating: 5 } });
  assert.equal(parsed.body.rating, 5);
});

test('rating 0 is rejected', () => {
  assert.equal(createRequestReviewSchema.safeParse({ params, body: { rating: 0 } }).success, false);
});

test('rating 6 is rejected', () => {
  assert.equal(createRequestReviewSchema.safeParse({ params, body: { rating: 6 } }).success, false);
});

test('decimal rating is rejected', () => {
  assert.equal(createRequestReviewSchema.safeParse({ params, body: { rating: 4.5 } }).success, false);
});

test('comment is trimmed', () => {
  const parsed = createRequestReviewSchema.parse({
    params,
    body: { rating: 5, comment: ' Professional and on time. ' },
  });

  assert.equal(parsed.body.comment, 'Professional and on time.');
  assert.equal(normalizeReviewComment(' Professional and on time. '), 'Professional and on time.');
});

test('comment over 1000 characters is rejected', () => {
  assert.equal(createRequestReviewSchema.safeParse({
    params,
    body: { rating: 5, comment: 'a'.repeat(1001) },
  }).success, false);
});

test('customer cannot review a pending request', () => {
  expectReviewError(
    () => assertReviewEligibility(customer, reviewRequest({ status: 'PENDING' })),
    'REQUEST_NOT_COMPLETED',
    400,
  );
});

test('customer cannot review an accepted request', () => {
  expectReviewError(
    () => assertReviewEligibility(customer, reviewRequest({ status: 'ACCEPTED' })),
    'REQUEST_NOT_COMPLETED',
    400,
  );
});

test('customer cannot review an in-progress request', () => {
  expectReviewError(
    () => assertReviewEligibility(customer, reviewRequest({ status: 'IN_PROGRESS' })),
    'REQUEST_NOT_COMPLETED',
    400,
  );
});

test('customer cannot review another customer request', () => {
  expectReviewError(
    () => assertReviewEligibility(otherCustomer, reviewRequest()),
    'REVIEW_NOT_ALLOWED',
    403,
  );
});

test('worker cannot review the request', () => {
  expectReviewError(
    () => assertReviewEligibility(workerActor, reviewRequest()),
    'REVIEW_NOT_ALLOWED',
    403,
  );
});

test('unauthenticated user cannot review', () => {
  expectReviewError(
    () => assertReviewEligibility(null, reviewRequest()),
    'UNAUTHORIZED',
    401,
  );
});

test('completed request without worker cannot be reviewed', () => {
  expectReviewError(
    () => assertReviewEligibility(customer, reviewRequest({ workerId: null, worker: null })),
    'REQUEST_HAS_NO_WORKER',
    400,
  );
});

test('second review for same request returns REVIEW_ALREADY_EXISTS', () => {
  expectReviewError(
    () => assertReviewEligibility(customer, reviewRequest({ review: { id: 'review-1' } })),
    'REVIEW_ALREADY_EXISTS',
    409,
  );
});

test('two simultaneous submissions rely on unique request constraint mapping', () => {
  const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['requestId'] },
  });
  const mapped = mapReviewCreateError(prismaError) as { code?: string; status?: number };

  assert.equal(mapped.code, 'REVIEW_ALREADY_EXISTS');
  assert.equal(mapped.status, 409);
});

test('same worker can receive reviews from two different completed requests', () => {
  const first = assertReviewEligibility(customer, reviewRequest({ id: 'request-a' }));
  const second = assertReviewEligibility(customer, reviewRequest({ id: 'request-b' }));

  assert.equal(first.workerUserId, 'worker-user-1');
  assert.equal(second.workerUserId, 'worker-user-1');
});

test('worker average and count update correctly', () => {
  const summary = buildRatingSummary([5, 5, 4, 3]);

  assert.equal(summary.averageRating, 4.25);
  assert.equal(summary.reviewCount, 4);
  assert.deepEqual(summary.ratingDistribution, { '1': 0, '2': 0, '3': 1, '4': 1, '5': 2 });
});

test('empty review list returns average null and count zero', () => {
  const summary = buildRatingSummary([]);

  assert.equal(summary.averageRating, null);
  assert.equal(summary.reviewCount, 0);
  assert.deepEqual(summary.ratingDistribution, { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
});

test('worker reviews endpoint filters only reviews for that worker', () => {
  assert.deepEqual(buildWorkerReviewsWhere('worker-user-1'), { revieweeId: 'worker-user-1' });
});
