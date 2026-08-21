import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';

async function deployScheduledMonuments() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('Deploying scheduled monuments function...');

    const sql = readFileSync('sql/heritage_analysis/analyze_scheduled_monuments.sql', 'utf8');
    await pool.query(sql);

    console.log('✅ Scheduled monuments function deployed successfully!');

  } catch (error) {
    console.error('❌ Error deploying function:', error);
  } finally {
    await pool.end();
  }
}

deployScheduledMonuments().catch(console.error);