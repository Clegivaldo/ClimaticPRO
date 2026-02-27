import { Router, Request, Response } from 'express';

const router = Router();

// Simple, unprotected debug endpoint to verify connectivity from clients
router.get('/sensors', async (_req: Request, res: Response) => {
  try {
    return res.json({
      code: 200,
      message: 'Debug sensors endpoint reachable',
      data: { now: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error in debug sensors endpoint:', error);
    return res.status(500).json({ code: 500, message: 'Debug endpoint failed' });
  }
});

export default router;
