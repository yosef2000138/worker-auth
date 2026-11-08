import {
  Prisma,
  SubscriptionEnvironment,
  SubscriptionPlatform,
  SubscriptionStatus,
  UserSubscription,
} from '@prisma/client';
import crypto from 'crypto';
import { db } from '../../config/database';
import { env } from '../../config/env';

const PROVIDER = 'REVENUECAT' as const;
const WORKER_PRO_PLAN = 'WORKER_PRO' as const;

type JsonRecord = Record<string, unknown>;

export type SubscriptionRuntimeStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'LOADING'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'ERROR'
  | SubscriptionStatus;

export type SubscriptionStatusResponse = {
  configured: boolean;
  enabled: boolean;
  plan: typeof WORKER_PRO_PLAN;
  status: SubscriptionRuntimeStatus;
  hasAccess: boolean;
  willRenew: boolean;
  platform: SubscriptionPlatform | null;
  environment: SubscriptionEnvironment | null;
  expirationDate: Date | null;
  storeProductId: string | null;
  entitlementId: string;
  workerAccess: WorkerAcceptanceAccess;
};

export type RevenueCatWebhookResult = {
  processed: boolean;
  duplicate: boolean;
  eventId: string;
  type: string;
  userMatched: boolean;
};

export type WorkerAcceptanceAccess = {
  acceptedRequestCount: number;
  freeAcceptedRequestLimit: number;
  remainingFreeRequests: number;
  requiresSubscription: boolean;
  hasSubscriptionAccess: boolean;
  canAcceptMoreRequests: boolean;
  freeRequestsUsed: number;
  freeRequestLimit: number;
  freeRequestsRemaining: number;
  subscriptionRequired: boolean;
  hasActiveSubscription: boolean;
  canAcceptRequest: boolean;
  reasonCode:
    | 'FREE_REQUESTS_AVAILABLE'
    | 'WORKER_PRO_ACTIVE'
    | 'WORKER_PRO_NOT_AVAILABLE'
    | 'WORKER_SUBSCRIPTION_REQUIRED';
};

export function getRevenueCatRuntimeConfig() {
  const configured = Boolean(
    env.REVENUECAT_SECRET_API_KEY &&
    env.REVENUECAT_PROJECT_ID &&
    env.REVENUECAT_WEBHOOK_AUTH_TOKEN &&
    env.REVENUECAT_ENTITLEMENT_ID,
  );

  return {
    configured,
    enabled: env.SUBSCRIPTIONS_ENABLED,
    entitlementId: env.REVENUECAT_ENTITLEMENT_ID,
  };
}

export function hasBackendWorkerProAccess(
  subscription?: Pick<UserSubscription, 'status' | 'expirationDate' | 'environment'> | null,
  runtimeEnvironment: 'development' | 'production' | 'test' = env.NODE_ENV,
) {
  if (!subscription) return false;

  const accessStatuses: SubscriptionStatus[] = ['ACTIVE', 'TRIAL', 'GRACE_PERIOD', 'CANCELLED'];
  const environmentAllowed = runtimeEnvironment !== 'production'
    || subscription.environment === 'PRODUCTION';

  return environmentAllowed
    && accessStatuses.includes(subscription.status)
    && Boolean(subscription.expirationDate)
    && subscription.expirationDate!.getTime() > Date.now();
}

export function hasEnabledWorkerProAccess(
  subscriptionsEnabled: boolean,
  subscription?: Pick<UserSubscription, 'status' | 'expirationDate' | 'environment'> | null,
) {
  return subscriptionsEnabled && hasBackendWorkerProAccess(subscription);
}

export function buildWorkerAcceptanceAccess({
  acceptedRequestCount,
  freeAcceptedRequestLimit,
  subscriptionsEnabled,
  subscriptionsConfigured,
  hasSubscriptionAccess,
}: {
  acceptedRequestCount: number;
  freeAcceptedRequestLimit: number;
  subscriptionsEnabled: boolean;
  subscriptionsConfigured: boolean;
  hasSubscriptionAccess: boolean;
}): WorkerAcceptanceAccess {
  const remainingFreeRequests = Math.max(freeAcceptedRequestLimit - acceptedRequestCount, 0);
  const hasFreeAccess = acceptedRequestCount < freeAcceptedRequestLimit;
  const subscriptionRequired = !hasFreeAccess && !hasSubscriptionAccess;
  const canAcceptMoreRequests = hasFreeAccess || hasSubscriptionAccess;

  const reasonCode = hasFreeAccess
    ? 'FREE_REQUESTS_AVAILABLE'
    : hasSubscriptionAccess
    ? 'WORKER_PRO_ACTIVE'
    : 'WORKER_SUBSCRIPTION_REQUIRED';

  return {
    acceptedRequestCount,
    freeAcceptedRequestLimit,
    remainingFreeRequests,
    requiresSubscription: subscriptionRequired,
    hasSubscriptionAccess,
    canAcceptMoreRequests,
    freeRequestsUsed: acceptedRequestCount,
    freeRequestLimit: freeAcceptedRequestLimit,
    freeRequestsRemaining: remainingFreeRequests,
    subscriptionRequired,
    hasActiveSubscription: hasSubscriptionAccess,
    canAcceptRequest: canAcceptMoreRequests,
    reasonCode,
  };
}

export async function getWorkerAcceptanceAccess(
  userId: string,
  tx: Prisma.TransactionClient | typeof db = db,
  knownWorkerId?: string,
): Promise<WorkerAcceptanceAccess> {
  const config = getRevenueCatRuntimeConfig();
  const freeAcceptedRequestLimit = env.WORKER_FREE_ACCEPTED_REQUEST_LIMIT;
  const worker = knownWorkerId
    ? { id: knownWorkerId }
    : await tx.worker.findUnique({ where: { userId }, select: { id: true } });

  if (!worker) {
    return buildWorkerAcceptanceAccess({
      acceptedRequestCount: 0,
      freeAcceptedRequestLimit,
      subscriptionsEnabled: config.enabled,
      subscriptionsConfigured: config.configured,
      hasSubscriptionAccess: false,
    });
  }

  const [acceptedRequestCount, subscription] = await Promise.all([
    tx.workerAcceptanceUsage.count({ where: { workerId: worker.id } }),
    config.enabled && config.configured
      ? tx.userSubscription.findFirst({
        where: { userId, provider: PROVIDER, entitlementId: config.entitlementId },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      })
      : Promise.resolve(null),
  ]);

  return buildWorkerAcceptanceAccess({
    acceptedRequestCount,
    freeAcceptedRequestLimit,
    subscriptionsEnabled: config.enabled,
    subscriptionsConfigured: config.configured,
    hasSubscriptionAccess: hasEnabledWorkerProAccess(config.enabled, subscription),
  });
}

export async function getMySubscriptionStatus(userId: string): Promise<SubscriptionStatusResponse> {
  const config = getRevenueCatRuntimeConfig();
  const workerAccess = await getWorkerAcceptanceAccess(userId);

  const safeBase = {
    configured: config.configured,
    enabled: config.enabled,
    plan: WORKER_PRO_PLAN,
    hasAccess: false,
    willRenew: false,
    platform: null,
    environment: null,
    expirationDate: null,
    storeProductId: null,
    entitlementId: config.entitlementId,
    workerAccess,
  };

  if (!config.configured) {
    return { ...safeBase, status: 'NOT_CONFIGURED' };
  }

  if (!config.enabled) {
    return { ...safeBase, status: 'CONFIGURED' };
  }

  const subscription = await db.userSubscription.findFirst({
    where: { userId, provider: PROVIDER, entitlementId: config.entitlementId },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (!subscription) {
    return { ...safeBase, status: 'UNAVAILABLE' };
  }

  return {
    ...safeBase,
    status: subscription.status,
    hasAccess: hasBackendWorkerProAccess(subscription),
    willRenew: subscription.willRenew ?? false,
    platform: subscription.platform,
    environment: subscription.environment,
    expirationDate: subscription.expirationDate,
    storeProductId: subscription.storeProductId,
  };
}

export function assertRevenueCatWebhookAuthorized(header: string | undefined) {
  const token = env.REVENUECAT_WEBHOOK_AUTH_TOKEN;
  if (!token) {
    throw { status: 503, message: 'RevenueCat webhook is not configured' };
  }

  const provided = header?.replace(/^Bearer\s+/i, '') ?? '';
  const providedDigest = crypto.createHash('sha256').update(provided).digest();
  const expectedDigest = crypto.createHash('sha256').update(token).digest();
  if (!provided || !crypto.timingSafeEqual(providedDigest, expectedDigest)) {
    throw { status: 401, message: 'Invalid webhook authorization' };
  }
}

export function assertRevenueCatWebhookSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  signingSecret: string | undefined = env.REVENUECAT_WEBHOOK_SIGNING_SECRET,
  nowMs = Date.now(),
) {
  if (!signingSecret) return;
  if (!rawBody || !signatureHeader) {
    throw { status: 401, message: 'Missing webhook signature' };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(part => part.trim().split('=', 2) as [string, string]),
  );
  const timestamp = Number(parts.t);
  const provided = parts.v1;
  if (!Number.isInteger(timestamp) || !provided || !/^[a-f0-9]{64}$/i.test(provided)) {
    throw { status: 401, message: 'Invalid webhook signature' };
  }
  if (Math.abs(nowMs - timestamp * 1000) > 5 * 60 * 1000) {
    throw { status: 401, message: 'Expired webhook signature' };
  }

  const expected = crypto.createHmac('sha256', signingSecret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  const providedBuffer = Buffer.from(provided, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw { status: 401, message: 'Invalid webhook signature' };
  }
}

export function mapRevenueCatEventStatus(type: string, periodType?: string | null): SubscriptionStatus {
  const normalized = type.toUpperCase();
  if (normalized === 'INITIAL_PURCHASE' || normalized === 'RENEWAL' || normalized === 'UNCANCELLATION' || normalized === 'PRODUCT_CHANGE') {
    return periodType?.toUpperCase() === 'TRIAL' ? 'TRIAL' : 'ACTIVE';
  }
  if (normalized === 'CANCELLATION') return 'CANCELLED';
  if (normalized === 'EXPIRATION') return 'EXPIRED';
  if (normalized === 'BILLING_ISSUE') return 'BILLING_ISSUE';
  if (normalized === 'REFUND') return 'REFUNDED';
  return 'UNKNOWN';
}

export function mapRevenueCatPlatform(store?: string | null): SubscriptionPlatform {
  const normalized = store?.toUpperCase();
  if (normalized === 'PLAY_STORE' || normalized === 'GOOGLE_PLAY' || normalized === 'ANDROID') return 'ANDROID';
  if (normalized === 'APP_STORE' || normalized === 'MAC_APP_STORE' || normalized === 'IOS') return 'IOS';
  return 'UNKNOWN';
}

export function mapRevenueCatEnvironment(value?: string | null): SubscriptionEnvironment {
  return value?.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}

function asString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 512 ? normalized : null;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function asDate(value: unknown) {
  let date: Date | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) date = new Date(value);
  if (typeof value === 'string' && value.trim()) {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) date = new Date(timestamp);
  }
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value) || value.length > 50) return [];
  return value.map(asString).filter((item): item is string => Boolean(item));
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const stringValue = asString(value);
    if (stringValue) return stringValue;
  }
  return null;
}

function firstDate(...values: unknown[]) {
  for (const value of values) {
    const dateValue = asDate(value);
    if (dateValue) return dateValue;
  }
  return null;
}

export function normalizeRevenueCatEvent(body: unknown) {
  const root = asRecord(body);
  if (!root) throw { status: 400, message: 'Malformed RevenueCat webhook body' };

  const event = asRecord(root.event) ?? root;
  const type = firstString(event.type, root.type);
  if (!type) throw { status: 400, message: 'RevenueCat webhook event type is missing' };

  const eventId = firstString(event.id, event.event_id, root.id, root.event_id);
  if (!eventId) throw { status: 400, message: 'RevenueCat webhook event ID is missing' };
  const eventTimestamp = firstDate(event.event_timestamp_ms, event.eventTimestampMs);
  if (!eventTimestamp) throw { status: 400, message: 'RevenueCat webhook event timestamp is missing' };

  const appUserId = firstString(event.app_user_id, event.appUserId, event.original_app_user_id, root.app_user_id);
  const originalTransactionId = firstString(
    event.original_transaction_id,
    event.originalTransactionId,
    event.transaction_id,
    event.transactionId,
  );
  const entitlementIds = Array.from(new Set([
    ...asStringArray(event.entitlement_ids),
    ...asStringArray(event.entitlementIds),
    firstString(event.entitlement_id, event.entitlementId),
  ].filter((item): item is string => Boolean(item))));

  return {
    event,
    eventId,
    type,
    eventTimestamp,
    entitlementIds,
    appUserId,
    originalTransactionId,
    productId: firstString(event.product_id, event.productId, event.new_product_id),
    store: firstString(event.store, event.platform),
    environment: firstString(event.environment),
    periodType: firstString(event.period_type, event.periodType),
    purchaseDate: firstDate(event.purchased_at_ms, event.purchaseDate),
    originalPurchaseDate: firstDate(event.original_purchased_at_ms, event.originalPurchaseDate),
    expirationDate: firstDate(event.expiration_at_ms, event.expirationDate),
    cancellationDate: firstDate(event.cancelled_at_ms, event.cancellationDate),
    billingIssueDate: firstDate(event.billing_issues_detected_at_ms, event.billingIssueDate),
    willRenew: asBoolean(event.will_renew) ?? asBoolean(event.willRenew),
  };
}

export function eventHasConfiguredEntitlement(
  event: Pick<ReturnType<typeof normalizeRevenueCatEvent>, 'entitlementIds'>,
  entitlementId = env.REVENUECAT_ENTITLEMENT_ID,
) {
  return event.entitlementIds.includes(entitlementId);
}

export function shouldApplyRevenueCatEvent(lastEventAt: Date | null, eventTimestamp: Date) {
  return !lastEventAt || eventTimestamp >= lastEventAt;
}

async function upsertSubscription(
  tx: Prisma.TransactionClient,
  userId: string,
  event: ReturnType<typeof normalizeRevenueCatEvent>,
) {
  const data = {
    userId,
    provider: PROVIDER,
    entitlementId: env.REVENUECAT_ENTITLEMENT_ID,
    storeProductId: event.productId,
    platform: mapRevenueCatPlatform(event.store),
    environment: mapRevenueCatEnvironment(event.environment),
    status: mapRevenueCatEventStatus(event.type, event.periodType),
    originalTransactionId: event.originalTransactionId,
    appUserId: event.appUserId,
    purchaseDate: event.purchaseDate,
    originalPurchaseDate: event.originalPurchaseDate,
    expirationDate: event.expirationDate,
    willRenew: event.willRenew,
    cancellationDate: event.cancellationDate,
    billingIssueDate: event.billingIssueDate,
    lastEventId: event.eventId,
    lastEventType: event.type,
    lastEventAt: event.eventTimestamp,
  } satisfies Prisma.UserSubscriptionUncheckedCreateInput;

  const existing = event.originalTransactionId
    ? await tx.userSubscription.findUnique({
      where: {
        provider_originalTransactionId: {
          provider: PROVIDER,
          originalTransactionId: event.originalTransactionId,
        },
      },
    })
    : await tx.userSubscription.findFirst({
      where: {
        userId,
        provider: PROVIDER,
        entitlementId: env.REVENUECAT_ENTITLEMENT_ID,
        ...(event.productId && { storeProductId: event.productId }),
      },
      orderBy: { updatedAt: 'desc' },
    });

  if (existing) {
    if (!shouldApplyRevenueCatEvent(existing.lastEventAt, event.eventTimestamp)) {
      return existing;
    }
    return tx.userSubscription.update({
      where: { id: existing.id },
      data,
    });
  }

  return tx.userSubscription.create({ data });
}

export async function handleRevenueCatWebhook(
  body: unknown,
  authorizationHeader: string | undefined,
  rawBody?: Buffer,
  signatureHeader?: string,
): Promise<RevenueCatWebhookResult> {
  assertRevenueCatWebhookAuthorized(authorizationHeader);
  assertRevenueCatWebhookSignature(rawBody, signatureHeader);
  const config = getRevenueCatRuntimeConfig();
  if (!config.configured) {
    throw { status: 503, message: 'RevenueCat webhook is not configured' };
  }

  const event = normalizeRevenueCatEvent(body);
  const mappedStatus = mapRevenueCatEventStatus(event.type, event.periodType);
  const updatesWorkerPro = eventHasConfiguredEntitlement(event, config.entitlementId)
    && mappedStatus !== 'UNKNOWN';

  return db.$transaction(async (tx) => {
    const lockKey = event.originalTransactionId
      ?? `${event.appUserId ?? 'unknown'}:${config.entitlementId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existingEvent = await tx.subscriptionWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: PROVIDER,
          providerEventId: event.eventId,
        },
      },
    });

    if (existingEvent?.processedAt) {
      return {
        processed: false,
        duplicate: true,
        eventId: event.eventId,
        type: event.type,
        userMatched: false,
      };
    }

    const webhookEvent = existingEvent ?? await tx.subscriptionWebhookEvent.create({
      data: {
        provider: PROVIDER,
        providerEventId: event.eventId,
        type: event.type,
        eventTimestamp: event.eventTimestamp,
      },
    });

    const user = event.appUserId
      ? await tx.user.findUnique({ where: { id: event.appUserId }, select: { id: true } })
      : null;

    if (user && updatesWorkerPro) {
      await upsertSubscription(tx, user.id, event);
    }

    await tx.subscriptionWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processedAt: new Date(), type: event.type, eventTimestamp: event.eventTimestamp },
    });

    return {
      processed: true,
      duplicate: false,
      eventId: event.eventId,
      type: event.type,
      userMatched: Boolean(user),
    };
  });
}
