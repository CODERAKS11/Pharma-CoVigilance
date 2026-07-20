import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './config/logger';
import authRouter from './routes/auth';
import casesRouter from './routes/cases';
import reviewRouter from './routes/review';
import dashboardRouter from './routes/dashboard';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 100, // higher limit in test context
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use(limiter);

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

// Normalize URL prefix for Vercel serverless rewrites
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.url.startsWith('/api/index')) {
    req.url = req.url.replace(/^\/api\/index/, '') || '/';
  } else if (req.url.startsWith('/api/')) {
    req.url = req.url.replace(/^\/api/, '') || '/';
  }
  next();
});

// Health check endpoint
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  return res.json({ status: 'ok', timestamp: new Date() });
});

// Mount Routes
app.use('/auth', authRouter);
app.use('/cases', casesRouter);
app.use('/cases', reviewRouter);
app.use('/dashboard', dashboardRouter);

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
