import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRevenueCatWebhookAuthorized,
  buildWorkerAcceptanceAccess,
  getRevenueCatRuntimeConfig,
  mapRevenueCatEnvironment,
  mapRevenueCatEventStatus,
  mapRevenueCatPlatform,
} from './subscriptions.service';

test('subscriptions are safe when RevenueCat secrets are not configured', () => {
  const config = getRevenueCatRuntimeConfig();

  assert.equal(config.configured, false);
  assert.equal(config.enabled, false);
  assert.equal(config.entitlementId, 'worker_pro');
});

test('RevenueCat event types map to normalized subscription statuses', () => {
  assert.equal(mapRevenueCatEventStatus('INITIAL_PURCHASE'), 'ACTIVE');
  assert.equal(mapRevenueCatEventStatus('RENEWAL'), 'ACTIVE');
  assert.equal(mapRevenueCatEventStatus('INITIAL_PURCHASE', 'TRIAL'), 'TRIAL');
  assert.equal(mapRevenueCatEventStatus('CANCELLATION'), 'CANCELLED');
  assert.equal(mapRevenueCatEventStatus('EXPIRATION'), 'EXPIRED');
  assert.equal(mapRevenueCatEventStatus('BILLING_ISSUE'), 'BILLING_ISSUE');
  assert.equal(mapRevenueCatEventStatus('REFUND'), 'REFUNDED');
  assert.equal(mapRevenueCatEventStatus('TRANSFER'), 'UNKNOWN');
});

test('RevenueCat store and environment values map safely', () => {
  assert.equal(mapRevenueCatPlatform('PLAY_STORE'), 'ANDROID');
  assert.equal(mapRevenueCatPlatform('APP_STORE'), 'IOS');
  assert.equal(mapRevenueCatPlatform('SOMETHING_ELSE'), 'UNKNOWN');
  assert.equal(mapRevenueCatEnvironment('PRODUCTION'), 'PRODUCTION');
  assert.equal(mapRevenueCatEnvironment('SANDBOX'), 'SANDBOX');
  assert.equal(mapRevenueCatEnvironment(undefined), 'SANDBOX');
});

test('RevenueCat webhook rejects requests while token is missing', () => {
  assert.throws(
    () => assertRevenueCatWebhookAuthorized(undefined),
    (error: unknown) => {
      const typed = error as { status?: number; message?: string };
      return typed.status === 503 && typed.message === 'RevenueCat webhook is not configured';
    },
  );
});

test('worker acceptance access allows the first five requests for free', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 4,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: false,
  });

  assert.equal(access.remainingFreeRequests, 1);
  assert.equal(access.requiresSubscription, false);
  assert.equal(access.canAcceptMoreRequests, true);
  assert.equal(access.reasonCode, 'FREE_REQUESTS_AVAILABLE');
});

test('worker acceptance access requires Worker Pro after free requests are used', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 5,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: false,
  });

  assert.equal(access.remainingFreeRequests, 0);
  assert.equal(access.requiresSubscription, true);
  assert.equal(access.canAcceptMoreRequests, false);
  assert.equal(access.reasonCode, 'WORKER_PRO_REQUIRED');
});

test('worker acceptance access allows request six with active Worker Pro', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 5,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: true,
  });

  assert.equal(access.requiresSubscription, true);
  assert.equal(access.canAcceptMoreRequests, true);
  assert.equal(access.reasonCode, 'WORKER_PRO_ACTIVE');
});

test('worker acceptance access does not block local development when enforcement is disabled', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 20,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: false,
    subscriptionsConfigured: false,
    hasSubscriptionAccess: false,
  });

  assert.equal(access.requiresSubscription, false);
  assert.equal(access.canAcceptMoreRequests, true);
});
