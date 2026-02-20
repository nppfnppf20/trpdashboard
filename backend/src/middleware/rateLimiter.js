/**
 * Rate Limiting Middleware
 * Protects against brute force and DDoS attacks
 */

import rateLimit from 'express-rate-limit';

// General API rate limiter - 200 requests per 15 minutes per USER
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each USER to 200 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  // Use user ID for authenticated routes, IP for unauthenticated
  // This prevents office workers sharing an IP from blocking each other
  keyGenerator: (req, res) => {
    // If user is authenticated, use their ID
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // For unauthenticated, don't use custom key (let library handle IPv6)
    return undefined;
  },
  // Only skip in development, NEVER in production
  skip: (req) => process.env.NODE_ENV !== 'production' && process.env.NODE_ENV === 'development'
});

// Stricter limiter for analysis endpoints (heavy computation)
export const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // Limit to 40 analyses per 15 minutes per USER
  message: {
    error: 'Too many requests',
    message: 'Too many analysis requests, please try again later. Limit: 40 per 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return undefined;
  },
  skip: (req) => process.env.NODE_ENV !== 'production' && process.env.NODE_ENV === 'development'
});

// Auth endpoint limiter - prevent brute force login attempts
// Uses IP-only (default behavior)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit to 20 requests per 15 minutes per IP
  message: {
    error: 'Too many requests',
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // No keyGenerator = uses default IP (handles IPv6 properly)
  skip: (req) => process.env.NODE_ENV !== 'production' && process.env.NODE_ENV === 'development'
});
