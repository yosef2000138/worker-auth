import type { TranslationKey } from './types';

export const apiErrorCodeTranslationKeys: Record<string, TranslationKey> = {
  VALIDATION_ERROR: 'errors.validation',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  WORKER_SUBSCRIPTION_REQUIRED: 'errors.workerProRequired',
  WORKER_PRO_REQUIRED: 'errors.workerProRequired',
  WORKER_PRO_NOT_AVAILABLE: 'subscription.message.backendDisabled',
};

export const apiErrorMessageTranslationKeys: Record<string, TranslationKey> = {
  'Too many requests, please try again later': 'errors.tooManyRequests',
  'Invalid credentials': 'errors.invalidCredentials',
  'Email already in use': 'errors.emailInUse',
  'Request is no longer available': 'errors.requestNotAvailable',
  'Request already reviewed': 'errors.requestAlreadyReviewed',
  'Worker not yet approved': 'errors.workerNotApproved',
  'Worker profile not found': 'errors.notFound',
  'Request not found': 'errors.notFound',
  'Not your request': 'errors.forbidden',
};
