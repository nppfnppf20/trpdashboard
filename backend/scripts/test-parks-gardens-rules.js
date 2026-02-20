import 'dotenv/config';
import pg from 'pg';
import { processHeritageRules } from '../src/rules/heritage/index.js';

async function testParksGardensRules() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('🧪 Testing Registered Parks and Gardens Business Rules\n');
    
    // Test polygon in Oxford area
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
    
    console.log('📊 Running heritage aggregator...\n');
    
    const result = await pool.query(
      'SELECT analyze_site_heritage($1) as analysis_result',
      [JSON.stringify(testPolygon)]
    );
    
    const analysisData = result.rows[0].analysis_result;
    
    console.log(`✅ Found ${analysisData.registered_parks_gardens?.length || 0} Registered Parks/Gardens\n`);
    
    if (analysisData.registered_parks_gardens && analysisData.registered_parks_gardens.length > 0) {
      console.log('📋 Sample Parks/Gardens:');
      analysisData.registered_parks_gardens.slice(0, 3).forEach(pg => {
        console.log(`   - ${pg.name} (Grade ${pg.grade})`);
        console.log(`     Distance: ${pg.dist_m}m, On-site: ${pg.on_site}, Within 100m: ${pg.within_100m}`);
      });
      console.log('');
    }
    
    console.log('🔧 Processing business rules...\n');
    
    const rulesResult = processHeritageRules(analysisData);
    
    console.log(`📊 Total Heritage Rules Triggered: ${rulesResult.rules.length}`);
    console.log(`🎯 Overall Heritage Risk: ${rulesResult.overallRisk}\n`);
    
    // Find parks/gardens specific rules
    const pgRules = rulesResult.rules.filter(r => r.id?.includes('parks_gardens'));
    
    if (pgRules.length > 0) {
      console.log(`✅ Registered Parks/Gardens Rules Triggered: ${pgRules.length}\n`);
      pgRules.forEach(rule => {
        console.log(`   📍 ${rule.rule}`);
        console.log(`      Risk Level: ${rule.level}`);
        console.log(`      Findings: ${rule.findings}`);
        if (rule.recommendations && rule.recommendations.length > 0) {
          console.log(`      Recommendations:`);
          rule.recommendations.forEach(rec => {
            console.log(`         - ${rec}`);
          });
        }
        console.log('');
      });
    } else {
      console.log('ℹ️  No Parks/Gardens rules triggered (likely all beyond 5km)\n');
    }
    
    console.log('✅ Business rules test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testParksGardensRules().catch(console.error);


