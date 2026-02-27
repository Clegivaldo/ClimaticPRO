import apiClient from './api.client';
import { useAuthStore } from '../store/useAuthStore';
import { useSensorStore } from '../store/useSensorStore';

class ApiService {
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
    const response = await apiClient.get('/sensors', { params: { page, limit } });
    const sensors = response.data.data.items;
    useSensorStore.getState().setSensors(sensors);
    return sensors;
  }

  async getLatestReading(sensorId: string) {
    const response = await apiClient.get(`/sensors/${sensorId}/data/latest`);
    const reading = response.data.data;
    if (reading) {
      useSensorStore.getState().setReading(sensorId, reading);
    }
    return reading;
  }

  async postSensorReading(sensorId: string, payload: any) {
    const response = await apiClient.post(`/sensors/${sensorId}/data`, payload);
    return response.data;
  }

  async askAI(message: string) {
    const response = await apiClient.post('/ai/chat', { message });
    return response.data.data;
  }
}

export const api = new ApiService();
