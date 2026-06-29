import type { CustomerInfo } from 'react-native-purchases';
import { SUBSCRIPTION_CONFIG } from './config';

export function hasWorkerProAccess(customerInfo?: CustomerInfo | null) {
  if (!customerInfo) return false;
  return Boolean(customerInfo.entitlements.active[SUBSCRIPTION_CONFIG.entitlementId]?.isActive);
}

export function getWorkerProEntitlement(customerInfo?: CustomerInfo | null) {
  return customerInfo?.entitlements.all[SUBSCRIPTION_CONFIG.entitlementId] ?? null;
}
