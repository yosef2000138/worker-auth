import { api, unwrap } from './api';
import { CreateReviewResponse, RatingEligibility, Review } from '@/types';

export const reviewService = {
  create: (payload: { requestId: string; rating: number; comment?: string }) =>
    api.post('/reviews', payload).then(unwrap<CreateReviewResponse>),
  createForRequest: (requestId: string, payload: { rating: number; comment?: string }) =>
    api.post(`/requests/${requestId}/reviews`, payload).then(unwrap<CreateReviewResponse>),
  eligibility: (requestId: string) =>
    api.get(`/requests/${requestId}/rating-eligibility`).then(unwrap<RatingEligibility>),
  requestReview: (requestId: string) =>
    api.get(`/requests/${requestId}/review`).then(unwrap<{ canReview: boolean; review: Review | null; eligibility: RatingEligibility }>),
  getOne: (id: string) => api.get(`/reviews/${id}`).then(unwrap<Review>),
};
