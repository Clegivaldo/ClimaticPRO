import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';

const router = Router();

/**
 * GET /health
 * Service health check
 * Requirement 9.8: Service health monitoring
 */
router.get('/', async (_req: Request, res: Response) => {
  const status: any = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    status: 'ok',
    checks: {
      database: 'unknown',
    }
  };

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    status.checks.database = 'connected';
  } catch (error) {
    status.status = 'error';
    status.checks.database = 'disconnected';
    console.error('Health check database error:', error);
  }

  const statusCode = status.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json(status);
});

export default router;
