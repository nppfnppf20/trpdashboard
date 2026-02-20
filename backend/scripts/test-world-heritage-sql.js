import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testWorldHeritageSql() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('📁 Reading SQL file...\n');
    
    // Read the SQL function file
    const sqlPath = path.join(__dirname, '..', 'sql', 'heritage_analysis', 'analyze_world_heritage_sites.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Deploying analyze_world_heritage_sites function...\n');
    
    // Deploy the function
    await pool.query(sqlContent);
    console.log('✅ Function deployed successfully!\n');
    
    // Test with a polygon near Durham (should find Durham Castle and Cathedral)
    const testPolygon = {
      type: "Polygon",
      coordinates: [[
        [-1.6, 54.7],
        [-1.6, 54.8],
        [-1.5, 54.8],
        [-1.5, 54.7],
        [-1.6, 54.7]
      ]]
    };
    
    console.log('🧪 Testing function with sample polygon...');
    console.log('   Polygon center: Durham area (should find Durham Castle & Cathedral)\n');
    
    const result = await pool.query(
      'SELECT * FROM analyze_world_heritage_sites($1)',
      [JSON.stringify(testPolygon)]
    );
    
    console.log(`📊 Results: ${result.rows.length} World Heritage Site(s) found within 5km\n`);
    
    if (result.rows.length > 0) {
      console.log('✅ Sample results:');
      result.rows.forEach((row, idx) => {
        console.log(`\n${idx + 1}. ${row.name}`);
        console.log(`   - ID: ${row.id}`);
        console.log(`   - List Entry: ${row.list_entry}`);
        console.log(`   - Inscription Date: ${row.inscr_date ? new Date(row.inscr_date).getFullYear() : 'N/A'}`);
        console.log(`   - Distance: ${row.dist_m}m`);
        console.log(`   - Direction: ${row.direction}`);
        console.log(`   - On site: ${row.on_site}`);
        console.log(`   - Within 1km: ${row.within_1km}`);
      });
    } else {
      console.log('ℹ️  No World Heritage Sites found within 5km of test polygon');
      console.log('   (There are only 28 WHS in England, so this is normal for most locations)');
    }
    
    console.log('\n✅ SQL function test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testWorldHeritageSql().catch(console.error);

