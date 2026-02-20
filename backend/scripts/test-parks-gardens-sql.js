import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testParksGardensSql() {
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
    const sqlPath = path.join(__dirname, '..', 'sql', 'heritage_analysis', 'analyze_registered_parks_gardens.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Deploying analyze_registered_parks_gardens function...\n');
    
    // Deploy the function
    await pool.query(sqlContent);
    console.log('✅ Function deployed successfully!\n');
    
    // Test with a sample polygon (Oxfordshire area - should find some parks/gardens)
    const testPolygon = {
      type: "Polygon",
      coordinates: [[
        [-1.3, 51.7],
        [-1.3, 51.8],
        [-1.2, 51.8],
        [-1.2, 51.7],
        [-1.3, 51.7]
      ]]
    };
    
    console.log('🧪 Testing function with sample polygon...');
    console.log(`   Polygon center: approximately Oxfordshire area\n`);
    
    const result = await pool.query(
      'SELECT * FROM analyze_registered_parks_gardens($1)',
      [JSON.stringify(testPolygon)]
    );
    
    console.log(`📊 Results: ${result.rows.length} Registered Park(s)/Garden(s) found within 5km\n`);
    
    if (result.rows.length > 0) {
      console.log('✅ Sample results:');
      result.rows.slice(0, 5).forEach((row, idx) => {
        console.log(`\n${idx + 1}. ${row.name} (Grade ${row.grade})`);
        console.log(`   - ID: ${row.id}`);
        console.log(`   - List Entry: ${row.list_entry}`);
        console.log(`   - Distance: ${row.dist_m}m`);
        console.log(`   - Direction: ${row.direction}`);
        console.log(`   - On site: ${row.on_site}`);
        console.log(`   - Within 100m: ${row.within_100m}`);
        console.log(`   - Within 500m: ${row.within_500m}`);
        console.log(`   - Within 1km: ${row.within_1km}`);
      });
      
      // Show grade distribution
      const gradeI = result.rows.filter(r => r.grade === 'I').length;
      const gradeIIStar = result.rows.filter(r => r.grade === 'II*').length;
      const gradeII = result.rows.filter(r => r.grade === 'II').length;
      console.log(`\n📊 Grade distribution:`);
      console.log(`   Grade I: ${gradeI}`);
      console.log(`   Grade II*: ${gradeIIStar}`);
      console.log(`   Grade II: ${gradeII}`);
    } else {
      console.log('ℹ️  No Registered Parks/Gardens found within 5km of test polygon');
    }
    
    console.log('\n✅ SQL function test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testParksGardensSql().catch(console.error);


