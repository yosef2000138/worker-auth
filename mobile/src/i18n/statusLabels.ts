import type { RequestStatus } from '@/types';
import type { TranslateFn, TranslationKey } from './types';

export const requestStatusTranslationKeys: Record<RequestStatus, TranslationKey> = {
  PENDING: 'requests.status.pending',
  ACCEPTED: 'requests.status.accepted',
  ON_THE_WAY: 'requests.status.onTheWay',
  IN_PROGRESS: 'requests.status.inProgress',
  COMPLETED: 'requests.status.completed',
  CANCELLED: 'requests.status.cancelled',
};

const subscriptionStatusTranslationKeys: Record<string, TranslationKey> = {
  ACTIVE: 'subscription.status.active',
  active: 'subscription.status.active',
  INACTIVE: 'subscription.status.inactive',
  inactive: 'subscription.status.inactive',
  EXPIRED: 'subscription.status.expired',
  expired: 'subscription.status.expired',
  CANCELLED: 'subscription.status.cancelled',
  canceled: 'subscription.status.cancelled',
  cancelled: 'subscription.status.cancelled',
  CANCELING_AT_PERIOD_END: 'subscription.status.cancelingAtPeriodEnd',
  canceling_at_period_end: 'subscription.status.cancelingAtPeriodEnd',
  cancelling_at_period_end: 'subscription.status.cancelingAtPeriodEnd',
  TRIALING: 'subscription.status.trialing',
  trialing: 'subscription.status.trialing',
  PAST_DUE: 'subscription.status.pastDue',
  past_due: 'subscription.status.pastDue',
  BILLING_ISSUE: 'subscription.status.pastDue',
  CONFIGURED: 'subscription.status.configured',
  AVAILABLE: 'subscription.status.available',
  UNAVAILABLE: 'subscription.status.unavailable',
  ERROR: 'subscription.status.unavailable',
  REFUNDED: 'subscription.status.cancelled',
  GRACE_PERIOD: 'subscription.status.active',
  TRIAL: 'subscription.status.trialing',
  NOT_CONFIGURED: 'subscription.status.notConfigured',
  not_configured: 'subscription.status.notConfigured',
};

const paymentStatusTranslationKeys: Record<string, TranslationKey> = {
  PENDING: 'payment.status.pending',
  pending: 'payment.status.pending',
  PAID: 'payment.status.paid',
  paid: 'payment.status.paid',
  SUCCEEDED: 'payment.status.paid',
  succeeded: 'payment.status.paid',
  FAILED: 'payment.status.failed',
  failed: 'payment.status.failed',
  REFUNDED: 'payment.status.refunded',
  refunded: 'payment.status.refunded',
  CANCELLED: 'payment.status.cancelled',
  CANCELED: 'payment.status.cancelled',
  cancelled: 'payment.status.cancelled',
  canceled: 'payment.status.cancelled',
};

function warnUnknownStatus(scope: string, status: unknown) {
  if (__DEV__) {
    console.warn(`[i18n] Unknown ${scope} status`, status);
  }
}

export function getRequestStatusLabel(status: string | null | undefined, t: TranslateFn) {
  const key = status ? requestStatusTranslationKeys[status as RequestStatus] : undefined;
  if (!key) {
    warnUnknownStatus('request', status);
    return t('status.unknown');
  }
  return t(key);
}

export function getJobStatusLabel(status: string | null | undefined, t: TranslateFn) {
  return getRequestStatusLabel(status, t);
}

export function getSubscriptionStatusLabel(status: string | null | undefined, t: TranslateFn) {
  const key = status ? subscriptionStatusTranslationKeys[status] : undefined;
  if (!key) {
    warnUnknownStatus('subscription', status);
    return t('subscription.status.unknown');
  }
  return t(key);
}

export function getPaymentStatusLabel(status: string | null | undefined, t: TranslateFn) {
  const key = status ? paymentStatusTranslationKeys[status] : undefined;
  if (!key) {
    warnUnknownStatus('payment', status);
    return t('payment.status.unknown');
  }
  return t(key);
}
