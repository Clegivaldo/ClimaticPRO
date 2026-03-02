import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

console.log('API_BASE_URL:', API_BASE_URL);

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
    // Debug: log outgoing request method, url and Authorization header
    try {
      // eslint-disable-next-line no-console
      console.log('[api.client] Request:', config.method, config.baseURL + config.url, 'Authorization:', config.headers?.Authorization);
    } catch (e) {}
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // If no response (network error / timeout), try a simple retry once
    if (!error.response && originalRequest && !((originalRequest as any)._retry)) {
      (originalRequest as any)._retry = true;
      await new Promise(resolve => setTimeout(resolve, 2000));
      return apiClient(originalRequest);
    }

    // If still a network error, try switching to localhost (useful for Expo Orbit / desktop)
    if (error.code === 'ERR_NETWORK' && originalRequest && !((originalRequest as any)._retryLocal)) {
      try {
        (originalRequest as any)._retryLocal = true;
        // eslint-disable-next-line no-console
        console.log('[api.client] Network error detected, retrying with localhost baseURL');
        const localBase = 'http://localhost:3001/api/v1';
        apiClient.defaults.baseURL = localBase;
        // also override the originalRequest baseURL so axios uses localhost
        (originalRequest as any).baseURL = localBase;
        // update config url if it was absolute
        if (originalRequest.url && typeof originalRequest.url === 'string' && originalRequest.url.startsWith('http')) {
          // convert to relative path
          const urlObj = new URL(originalRequest.url);
          originalRequest.url = urlObj.pathname + urlObj.search;
        }
        // eslint-disable-next-line no-console
        console.log('[api.client] Retrying request to:', (originalRequest as any).baseURL + originalRequest.url);
        await new Promise(resolve => setTimeout(resolve, 500));
        return apiClient(originalRequest);
      } catch (e) {
        // ignore and fallthrough to default error handling
      }
    }

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }

    // Debug: log response status, headers and error details
    try {
      // eslint-disable-next-line no-console
      console.log('[api.client] Response error:', error.message, error.response?.status, error.response?.headers);
      // eslint-disable-next-line no-console
      console.log('[api.client] Error details:', error.toJSON ? error.toJSON() : error);
    } catch (e) {}

    return Promise.reject(error);
  }
);

export default apiClient;
