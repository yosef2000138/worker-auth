import { api, clearTokens, refreshAuthTokens, setTokens, unwrap } from './api';
import { AuthResult, Role, User } from '@/types';
export type RegisterPayload = { fullName: string; email: string; phone?: string; password: string; role: Exclude<Role, 'ADMIN'> };
export type LoginPayload = { email: string; password: string };
export const authService = {
  async register(payload: RegisterPayload) {
    const data = unwrap<AuthResult>(await api.post('/auth/register', payload));
    await clearTokens();
    return data;
  },
  async login(payload: LoginPayload) {
    const res = await api.post('/auth/login', payload);
    const data = unwrap<AuthResult>(res);
    await setTokens(data.accessToken, data.refreshToken);
    return data;
  },  
  async logout() { await api.post('/auth/logout').catch(() => undefined); await clearTokens(); },
  async refresh() {
    try {
      const data = await refreshAuthTokens();
      if (!data) throw new Error('No refresh token');
      return data;
    } catch (err) {
      await clearTokens();
      throw err;
    }
  },
  forgotPassword(email: string) { return api.post('/auth/forgot-password', { email }).then(r => r.data); },
  resetPassword(token: string, newPassword: string) { return api.post('/auth/reset-password', { token, newPassword }).then(r => r.data); },
  profile() { return api.get('/users/profile').then(unwrap<User>); },
};
