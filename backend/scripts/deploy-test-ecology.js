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
    ssl: false
  });

  try {
    console.log('📁 Reading SQL aggregator...\n');
    const sqlPath = path.join(__dirname, '..', 'sql', 'create_analysis_functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Deploying ecology aggregator...\n');
    await pool.query(sqlContent);
    console.log('✅ Deployed!\n');
    
    // Test with Peak District
    const testPolygon = {
      type: "Polygon",
      coordinates: [[[-1.8, 53.3], [-1.8, 53.4], [-1.7, 53.4], [-1.7, 53.3], [-1.8, 53.3]]]
    };
    
    console.log('🧪 Testing...\n');
    const result = await pool.query(
      'SELECT analyze_site_ecology($1) as r',
      [JSON.stringify(testPolygon)]
    );
    
    const data = result.rows[0].r;
    console.log('📊 Ecology Analysis Results:');
    console.log(`   SSSI: ${data.sssi?.length || 0}`);
    console.log(`   Ramsar: ${data.ramsar?.length || 0}`);
    console.log(`   GCN: ${data.gcn?.length || 0}`);
    console.log(`   OS Priority Ponds: ${data.os_priority_ponds?.length || 0}`);
    
    if (data.sssi && data.sssi.length > 0) {
      console.log('\n✅ SSSI sites found:');
      data.sssi.slice(0, 3).forEach(s => {
        console.log(`   - ${s.name} (${s.dist_m}m)`);
      });
    }
    
    console.log('\n✅ Complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

deployAndTest().catch(console.error);

