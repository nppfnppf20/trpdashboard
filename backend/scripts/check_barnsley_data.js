/**
 * Script to investigate Barnsley LAD data and column names across all LAD tables
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

async function checkBarnsleyData() {
  try {
    console.log('🔍 Investigating Barnsley data across LAD tables...\n');

    // Check LAD25
    console.log('=== LAD25 Table ===');
    const lad25Columns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'Socioeconomics'
      AND table_name = 'LAD25'
      ORDER BY ordinal_position
    `);
    console.log('📋 All columns:', lad25Columns.rows.map(r => r.column_name).join(', '));

    const lad25Data = await pool.query(`
      SELECT *
      FROM "Socioeconomics"."LAD25"
      WHERE "LAD25NM" ILIKE '%barnsley%'
      LIMIT 5
    `);
    console.log(`📊 Rows matching 'Barnsley': ${lad25Data.rows.length}`);
    if (lad25Data.rows.length > 0) {
      console.log('📝 Sample data:', JSON.stringify(lad25Data.rows[0], null, 2));
    }
    console.log();

    // Check LAD19
    console.log('=== LAD19 Table ===');
    const lad19Columns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'Socioeconomics'
      AND table_name = 'LAD19'
      ORDER BY ordinal_position
    `);
    console.log('📋 All columns:', lad19Columns.rows.map(r => r.column_name).join(', '));

    // Try both uppercase and lowercase - we'll see which exists
    let lad19Data;
    try {
      lad19Data = await pool.query(`
        SELECT *
        FROM "Socioeconomics"."LAD19"
        WHERE "LAD19NM" ILIKE '%barnsley%'
        LIMIT 5
      `);
      console.log('  ✅ LAD19 uses uppercase LAD19NM');
    } catch (e) {
      lad19Data = await pool.query(`
        SELECT *
        FROM "Socioeconomics"."LAD19"
        WHERE lad19nm ILIKE '%barnsley%'
        LIMIT 5
      `);
      console.log('  ✅ LAD19 uses lowercase lad19nm');
    }
    console.log(`📊 Rows matching 'Barnsley': ${lad19Data.rows.length}`);
    if (lad19Data.rows.length > 0) {
      console.log('📝 Sample data:', JSON.stringify(lad19Data.rows[0], null, 2));
    }
    console.log();

    // Check LAD11
    console.log('=== LAD11 Table ===');
    const lad11Columns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'Socioeconomics'
      AND table_name = 'LAD11'
      ORDER BY ordinal_position
    `);
    console.log('📋 All columns:', lad11Columns.rows.map(r => r.column_name).join(', '));

    // Try both uppercase and lowercase - we'll see which exists
    let lad11Data;
    try {
      lad11Data = await pool.query(`
        SELECT *
        FROM "Socioeconomics"."LAD11"
        WHERE "LAD11NM" ILIKE '%barnsley%'
        LIMIT 5
      `);
      console.log('  ✅ LAD11 uses uppercase LAD11NM');
    } catch (e) {
      lad11Data = await pool.query(`
        SELECT *
        FROM "Socioeconomics"."LAD11"
        WHERE lad11nm ILIKE '%barnsley%'
        LIMIT 5
      `);
      console.log('  ✅ LAD11 uses lowercase lad11nm');
    }
    console.log(`📊 Rows matching 'Barnsley': ${lad11Data.rows.length}`);
    if (lad11Data.rows.length > 0) {
      console.log('📝 Sample data:', JSON.stringify(lad11Data.rows[0], null, 2));
    }
    console.log();

    // Check for all variations of name columns
    console.log('=== Checking for Name Field Variations ===');
    for (const table of ['LAD25', 'LAD19', 'LAD11']) {
      console.log(`\n${table}:`);
      const nameColumns = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'Socioeconomics'
        AND table_name = $1
        AND (column_name ILIKE '%nm%' OR column_name ILIKE '%name%')
      `, [table]);
      console.log('  Name-like columns:', nameColumns.rows.map(r => r.column_name).join(', '));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkBarnsleyData();
