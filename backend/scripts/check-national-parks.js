import 'dotenv/config';
import pg from 'pg';

async function checkNationalParks() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('🔍 Checking for National Parks tables...\n');
    
    // Search for tables containing 'national' or 'park'
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (LOWER(table_name) LIKE '%national%' OR LOWER(table_name) LIKE '%park%')
      ORDER BY table_name;
    `);
    
    console.log('📊 Tables matching "national" or "park":');
    if (tables.rows.length === 0) {
      console.log('  ❌ No matching tables found');
      return;
    }
    
    tables.rows.forEach(row => {
      console.log(`  - "${row.table_name}"`);
    });
    
    // Check the most likely table
    const targetTable = 'National parks England';
    console.log(`\n🔍 Checking structure of "${targetTable}"...\n`);
    
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [targetTable]);
    
    if (columns.rows.length === 0) {
      console.log(`  ❌ Table "${targetTable}" not found or has no columns`);
      return;
    }
    
    console.log(`✅ Column structure for "${targetTable}":`);
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '[NOT NULL]' : '[nullable]'}`);
    });
    
    // Get row count
    const count = await pool.query(`SELECT COUNT(*) as count FROM "${targetTable}"`);
    console.log(`\n📊 Total records: ${count.rows[0].count}`);
    
    // Get sample data
    const sample = await pool.query(`
      SELECT "OBJECTID", "NAME", "CODE", ST_GeometryType(geom) as geom_type, ST_SRID(geom) as srid
      FROM "${targetTable}" 
      LIMIT 3
    `);
    
    console.log('\n📋 Sample records:');
    sample.rows.forEach(row => {
      console.log(`  - ID: ${row.OBJECTID}, Name: "${row.NAME}", Code: ${row.CODE}, Type: ${row.geom_type}, SRID: ${row.srid}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkNationalParks().catch(console.error);

