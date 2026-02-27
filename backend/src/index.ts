import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from './utils/prisma';
import routes from './routes';
import healthRoutes from './routes/health.routes';
import { initFCM } from './services/notification.service';
import { initGemini } from './services/gemini.service';
import { globalRateLimiter } from './middleware/rateLimit.middleware';
import pino from 'pino-http';
import { logger } from './utils/logger';

dotenv.config();

const app: Application = express();
const PORT = process.env['PORT'] || 3001;

// Configuração de CORS simplificada para desenvolvimento
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Desativar Helmet temporariamente para evitar bloqueios de COOP/COEP no mobile
// app.use(helmet()); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalRateLimiter);

// Diagnostic middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Rotas de teste e informação na raiz
app.get('/', (req, res) => {
  res.json({ service: 'Climatic Pro API', status: 'online' });
});

app.get('/api/v1', (req, res) => {
  res.json({ message: 'API v1 root working' });
});

// API routes
app.use('/api/v1', routes);


// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✓ Database connected successfully');
    
    // Initialize services
    initFCM();
    initGemini();
    
    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
      console.log(`✓ Environment: ${process.env['NODE_ENV'] || 'development'}`);
    });
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    process.exit(1);
  }
};

startServer();

export default app;
