import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import Constants from 'expo-constants';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
  'http://10.11.12.34:3001/api/v1';

console.log('[api.client] Initializing with API_BASE_URL:', API_BASE_URL);

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Debug logging
    try {
      const authHeader = config.headers?.Authorization ? 'Present' : 'Missing';
      console.log(`[api.client] Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url} (Auth: ${authHeader})`);
    } catch (e) { }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // 1. Handle regular retry (once) for network errors or timeouts
    if (!error.response && originalRequest && !((originalRequest as any)._retry)) {
      (originalRequest as any)._retry = true;
      console.log('[api.client] No response, retrying request...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return apiClient(originalRequest);
    }

    // 2. Clear auth on 401
    if (error.response?.status === 401) {
      console.warn('[api.client] 401 Unauthorized, logging out');
      useAuthStore.getState().logout();
    }

    // 3. Log detailed error information
    try {
      if (error.code === 'ERR_NETWORK') {
        console.error('[api.client] Network Error: Could not reach', originalRequest?.baseURL || API_BASE_URL);
      } else {
        console.log('[api.client] Response error:', error.message, error.response?.status);
      }
      // console.log('[api.client] Error details:', error.toJSON ? error.toJSON() : error);
    } catch (e) { }

    return Promise.reject(error);
  }
);

export default apiClient;
