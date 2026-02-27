import { Router, Request, Response } from 'express';
import * as syncService from '../services/sync.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// Validation schema
const syncOperationSchema = z.object({
  type: z.enum(['create', 'update', 'delete']),
  resource: z.enum(['sensor', 'reading', 'alert_config']),
  resourceId: z.string(),
  payload: z.any(),
  timestamp: z.string().datetime().transform(val => new Date(val)),
});

const batchSyncSchema = z.object({
  operations: z.array(syncOperationSchema).max(100), // Limit to 100 ops per batch
});

// All sync routes require authentication
router.use(authenticateToken);

/**
 * POST /api/v1/sync/batch
 * Synchronize a batch of operations from client
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validation = batchSyncSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation failed',
        error: validation.error.flatten()
      });
    }
    
    const result = await syncService.processBatchSync(userId, validation.data.operations);
    
    return res.json({
      code: 200,
      message: 'Batch synchronization processed',
      data: result
    });
  } catch (error) {
    console.error('Error in batch sync endpoint:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to process synchronization'
    });
  }
});

export default router;
