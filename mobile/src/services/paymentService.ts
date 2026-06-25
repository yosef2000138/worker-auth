import { api, unwrap } from './api';
import { Paginated, Payment } from '@/types';
export const paymentService = {
  createIntent: (requestId: string) => api.post('/payments/create-intent', { requestId }).then(r => r.data.data),
  confirm: (requestId: string, amount: number) => api.post('/payments/confirm', { requestId, amount }).then(unwrap<Payment>),
  recordCash: (requestId: string, amount: number) => api.post('/payments/cash', { requestId, amount }).then(unwrap<Payment>),
  byRequest: (requestId: string) => api.get(`/payments/request/${requestId}`).then(unwrap<Payment | null>),
  history: (page = 1, limit = 10) => api.get('/payments/history', { params: { page, limit } }).then(unwrap<Paginated<Payment>>),
};
