import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugEcologyError() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    console.log('🔍 Checking ecology analysis function...\n');
    
    // Check if function exists
    const funcCheck = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('analyze_site_ecology', 'analyze_sssi')
    `);
    
    console.log('📋 Functions found:', funcCheck.rows.map(r => r.routine_name));
    
    if (funcCheck.rows.length < 2) {
      console.log('\n❌ Missing functions! Deploying now...\n');
      
      // Deploy aggregator
      const aggregatorPath = path.join(__dirname, '..', 'sql', 'create_analysis_functions.sql');
      const aggregatorSql = fs.readFileSync(aggregatorPath, 'utf8');
      await pool.query(aggregatorSql);
      console.log('✅ Aggregator deployed\n');
    }
    
    // Test with simple polygon
    const testPolygon = {
      type: "Polygon",
      coordinates: [[[-1.8, 53.3], [-1.8, 53.4], [-1.7, 53.4], [-1.7, 53.3], [-1.8, 53.3]]]
    };
    
    console.log('🧪 Testing analyze_site_ecology...\n');
    
    try {
      const result = await pool.query(
        'SELECT analyze_site_ecology($1) as result',
        [JSON.stringify(testPolygon)]
      );
      
      const data = result.rows[0].result;
      console.log('✅ Ecology analysis working!');
      console.log('   SSSI:', data.sssi?.length || 0);
      console.log('   Ramsar:', data.ramsar?.length || 0);
      console.log('   GCN:', data.gcn?.length || 0);
      console.log('   OS Ponds:', data.os_priority_ponds?.length || 0);
      
    } catch (funcError) {
      console.error('❌ Function error:', funcError.message);
      console.error('   Hint:', funcError.hint || 'No hint');
      console.error('   Detail:', funcError.detail || 'No detail');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

debugEcologyError().catch(console.error);

