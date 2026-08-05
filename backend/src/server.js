/**
 * Main Server File
 * Express application entry point
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { log, LOG_FILE_PATH } from './utils/logger.js';

const app = express();
const port = process.env.PORT || 8080;

// =====================================================
// TRUST PROXY (CRITICAL for Render/Railway/Heroku)
// =====================================================
// Without this, rate limiting sees load balancer IP, not user IP
// All users would share the same rate limit!
app.set('trust proxy', 1);

// =====================================================
// SECURITY MIDDLEWARE (Order matters!)
// =====================================================

// 1. Security headers - protects against common vulnerabilities
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
  contentSecurityPolicy: false // Disable CSP (can configure later if needed)
}));

// 2. CORS - restrict to your frontend domain
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://hlpv-frontend.onrender.com',
  'https://trpdashboard.co.uk',
  'https://www.trpdashboard.co.uk',
  'http://localhost:5173', // Allow local dev
  'http://localhost:3000'  // Alternative local dev port
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2b. Request logging — every request's start/finish + DB pool stats,
// written to backend/logs/app.log for diagnosing intermittent issues after
// the fact (see requestLogger.js for how to read it).
app.use(requestLogger);

// 3. Body parsing with size limits
app.use(express.json({
  limit: '10mb',
  strict: true  // Only parse arrays and objects
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Rate limiting - apply to all routes (except health check)
app.use('/api', apiLimiter);
app.use('/analyze', apiLimiter);
app.use('/save-site', apiLimiter);
app.use('/save-trp-edits', apiLimiter);

// =====================================================
// ROUTES
// =====================================================

// Health check (no rate limit needed)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount all routes
app.use('/', routes);

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// =====================================================
// START SERVER
// =====================================================

app.listen(port, () => {
  console.log(`🚀 Backend listening on port ${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`🔑 Trust proxy: ENABLED`);
  console.log(`⏱️  Rate limiting: ${process.env.NODE_ENV === 'production' ? 'ENABLED (user-based)' : 'DISABLED (dev mode)'}`);
  console.log(`🪵 Request/error log: ${LOG_FILE_PATH}`);
  log('info', 'server started', { port });
});

// Handle unhandled promise rejections — these can otherwise fail silently:
// the request that triggered one just hangs forever (its DB client, if any,
// never gets released), which is invisible unless it's logged here.
process.on('unhandledRejection', (err) => {
  log('error', 'Unhandled Promise Rejection', { message: err?.message, stack: err?.stack });
  // In production, you might want to exit the process
  // process.exit(1);
});

process.on('uncaughtException', (err) => {
  log('error', 'Uncaught Exception', { message: err?.message, stack: err?.stack });
});
