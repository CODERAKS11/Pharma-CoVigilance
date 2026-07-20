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

// Enable trust proxy for cloud environments (Vercel, Heroku, AWS)
app.set('trust proxy', 1);

// Universal Permissive CORS Middleware - Allow ALL Origins, IPs, Methods, & Headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'false');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Security Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: '*',
  optionsSuccessStatus: 200
}));
app.options('*', cors());
app.use(express.json());

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 100, // higher limit in test context
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
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

// Normalize URL prefix for Vercel serverless rewrites and sanitize double slashes
app.use((req: Request, res: Response, next: NextFunction) => {
  // Sanitize multiple slashes (e.g. //auth/login -> /auth/login)
  req.url = req.url.replace(/\/+/g, '/');

  if (req.url.startsWith('/api/index.ts')) {
    req.url = req.url.replace(/^\/api\/index\.ts/, '') || '/';
  } else if (req.url.startsWith('/api/index')) {
    req.url = req.url.replace(/^\/api\/index/, '') || '/';
  } else if (req.url.startsWith('/api/')) {
    req.url = req.url.replace(/^\/api/, '') || '/';
  }
  next();
});

// Root and Health check endpoints
app.get(['/', '/health', '/api/health'], (req: Request, res: Response) => {
  return res.json({ status: 'ok', service: 'PharmaSafe API Service', timestamp: new Date() });
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
