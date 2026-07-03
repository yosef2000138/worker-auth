import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkerAcceptanceAccess } from '../subscriptions/subscriptions.service';
import {
  ACTIVE_OFFER_STATUSES,
  buildIncomingRequestWhereFromWorker,
  assertWorkerCanSubmitOffer,
  type EligibleWorker,
} from './requestMatching.service';

test('active offer statuses are exactly submitted and discussing', () => {
  assert.deepEqual([...ACTIVE_OFFER_STATUSES].sort(), ['DISCUSSING', 'SUBMITTED']);
});

test('closed offer statuses do not occupy active offer slots', () => {
  const closedStatuses = ['SELECTED', 'NOT_SELECTED', 'WITHDRAWN', 'EXPIRED'];

  for (const status of closedStatuses) {
    assert.equal(ACTIVE_OFFER_STATUSES.includes(status as never), false, `${status} should release the active slot`);
  }
});

test('worker with zero remaining free requests is blocked from creating an offer', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 9,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: false,
  });

  assert.throws(
    () => assertWorkerCanSubmitOffer(access),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 402);
      assert.equal((error as { code?: string }).code, 'WORKER_SUBSCRIPTION_REQUIRED');
      return true;
    },
  );
});

test('worker with free quota can create an offer', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 2,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: false,
  });

  assert.doesNotThrow(() => assertWorkerCanSubmitOffer(access));
});

test('worker with an active subscription can create an offer after free quota is used', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 9,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: true,
  });

  assert.doesNotThrow(() => assertWorkerCanSubmitOffer(access));
});

test('incoming request visibility can still be built for exhausted workers', () => {
  const worker = {
    id: 'worker-1',
    userId: 'worker-user-1',
    user: { role: 'WORKER', isActive: true },
    approvedAt: new Date(),
    isAvailable: true,
    categories: [{ categoryId: 'electrical' }],
    availability: [],
  } as EligibleWorker;

  assert.deepEqual(buildIncomingRequestWhereFromWorker(worker, 'worker-user-1'), {
    status: 'PENDING',
    workerId: null,
    customerId: { not: 'worker-user-1' },
    categoryId: { in: ['electrical'] },
  });
});

test('unrelated-category workers are excluded by the incoming category filter', () => {
  const worker = {
    id: 'worker-1',
    userId: 'worker-user-1',
    user: { role: 'WORKER', isActive: true },
    approvedAt: new Date(),
    isAvailable: true,
    categories: [{ categoryId: 'plumbing' }],
    availability: [],
  } as EligibleWorker;

  const where = buildIncomingRequestWhereFromWorker(worker, 'worker-user-1');
  const categoryFilter = where?.categoryId as { in?: string[] };

  assert.equal(categoryFilter.in?.includes('electrical'), false);
});
