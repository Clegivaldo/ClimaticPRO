import { Router, Request, Response } from 'express';
import * as sensorService from '../services/sensor.service';
import { authenticateToken } from '../middleware/auth.middleware';
import sensorDataRoutes from './sensorData.routes';
import { z } from 'zod';

const router = Router();

// Mount nested routes
router.use('/:id/data', sensorDataRoutes);

// Validation schemas
const createSensorSchema = z.object({
  mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address'),
  alias: z.string().min(1).max(50).optional(),
  deviceType: z.enum(['F525_GATEWAY', 'JHT_UP_39F5', 'WIFI_PT100_35F5', 'JW_U_WATER']),
});

const updateSensorSchema = z.object({
  alias: z.string().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// All sensor routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/sensors
 * List all sensors for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const pagination = paginationSchema.safeParse(req.query);
    
    const result = await sensorService.getSensors(userId, pagination.success ? pagination.data : {});
    
    return res.json({
      code: 200,
      message: 'Sensors retrieved successfully',
      data: result
    });
  } catch (error) {
    console.error('Error listing sensors:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to list sensors'
    });
  }
});

/**
 * GET /api/v1/sensors/:id
 * Get details for a specific sensor
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sensorId = req.params['id'] as string;
    const sensor = await sensorService.getSensorById(sensorId, userId);
    
    if (!sensor) {
      return res.status(404).json({
        code: 404,
        message: 'Sensor not found'
      });
    }
    
    return res.json({
      code: 200,
      message: 'Sensor details retrieved successfully',
      data: sensor
    });
  } catch (error) {
    console.error('Error getting sensor details:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to get sensor details'
    });
  }
});

/**
 * POST /api/v1/sensors
 * Add a new sensor
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validation = createSensorSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation failed',
        error: validation.error.flatten()
      });
    }
    
    const sensor = await sensorService.createSensor({
      ...validation.data,
      userId
    });
    
    return res.status(201).json({
      code: 201,
      message: 'Sensor created successfully',
      data: sensor
    });
  } catch (error: any) {
    // Handle unique constraint violation (P2002)
    if (error.code === 'P2002') {
      return res.status(409).json({
        code: 409,
        message: 'Sensor with this MAC address already exists for this user'
      });
    }
    
    console.error('Error creating sensor:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to create sensor'
    });
  }
});

/**
 * PATCH /api/v1/sensors/:id
 * Update sensor alias or status
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sensorId = req.params['id'] as string;
    const validation = updateSensorSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation failed',
        error: validation.error.flatten()
      });
    }
    
    const result = await sensorService.updateSensor(sensorId, userId, validation.data);
    
    if ((result as any).count === 0) {
      return res.status(404).json({
        code: 404,
        message: 'Sensor not found'
      });
    }
    
    return res.json({
      code: 200,
      message: 'Sensor updated successfully'
    });
  } catch (error) {
    console.error('Error updating sensor:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to update sensor'
    });
  }
});

/**
 * DELETE /api/v1/sensors/:id
 * Remove a sensor
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sensorId = req.params['id'] as string;
    const result = await sensorService.deleteSensor(sensorId, userId);
    
    if ((result as any).count === 0) {
      return res.status(404).json({
        code: 404,
        message: 'Sensor not found'
      });
    }
    
    return res.json({
      code: 200,
      message: 'Sensor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sensor:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to delete sensor'
    });
  }
});

export default router;
