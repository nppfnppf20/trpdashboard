import 'dotenv/config';
import pg from 'pg';

async function checkRamsarTables() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('Checking for Ramsar tables...');

    // Search for tables containing ramsar
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND LOWER(table_name) LIKE '%ramsar%'
      ORDER BY table_name;
    `);

    console.log('\nMatching tables:');
    tables.rows.forEach(row => {
      console.log(`  - "${row.table_name}"`);
    });

    // If we found tables, check their structure
    if (tables.rows.length > 0) {
      for (const table of tables.rows) {
        const tableName = table.table_name;

        console.log(`\n=== Column structure for "${tableName}" ===`);

        const columns = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = $1
          ORDER BY ordinal_position;
        `, [tableName]);

        columns.rows.forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type})`);
        });

        // Test basic query
        try {
          const count = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);
          console.log(`  Records: ${count.rows[0].count}`);
        } catch (err) {
          console.log(`  ❌ Error querying table: ${err.message}`);
        }

        // Check SRID if geom column exists
        try {
          const srid = await pool.query(`SELECT ST_SRID(geom) FROM "${tableName}" LIMIT 1`);
          console.log(`  SRID: ${srid.rows[0]?.st_srid || 'N/A'}`);
        } catch (err) {
          console.log(`  No geometry column or SRID error`);
        }
      }
    } else {
      console.log('\n❌ No Ramsar tables found. Searching for broader ecology patterns...');

      // Search for other ecology-related tables
      const ecologyTables = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND (
          LOWER(table_name) LIKE '%wetland%' OR
          LOWER(table_name) LIKE '%site%' OR
          LOWER(table_name) LIKE '%designat%' OR
          LOWER(table_name) LIKE '%special%' OR
          LOWER(table_name) LIKE '%protect%'
        )
        ORDER BY table_name;
      `);

      console.log('\nPossible ecology-related tables:');
      ecologyTables.rows.forEach(row => {
        console.log(`  - "${row.table_name}"`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
  } finally {
    await pool.end();
  }
}

checkRamsarTables().catch(console.error);