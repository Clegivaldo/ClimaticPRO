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
    
    if (!error.response && originalRequest && !((originalRequest as any)._retry)) {
      (originalRequest as any)._retry = true;
      await new Promise(resolve => setTimeout(resolve, 2000));
      return apiClient(originalRequest);
    }

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }

    // Debug: log response status and headers on error
    try {
      // eslint-disable-next-line no-console
      console.log('[api.client] Response error:', error.response?.status, error.response?.headers);
    } catch (e) {}

    return Promise.reject(error);
  }
);

export default apiClient;
