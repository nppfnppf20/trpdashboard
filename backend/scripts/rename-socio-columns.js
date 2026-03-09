import 'dotenv/config';
import pg from 'pg';

// 4 blocked columns (special chars prevent SQL referencing them as expressions)
// Apply to all 3 main source tables: Countries, LAD25, Regions
const RENAMES = [
  {
    from: 'Master sheet2_abc Total: All usual residents 2021 census',
    to:   'Master sheet2_abc_Total_All_usual_residents_2021_census',
  },
  {
    from: 'Master sheet2_Total: All usual residents aged 16 years and over',
    to:   'Master sheet2_Total_All_usual_residents_aged_16_and_over',
  },
  {
    from: 'Master sheet2_Local Authority Code [note 1]',
    to:   'Master sheet2_Local_Authority_Code',
  },
  {
    from: 'Master sheet2_Estimated number of households  [note 2][note 3][',
    to:   'Master sheet2_Estimated_number_of_households',
  },
];

const SOURCE_TABLES = ['Countries', 'LAD25', 'Regions'];

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    for (const table of SOURCE_TABLES) {
      // Get actual column names by ordinal to verify existence before renaming
      const cols = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'Socioeconomics'
          AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      const existingNames = new Set(cols.rows.map(r => r.column_name));

      for (const { from, to } of RENAMES) {
        if (!existingNames.has(from)) {
          if (existingNames.has(to)) {
            console.log(`[${table}] Already renamed: "${to}" — skipping`);
          } else {
            console.warn(`[${table}] Column not found: "${from}" — skipping`);
          }
          continue;
        }

        // Use ordinal-based lookup to confirm, then rename using quoted identifiers
        const sql = `ALTER TABLE "Socioeconomics"."${table}" RENAME COLUMN "${from}" TO "${to}"`;
        await pool.query(sql);
        console.log(`[${table}] Renamed: "${from}" → "${to}"`);
      }
    }

    console.log('\nDone. Run the affected INSERT files next:');
    console.log('  02_census_2021.sql');
    console.log('  07_qualifications.sql');
    console.log('  14_renewables.sql');

  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
