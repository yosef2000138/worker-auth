import { api, ApiRequestError, unwrap } from './api';
import { Paginated, Payment } from '@/types';

function onlinePaymentUnavailable() {
  return Promise.reject(new ApiRequestError('Online payments are not available in this build.', {
    code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
    status: 501,
  }));
}

export const paymentService = {
  createIntent: (_requestId: string) => onlinePaymentUnavailable(),
  confirm: (_requestId: string, _amount: number) => onlinePaymentUnavailable(),
  recordCash: (requestId: string, amount: number) => api.post('/payments/cash', { requestId, amount }).then(unwrap<Payment>),
  byRequest: (requestId: string) => api.get(`/payments/request/${requestId}`).then(unwrap<Payment | null>),
  history: (page = 1, limit = 10) => api.get('/payments/history', { params: { page, limit } }).then(unwrap<Paginated<Payment>>),
};
