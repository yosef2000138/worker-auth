import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_URL = 'https://worker-auth.onrender.com/api/v1';
const DEFAULT_SOCKET_URL = 'https://worker-auth.onrender.com';

const normalizeUrl = (value: string | undefined, fallback: string) => {
  return (value?.trim() || fallback).replace(/\/+$/, '');
};

export const API_URL = normalizeUrl(process.env.EXPO_PUBLIC_API_URL, DEFAULT_API_URL);
export const SOCKET_URL = normalizeUrl(process.env.EXPO_PUBLIC_SOCKET_URL, DEFAULT_SOCKET_URL);

export const ACCESS_TOKEN_KEY = 'worker_app_access_token';
export const REFRESH_TOKEN_KEY = 'worker_app_refresh_token';

export const api = axios.create({ baseURL: API_URL, timeout: 30000, headers: { Accept: 'application/json' } });

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(r => r, (error: AxiosError<{ message?: string }>) => {
  const msg = error.response?.data?.message ?? error.message ?? 'Request failed';
  return Promise.reject(new Error(msg));
});

export async function setTokens(accessToken?: string, refreshToken?: string) {
  if (accessToken) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}
export async function clearTokens() { await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY); await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY); }
export async function getRefreshToken() { return SecureStore.getItemAsync(REFRESH_TOKEN_KEY); }
export const unwrap = <T,>(response: { data: { data: T } }) => response.data.data;
