import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_HOSTS = {
  ios: 'http://localhost:3000/api/v1',
  android: 'http://10.0.2.2:3000/api/v1',
  device: 'http://192.168.10.237:3000/api/v1',
} as const;

export const SOCKET_HOSTS = {
  ios: 'http://localhost:3000',
  android: 'http://10.0.2.2:3000',
  device: 'http://192.168.10.237:3000',
} as const;

type Target = keyof typeof API_HOSTS;
export const API_TARGET = 'ios' as Target; // use 'ios' for simulator, 'android' for emulator, 'device' for real phone
const fallbackApiUrl = API_TARGET === 'ios' && Platform.OS === 'android' ? API_HOSTS.android : API_HOSTS[API_TARGET];
const fallbackSocketUrl = API_TARGET === 'ios' && Platform.OS === 'android' ? SOCKET_HOSTS.android : SOCKET_HOSTS[API_TARGET];
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? fallbackApiUrl;
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? fallbackSocketUrl;

export const ACCESS_TOKEN_KEY = 'worker_app_access_token';
export const REFRESH_TOKEN_KEY = 'worker_app_refresh_token';

export const api = axios.create({ baseURL: API_URL, timeout: 15000, headers: { Accept: 'application/json' } });

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
