import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

export type SubscriptionRuntimeStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'LOADING'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'ERROR';

export type BackendSubscriptionStatus =
  | SubscriptionRuntimeStatus
  | 'ACTIVE'
  | 'TRIAL'
  | 'GRACE_PERIOD'
  | 'BILLING_ISSUE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'UNKNOWN';

export type WorkerProStatus = {
  status: SubscriptionRuntimeStatus;
  configured: boolean;
  hasAccess: boolean;
  message?: string;
  customerInfo?: CustomerInfo | null;
  packageToPurchase?: PurchasesPackage | null;
  localizedPrice?: string | null;
  managementURL?: string | null;
  willRenew?: boolean | null;
  expirationDate?: string | null;
};

export type BackendSubscriptionResponse = {
  configured: boolean;
  enabled: boolean;
  plan: 'WORKER_PRO';
  status: BackendSubscriptionStatus;
  hasAccess: boolean;
  willRenew: boolean;
  platform: 'ANDROID' | 'IOS' | 'UNKNOWN' | null;
  environment: 'SANDBOX' | 'PRODUCTION' | null;
  expirationDate: string | null;
  storeProductId: string | null;
  entitlementId: string;
  workerAccess?: {
    acceptedRequestCount: number;
    freeAcceptedRequestLimit: number;
    remainingFreeRequests: number;
    requiresSubscription: boolean;
    hasSubscriptionAccess: boolean;
    canAcceptMoreRequests: boolean;
    reasonCode: 'FREE_REQUESTS_AVAILABLE' | 'WORKER_PRO_ACTIVE' | 'WORKER_PRO_NOT_AVAILABLE' | 'WORKER_PRO_REQUIRED';
  };
};

export type PurchaseActionResult = {
  customerInfo: CustomerInfo;
  hasAccess: boolean;
  cancelled?: boolean;
  pending?: boolean;
  message: string;
};
