import type { TranslationKey } from './types';

export const apiErrorCodeTranslationKeys: Record<string, TranslationKey> = {
  VALIDATION_ERROR: 'errors.validation',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  WORKER_SUBSCRIPTION_REQUIRED: 'errors.workerProRequired',
  WORKER_PRO_REQUIRED: 'errors.workerProRequired',
  WORKER_PRO_NOT_AVAILABLE: 'subscription.message.backendDisabled',
  REQUEST_NOT_FOUND: 'errors.notFound',
  REQUEST_NOT_COMPLETED: 'errors.requestNotCompleted',
  REQUEST_HAS_NO_WORKER: 'errors.requestHasNoWorker',
  REVIEW_NOT_ALLOWED: 'errors.reviewNotAllowed',
  REVIEW_ALREADY_EXISTS: 'errors.requestAlreadyReviewed',
};

export const apiErrorMessageTranslationKeys: Record<string, TranslationKey> = {
  'Too many requests, please try again later': 'errors.tooManyRequests',
  'Invalid credentials': 'errors.invalidCredentials',
  'Email already in use': 'errors.emailInUse',
  'Request is no longer available': 'errors.requestNotAvailable',
  'Request already reviewed': 'errors.requestAlreadyReviewed',
  'Request must be completed before it can be reviewed': 'errors.requestNotCompleted',
  'Request has no assigned worker': 'errors.requestHasNoWorker',
  'Only customers can review completed requests': 'errors.reviewNotAllowed',
  'Only the customer can review this request': 'errors.reviewNotAllowed',
  'Worker not yet approved': 'errors.workerNotApproved',
  'Worker profile not found': 'errors.notFound',
  'Request not found': 'errors.notFound',
  'Not your request': 'errors.forbidden',
};
