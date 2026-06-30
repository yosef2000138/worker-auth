import { api, unwrap } from '@/services/api';
import { BackendSubscriptionResponse } from './types';

export const subscriptionApi = {
  me: () => api.get('/subscriptions/me').then(unwrap<BackendSubscriptionResponse>),
};
