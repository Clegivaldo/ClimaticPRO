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

  async askAI(message: string) {
    const response = await apiClient.post('/ai/chat', { message });
    return response.data.data;
  }
}

export const api = new ApiService();
