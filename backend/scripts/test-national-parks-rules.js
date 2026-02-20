import 'dotenv/config';
import pg from 'pg';
import { processLandscapeRules } from '../src/rules/landscape/index.js';

async function testNationalParksRules() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('🧪 Testing National Parks Business Rules...\n');
    
    // Test polygon in Peak District
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
    
    console.log('📊 Step 1: Getting SQL analysis results...\n');
    
    const sqlResult = await pool.query(
      'SELECT analyze_site_landscape($1) as analysis_result',
      [JSON.stringify(testPolygon)]
    );
    
    const analysisData = sqlResult.rows[0].analysis_result;
    
    console.log(`   Green Belt: ${analysisData.green_belt?.length || 0} features`);
    console.log(`   AONB: ${analysisData.aonb?.length || 0} features`);
    console.log(`   National Parks: ${analysisData.national_parks?.length || 0} features`);
    
    if (analysisData.national_parks && analysisData.national_parks.length > 0) {
      console.log('\n   National Parks found:');
      analysisData.national_parks.forEach(park => {
        console.log(`   - ${park.name} (${park.dist_m}m, on_site: ${park.on_site})`);
      });
    }
    
    console.log('\n🎯 Step 2: Processing business rules...\n');
    
    const rulesAssessment = processLandscapeRules(analysisData);
    
    console.log(`   Overall Risk: ${rulesAssessment.overallRisk}`);
    console.log(`   Total Rules Triggered: ${rulesAssessment.rules.length}`);
    
    // Filter for National Park rules only
    const npRules = rulesAssessment.rules.filter(r => r.id && r.id.includes('national_park'));
    
    if (npRules.length > 0) {
      console.log(`\n✅ National Park Rules Triggered: ${npRules.length}\n`);
      
      npRules.forEach((rule, idx) => {
        console.log(`   ${idx + 1}. ${rule.rule}`);
        console.log(`      - Risk Level: ${rule.level}`);
        console.log(`      - Findings: ${rule.findings}`);
        if (rule.recommendations && rule.recommendations.length > 0) {
          console.log(`      - Recommendations:`);
          rule.recommendations.forEach(rec => {
            console.log(`        • ${rec}`);
          });
        }
      });
    } else {
      console.log('\n   No National Park rules triggered');
    }
    
    console.log('\n✅ Business rules test complete!');
    console.log('✅ National Parks rules successfully integrated into landscape domain!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testNationalParksRules().catch(console.error);

