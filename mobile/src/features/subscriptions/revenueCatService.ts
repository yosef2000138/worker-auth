import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import {
  getPlatformProductId,
  getPlatformRevenueCatKey,
  isRevenueCatNativeModuleAvailable,
  isSubscriptionPlatformSupported,
  SUBSCRIPTION_CONFIG,
} from './config';
import { getWorkerProEntitlement, hasWorkerProAccess } from './entitlements';
import { mapPurchaseError } from './errors';
import { PurchaseActionResult, WorkerProStatus } from './types';

type PurchasesModule = typeof import('react-native-purchases').default;

let purchasesModulePromise: Promise<PurchasesModule> | null = null;
let configured = false;
let configuredAppUserId: string | null = null;

async function getPurchases() {
  if (!isSubscriptionPlatformSupported()) {
    throw new Error('Subscriptions are available on iOS and Android builds.');
  }

  if (!isRevenueCatNativeModuleAvailable()) {
    throw new Error('Worker Pro purchases require a development build or production app build.');
  }

  purchasesModulePromise ??= import('react-native-purchases').then(mod => mod.default);
  return purchasesModulePromise;
}

async function ensureConfigured(appUserId: string | null) {
  const apiKey = getPlatformRevenueCatKey();
  if (!apiKey) return false;

  const Purchases = await getPurchases();
  if (!configured) {
    Purchases.configure({ apiKey, ...(appUserId ? { appUserID: appUserId } : {}) });
    configured = true;
    configuredAppUserId = appUserId;
    return true;
  }

  if (appUserId && configuredAppUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredAppUserId = appUserId;
  }

  return true;
}

function findWorkerProPackage(packages: PurchasesPackage[]) {
  const productId = getPlatformProductId();
  return packages.find(item => item.product.identifier === productId)
    ?? packages.find(item => item.identifier.toLowerCase().includes('monthly'))
    ?? null;
}

function toWorkerProStatus(customerInfo: CustomerInfo | null, packageToPurchase: PurchasesPackage | null): WorkerProStatus {
  const entitlement = getWorkerProEntitlement(customerInfo);
  return {
    status: packageToPurchase ? 'AVAILABLE' : 'UNAVAILABLE',
    configured: true,
    hasAccess: hasWorkerProAccess(customerInfo),
    customerInfo,
    packageToPurchase,
    localizedPrice: packageToPurchase?.product.priceString ?? null,
    managementURL: customerInfo?.managementURL ?? null,
    willRenew: entitlement?.willRenew ?? null,
    expirationDate: entitlement?.expirationDate ?? null,
    message: packageToPurchase ? undefined : 'Worker Pro offering or package was not found in RevenueCat.',
  };
}

export const revenueCatService = {
  async configureForUser(appUserId: string | null) {
    if (!getPlatformRevenueCatKey()) return false;
    if (!isRevenueCatNativeModuleAvailable()) return false;

    try {
      return await ensureConfigured(appUserId);
    } catch {
      return false;
    }
  },

  async clearUser() {
    if (!configured) return;
    try {
      const Purchases = await getPurchases();
      await Purchases.logOut();
    } catch {
      // RevenueCat can reject logout for anonymous users. The next login call will set the backend user ID.
    } finally {
      configuredAppUserId = null;
    }
  },

  async getWorkerProStatus(appUserId: string | null): Promise<WorkerProStatus> {
    if (!isSubscriptionPlatformSupported()) {
      return {
        status: 'UNAVAILABLE',
        configured: false,
        hasAccess: false,
        message: 'Subscriptions are available on iOS and Android builds.',
      };
    }

    if (!isRevenueCatNativeModuleAvailable()) {
      return {
        status: 'UNAVAILABLE',
        configured: false,
        hasAccess: false,
        message: 'Worker Pro purchases require a development build or production app build. Expo Go can still use the app, but cannot run native RevenueCat purchases.',
      };
    }

    if (!getPlatformRevenueCatKey()) {
      return {
        status: 'NOT_CONFIGURED',
        configured: false,
        hasAccess: false,
        message: 'Subscriptions are not configured yet.',
      };
    }

    try {
      const Purchases = await getPurchases();
      await ensureConfigured(appUserId);
      const [customerInfo, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      const offering = offerings.all[SUBSCRIPTION_CONFIG.offeringId]
        ?? (offerings.current?.identifier === SUBSCRIPTION_CONFIG.offeringId ? offerings.current : null);
      const packageToPurchase = offering
        ? offering.monthly ?? findWorkerProPackage(offering.availablePackages)
        : null;

      return toWorkerProStatus(customerInfo, packageToPurchase);
    } catch (error) {
      return {
        status: 'ERROR',
        configured: true,
        hasAccess: false,
        message: mapPurchaseError(error).message,
      };
    }
  },

  async purchaseWorkerPro(appUserId: string | null, packageToPurchase?: PurchasesPackage | null): Promise<PurchaseActionResult> {
    if (!packageToPurchase) {
      throw new Error('Worker Pro package is not available yet.');
    }

    try {
      const Purchases = await getPurchases();
      await ensureConfigured(appUserId);
      const result = await Purchases.purchasePackage(packageToPurchase);
      return {
        customerInfo: result.customerInfo,
        hasAccess: hasWorkerProAccess(result.customerInfo),
        message: hasWorkerProAccess(result.customerInfo) ? 'Worker Pro is active.' : 'Purchase completed, waiting for entitlement refresh.',
      };
    } catch (error) {
      const mapped = mapPurchaseError(error);
      if (mapped.cancelled || mapped.pending) {
        const Purchases = await getPurchases();
        const customerInfo = await Purchases.getCustomerInfo();
        return {
          customerInfo,
          hasAccess: hasWorkerProAccess(customerInfo),
          cancelled: mapped.cancelled,
          pending: mapped.pending,
          message: mapped.message,
        };
      }
      throw new Error(mapped.message);
    }
  },

  async restorePurchases(appUserId: string | null): Promise<PurchaseActionResult> {
    try {
      const Purchases = await getPurchases();
      await ensureConfigured(appUserId);
      const customerInfo = await Purchases.restorePurchases();
      const hasAccess = hasWorkerProAccess(customerInfo);
      return {
        customerInfo,
        hasAccess,
        message: hasAccess ? 'Worker Pro restored.' : 'No active Worker Pro purchase was found.',
      };
    } catch (error) {
      throw new Error(mapPurchaseError(error).message);
    }
  },
};
