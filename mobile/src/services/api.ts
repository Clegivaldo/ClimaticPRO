import apiClient from './api.client';
import { useAuthStore } from '../store/useAuthStore';
import { useSensorStore } from '../store/useSensorStore';

class ApiService {
  async getAlertConfig(sensorId: string) {
    const response = await apiClient.get(`/alerts/sensors/${sensorId}/config`);
    return response.data.data;
  }

  async updateAlertConfig(sensorId: string, payload: {
    isEnabled?: boolean;
    tempMin?: number | null;
    tempMax?: number | null;
    humidityMin?: number | null;
    humidityMax?: number | null;
    cooldownMinutes?: number;
  }) {
    const response = await apiClient.patch(`/alerts/sensors/${sensorId}/config`, payload);
    return response.data.data;
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

  async getSensorHistory(sensorId: string, startDate?: string, endDate?: string, page = 1, limit = 100) {
    const response = await apiClient.get(`/sensors/${sensorId}/data`, {
      params: { startDate, endDate, page, limit }
    });
    return response.data.data;
  }

  async postSensorReading(sensorId: string, payload: any) {
    const response = await apiClient.post(`/sensors/${sensorId}/data`, payload);
    return response.data;
  }

  async syncJaaleeData() {
    const response = await apiClient.post('/sync/jaalee/fetch');
    return response.data?.data;
  }

  async registerSensor(mac?: string, deviceType?: string, alias?: string, signature?: string) {
    const body: any = { deviceType };
    if (mac) body.mac = mac;
    if (signature) body.signature = signature;
    if (alias) body.alias = alias;
    const response = await apiClient.post('/sensors', body);
    const newSensor = response.data.data;
    const currentSensors = useSensorStore.getState().sensors;
    useSensorStore.getState().setSensors([...currentSensors, newSensor]);
    return newSensor;
  }

  async deleteSensor(sensorId: string) {
    const response = await apiClient.delete(`/sensors/${sensorId}`);
    const currentSensors = useSensorStore.getState().sensors;
    useSensorStore.getState().setSensors(currentSensors.filter((s: any) => s.id !== sensorId));
    return response.data;
  }

  async updateSensor(sensorId: string, payload: { alias?: string; isActive?: boolean; mac?: string }) {
    const response = await apiClient.patch(`/sensors/${sensorId}`, payload);
    useSensorStore.getState().updateSensor(sensorId, payload as any);
    return response.data;
  }

  async askAI(message: string) {
    const response = await apiClient.post('/ai/chat', { message });
    return response.data.data;
  }
}

export const api = new ApiService();
