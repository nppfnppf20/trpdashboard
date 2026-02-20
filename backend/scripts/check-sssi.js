import 'dotenv/config';
import pg from 'pg';

async function checkSSSI() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('🔍 Checking for SSSI tables...\n');
    
    // Search for tables containing 'sssi'
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND LOWER(table_name) LIKE '%sssi%'
      ORDER BY table_name;
    `);
    
    console.log('📊 Tables matching "sssi":');
    if (tables.rows.length === 0) {
      console.log('  ❌ No matching tables found');
      return;
    }
    
    tables.rows.forEach(row => {
      console.log(`  - "${row.table_name}"`);
    });
    
    // Check the sssi table
    const targetTable = 'sssi';
    console.log(`\n🔍 Checking structure of "${targetTable}"...\n`);
    
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [targetTable]);
    
    if (columns.rows.length === 0) {
      console.log(`  ❌ Table "${targetTable}" not found, trying alternatives...\n`);
      
      // Try other possible names
      const alternatives = ['SSSI', 'sssi_england', 'sites_special_scientific_interest'];
      for (const altTable of alternatives) {
        const altCheck = await pool.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1 LIMIT 1
        `, [altTable]);
        if (altCheck.rows.length > 0) {
          console.log(`  ✅ Found alternative: "${altTable}"\n`);
          return checkSpecificTable(pool, altTable);
        }
      }
      console.log('  ❌ No alternative table names found');
      return;
    }
    
    await checkSpecificTable(pool, targetTable);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

async function checkSpecificTable(pool, tableName) {
  console.log(`✅ Checking table: "${tableName}"\n`);
  
  const columns = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);
  
  console.log(`📋 Column structure:`);
  columns.rows.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '[NOT NULL]' : '[nullable]'}`);
  });
  
  // Check for geometry column using PostGIS metadata
  const geomCol = await pool.query(`
    SELECT f_geometry_column, type, srid
    FROM geometry_columns 
    WHERE f_table_name = $1
  `, [tableName]);
  
  if (geomCol.rows.length > 0) {
    console.log(`\n🗺️ Geometry column: ${geomCol.rows[0].f_geometry_column}`);
    console.log(`   Type: ${geomCol.rows[0].type}, SRID: ${geomCol.rows[0].srid}`);
  } else {
    console.log('\n❌ No geometry column found in PostGIS registry');
    return;
  }
  
  // Get row count
  const count = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
  console.log(`\n📊 Total records: ${count.rows[0].count}`);
  
  // Get sample data
  const geomColName = geomCol.rows[0].f_geometry_column;
  const sample = await pool.query(`
    SELECT *, ST_GeometryType("${geomColName}") as geom_type
    FROM "${tableName}" 
    WHERE "${geomColName}" IS NOT NULL
    LIMIT 3
  `);
  
  console.log('\n📋 Sample records:');
  sample.rows.forEach(row => {
    const keys = Object.keys(row).filter(k => !k.includes('geom') && k !== 'geom_type');
    console.log(`  - Geom Type: ${row.geom_type}`);
    keys.slice(0, 6).forEach(k => {
      console.log(`    ${k}: ${row[k]}`);
    });
    console.log('');
  });
}

checkSSSI().catch(console.error);

