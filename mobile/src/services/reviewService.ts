import { api, unwrap } from './api';
import { Review } from '@/types';

export const reviewService = {
  create: (payload: { requestId: string; rating: number; comment?: string }) =>
    api.post('/reviews', payload).then(unwrap<Review>),
  getOne: (id: string) => api.get(`/reviews/${id}`).then(unwrap<Review>),
};
