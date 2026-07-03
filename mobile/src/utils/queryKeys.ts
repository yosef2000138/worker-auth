import type { Role } from '@/types';

export const queryKeys = {
  categories: ['categories'] as const,
  profile: (userId?: string | null) =>
    ['profile', userId ?? 'anonymous'] as const,
  customerRequests: (userId?: string | null, role?: Role | string | null) =>
    ['requests', userId ?? 'anonymous', role ?? 'unknown'] as const,
  incomingRequests: (userId?: string | null) =>
    ['incoming', userId ?? 'anonymous'] as const,
  workerMe: (userId?: string | null) =>
    ['worker-me', userId ?? 'anonymous'] as const,
  workerRequests: (userId?: string | null) =>
    ['worker-requests', userId ?? 'anonymous'] as const,
  workerActiveFallback: (userId?: string | null) =>
    ['worker-active-fallback', userId ?? 'anonymous'] as const,
  workerCalendar: (userId: string | null | undefined, monthKey: string) =>
    ['worker-work-calendar', userId ?? 'anonymous', monthKey] as const,
  request: (requestId?: string | null, userId?: string | null) =>
    ['request', requestId ?? 'unknown', userId ?? 'anonymous'] as const,
  requestOffers: (requestId?: string | null, userId?: string | null) =>
    ['request-offers', requestId ?? 'unknown', userId ?? 'anonymous'] as const,
  payment: (requestId?: string | null, userId?: string | null) =>
    ['payment', requestId ?? 'unknown', userId ?? 'anonymous'] as const,
  ratingEligibility: (requestId?: string | null, userId?: string | null) =>
    ['rating-eligibility', requestId ?? 'unknown', userId ?? 'anonymous'] as const,
  messagesUnreadCount: (userId?: string | null) =>
    ['messages-unread-count', userId ?? 'anonymous'] as const,
  messages: (requestId?: string | null, userId?: string | null) =>
    ['messages', requestId ?? 'unknown', userId ?? 'anonymous'] as const,
  messageConversations: (userId?: string | null, role?: Role | string | null) =>
    ['message-conversations', userId ?? 'anonymous', role ?? 'unknown'] as const,
  offerMessages: (requestId?: string | null, offerId?: string | null, userId?: string | null) =>
    ['offer-messages', requestId ?? 'unknown', offerId ?? 'unknown', userId ?? 'anonymous'] as const,
  notifications: (userId?: string | null) =>
    ['notifications', userId ?? 'anonymous'] as const,
  workerReviews: (workerId?: string | null) =>
    ['worker-reviews', workerId ?? 'unknown'] as const,
  worker: (workerId?: string | null, userId?: string | null) =>
    ['worker', workerId ?? 'unknown', userId ?? 'anonymous'] as const,
  reviews: (workerId?: string | null, userId?: string | null) =>
    ['reviews', workerId ?? 'unknown', userId ?? 'anonymous'] as const,
};
