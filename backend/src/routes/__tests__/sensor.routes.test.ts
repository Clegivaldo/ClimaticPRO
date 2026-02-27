import request from 'supertest';
import express from 'express';
import sensorRoutes from '../sensor.routes';
import * as sensorService from '../../services/sensor.service';
import { DeviceType } from '@prisma/client';

// Mock sensor service
jest.mock('../../services/sensor.service');

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user-id' };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/v1/sensors', sensorRoutes);

describe('Sensor Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/sensors', () => {
    it('should return list of sensors', async () => {
      const mockResult = {
        items: [
          { id: '1', mac: 'AA:BB:CC:DD:EE:FF', deviceType: DeviceType.F525_GATEWAY }
        ],
        pagination: { page: 1, limit: 50, total: 1, hasMore: false }
      };
      
      (sensorService.getSensors as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/v1/sensors');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(sensorService.getSensors).toHaveBeenCalledWith('test-user-id', {});
    });

    it('should handle pagination query params', async () => {
      (sensorService.getSensors as jest.Mock).mockResolvedValue({ items: [], pagination: {} });

      await request(app).get('/api/v1/sensors?page=2&limit=20');

      expect(sensorService.getSensors).toHaveBeenCalledWith('test-user-id', { page: 2, limit: 20 });
    });
  });

  describe('POST /api/v1/sensors', () => {
    it('should create a new sensor', async () => {
      const sensorData = {
        mac: 'AA:BB:CC:DD:EE:FF',
        deviceType: 'F525_GATEWAY',
        alias: 'Kitchen'
      };
      
      (sensorService.createSensor as jest.Mock).mockResolvedValue({ id: 'new-id', ...sensorData });

      const response = await request(app)
        .post('/api/v1/sensors')
        .send(sensorData);

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe('new-id');
      expect(sensorService.createSensor).toHaveBeenCalledWith({
        ...sensorData,
        userId: 'test-user-id'
      });
    });

    it('should return 400 for invalid MAC address', async () => {
      const response = await request(app)
        .post('/api/v1/sensors')
        .send({ mac: 'invalid', deviceType: 'F525_GATEWAY' });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/sensors/:id', () => {
    it('should update sensor', async () => {
      (sensorService.updateSensor as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await request(app)
        .patch('/api/v1/sensors/sensor-id')
        .send({ alias: 'New Alias' });

      expect(response.status).toBe(200);
      expect(sensorService.updateSensor).toHaveBeenCalledWith('sensor-id', 'test-user-id', { alias: 'New Alias' });
    });

    it('should return 404 if sensor not found', async () => {
      (sensorService.updateSensor as jest.Mock).mockResolvedValue({ count: 0 });

      const response = await request(app)
        .patch('/api/v1/sensors/non-existent')
        .send({ alias: 'New Alias' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/sensors/:id', () => {
    it('should delete sensor', async () => {
      (sensorService.deleteSensor as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await request(app).delete('/api/v1/sensors/sensor-id');

      expect(response.status).toBe(200);
      expect(sensorService.deleteSensor).toHaveBeenCalledWith('sensor-id', 'test-user-id');
    });
  });
});
