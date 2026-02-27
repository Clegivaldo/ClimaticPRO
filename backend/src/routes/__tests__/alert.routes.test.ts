import request from 'supertest';
import express from 'express';
import alertRoutes from '../alert.routes';
import * as alertService from '../../services/alert.service';

// Mock alert service
jest.mock('../../services/alert.service');

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user-id' };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/v1/alerts', alertRoutes);

describe('Alert Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/alerts', () => {
    it('should return alert history', async () => {
      const mockResult = {
        items: [{ id: 'a1', parameter: 'temperature', value: 35 }],
        pagination: { page: 1, limit: 50, total: 1, hasMore: false }
      };
      
      (alertService.getAlertHistory as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/v1/alerts');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult);
      expect(alertService.getAlertHistory).toHaveBeenCalledWith('test-user-id', {});
    });
  });

  describe('PATCH /api/v1/alerts/:id/acknowledge', () => {
    it('should acknowledge an alert', async () => {
      (alertService.acknowledgeAlert as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await request(app).patch('/api/v1/alerts/a1/acknowledge');

      expect(response.status).toBe(200);
      expect(alertService.acknowledgeAlert).toHaveBeenCalledWith('a1', 'test-user-id');
    });
  });

  describe('GET /api/v1/alerts/sensors/:sensorId/config', () => {
    it('should return alert config', async () => {
      const mockConfig = { isEnabled: true, tempMax: 30 };
      (alertService.getAlertConfig as jest.Mock).mockResolvedValue(mockConfig);

      const response = await request(app).get('/api/v1/alerts/sensors/s1/config');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockConfig);
    });
  });

  describe('PATCH /api/v1/alerts/sensors/:sensorId/config', () => {
    it('should update alert config', async () => {
      const newConfig = { isEnabled: false, tempMax: 35 };
      (alertService.updateAlertConfig as jest.Mock).mockResolvedValue(newConfig);

      const response = await request(app)
        .patch('/api/v1/alerts/sensors/s1/config')
        .send(newConfig);

      expect(response.status).toBe(200);
      expect(alertService.updateAlertConfig).toHaveBeenCalledWith('s1', 'test-user-id', expect.objectContaining(newConfig));
    });
  });
});
