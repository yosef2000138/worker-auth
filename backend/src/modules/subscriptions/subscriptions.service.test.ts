import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRevenueCatWebhookAuthorized,
  buildWorkerAcceptanceAccess,
  getRevenueCatRuntimeConfig,
  hasBackendWorkerProAccess,
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

test('worker acceptance access starts with zero used free requests', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 0,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: false,
  });

  assert.equal(access.freeRequestLimit, 5);
  assert.equal(access.freeRequestsUsed, 0);
  assert.equal(access.freeRequestsRemaining, 5);
  assert.equal(access.subscriptionRequired, false);
  assert.equal(access.canAcceptRequest, true);
});

test('worker acceptance access reflects one consumed free request', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 1,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: false,
  });

  assert.equal(access.freeRequestsUsed, 1);
  assert.equal(access.freeRequestsRemaining, 4);
  assert.equal(access.subscriptionRequired, false);
  assert.equal(access.canAcceptRequest, true);
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
  assert.equal(access.freeRequestsUsed, 4);
  assert.equal(access.freeRequestLimit, 5);
  assert.equal(access.freeRequestsRemaining, 1);
  assert.equal(access.requiresSubscription, false);
  assert.equal(access.subscriptionRequired, false);
  assert.equal(access.canAcceptMoreRequests, true);
  assert.equal(access.canAcceptRequest, true);
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
  assert.equal(access.freeRequestsUsed, 5);
  assert.equal(access.freeRequestLimit, 5);
  assert.equal(access.freeRequestsRemaining, 0);
  assert.equal(access.requiresSubscription, true);
  assert.equal(access.subscriptionRequired, true);
  assert.equal(access.canAcceptMoreRequests, false);
  assert.equal(access.canAcceptRequest, false);
  assert.equal(access.reasonCode, 'WORKER_SUBSCRIPTION_REQUIRED');
});

test('worker acceptance access allows request six with active Worker Pro', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 5,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: true,
  });

  assert.equal(access.requiresSubscription, false);
  assert.equal(access.subscriptionRequired, false);
  assert.equal(access.hasActiveSubscription, true);
  assert.equal(access.canAcceptMoreRequests, true);
  assert.equal(access.canAcceptRequest, true);
  assert.equal(access.reasonCode, 'WORKER_PRO_ACTIVE');
});

test('worker acceptance access blocks after free quota even when provider is disabled', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 20,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: false,
    subscriptionsConfigured: false,
    hasSubscriptionAccess: false,
  });

  assert.equal(access.remainingFreeRequests, 0);
  assert.equal(access.requiresSubscription, true);
  assert.equal(access.subscriptionRequired, true);
  assert.equal(access.canAcceptMoreRequests, false);
  assert.equal(access.canAcceptRequest, false);
  assert.equal(access.reasonCode, 'WORKER_SUBSCRIPTION_REQUIRED');
});

test('worker acceptance access blocks exhausted free quota without a subscription record', () => {
  const access = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 5,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: hasBackendWorkerProAccess(null),
  });

  assert.equal(access.requiresSubscription, true);
  assert.equal(access.canAcceptRequest, false);
  assert.equal(access.reasonCode, 'WORKER_SUBSCRIPTION_REQUIRED');
});

test('backend Worker Pro access only trusts active non-expired subscriptions', () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);

  assert.equal(hasBackendWorkerProAccess({ status: 'ACTIVE', expirationDate: future }), true);
  assert.equal(hasBackendWorkerProAccess({ status: 'ACTIVE', expirationDate: past }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'ACTIVE', expirationDate: null }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'TRIAL', expirationDate: future }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'GRACE_PERIOD', expirationDate: future }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'BILLING_ISSUE', expirationDate: future }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'CANCELLED', expirationDate: future }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'EXPIRED', expirationDate: future }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'REFUNDED', expirationDate: future }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'UNKNOWN', expirationDate: future }), false);
});

test('exhausted worker can accept only with active backend subscription access', () => {
  const blocked = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 5,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: hasBackendWorkerProAccess({ status: 'EXPIRED', expirationDate: new Date(Date.now() + 60_000) }),
  });
  const allowed = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 5,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: hasBackendWorkerProAccess({ status: 'ACTIVE', expirationDate: new Date(Date.now() + 60_000) }),
  });

  assert.equal(blocked.canAcceptRequest, false);
  assert.equal(blocked.subscriptionRequired, true);
  assert.equal(allowed.canAcceptRequest, true);
  assert.equal(allowed.subscriptionRequired, false);
  assert.equal(allowed.reasonCode, 'WORKER_PRO_ACTIVE');
});
