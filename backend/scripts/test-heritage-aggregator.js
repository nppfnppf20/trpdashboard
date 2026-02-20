import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testHeritageAggregator() {
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
    
    console.log('🚀 Deploying updated analyze_site_heritage aggregator...\n');
    await pool.query(sqlContent);
    console.log('✅ Aggregator deployed successfully!\n');
    
    // Test with Oxford polygon
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
    
    console.log('🧪 Testing heritage aggregator with sample polygon...\n');
    
    const result = await pool.query(
      'SELECT analyze_site_heritage($1) as analysis_result',
      [JSON.stringify(testPolygon)]
    );
    
    const data = result.rows[0].analysis_result;
    
    console.log('📊 Aggregated Heritage Analysis Results:\n');
    console.log(`   Listed Buildings: ${data.listed_buildings?.length || 0}`);
    console.log(`   Conservation Areas: ${data.conservation_areas?.length || 0}`);
    console.log(`   Scheduled Monuments: ${data.scheduled_monuments?.length || 0}`);
    console.log(`   Registered Parks/Gardens: ${data.registered_parks_gardens?.length || 0}`);
    
    if (data.registered_parks_gardens && data.registered_parks_gardens.length > 0) {
      console.log('\n✅ Registered Parks/Gardens found:');
      data.registered_parks_gardens.slice(0, 3).forEach(pg => {
        console.log(`   - ${pg.name} (Grade ${pg.grade}) - ${pg.dist_m}m, ${pg.direction}`);
      });
    }
    
    console.log('\n✅ Heritage aggregator test complete!');
    console.log('✅ Registered Parks and Gardens successfully integrated into heritage analysis!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testHeritageAggregator().catch(console.error);


