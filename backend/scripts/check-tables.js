import 'dotenv/config';
import pg from 'pg';

async function checkTables() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('Checking available tables with "green" or "belt" in the name...');

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (LOWER(table_name) LIKE '%green%' OR LOWER(table_name) LIKE '%belt%')
      ORDER BY table_name;
    `);

    console.log('Green Belt related tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Also check for any tables that might be landscape related
    const landscapeResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND LOWER(table_name) LIKE '%landscape%'
      ORDER BY table_name;
    `);

    console.log('\nLandscape related tables:');
    landscapeResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check column structure of Green_belt table
    if (result.rows.length > 0) {
      console.log('\nChecking Green_belt table columns:');
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'Green_belt'
        ORDER BY ordinal_position;
      `);

      columnsResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }

  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    await pool.end();
  }
}

checkTables();