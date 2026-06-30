import { api, unwrap } from './api';
import { RatingEligibility, Review } from '@/types';

export const reviewService = {
  create: (payload: { requestId: string; rating: number; comment?: string }) =>
    api.post('/reviews', payload).then(unwrap<Review>),
  createForRequest: (requestId: string, payload: { rating: number; comment?: string }) =>
    api.post(`/requests/${requestId}/reviews`, payload).then(unwrap<Review>),
  eligibility: (requestId: string) =>
    api.get(`/requests/${requestId}/rating-eligibility`).then(unwrap<RatingEligibility>),
  getOne: (id: string) => api.get(`/reviews/${id}`).then(unwrap<Review>),
};
