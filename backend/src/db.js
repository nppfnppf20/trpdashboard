import pg from 'pg';
import { log } from './utils/logger.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL is not set. Please configure your Supabase Postgres connection string in .env');
}

export const pool = new pg.Pool({
  connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false,
  keepAlive: true,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on('error', (err) => {
  log('error', 'pg pool error', { message: err?.message, stack: err?.stack });
});

// Heartbeat — records pool health every 30s even when nothing is actively
// erroring, so a post-incident look at the log has a timeline leading up to
// it, not just a single data point. waiting > 0 sustained across several of
// these ticks (with total === 10, the configured max) is the exact signature
// of pool exhaustion: every connection is checked out and requests are
// queuing for one to free up.
setInterval(() => {
  const stats = { poolTotal: pool.totalCount, poolIdle: pool.idleCount, poolWaiting: pool.waitingCount };
  log(stats.poolWaiting > 0 ? 'warn' : 'debug', 'pool heartbeat', stats);
}, 30000).unref();


