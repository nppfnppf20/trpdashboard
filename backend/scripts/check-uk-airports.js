import 'dotenv/config';
import pg from 'pg';

async function check() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Search for airport-related tables
    console.log('Searching for airport-related tables...\n');
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (
        LOWER(table_name) LIKE '%airport%'
        OR LOWER(table_name) LIKE '%airfield%'
        OR LOWER(table_name) LIKE '%aerodrome%'
      )
    `);

    console.log('Tables found:', tables.rows);

    if (tables.rows.length > 0) {
      // Check structure of first matching table
      const tableName = tables.rows[0].table_name;
      console.log(`\nChecking structure of: ${tableName}\n`);

      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      console.log('Columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      // Get sample data
      const sample = await pool.query(`
        SELECT *, ST_GeometryType(geom) as geom_type, ST_SRID(geom) as srid
        FROM "${tableName}" LIMIT 3
      `);

      console.log('\nSample data:');
      sample.rows.forEach((row, i) => {
        console.log(`\nRecord ${i + 1}:`);
        Object.entries(row).forEach(([key, val]) => {
          if (key !== 'geom') {
            console.log(`  ${key}: ${val}`);
          }
        });
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

check();
