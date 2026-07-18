import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './config/logger';
import authRouter from './routes/auth';
import casesRouter from './routes/cases';

const app = express();

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Simple logging middleware for HTTP requests
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    }, 'HTTP Request processed');
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  return res.json({ status: 'ok', timestamp: new Date() });
});

// Mount Routes
app.use('/auth', authRouter);
app.use('/cases', casesRouter);

// 404 Route handler
app.use((req: Request, res: Response) => {
  return res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled API request error occurred');
  return res.status(500).json({ error: 'Internal server error occurred' });
});

export default app;
