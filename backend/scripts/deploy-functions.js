import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deployFunctions() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3, // Limit concurrent connections
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  });

  try {
    console.log('Deploying PostgreSQL functions...');
    
    // Skip heritage analysis functions - already deployed and working
    // const heritageFiles = [
    //   'analyze_listed_buildings.sql',
    //   'analyze_conservation_areas.sql'
    // ];
    
    // for (const file of heritageFiles) {
    //   const path = join(__dirname, '..', 'sql', 'heritage_analysis', file);
    //   try {
    //     const sql = readFileSync(path, 'utf8');
    //     await pool.query(sql);
    //     console.log(`✅ ${file} deployed`);
    //   } catch (e) {
    //     console.warn(`⚠️ Could not execute ${file}:`, e?.message || e);
    //   }
    // }
    
    // Deploy landscape analysis functions
    const landscapeFiles = [
      'analyze_green_belt.sql',
      'analyze_AONB.sql'
    ];
    
    // Deploy agricultural land analysis functions
    const agLandFiles = [
      'analyze_ag_land.sql'
    ];
    
    // Deploy renewables analysis functions
    const renewablesFiles = [
      'analyze_renewables.sql'
    ];
    
    // Deploy ecology analysis functions
    const ecologyFiles = [
      'analyze_OS_priority_ponds.sql',
      'analyze_ramsar.sql'
    ];
    
    for (const file of landscapeFiles) {
      const path = join(__dirname, '..', 'sql', 'landscape_analysis', file);
      try {
        const sql = readFileSync(path, 'utf8');
        await pool.query(sql);
        console.log(`✅ ${file} deployed`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
      } catch (e) {
        console.warn(`⚠️ Could not execute ${file}:`, e?.message || e);
      }
    }
    
    for (const file of agLandFiles) {
      const path = join(__dirname, '..', 'sql', 'Ag_land_analysis', file);
      try {
        const sql = readFileSync(path, 'utf8');
        await pool.query(sql);
        console.log(`✅ ${file} deployed`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
      } catch (e) {
        console.warn(`⚠️ Could not execute ${file}:`, e?.message || e);
      }
    }
    
    for (const file of renewablesFiles) {
      const path = join(__dirname, '..', 'sql', 'renewables_analysis', file);
      try {
        const sql = readFileSync(path, 'utf8');
        await pool.query(sql);
        console.log(`✅ ${file} deployed`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
      } catch (e) {
        console.warn(`⚠️ Could not execute ${file}:`, e?.message || e);
      }
    }
    
    for (const file of ecologyFiles) {
      const path = join(__dirname, '..', 'sql', 'ecology_analysis', file);
      try {
        const sql = readFileSync(path, 'utf8');
        await pool.query(sql);
        console.log(`✅ ${file} deployed`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
      } catch (e) {
        console.warn(`⚠️ Could not execute ${file}:`, e?.message || e);
      }
    }

    // Finally, deploy the aggregator functions (depends on all individual functions)
    const combinedPath = join(__dirname, '..', 'sql', 'create_analysis_functions.sql');
    const combinedSql = readFileSync(combinedPath, 'utf8');
    await pool.query(combinedSql);
    
    console.log('✅ PostgreSQL functions deployed successfully!');
    
    // Test the functions
    console.log('\nTesting functions...');
    
    // Simple test polygon (small square in London)
    const testPolygon = {
      "type": "Polygon",
      "coordinates": [[
        [-0.1, 51.5],
        [-0.09, 51.5],
        [-0.09, 51.51],
        [-0.1, 51.51],
        [-0.1, 51.5]
      ]]
    };
    
    // Test heritage analysis function
    const result = await pool.query(
      'SELECT analyze_site_heritage($1) as result',
      [JSON.stringify(testPolygon)]
    );
    
    console.log('✅ Heritage analysis function working');
    console.log('Sample result structure:', Object.keys(result.rows[0].result));
    
  } catch (error) {
    console.error('❌ Error deploying functions:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

deployFunctions().catch((e) => {
  console.error(e);
  process.exit(1);
});
