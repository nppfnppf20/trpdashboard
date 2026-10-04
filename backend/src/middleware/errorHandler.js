/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Many controllers reply to failures with `{ error: '...', details: err.message }`.
 * `details` is raw exception text (often database errors naming tables, columns
 * or constraints), which should not reach clients in production.
 * This wraps res.json so that on 5xx responses the technical fields are dropped;
 * the full error is still logged server-side by each controller.
 * Mounted once in server.js before the routes.
 */
export function scrubServerErrorDetails(req, res, next) {
  if (!isProduction) return next();

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === 'object' && !Array.isArray(body)) {
      const { details, detail, hint, stack, ...safe } = body;
      return originalJson(safe);
    }
    return originalJson(body);
  };
  next();
}

export function errorHandler(err, req, res, next) {
  // Log detailed error information
  console.error('Error:', {
    message: err?.message,
    detail: err?.detail,
    hint: err?.hint,
    code: err?.code,
    position: err?.position,
    stack: err?.stack
  });

  // Errors we recognise and can answer precisely
  if (err?.isCorsError) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed request body' });
  }

  const statusCode = err.status || err.statusCode || 500;

  // 4xx messages are written for the client; 5xx messages can contain internals.
  const message = statusCode >= 500 && isProduction
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { detail: err.detail, hint: err.hint })
  });
}
