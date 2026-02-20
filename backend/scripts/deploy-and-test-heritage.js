import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployAndTest() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('📁 Reading SQL aggregator file...\n');
    
    const sqlPath = path.join(__dirname, '..', 'sql', 'create_analysis_functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Deploying updated heritage aggregator...\n');
    await pool.query(sqlContent);
    console.log('✅ Aggregator deployed successfully!\n');
    
    // Test with Bath polygon (UNESCO World Heritage Site)
    const bathPolygon = {
      type: "Polygon",
      coordinates: [[
        [-2.37, 51.37],
        [-2.37, 51.39],
        [-2.35, 51.39],
        [-2.35, 51.37],
        [-2.37, 51.37]
      ]]
    };
    
    console.log('🧪 Testing with Bath polygon...\n');
    
    const result = await pool.query(
      'SELECT analyze_site_heritage($1) as analysis_result',
      [JSON.stringify(bathPolygon)]
    );
    
    const data = result.rows[0].analysis_result;
    
    console.log('📊 Heritage Analysis Results:\n');
    console.log(`   Listed Buildings: ${data.listed_buildings?.length || 0}`);
    console.log(`   Conservation Areas: ${data.conservation_areas?.length || 0}`);
    console.log(`   Scheduled Monuments: ${data.scheduled_monuments?.length || 0}`);
    console.log(`   Registered Parks/Gardens: ${data.registered_parks_gardens?.length || 0}`);
    console.log(`   World Heritage Sites: ${data.world_heritage_sites?.length || 0}`);
    
    if (data.world_heritage_sites && data.world_heritage_sites.length > 0) {
      console.log('\n✅ World Heritage Sites found:');
      data.world_heritage_sites.forEach(whs => {
        console.log(`   - ${whs.name} - ${whs.dist_m}m, On-site: ${whs.on_site}`);
      });
    } else {
      console.log('\n❌ No World Heritage Sites found - this is the problem!');
    }
    
    console.log('\n✅ Deployment and test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

deployAndTest().catch(console.error);

