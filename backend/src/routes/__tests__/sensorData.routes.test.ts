import request from 'supertest';
import express from 'express';
import sensorRoutes from '../sensor.routes';
import * as sensorDataService from '../../services/sensorData.service';

// Mock sensor data service
jest.mock('../../services/sensorData.service');

// Mock sensor service (to allow mounting sensorRoutes)
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

describe('Sensor Data Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/sensors/:id/data', () => {
    it('should return historical data', async () => {
      const mockResult = {
        items: [{ id: 'r1', temperature: 25.5, timestamp: new Date() }],
        pagination: { page: 1, limit: 50, total: 1, hasMore: false }
      };
      
      (sensorDataService.getSensorHistory as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/v1/sensors/sensor-123/data');

      expect(response.status).toBe(200);
      expect(response.body.data.items[0].temperature).toBe(25.5);
      expect(sensorDataService.getSensorHistory).toHaveBeenCalledWith('sensor-123', 'test-user-id', {});
    });

    it('should handle date filters', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z').toISOString();
      const endDate = new Date('2024-01-02T00:00:00Z').toISOString();
      
      (sensorDataService.getSensorHistory as jest.Mock).mockResolvedValue({ items: [], pagination: {} });

      await request(app).get(`/api/v1/sensors/s1/data?startDate=${startDate}&endDate=${endDate}`);

      const callArgs = (sensorDataService.getSensorHistory as jest.Mock).mock.calls[0][2];
      expect(callArgs.startDate).toBeInstanceOf(Date);
      expect(callArgs.endDate).toBeInstanceOf(Date);
    });
  });

  describe('GET /api/v1/sensors/:id/data/latest', () => {
    it('should return latest reading', async () => {
      const mockReading = { id: 'r1', temperature: 25.5 };
      (sensorDataService.getLatestReading as jest.Mock).mockResolvedValue(mockReading);

      const response = await request(app).get('/api/v1/sensors/s1/data/latest');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockReading);
    });
  });

  describe('POST /api/v1/sensors/:id/data', () => {
    it('should create a new reading', async () => {
      const readingData = { temperature: 22.2, humidity: 45 };
      (sensorDataService.createReading as jest.Mock).mockResolvedValue({ id: 'new-r', ...readingData });

      const response = await request(app)
        .post('/api/v1/sensors/s1/data')
        .send(readingData);

      expect(response.status).toBe(201);
      expect(sensorDataService.createReading).toHaveBeenCalledWith({
        ...readingData,
        sensorId: 's1'
      });
    });
  });
});
