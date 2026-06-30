import { api, unwrap } from './api';
import {
  Category,
  Paginated,
  WorkerReviewsResponse,
  WorkerProfile,
} from '@/types';
export type WorkerSearchParams = { categoryId?: string; lat?: number; lng?: number; minRating?: number; maxRate?: number; page?: number; limit?: number; sort?: 'rating' | 'jobs' | 'rate' };
export type UpdateWorkerProfilePayload = {
  bio?: string | null;
  yearsExp?: number;
  hourlyRate?: number | null;
  fixedPrice?: number | null;
  workingRadius?: number;
};
export const workerService = {
  search: (params?: WorkerSearchParams) => api.get('/workers', { params }).then(unwrap<Paginated<WorkerProfile>>),
  getOne: (id: string) => api.get(`/workers/${id}`).then(unwrap<WorkerProfile>),
  me: () => api.get('/workers/me').then(unwrap<WorkerProfile>),
  updateMe: (payload: UpdateWorkerProfilePayload) => api.put('/workers/me', payload).then(unwrap<WorkerProfile>),
  setCategories: (categoryIds: string[]) => api.put('/workers/me/categories', { categoryIds }).then(unwrap<WorkerProfile>),
  setAvailability: (slots: { dayOfWeek: number; startTime: string; endTime: string }[]) => api.put('/workers/me/availability', { slots }).then(r => r.data.data),
  toggleAvailability: (isAvailable: boolean) => api.patch('/workers/me/availability-status', { isAvailable }).then(unwrap<{ id: string; isAvailable: boolean }>),
  reviews: (workerId: string, page = 1, limit = 10) => api.get(`/workers/${workerId}/reviews`, { params: { page, limit } }).then(unwrap<WorkerReviewsResponse>),
  categories: () => api.get('/categories').then(unwrap<Category[]>),
};
