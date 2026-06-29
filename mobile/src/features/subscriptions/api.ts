import { ApiRequestError, api, unwrap } from '@/services/api';
import { BackendSubscriptionResponse } from './types';

const unavailableBackendSubscription: BackendSubscriptionResponse = {
  configured: false,
  enabled: false,
  plan: 'WORKER_PRO',
  status: 'NOT_CONFIGURED',
  hasAccess: false,
  willRenew: false,
  platform: null,
  environment: null,
  expirationDate: null,
  storeProductId: null,
  entitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? 'worker_pro',
  workerAccess: {
    acceptedRequestCount: 0,
    freeAcceptedRequestLimit: 5,
    remainingFreeRequests: 5,
    requiresSubscription: false,
    hasSubscriptionAccess: false,
    canAcceptMoreRequests: true,
    reasonCode: 'FREE_REQUESTS_AVAILABLE',
  },
};

export const subscriptionApi = {
  me: () => api.get('/subscriptions/me')
    .then(unwrap<BackendSubscriptionResponse>)
    .catch((error) => {
      if (error instanceof ApiRequestError && error.status === 404) {
        return unavailableBackendSubscription;
      }

      throw error;
    }),
};
