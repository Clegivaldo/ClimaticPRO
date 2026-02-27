import { Router } from 'express';
import authRoutes from './auth.routes';
import sensorRoutes from './sensor.routes';
import alertRoutes from './alert.routes';
import aiRoutes from './ai.routes';
import exportRoutes from './export.routes';
import syncRoutes from './sync.routes';
import debugRoutes from './debug.routes';

const router = Router();

// Test route for API base
// Root info for API - responds to GET /api/v1/
router.get('/', (_req, res) => {
  res.json({
    service: 'Climatic Pro Backend API',
    version: '1.0.0',
    status: 'online',
    docs: '/api/v1'
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/sensors', sensorRoutes);
router.use('/alerts', alertRoutes);
router.use('/ai', aiRoutes);
router.use('/export', exportRoutes);
router.use('/sync', syncRoutes);
router.use('/debug', debugRoutes);

export default router;
