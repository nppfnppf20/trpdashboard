import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testNationalParksSql() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('📁 Reading SQL file...\n');
    
    // Read the SQL function file
    const sqlPath = path.join(__dirname, '..', 'sql', 'landscape_analysis', 'analyze_national_parks.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Deploying analyze_national_parks function...\n');
    
    // Deploy the function
    await pool.query(sqlContent);
    console.log('✅ Function deployed successfully!\n');
    
    // Test with a sample polygon (somewhere in England that should find some parks)
    // This polygon is roughly in the Peak District area
    const testPolygon = {
      type: "Polygon",
      coordinates: [[
        [-1.8, 53.3],
        [-1.8, 53.5],
        [-1.5, 53.5],
        [-1.5, 53.3],
        [-1.8, 53.3]
      ]]
    };
    
    console.log('🧪 Testing function with sample polygon...');
    console.log(`   Polygon center: approximately Peak District area\n`);
    
    const result = await pool.query(
      'SELECT * FROM analyze_national_parks($1)',
      [JSON.stringify(testPolygon)]
    );
    
    console.log(`📊 Results: ${result.rows.length} National Park(s) found within 5km\n`);
    
    if (result.rows.length > 0) {
      console.log('✅ Sample results:');
      result.rows.forEach((row, idx) => {
        console.log(`\n${idx + 1}. ${row.name}`);
        console.log(`   - ID: ${row.id}`);
        console.log(`   - Distance: ${row.dist_m}m`);
        console.log(`   - Direction: ${row.direction}`);
        console.log(`   - On site: ${row.on_site}`);
        console.log(`   - Within 50m: ${row.within_50m}`);
        console.log(`   - Within 100m: ${row.within_100m}`);
        console.log(`   - Within 250m: ${row.within_250m}`);
        console.log(`   - Within 500m: ${row.within_500m}`);
        console.log(`   - Within 1km: ${row.within_1km}`);
        console.log(`   - Within 3km: ${row.within_3km}`);
        console.log(`   - Within 5km: ${row.within_5km}`);
      });
    } else {
      console.log('ℹ️  No National Parks found within 5km of test polygon');
      console.log('   This is expected if the test area is not near any National Parks');
    }
    
    console.log('\n✅ SQL function test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testNationalParksSql().catch(console.error);

