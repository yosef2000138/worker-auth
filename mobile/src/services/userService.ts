import { api, unwrap } from './api';
import { ServiceRequest, User, WorkerProfile } from '@/types';

export type UpdateProfilePayload = {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
};

export const userService = {
  profile: () => api.get('/users/profile').then(unwrap<User>),
  updateProfile: (payload: UpdateProfilePayload) => api.put('/users/profile', payload).then(unwrap<User>),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    api.put('/users/change-password', payload).then(r => r.data),
  history: () => api.get('/users/history').then(unwrap<ServiceRequest[]>),
  favorites: () => api.get('/users/favorites').then(unwrap<WorkerProfile[]>),
  addFavorite: (workerId: string) => api.post(`/users/favorites/${workerId}`).then(r => r.data),
  removeFavorite: (workerId: string) => api.delete(`/users/favorites/${workerId}`).then(r => r.data),
};
