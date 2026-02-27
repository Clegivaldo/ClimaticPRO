import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Common API client (Axios)
 * Requirement 9.3: Common API client
 * Requirement 10.5: Request retry logic for offline support
 */

const API_BASE_URL = import.meta.env['VITE_API_URL'] || 'http://localhost:3001/api/v1';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Add Authorization header
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle errors and retries
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // Requirement 10.5: Simple retry logic for network errors
    if (!error.response && originalRequest && !((originalRequest as any)._retry)) {
      (originalRequest as any)._retry = true;
      // Wait 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      return apiClient(originalRequest);
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      // Redirect to login could be handled here or in UI layer
    }

    return Promise.reject(error);
  }
);

export default apiClient;
