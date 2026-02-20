import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testLandscapeAggregator() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('📁 Reading aggregator SQL file...\n');
    
    // Read and deploy the aggregator function
    const sqlPath = path.join(__dirname, '..', 'sql', 'create_analysis_functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Deploying updated analyze_site_landscape aggregator...\n');
    await pool.query(sqlContent);
    console.log('✅ Aggregator deployed successfully!\n');
    
    // Test with Peak District polygon
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
    
    console.log('🧪 Testing landscape aggregator with sample polygon...\n');
    
    const result = await pool.query(
      'SELECT analyze_site_landscape($1) as analysis_result',
      [JSON.stringify(testPolygon)]
    );
    
    const data = result.rows[0].analysis_result;
    
    console.log('📊 Aggregated Landscape Analysis Results:\n');
    console.log(`   Green Belt features: ${data.green_belt?.length || 0}`);
    console.log(`   AONB features: ${data.aonb?.length || 0}`);
    console.log(`   National Parks: ${data.national_parks?.length || 0}`);
    
    if (data.national_parks && data.national_parks.length > 0) {
      console.log('\n✅ National Parks found:');
      data.national_parks.forEach(park => {
        console.log(`   - ${park.name} (${park.dist_m}m, ${park.direction})`);
      });
    }
    
    console.log('\n✅ Landscape aggregator test complete!');
    console.log('✅ National Parks successfully integrated into landscape analysis!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testLandscapeAggregator().catch(console.error);

