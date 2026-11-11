import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { buildWorkerAcceptanceAccess } from '../subscriptions/subscriptions.service';
import {
  ACTIVE_OFFER_STATUSES,
  buildIncomingRequestWhereFromWorker,
  buildServiceAreaWhereFromWorker,
  assertWorkerCanSubmitOffer,
  assertWorkerEligibleForRequestVisibility,
  isWorkerProfileCompleteForMatching,
  workerMatchesServiceArea,
  type EligibleWorker,
} from './requestMatching.service';

function baseWorker(overrides: Partial<EligibleWorker> = {}) {
  return {
    id: 'worker-1',
    userId: 'worker-user-1',
    bio: 'Experienced electrical worker for home repairs.',
    yearsExp: 3,
    hourlyRate: new Prisma.Decimal(120),
    user: { id: 'worker-user-1', role: 'WORKER', isActive: true, fullName: 'Test Worker', phone: '0501234567', avatarUrl: 'https://example.com/avatar.jpg' },
    approvedAt: new Date(),
    isAvailable: true,
    primaryServiceCity: null,
    additionalServiceCities: [],
    serviceRadiusKm: null,
    baseLatitude: null,
    baseLongitude: null,
    categories: [{ categoryId: 'electrical' }],
    availability: [],
    ...overrides,
  } as EligibleWorker;
}

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
  const worker = baseWorker();

  assert.deepEqual(buildIncomingRequestWhereFromWorker(worker, 'worker-user-1'), {
    status: 'PENDING',
    workerId: null,
    customerId: { not: 'worker-user-1' },
    categoryId: { in: ['electrical'] },
  });
});

test('complete onboarded worker can see incoming requests before manual approval', () => {
  const worker = baseWorker({
    approvedAt: null,
    availability: [{ dayOfWeek: 0, startTime: '09:00', endTime: '18:00' }],
  });

  assert.equal(isWorkerProfileCompleteForMatching(worker), true);
  assert.deepEqual(buildIncomingRequestWhereFromWorker(worker, 'worker-user-1'), {
    status: 'PENDING',
    workerId: null,
    customerId: { not: 'worker-user-1' },
    categoryId: { in: ['electrical'] },
  });
});

test('incomplete unapproved worker cannot see incoming requests', () => {
  const worker = baseWorker({
    bio: null,
    yearsExp: 0,
    hourlyRate: null,
    user: { id: 'worker-user-1', role: 'WORKER', isActive: true, fullName: 'Test Worker', phone: '0501234567', avatarUrl: null },
    approvedAt: null,
    availability: [],
  });

  assert.equal(isWorkerProfileCompleteForMatching(worker), false);
  assert.equal(buildIncomingRequestWhereFromWorker(worker, 'worker-user-1'), null);
});

test('unrelated-category workers are excluded by the incoming category filter', () => {
  const worker = baseWorker({
    bio: 'Experienced plumbing worker for home repairs.',
    categories: [{ categoryId: 'plumbing' }],
  });

  const where = buildIncomingRequestWhereFromWorker(worker, 'worker-user-1');
  const categoryFilter = where?.categoryId as { in?: string[] };

  assert.equal(categoryFilter.in?.includes('electrical'), false);
});

test('offer metadata visibility uses matching rules without checking quota', () => {
  const request = {
    id: 'request-1',
    customerId: 'customer-1',
    categoryId: 'electrical',
  };

  assert.doesNotThrow(() => assertWorkerEligibleForRequestVisibility(baseWorker(), request));
  assert.throws(
    () => assertWorkerEligibleForRequestVisibility(
      baseWorker({ categories: [{ categoryId: 'plumbing' }] }),
      request,
    ),
    (error: unknown) => (error as { code?: string }).code === 'WORKER_CATEGORY_MISMATCH',
  );
});

test('incoming request visibility does not require request location fields', () => {
  const worker = baseWorker();

  const where = buildIncomingRequestWhereFromWorker(worker, 'worker-user-1');

  assert.equal('address' in (where ?? {}), false);
  assert.equal('lat' in (where ?? {}), false);
  assert.equal('lng' in (where ?? {}), false);
  assert.deepEqual(where, {
    status: 'PENDING',
    workerId: null,
    customerId: { not: 'worker-user-1' },
    categoryId: { in: ['electrical'] },
  });
});

test('no-location request matches category worker by service area', () => {
  assert.equal(workerMatchesServiceArea(baseWorker({ primaryServiceCity: 'Haifa' }), {}), true);
});

test('city request matches worker primary city', () => {
  assert.equal(workerMatchesServiceArea(baseWorker({ primaryServiceCity: 'Haifa' }), { serviceCity: ' haifa ' }), true);
});

test('city request matches worker additional city', () => {
  assert.equal(workerMatchesServiceArea(baseWorker({ additionalServiceCities: ['Acre', 'Karmiel'] }), { serviceCity: 'karmiel' }), true);
});

test('city request does not match different configured city', () => {
  assert.equal(workerMatchesServiceArea(baseWorker({ primaryServiceCity: 'Haifa' }), { serviceCity: 'Tel Aviv' }), false);
});

test('coordinate request matches worker within radius', () => {
  const worker = baseWorker({ baseLatitude: 32.794, baseLongitude: 34.9896, serviceRadiusKm: 25 });
  assert.equal(workerMatchesServiceArea(worker, { lat: 32.800, lng: 34.990 }), true);
});

test('coordinate request does not match worker outside radius', () => {
  const worker = baseWorker({ baseLatitude: 32.794, baseLongitude: 34.9896, serviceRadiusKm: 10 });
  assert.equal(workerMatchesServiceArea(worker, { lat: 31.7683, lng: 35.2137 }), false);
});

test('coordinate request falls back for worker without service area during MVP', () => {
  assert.equal(workerMatchesServiceArea(baseWorker(), { lat: 31.7683, lng: 35.2137 }), true);
});

test('request with city and coordinates prefers radius when available', () => {
  const worker = baseWorker({
    primaryServiceCity: 'Jerusalem',
    baseLatitude: 32.794,
    baseLongitude: 34.9896,
    serviceRadiusKm: 10,
  });
  assert.equal(workerMatchesServiceArea(worker, { serviceCity: 'Jerusalem', lat: 31.7683, lng: 35.2137 }), false);
});

test('city matching is pushed into the database candidate query', () => {
  const where = buildServiceAreaWhereFromWorker(baseWorker({
    primaryServiceCity: 'Haifa',
    additionalServiceCities: ['Acre'],
  }));

  assert.deepEqual(where, {
    OR: [
      { serviceCity: { in: ['haifa', 'acre'], mode: 'insensitive' } },
      { lat: null, lng: null, serviceCity: null },
    ],
  });
});

test('radius matching uses a database bounding box before exact distance filtering', () => {
  const where = buildServiceAreaWhereFromWorker(baseWorker({
    baseLatitude: 32.794,
    baseLongitude: 34.9896,
    serviceRadiusKm: 10,
  }));
  const conditions = Array.isArray(where?.OR) ? where.OR : [];
  const firstCondition = conditions[0] as {
    lat: { gte: number; lte: number };
    lng: { gte: number; lte: number };
  };

  assert.ok(firstCondition.lat.gte < 32.794);
  assert.ok(firstCondition.lat.lte > 32.794);
  assert.ok(firstCondition.lng.gte < 34.9896);
  assert.ok(firstCondition.lng.lte > 34.9896);
});
