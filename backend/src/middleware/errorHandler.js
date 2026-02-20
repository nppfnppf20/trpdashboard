/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */

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
  
  // Send appropriate response
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({ 
    error: message,
    ...(process.env.NODE_ENV === 'development' && { detail: err.detail, hint: err.hint })
  });
}

