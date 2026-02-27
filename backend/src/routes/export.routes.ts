import { Router, Request, Response } from 'express';
import * as exportService from '../services/export.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// Validation schema
const exportSchema = z.object({
  sensorId: z.string().uuid(),
  startDate: z.string().datetime().transform(val => new Date(val)),
  endDate: z.string().datetime().transform(val => new Date(val)),
  parameters: z.array(z.string()).min(1),
});

// All export routes require authentication
router.use(authenticateToken);

/**
 * POST /api/v1/export/csv
 * Export sensor data to CSV
 */
router.post('/csv', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validation = exportSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation failed',
        error: validation.error.flatten()
      });
    }
    
    const csv = await exportService.generateCSV({
      ...validation.data,
      userId
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sensor_data_${validation.data.sensorId}.csv"`);
    return res.send(csv);
  } catch (error: any) {
    if (error.message === 'Sensor not found or access denied') {
      return res.status(404).json({
        code: 404,
        message: error.message
      });
    }
    
    console.error('Error exporting to CSV:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to generate CSV export'
    });
  }
});

/**
 * POST /api/v1/export/pdf
 * Export sensor data to PDF
 */
router.post('/pdf', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validation = exportSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation failed',
        error: validation.error.flatten()
      });
    }
    
    const pdfBuffer = await exportService.generatePDF({
      ...validation.data,
      userId
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sensor_data_${validation.data.sensorId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error: any) {
    if (error.message === 'Sensor not found or access denied') {
      return res.status(404).json({
        code: 404,
        message: error.message
      });
    }
    
    console.error('Error exporting to PDF:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to generate PDF export'
    });
  }
});

export default router;
