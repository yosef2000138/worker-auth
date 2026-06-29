import { api, unwrap } from './api';
import { Message, NotificationItem, Paginated, PaymentMethod, RequestStatus, ServiceRequest } from '@/types';
export type CreateRequestPayload = { categoryId: string; title: string; description: string; lat: number; lng: number; address: string; scheduledAt?: string; paymentMethod: PaymentMethod; images?: { uri: string; name?: string; type?: string }[] };
export type RequestStatusUpdate = Exclude<RequestStatus, 'PENDING'>;
export const requestService = {
  async create(payload: CreateRequestPayload) { const form = new FormData(); Object.entries(payload).forEach(([k, v]) => { if (k !== 'images' && v !== undefined) form.append(k, String(v)); }); payload.images?.forEach((img, i) => form.append('images', { uri: img.uri, name: img.name ?? `image-${i}.jpg`, type: img.type ?? 'image/jpeg' } as unknown as Blob)); return api.post('/requests', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap<ServiceRequest>); },
  list: (params?: { status?: RequestStatus; page?: number; limit?: number }) => api.get('/requests', { params }).then(unwrap<Paginated<ServiceRequest>>),
  getOne: (id: string) => api.get(`/requests/${id}`).then(unwrap<ServiceRequest>),
  updateStatus: (id: string, status: RequestStatusUpdate, cancellationReason?: string) => api.put(`/requests/${id}/status`, { status, cancellationReason }).then(unwrap<ServiceRequest>),
  cancel: (id: string, reason?: string) => api.post(`/requests/${id}/cancel`, { reason }).then(unwrap<ServiceRequest>),
  messages: (requestId: string, params?: { before?: string; limit?: number }) => api.get(`/messages/${requestId}`, { params }).then(unwrap<Message[]>),
  sendMessage: (requestId: string, content: string) => api.post(`/messages/${requestId}`, { content }).then(unwrap<Message>),
  markRead: (requestId: string) => api.patch(`/messages/${requestId}/read`).then(r => r.data),
  unreadCount: () => api.get('/messages/unread-count').then(r => r.data.data),
  notifications: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => api.get('/notifications', { params }).then(unwrap<Paginated<NotificationItem>>),
  markAllNotificationsRead: () => api.patch('/notifications/read-all').then(r => r.data),
  markNotificationRead: (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data),
  deleteNotification: (id: string) => api.delete(`/notifications/${id}`).then(r => r.data),
};
