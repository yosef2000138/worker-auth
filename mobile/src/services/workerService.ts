import { api, unwrap } from './api';
import { Category, Paginated, Review, WorkerProfile } from '@/types';
export type WorkerSearchParams = { categoryId?: string; lat?: number; lng?: number; minRating?: number; maxRate?: number; page?: number; limit?: number; sort?: 'rating' | 'jobs' | 'rate' };
export const workerService = {
  search: (params?: WorkerSearchParams) => api.get('/workers', { params }).then(unwrap<Paginated<WorkerProfile>>),
  getOne: (id: string) => api.get(`/workers/${id}`).then(unwrap<WorkerProfile>),
  // TODO: backend currently declares /workers/:id before /workers/me, so /me may be captured as :id until route order is fixed.
  me: () => api.get('/workers/me').then(unwrap<WorkerProfile>),
  updateMe: (payload: Partial<WorkerProfile>) => api.put('/workers/me', payload).then(unwrap<WorkerProfile>),
  setCategories: (categoryIds: string[]) => api.put('/workers/me/categories', { categoryIds }).then(r => r.data),
  setAvailability: (slots: { dayOfWeek: number; startTime: string; endTime: string }[]) => api.put('/workers/me/availability', { slots }).then(r => r.data),
  toggleAvailability: (isAvailable: boolean) => api.patch('/workers/me/availability-status', { isAvailable }).then(r => r.data),
  earnings: () => api.get('/workers/me/earnings').then(r => r.data.data),
  reviews: (workerId: string, page = 1, limit = 10) => api.get(`/reviews/worker/${workerId}`, { params: { page, limit } }).then(unwrap<Paginated<Review>>),
  categories: () => api.get('/categories').then(unwrap<Category[]>),
};
