import 'dotenv/config';
import pg from 'pg';

async function checkLocalNatureReserves() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    console.log('🔍 Checking for Local Nature Reserves tables...\n');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (LOWER(table_name) LIKE '%local%nature%' OR LOWER(table_name) LIKE '%lnr%')
      ORDER BY table_name;
    `);
    
    console.log('📊 Tables matching "local nature" or "lnr":');
    if (tables.rows.length === 0) {
      console.log('  ❌ No matching tables found');
      return;
    }
    
    tables.rows.forEach(row => {
      console.log(`  - "${row.table_name}"`);
    });
    
    const targetTable = 'local_nature_reserves_england';
    console.log(`\n🔍 Checking "${targetTable}"...\n`);
    
    const cols = await pool.query(
      'SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position',
      [targetTable]
    );
    
    if (cols.rows.length === 0) {
      console.log('  ❌ Table not found, trying alternatives...');
      return;
    }
    
    console.log('📋 Columns:', cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    
    const geom = await pool.query(
      'SELECT f_geometry_column, type, srid FROM geometry_columns WHERE f_table_name=$1',
      [targetTable]
    );
    
    if (geom.rows.length > 0) {
      console.log('\n🗺️ Geometry:', geom.rows[0]);
    } else {
      console.log('\n❌ No geometry column');
      return;
    }
    
    const count = await pool.query(`SELECT COUNT(*) FROM "${targetTable}"`);
    console.log(`\n📊 Total records: ${count.rows[0].count}`);
    
    const sample = await pool.query(`SELECT * FROM "${targetTable}" LIMIT 1`);
    console.log('\n📋 Sample columns:', Object.keys(sample.rows[0]).slice(0, 15).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLocalNatureReserves().catch(console.error);

