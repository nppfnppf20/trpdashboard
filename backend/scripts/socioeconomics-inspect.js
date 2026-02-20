import 'dotenv/config';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get detailed info about Socioeconomics schema tables
    const tables = await pool.query(`
      SELECT
        schemaname,
        tablename,
        schemaname||'.'||tablename as full_name
      FROM pg_tables
      WHERE schemaname = 'Socioeconomics'
      ORDER BY tablename;
    `);

    console.log('=== SOCIOECONOMICS SCHEMA TABLES ===');
    console.log(tables.rows);

    // Get column details for each table
    for (const table of tables.rows) {
      console.log(`\n=== ${table.full_name} COLUMNS ===`);

      const columns = await pool.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'Socioeconomics'
          AND table_name = $1
        ORDER BY ordinal_position;
      `, [table.tablename]);

      console.log(columns.rows);

      // Get sample of data (first 5 rows)
      console.log(`\n=== ${table.full_name} SAMPLE DATA ===`);
      try {
        const sample = await pool.query(`
          SELECT * FROM "Socioeconomics"."${table.tablename}"
          LIMIT 5;
        `);

        console.log(`Row count in sample: ${sample.rows.length}`);
        if (sample.rows.length > 0) {
          console.log('Sample row:', sample.rows[0]);
        }
      } catch (err) {
        console.log('Error getting sample data:', err.message);
      }

      // Get total row count
      try {
        const count = await pool.query(`
          SELECT COUNT(*) as total_rows
          FROM "Socioeconomics"."${table.tablename}";
        `);
        console.log(`Total rows: ${count.rows[0].total_rows}`);
      } catch (err) {
        console.log('Error getting row count:', err.message);
      }
    }

  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});