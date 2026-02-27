import { Router, Request, Response } from 'express';
import * as geminiService from '../services/gemini.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const chatSchema = z.object({
  message: z.string().min(1).max(2000),
});

// All AI routes require authentication
router.use(authenticateToken);

/**
 * POST /api/v1/ai/chat
 * Send a message to the AI assistant
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validation = chatSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 400,
        message: 'Validation failed',
        error: validation.error.flatten()
      });
    }
    
    const result = await geminiService.askAssistant(userId, validation.data.message);
    
    return res.json({
      code: 200,
      message: 'AI Assistant response retrieved successfully',
      data: result
    });
  } catch (error: any) {
    if (error.message === 'AI Assistant is currently unavailable (API key not configured)') {
      return res.status(503).json({
        code: 503,
        message: error.message
      });
    }
    
    if (error.message === 'AI Assistant timed out') {
      return res.status(504).json({
        code: 504,
        message: error.message
      });
    }
    
    console.error('Error in AI chat endpoint:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to get response from AI Assistant'
    });
  }
});

/**
 * GET /api/v1/ai/insights
 * Get automatic AI-generated insights
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await geminiService.getAutomaticInsights(userId);
    
    return res.json({
      code: 200,
      message: 'AI Insights retrieved successfully',
      data: result
    });
  } catch (error: any) {
    if (error.message === 'AI Assistant is currently unavailable (API key not configured)') {
      return res.status(503).json({
        code: 503,
        message: error.message
      });
    }
    
    console.error('Error in AI insights endpoint:', error);
    return res.status(500).json({
      code: 500,
      message: 'Failed to get AI insights'
    });
  }
});

export default router;
