import { api, unwrap } from './api';
import {
  Message,
  NotificationItem,
  OfferMessage,
  Paginated,
  PaymentMethod,
  RatingEligibility,
  RequestStatus,
  RequestOffer,
  RequestOffersResponse,
  RequestStatusUpdateResult,
  ServiceRequest,
  CreateReviewResponse,
  ConfirmOfferResponse,
  WorkerAcceptanceAccess,
} from '@/types';
export type CreateRequestPayload = { categoryId: string; title: string; description: string; lat: number; lng: number; address: string; scheduledAt?: string; paymentMethod: PaymentMethod; images?: { uri: string; name?: string; type?: string }[] };
export type RequestStatusUpdate = Exclude<RequestStatus, 'PENDING'>;
export type CreateOfferPayload = {
  proposedPrice: number;
  message?: string;
  availableAt: string;
  estimatedDuration: number;
};

function normalizeStatusUpdateResult(data: RequestStatusUpdateResult) {
  if ('request' in data) return data;
  return { request: data };
}

export const requestService = {
  async create(payload: CreateRequestPayload) { const form = new FormData(); Object.entries(payload).forEach(([k, v]) => { if (k !== 'images' && v !== undefined) form.append(k, String(v)); }); payload.images?.forEach((img, i) => form.append('images', { uri: img.uri, name: img.name ?? `image-${i}.jpg`, type: img.type ?? 'image/jpeg' } as unknown as Blob)); return api.post('/requests', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap<ServiceRequest>); },
  list: (params?: { status?: RequestStatus; page?: number; limit?: number }) => api.get('/requests', { params }).then(unwrap<Paginated<ServiceRequest>>),
  getOne: (id: string) => api.get(`/requests/${id}`).then(unwrap<ServiceRequest>),
  updateStatusResult: (id: string, status: RequestStatusUpdate, cancellationReason?: string) =>
    api.put(`/requests/${id}/status`, { status, cancellationReason })
      .then(unwrap<RequestStatusUpdateResult>)
      .then(normalizeStatusUpdateResult),
  updateStatus: (id: string, status: RequestStatusUpdate, cancellationReason?: string) =>
    requestService.updateStatusResult(id, status, cancellationReason).then(result => result.request),
  accept: (id: string) => requestService.updateStatusResult(id, 'ACCEPTED'),
  cancel: (id: string, reason?: string) => api.post(`/requests/${id}/cancel`, { reason }).then(unwrap<ServiceRequest>),
  offers: (requestId: string) => api.get(`/requests/${requestId}/offers`).then(unwrap<RequestOffersResponse>),
  createOffer: (requestId: string, payload: CreateOfferPayload) =>
    api.post(`/requests/${requestId}/offers`, payload).then(unwrap<{ offer: RequestOffer; workerAccess?: WorkerAcceptanceAccess }>),
  confirmOffer: (requestId: string, offerId: string) =>
    api.post(`/requests/${requestId}/offers/${offerId}/confirm`).then(unwrap<ConfirmOfferResponse>),
  withdrawOffer: (requestId: string, offerId: string) =>
    api.post(`/requests/${requestId}/offers/${offerId}/withdraw`).then(unwrap<RequestOffer>),
  offerMessages: (requestId: string, offerId: string, params?: { before?: string; limit?: number }) =>
    api.get(`/requests/${requestId}/offers/${offerId}/messages`, { params }).then(unwrap<OfferMessage[]>),
  sendOfferMessage: (requestId: string, offerId: string, content: string) =>
    api.post(`/requests/${requestId}/offers/${offerId}/messages`, { content }).then(unwrap<OfferMessage>),
  ratingEligibility: (requestId: string) => api.get(`/requests/${requestId}/rating-eligibility`).then(unwrap<RatingEligibility>),
  submitReview: (requestId: string, payload: { rating: number; comment?: string }) =>
    api.post(`/requests/${requestId}/reviews`, payload).then(unwrap<CreateReviewResponse>),
  messages: (requestId: string, params?: { before?: string; limit?: number }) => api.get(`/messages/${requestId}`, { params }).then(unwrap<Message[]>),
  sendMessage: (requestId: string, content: string) => api.post(`/messages/${requestId}`, { content }).then(unwrap<Message>),
  markRead: (requestId: string) => api.patch(`/messages/${requestId}/read`).then(r => r.data),
  unreadCount: () => api.get('/messages/unread-count').then(r => r.data.data),
  notifications: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => api.get('/notifications', { params }).then(unwrap<Paginated<NotificationItem>>),
  markAllNotificationsRead: () => api.patch('/notifications/read-all').then(r => r.data),
  markNotificationRead: (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data),
  deleteNotification: (id: string) => api.delete(`/notifications/${id}`).then(r => r.data),
};
