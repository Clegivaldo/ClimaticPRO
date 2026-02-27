import { Router, Request, Response } from 'express';
import * as alertService from '../services/alert.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const alertConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  tempMin: z.number().nullable().optional(),
  tempMax: z.number().nullable().optional(),
  humidityMin: z.number().nullable().optional(),
  humidityMax: z.number().nullable().optional(),
  co2Max: z.number().nullable().optional(),
  pm25Max: z.number().nullable().optional(),
  tvocMax: z.number().nullable().optional(),
  cooldownMinutes: z.number().min(1).max(1440).optional(),
});

// All alert routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/alerts
 * List all alerts for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const pagination = paginationSchema.safeParse(req.query);
    
    const result = await alertService.getAlertHistory(userId, pagination.success ? pagination.data : {});
    
    return res.json({
      code: 200,
      message: 'Alert history retrieved successfully',
      data: result
    });
  } catch (error) {
    console.error('Error listing alerts:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to list alerts'
    });
  }
});

/**
 * PATCH /api/v1/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.patch('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const alertId = req.params['id'] as string;
    
    const result = await alertService.acknowledgeAlert(alertId, userId);
    
    if ((result as any).count === 0) {
      return res.status(404).json({
        code: 404,
        message: 'Alert not found'
      });
    }
    
    return res.json({
      code: 200,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to acknowledge alert'
    });
  }
});

/**
 * GET /api/v1/alerts/sensors/:sensorId/config
 * Get alert configuration for a specific sensor
 */
router.get('/sensors/:sensorId/config', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sensorId = req.params['sensorId'] as string;
    
    const config = await alertService.getAlertConfig(sensorId, userId);
    
    return res.json({
      code: 200,
      message: 'Alert configuration retrieved successfully',
      data: config
    });
  } catch (error: any) {
    if (error.message === 'Sensor not found or access denied') {
      return res.status(404).json({
        code: 404,
        message: error.message
      });
    }
    
    console.error('Error getting alert config:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to get alert configuration'
    });
  }
});

/**
 * PATCH /api/v1/alerts/sensors/:sensorId/config
 * Update alert configuration for a specific sensor
 */
router.patch('/sensors/:sensorId/config', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sensorId = req.params['sensorId'] as string;
    const validation = alertConfigSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation failed',
        error: validation.error.flatten()
      });
    }
    
    const config = await alertService.updateAlertConfig(sensorId, userId, validation.data);
    
    return res.json({
      code: 200,
      message: 'Alert configuration updated successfully',
      data: config
    });
  } catch (error: any) {
    if (error.message === 'Sensor not found or access denied') {
      return res.status(404).json({
        code: 404,
        message: error.message
      });
    }
    
    console.error('Error updating alert config:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to update alert configuration'
    });
  }
});

export default router;
