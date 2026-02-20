import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSSSISql() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('📁 Reading SQL file...\n');
    
    const sqlPath = path.join(__dirname, '..', 'sql', 'ecology_analysis', 'analyze_sssi.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Deploying analyze_sssi function...\n');
    await pool.query(sqlContent);
    console.log('✅ Function deployed successfully!\n');
    
    // Test with Peak District area (lots of SSSI sites)
    const testPolygon = {
      type: "Polygon",
      coordinates: [[
        [-1.8, 53.3],
        [-1.8, 53.4],
        [-1.7, 53.4],
        [-1.7, 53.3],
        [-1.8, 53.3]
      ]]
    };
    
    console.log('🧪 Testing function with sample polygon (Peak District area)...\n');
    
    const result = await pool.query(
      'SELECT * FROM analyze_sssi($1)',
      [JSON.stringify(testPolygon)]
    );
    
    console.log(`📊 Results: ${result.rows.length} SSSI site(s) found within 5km\n`);
    
    if (result.rows.length > 0) {
      console.log('✅ Sample results (showing first 5):');
      result.rows.slice(0, 5).forEach((row, idx) => {
        console.log(`\n${idx + 1}. ${row.name}`);
        console.log(`   - ID: ${row.id}`);
        console.log(`   - Ref Code: ${row.ref_code}`);
        console.log(`   - Area: ${row.measure ? row.measure.toFixed(2) + ' ha' : 'N/A'}`);
        console.log(`   - Distance: ${row.dist_m}m`);
        console.log(`   - Direction: ${row.direction}`);
        console.log(`   - On site: ${row.on_site}`);
        console.log(`   - Within 1km: ${row.within_1km}`);
      });
      
      // Show on-site count
      const onSiteCount = result.rows.filter(r => r.on_site).length;
      console.log(`\n📊 On-site: ${onSiteCount} SSSI site(s)`);
    } else {
      console.log('ℹ️  No SSSI sites found within 5km of test polygon');
    }
    
    console.log('\n✅ SQL function test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testSSSISql().catch(console.error);

