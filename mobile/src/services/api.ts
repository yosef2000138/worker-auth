import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/authStore';
import type { AuthResult } from '@/types';

const DEFAULT_API_URL = 'https://worker-auth.onrender.com/api/v1';
const DEFAULT_SOCKET_URL = 'https://worker-auth.onrender.com';

const normalizeUrl = (value: string | undefined, fallback: string) => {
  return (value?.trim() || fallback).replace(/\/+$/, '');
};

export const API_URL = normalizeUrl(process.env.EXPO_PUBLIC_API_URL, DEFAULT_API_URL);
export const SOCKET_URL = normalizeUrl(process.env.EXPO_PUBLIC_SOCKET_URL, DEFAULT_SOCKET_URL);

export const ACCESS_TOKEN_KEY = 'worker_app_access_token';
export const REFRESH_TOKEN_KEY = 'worker_app_refresh_token';

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };
type ApiErrorBody = {
  message?: string;
  errors?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiRequestError extends Error {
  code?: string;
  details?: unknown;
  status?: number;

  constructor(message: string, options?: { code?: string; details?: unknown; status?: number }) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = options?.code;
    this.details = options?.details;
    this.status = options?.status;
  }
}

export const api = axios.create({ baseURL: API_URL, timeout: 120000, headers: { Accept: 'application/json' } });

let refreshPromise: Promise<AuthResult | null> | null = null;
const sessionInvalidationHandlers = new Set<() => Promise<void> | void>();

export function addSessionInvalidationHandler(handler: () => Promise<void> | void) {
  sessionInvalidationHandlers.add(handler);
  return () => {
    sessionInvalidationHandlers.delete(handler);
  };
}

export async function invalidateAuthSession() {
  await clearTokens();
  await Promise.all(Array.from(sessionInvalidationHandlers, handler => handler()));
  useAuthStore.getState().logoutLocal();
}

async function performRefresh() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const response = await axios.post<{ data: AuthResult }>(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { headers: { Accept: 'application/json' } },
  );
  const data = response.data.data;
  if ((await getRefreshToken()) !== refreshToken) {
    return null;
  }
  await setTokens(data.accessToken, data.refreshToken);
  useAuthStore.getState().setAuth(data);
  return data;
}

export async function refreshAuthTokens() {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function refreshAccessToken() {
  const data = await refreshAuthTokens();
  return data?.accessToken ?? null;
}

function shouldRefreshForRequest(config: RetriableRequestConfig) {
  const url = config.url ?? '';
  return !url.startsWith('/auth/');
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(r => r, async (error: AxiosError<ApiErrorBody>) => {
  const originalRequest = error.config as RetriableRequestConfig | undefined;

  if (error.response?.status === 401 && originalRequest && !originalRequest._retry && shouldRefreshForRequest(originalRequest)) {
    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();

      if (accessToken) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      }

      await invalidateAuthSession();
    } catch {
      await invalidateAuthSession();
    }
  }

  if (error.code === 'ECONNABORTED') {
    return Promise.reject(new ApiRequestError('The server is waking up. Please try again in a moment.', { status: error.response?.status }));
  }
  const body = error.response?.data;
  const msg = body?.error?.message ?? body?.message ?? error.message ?? 'Request failed';
  return Promise.reject(new ApiRequestError(msg, {
    code: body?.error?.code,
    details: body?.error?.details ?? body?.errors,
    status: error.response?.status,
  }));
});

export async function setTokens(accessToken: string, refreshToken: string) {
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, options),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, options),
  ]);
}
export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
export async function getRefreshToken() { return SecureStore.getItemAsync(REFRESH_TOKEN_KEY); }
export const unwrap = <T,>(response: { data: { data: T } }) => response.data.data;
