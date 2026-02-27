import apiClient from './api.client';
import { useAuthStore } from '../store/useAuthStore';
import { useSensorStore } from '../store/useSensorStore';

/**
 * Refactored ApiService to use the new backend structure
 * Requirement 9.3: Common API client
 */

class ApiService {
  setToken(token: string) {
    useAuthStore.getState().setAuth({ userId: 'unknown' }, token);
  }

  getToken() {
    return useAuthStore.getState().token;
  }

  logout() {
    useAuthStore.getState().logout();
  }

  async getVerificationCode(identifier: string) {
    const response = await apiClient.post('/auth/send-code', { identifier });
    return response.data;
  }

  async login(identifier: string, code: string) {
    const response = await apiClient.post('/auth/verify-code', { identifier, code });
    if (response.data.data && response.data.data.token) {
      const { user, token } = response.data.data;
      useAuthStore.getState().setAuth(user, token);
    }
    return response.data.data;
  }

  async getAllDeviceData(page = 1, limit = 50) {
    const response = await apiClient.get('/sensors', {
      params: { page, limit }
    });
    
    const sensors = response.data.data.items;
    useSensorStore.getState().setSensors(sensors);
    return sensors;
  }

  async getSensorDetails(sensorId: string) {
    const response = await apiClient.get(`/sensors/${sensorId}`);
    return response.data.data;
  }

  async getSensorHistory(sensorId: string, params: any = {}) {
    const response = await apiClient.get(`/sensors/${sensorId}/data`, { params });
    return response.data.data;
  }

  async getLatestReading(sensorId: string) {
    const response = await apiClient.get(`/sensors/${sensorId}/data/latest`);
    const reading = response.data.data;
    if (reading) {
      useSensorStore.getState().setReading(sensorId, reading);
    }
    return reading;
  }

  async updateSensor(sensorId: string, data: any) {
    const response = await apiClient.patch(`/sensors/${sensorId}`, data);
    useSensorStore.getState().updateSensor(sensorId, data);
    return response.data;
  }

  async registerSensor(mac: string, deviceType: string, alias?: string) {
    const response = await apiClient.post('/sensors', { mac, deviceType, alias });
    const newSensor = response.data.data;
    // Add to store
    const currentSensors = useSensorStore.getState().sensors;
    useSensorStore.getState().setSensors([...currentSensors, newSensor]);
    return newSensor;
  }

  async deleteSensor(sensorId: string) {
    const response = await apiClient.delete(`/sensors/${sensorId}`);
    return response.data;
  }

  // AI Assistant
  async askAI(message: string) {
    const response = await apiClient.post('/ai/chat', { message });
    return response.data.data;
  }

  async getAIInsights() {
    const response = await apiClient.get('/ai/insights');
    return response.data.data;
  }

  // Alerts
  async getGlobalAlertHistory(page = 1, limit = 50) {
    const response = await apiClient.get('/alerts', {
      params: { page, limit }
    });
    return response.data.data;
  }

  async acknowledgeAlert(alertId: string) {
    const response = await apiClient.patch(`/alerts/${alertId}/acknowledge`);
    return response.data;
  }

  async getAlertConfig(sensorId: string) {
    const response = await apiClient.get(`/alerts/sensors/${sensorId}/config`);
    return response.data.data;
  }

  async updateAlertConfig(sensorId: string, data: any) {
    const response = await apiClient.patch(`/alerts/sensors/${sensorId}/config`, data);
    return response.data.data;
  }

  // Export
  async exportCSV(data: any) {
    const response = await apiClient.post('/export/csv', data, { responseType: 'blob' });
    return response.data;
  }

  async exportPDF(data: any) {
    const response = await apiClient.post('/export/pdf', data, { responseType: 'blob' });
    return response.data;
  }
}

export const api = new ApiService();
