import pg from 'pg';

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
  console.error('pg pool error', err);
});


