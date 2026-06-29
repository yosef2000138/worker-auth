import { NativeModules, Platform } from 'react-native';

const valueOrFallback = (value: string | undefined, fallback: string) => value?.trim() || fallback;

export const SUBSCRIPTION_CONFIG = {
  androidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? '',
  iosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? '',
  entitlementId: valueOrFallback(process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID, 'worker_pro'),
  offeringId: valueOrFallback(process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID, 'default'),
  googleProductId: valueOrFallback(process.env.EXPO_PUBLIC_GOOGLE_WORKER_PRO_PRODUCT_ID, 'worker_pro_monthly'),
  appleProductId: valueOrFallback(process.env.EXPO_PUBLIC_APPLE_WORKER_PRO_PRODUCT_ID, 'com.workerapp.workerpro.monthly'),
  googleBasePlanId: 'monthly',
  plannedPriceLabel: 'Planned price: ₪100/month',
} as const;

export function getPlatformRevenueCatKey() {
  if (Platform.OS === 'android') return SUBSCRIPTION_CONFIG.androidApiKey;
  if (Platform.OS === 'ios') return SUBSCRIPTION_CONFIG.iosApiKey;
  return '';
}

export function getPlatformProductId() {
  if (Platform.OS === 'android') return SUBSCRIPTION_CONFIG.googleProductId;
  if (Platform.OS === 'ios') return SUBSCRIPTION_CONFIG.appleProductId;
  return '';
}

export function isSubscriptionPlatformSupported() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export function isRevenueCatNativeModuleAvailable() {
  return Boolean(NativeModules.RNPurchases);
}
