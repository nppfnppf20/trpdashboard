import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const lines = [];
  const log = (msg) => {
    lines.push(typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2));
  };

  try {
    const tables = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'Socioeconomics'
      ORDER BY tablename;
    `);

    log('=== SOCIOECONOMICS SCHEMA TABLES ===');
    log(tables.rows.map(r => r.tablename).join('\n'));
    log('');

    for (const table of tables.rows) {
      const name = table.tablename;

      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'Socioeconomics'
          AND table_name = $1
        ORDER BY ordinal_position;
      `, [name]);

      log(`=== ${name} COLUMNS ===`);
      columns.rows.forEach(c => log(`  ${c.column_name} (${c.data_type})`));

      const count = await pool.query(`
        SELECT COUNT(*) as total_rows
        FROM "Socioeconomics"."${name}";
      `);
      log(`  ROWS: ${count.rows[0].total_rows}`);
      log('');
    }

  } finally {
    await pool.end();
  }

  fs.writeFileSync('socioeconomics-dump.txt', lines.join('\n'));
  console.log('Done - output written to socioeconomics-dump.txt');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
