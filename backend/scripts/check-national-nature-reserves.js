import 'dotenv/config';
import pg from 'pg';

async function checkNationalNatureReserves() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    console.log('🔍 Checking for National Nature Reserves tables...\n');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (LOWER(table_name) LIKE '%national%nature%' OR LOWER(table_name) LIKE '%nnr%')
      ORDER BY table_name;
    `);
    
    console.log('📊 Tables matching "national nature" or "nnr":');
    if (tables.rows.length === 0) {
      console.log('  ❌ No matching tables found');
      return;
    }
    
    tables.rows.forEach(row => {
      console.log(`  - "${row.table_name}"`);
    });
    
    const targetTable = 'National nature reserves England';
    console.log(`\n🔍 Checking "${targetTable}"...\n`);
    
    const cols = await pool.query(
      'SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position',
      [targetTable]
    );
    
    if (cols.rows.length === 0) {
      console.log('  ❌ Table not found, trying without spaces...');
      // Try alternative
      const alt = await pool.query(
        'SELECT column_name FROM information_schema.columns WHERE LOWER(table_name) LIKE $1 LIMIT 1',
        ['%national%nature%reserves%']
      );
      if (alt.rows.length > 0) {
        console.log('  Found alternative table name');
      }
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
      console.log('\n❌ No geometry column found in PostGIS registry');
      return;
    }
    
    const count = await pool.query(`SELECT COUNT(*) FROM "${targetTable}"`);
    console.log(`\n📊 Total records: ${count.rows[0].count}`);
    
    const sample = await pool.query(`SELECT * FROM "${targetTable}" LIMIT 1`);
    console.log('\n📋 Sample columns:', Object.keys(sample.rows[0]).slice(0, 15).join(', '));
    console.log('\n✅ Table verified successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkNationalNatureReserves().catch(console.error);

