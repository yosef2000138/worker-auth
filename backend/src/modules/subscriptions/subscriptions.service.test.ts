import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  assertRevenueCatWebhookAuthorized,
  assertRevenueCatWebhookSignature,
  buildWorkerAcceptanceAccess,
  eventHasConfiguredEntitlement,
  getRevenueCatRuntimeConfig,
  hasBackendWorkerProAccess,
  hasEnabledWorkerProAccess,
  mapRevenueCatEnvironment,
  mapRevenueCatEventStatus,
  mapRevenueCatPlatform,
  normalizeRevenueCatEvent,
  shouldApplyRevenueCatEvent,
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

test('RevenueCat webhook HMAC validates the raw body and timestamp', () => {
  const rawBody = Buffer.from('{"event":{"id":"event-1"}}');
  const secret = 's'.repeat(32);
  const now = 1_700_000_000_000;
  const timestamp = Math.floor(now / 1000);
  const digest = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');

  assert.doesNotThrow(() => assertRevenueCatWebhookSignature(
    rawBody,
    `t=${timestamp},v1=${digest}`,
    secret,
    now,
  ));
  assert.throws(() => assertRevenueCatWebhookSignature(
    rawBody,
    `t=${timestamp},v1=${'0'.repeat(64)}`,
    secret,
    now,
  ));
  assert.throws(() => assertRevenueCatWebhookSignature(
    rawBody,
    `t=${timestamp - 600},v1=${digest}`,
    secret,
    now,
  ));
});

test('RevenueCat events grant access only for the configured entitlement', () => {
  const event = normalizeRevenueCatEvent({
    api_version: '1.0',
    event: {
      id: 'event-1',
      type: 'INITIAL_PURCHASE',
      event_timestamp_ms: Date.now(),
      entitlement_ids: ['worker_pro'],
    },
  });

  assert.equal(eventHasConfiguredEntitlement(event, 'worker_pro'), true);
  assert.equal(eventHasConfiguredEntitlement(event, 'another_plan'), false);
  assert.throws(() => normalizeRevenueCatEvent({ event: { type: 'RENEWAL', event_timestamp_ms: Date.now() } }));
});

test('older RevenueCat events cannot overwrite newer subscription state', () => {
  const latest = new Date('2026-01-02T00:00:00.000Z');
  assert.equal(shouldApplyRevenueCatEvent(latest, new Date('2026-01-01T00:00:00.000Z')), false);
  assert.equal(shouldApplyRevenueCatEvent(latest, new Date('2026-01-02T00:00:00.000Z')), true);
  assert.equal(shouldApplyRevenueCatEvent(null, new Date('2026-01-01T00:00:00.000Z')), true);
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

  assert.equal(hasBackendWorkerProAccess({ status: 'ACTIVE', expirationDate: future, environment: 'PRODUCTION' }), true);
  assert.equal(hasBackendWorkerProAccess({ status: 'ACTIVE', expirationDate: past, environment: 'PRODUCTION' }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'ACTIVE', expirationDate: null, environment: 'PRODUCTION' }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'TRIAL', expirationDate: future, environment: 'PRODUCTION' }), true);
  assert.equal(hasBackendWorkerProAccess({ status: 'GRACE_PERIOD', expirationDate: future, environment: 'PRODUCTION' }), true);
  assert.equal(hasBackendWorkerProAccess({ status: 'BILLING_ISSUE', expirationDate: future, environment: 'PRODUCTION' }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'CANCELLED', expirationDate: future, environment: 'PRODUCTION' }), true);
  assert.equal(hasBackendWorkerProAccess({ status: 'EXPIRED', expirationDate: future, environment: 'PRODUCTION' }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'REFUNDED', expirationDate: future, environment: 'PRODUCTION' }), false);
  assert.equal(hasBackendWorkerProAccess({ status: 'UNKNOWN', expirationDate: future, environment: 'PRODUCTION' }), false);
  assert.equal(hasBackendWorkerProAccess(
    { status: 'ACTIVE', expirationDate: future, environment: 'SANDBOX' },
    'production',
  ), false);
});

test('subscription kill switch prevents stored access from bypassing quota', () => {
  const activeSubscription = {
    status: 'ACTIVE' as const,
    expirationDate: new Date(Date.now() + 60_000),
    environment: 'PRODUCTION' as const,
  };

  assert.equal(hasEnabledWorkerProAccess(false, activeSubscription), false);
  assert.equal(hasEnabledWorkerProAccess(true, activeSubscription), true);
});

test('exhausted worker can accept only with active backend subscription access', () => {
  const blocked = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 5,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: hasBackendWorkerProAccess({
      status: 'EXPIRED',
      expirationDate: new Date(Date.now() + 60_000),
      environment: 'PRODUCTION',
    }),
  });
  const allowed = buildWorkerAcceptanceAccess({
    acceptedRequestCount: 5,
    freeAcceptedRequestLimit: 5,
    subscriptionsEnabled: true,
    subscriptionsConfigured: true,
    hasSubscriptionAccess: hasBackendWorkerProAccess({
      status: 'ACTIVE',
      expirationDate: new Date(Date.now() + 60_000),
      environment: 'PRODUCTION',
    }),
  });

  assert.equal(blocked.canAcceptRequest, false);
  assert.equal(blocked.subscriptionRequired, true);
  assert.equal(allowed.canAcceptRequest, true);
  assert.equal(allowed.subscriptionRequired, false);
  assert.equal(allowed.reasonCode, 'WORKER_PRO_ACTIVE');
});
