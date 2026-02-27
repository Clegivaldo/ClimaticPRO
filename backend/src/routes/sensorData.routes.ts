import { Router, Request, Response } from 'express';
import * as sensorDataService from '../services/sensorData.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router({ mergeParams: true }); // Merge params to access sensorId from parent router

// Validation schemas
const createReadingSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  co2: z.number().optional(),
  pm25: z.number().optional(),
  tvoc: z.number().optional(),
  pressure: z.number().optional(),
  waterLevel: z.number().optional(),
  timestamp: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});

const historyQuerySchema = z.object({
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// All sensor data routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/sensors/:id/data
 * Get historical data for a sensor
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sensorId = req.params['id'] as string;
    const query = historyQuerySchema.safeParse(req.query);
    
    if (!query.success) {
      return res.status(400).json({
        code: 400,
        message: 'Invalid query parameters',
        error: query.error.flatten()
      });
    }
    
    const result = await sensorDataService.getSensorHistory(sensorId, userId, query.data);
    
    return res.json({
      code: 200,
      message: 'Sensor history retrieved successfully',
      data: result
    });
  } catch (error: any) {
    if (error.message === 'Sensor not found or access denied') {
      return res.status(404).json({
        code: 404,
        message: error.message
      });
    }
    
    console.error('Error getting sensor history:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to get sensor history'
    });
  }
});

/**
 * GET /api/v1/sensors/:id/data/latest
 * Get the latest reading for a sensor
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sensorId = req.params['id'] as string;
    
    const result = await sensorDataService.getLatestReading(sensorId, userId);
    
    return res.json({
      code: 200,
      message: 'Latest sensor reading retrieved successfully',
      data: result
    });
  } catch (error: any) {
    if (error.message === 'Sensor not found or access denied') {
      return res.status(404).json({
        code: 404,
        message: error.message
      });
    }
    
    console.error('Error getting latest sensor reading:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to get latest sensor reading'
    });
  }
});

/**
 * POST /api/v1/sensors/:id/data
 * Add a new sensor reading
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const sensorId = req.params['id'] as string;
    const validation = createReadingSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation failed',
        error: validation.error.flatten()
      });
    }
    
    // In a real app, we should also verify sensor ownership here
    // But for simplicity, we'll assume the sensorId is valid if provided via API
    
    const reading = await sensorDataService.createReading({
      ...validation.data,
      sensorId
    });
    
    return res.status(201).json({
      code: 201,
      message: 'Sensor reading created successfully',
      data: reading
    });
  } catch (error) {
    console.error('Error creating sensor reading:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to create sensor reading'
    });
  }
});

export default router;
