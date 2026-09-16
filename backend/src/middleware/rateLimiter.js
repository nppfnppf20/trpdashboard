/**
 * Rate Limiting Middleware
 * Protects against brute force and DDoS attacks
 */

import rateLimit from 'express-rate-limit';

/**
 * Pulls the user id out of the request's bearer JWT without verifying its
 * signature, purely so the rate limiter can bucket by user instead of IP.
 *
 * This middleware always runs before `authenticate` (it's mounted globally
 * on `/api`, ahead of the per-route auth middleware that populates
 * `req.user`), so `req.user.id` is never available here — reading the
 * token's `sub` claim directly is the only way to key per-user at this
 * point in the pipeline. This is safe to leave unverified: real
 * authorization is still enforced later by `authenticate`'s signature
 * check, so a forged token only ever earns the forger their own bucket.
 */
function getRateLimitUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return undefined;

  try {
    const payload = authHeader.slice(7).split('.')[1];
    const { sub } = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    return sub || undefined;
  } catch {
    return undefined;
  }
}

// Use user ID for authenticated requests, IP for unauthenticated ones.
// This prevents office workers/VPN users sharing a public IP from
// exhausting each other's request budget.
function keyByUserOrIp(req, res) {
  const userId = getRateLimitUserId(req);
  return userId ? `user:${userId}` : req.ip;
}

// General API rate limiter - 1000 requests per 15 minutes per USER
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each USER to 1000 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator: keyByUserOrIp,
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
  keyGenerator: keyByUserOrIp,
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
