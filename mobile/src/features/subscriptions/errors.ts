import type { PurchasesError } from 'react-native-purchases';

const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: '1',
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5',
  NETWORK_ERROR: '10',
  INVALID_CREDENTIALS_ERROR: '11',
  PAYMENT_PENDING_ERROR: '20',
  CONFIGURATION_ERROR: '23',
  UNSUPPORTED_ERROR: '24',
  OFFLINE_CONNECTION_ERROR: '35',
} as const;

type ErrorRecord = {
  code?: unknown;
  message?: unknown;
  userCancelled?: unknown;
};

function getErrorRecord(error: unknown): ErrorRecord {
  return typeof error === 'object' && error !== null ? error as ErrorRecord : {};
}

export function isPurchaseCancelled(error: unknown) {
  const record = getErrorRecord(error);
  return record.userCancelled === true || record.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export function mapPurchaseError(error: unknown) {
  const record = getErrorRecord(error);
  const code = record.code as PurchasesError['code'] | undefined;

  if (isPurchaseCancelled(error)) {
    return { code, cancelled: true, message: 'Purchase cancelled.' };
  }

  switch (code) {
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return { code, message: 'Worker Pro is not available in the store yet.' };
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return { code, pending: true, message: 'Purchase is pending approval.' };
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
      return { code, message: 'Network problem. Check the connection and try again.' };
    case PURCHASES_ERROR_CODE.CONFIGURATION_ERROR:
    case PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR:
      return { code, message: 'Subscriptions are not configured correctly yet.' };
    case PURCHASES_ERROR_CODE.UNSUPPORTED_ERROR:
      return { code, message: 'Subscriptions require a development build or store build.' };
    default:
      return {
        code,
        message: typeof record.message === 'string' && record.message.trim() ? record.message : 'Subscription action failed.',
      };
  }
}
