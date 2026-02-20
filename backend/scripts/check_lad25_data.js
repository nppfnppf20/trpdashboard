/**
 * Script to check if LAD25 socioeconomic data columns are populated for Barnsley
 */

import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkLAD25Data() {
  try {
    console.log('🔍 Checking LAD25 data population...\n');

    // Get Barnsley data
    console.log('=== Barnsley (E08000038) ===');
    const barnsleyQuery = await pool.query(`
      SELECT
        "LAD25CD",
        "LAD25NM",
        "Master sheet2_Census 2021 pop",
        "Master sheet2_abc Total: All usual residents 2021 census",
        "Master sheet2_percent working age 2021 census",
        "Master sheet2_Total 2011 census",
        "Master sheet2_2018 All Ages",
        "Master sheet2_2043 All Ages"
      FROM "Socioeconomics"."LAD25"
      WHERE "LAD25NM" = 'Barnsley'
      LIMIT 1
    `);

    if (barnsleyQuery.rows.length > 0) {
      console.log('✅ Found Barnsley');
      console.log('Data sample:');
      console.log(JSON.stringify(barnsleyQuery.rows[0], null, 2));
    } else {
      console.log('❌ Barnsley not found with exact name match');

      // Try ILIKE search
      const barnsleySearch = await pool.query(`
        SELECT "LAD25CD", "LAD25NM"
        FROM "Socioeconomics"."LAD25"
        WHERE "LAD25NM" ILIKE '%barnsley%'
      `);
      console.log('Search results:', barnsleySearch.rows);
    }

    // Check a working area for comparison (Cheshire East)
    console.log('\n=== Cheshire East (E06000049) for comparison ===');
    const cheshireQuery = await pool.query(`
      SELECT
        "LAD25CD",
        "LAD25NM",
        "Master sheet2_Census 2021 pop",
        "Master sheet2_abc Total: All usual residents 2021 census",
        "Master sheet2_percent working age 2021 census",
        "Master sheet2_Total 2011 census"
      FROM "Socioeconomics"."LAD25"
      WHERE "LAD25CD" = 'E06000049'
      LIMIT 1
    `);

    if (cheshireQuery.rows.length > 0) {
      console.log('✅ Found Cheshire East');
      console.log('Data sample:');
      console.log(JSON.stringify(cheshireQuery.rows[0], null, 2));
    }

    // Count how many LAD25 rows have NULL vs populated data
    console.log('\n=== Data Population Statistics ===');
    const statsQuery = await pool.query(`
      SELECT
        COUNT(*) as total_rows,
        COUNT("Master sheet2_Census 2021 pop") as census_2021_pop_count,
        COUNT("Master sheet2_Total 2011 census") as census_2011_count,
        COUNT("Master sheet2_2018 All Ages") as pop_2018_count
      FROM "Socioeconomics"."LAD25"
    `);

    console.log('LAD25 table statistics:');
    console.log(JSON.stringify(statsQuery.rows[0], null, 2));

    // List all LAD25 codes and names to see what's available
    console.log('\n=== All LAD25 Entries (first 20) ===');
    const allLADs = await pool.query(`
      SELECT "LAD25CD", "LAD25NM"
      FROM "Socioeconomics"."LAD25"
      ORDER BY "LAD25NM"
      LIMIT 20
    `);
    console.log(allLADs.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLAD25Data();
