import { Router, Request, Response } from 'express';
import * as syncService from '../services/sync.service';
import * as jaaleeService from '../services/jaalee.service';
import { prisma } from '../utils/prisma';
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

/**
 * POST /api/v1/sync/jaalee/fetch
 * Trigger manual sync from JAALEE Open API and import readings for known sensors
 */
router.post('/jaalee/fetch', async (req: Request, res: Response) => {
  try {
    // Determine target user by JWT: prefer explicit userId, otherwise resolve by email
    let userId = req.user?.userId ?? null;
    const userEmail = req.user?.email ?? null;

    if (!userId && userEmail) {
      // upsert user by email so auto-registration can assign devices
      const u = await prisma.user.upsert({
        where: { email: userEmail },
        update: {},
        create: { email: userEmail }
      });
      userId = u.id;
    }

    const items = await jaaleeService.fetchAllDevices(userId ?? undefined);
    const imported = await jaaleeService.importJaaleeToDb(items, { autoRegister: true, userId });
    return res.json({ code: 200, message: 'Imported', data: { count: imported.length } });
  } catch (error: any) {
    console.error('Error fetching Jaalee data:', error);
    return res.status(500).json({ code: 500, message: 'Failed to fetch Jaalee data', error: error.message });
  }
});

// Public test endpoint (only enabled when ALLOW_PUBLIC_JAALEE=true)
router.get('/jaalee/test', async (_req: Request, res: Response) => {
  try {
    if (process.env['ALLOW_PUBLIC_JAALEE'] !== 'true') {
      return res.status(403).json({ code: 403, message: 'Public Jaalee test disabled' });
    }
    const items = await jaaleeService.fetchAllDevices();
    // Return first 10 normalized items (without saving)
    const sample = items.slice(0, 10).map(it => ({ mac: it.mac || it.bleMac, temperature: it.temperature, humidity: it.humidity, type: it.type }));
    return res.json({ code: 200, message: 'ok', data: sample });
  } catch (error: any) {
    console.error('Error in Jaalee test:', error);
    return res.status(500).json({ code: 500, message: 'Failed', error: error.message });
  }
});

// Login endpoint to obtain and persist JAALEE token (for local dev)
router.post('/jaalee/login', async (req: Request, res: Response) => {
  try {
    const { account, code, timeZone, token: providedToken } = req.body;

    // If caller provided a token directly (convenience for testing or if user pasted token), persist it
    if (providedToken) {
      // persist to user if authenticated
      if (req.user?.userId) {
        await prisma.user.update({ where: { id: req.user.userId }, data: { jaaleeToken: providedToken } });
      } else {
        // also store in file for fallback
        storeToken(providedToken as string);
      }
      return res.json({ code: 200, message: 'ok', data: { token: providedToken } });
    }

    if (!account || !code) return res.status(400).json({ code: 400, message: 'account and code required' });
    const token = await jaaleeService.login(account, code, timeZone || 'GMT+08:00');
    // persist token to user when authenticated
    if (req.user?.userId) {
      await prisma.user.update({ where: { id: req.user.userId }, data: { jaaleeToken: token } });
    }
    return res.json({ code: 200, message: 'ok', data: { token } });
  } catch (error: any) {
    console.error('Jaalee login error:', error);
    return res.status(500).json({ code: 500, message: 'Login failed', error: error.message });
  }
});

export default router;

