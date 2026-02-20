import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const cols = await pool.query(
  'SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position',
  ['SSSI']
);
console.log('📋 Columns:', cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

const geom = await pool.query(
  'SELECT f_geometry_column, type, srid FROM geometry_columns WHERE f_table_name=$1',
  ['SSSI']
);
console.log('🗺️ Geometry:', geom.rows[0]);

const count = await pool.query('SELECT COUNT(*) FROM "SSSI"');
console.log('📊 Total records:', count.rows[0].count);

const sample = await pool.query('SELECT * FROM "SSSI" LIMIT 1');
console.log('📋 Sample columns:', Object.keys(sample.rows[0]).slice(0, 15).join(', '));

await pool.end();

