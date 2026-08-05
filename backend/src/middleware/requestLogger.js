/**
 * Logs every request's start and finish, with DB pool stats attached to
 * each, to backend/logs/app.log. A "→ start" line with no matching "← done"
 * line for the same reqId is a hung request — the exact signature of pool
 * exhaustion or a stuck upstream (LLM) call. Only slow (>5s) or error
 * responses are echoed to the console; everything is written to the file.
 */

import { log } from '../utils/logger.js';
import { pool } from '../db.js';

const SLOW_MS = 5000;

function poolStats() {
  return { poolTotal: pool.totalCount, poolIdle: pool.idleCount, poolWaiting: pool.waitingCount };
}

export function requestLogger(req, res, next) {
  if (req.path === '/health') return next();

  const start = Date.now();
  const reqId = `${start}-${Math.random().toString(36).slice(2, 8)}`;
  req._logId = reqId;

  log('debug', `start ${req.method} ${req.originalUrl}`, { reqId, ...poolStats() });

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const meta = { reqId, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs, ...poolStats() };
    if (durationMs > SLOW_MS || res.statusCode >= 500) {
      log('warn', `done ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`, meta);
    } else {
      log('debug', `done ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`, meta);
    }
  });

  next();
}
