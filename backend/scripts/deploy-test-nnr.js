import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, ssl: false});

console.log('🚀 Deploying National Nature Reserves...\n');

// Deploy individual function
const sqlNNR = fs.readFileSync(path.join(__dirname, '..', 'sql', 'ecology_analysis', 'analyze_national_nature_reserves.sql'), 'utf8');
await pool.query(sqlNNR);
console.log('✅ NNR function deployed\n');

// Deploy aggregator
const sqlAggregator = fs.readFileSync(path.join(__dirname, '..', 'sql', 'create_analysis_functions.sql'), 'utf8');
await pool.query(sqlAggregator);
console.log('✅ Ecology aggregator updated\n');

// Test with Peak District polygon
console.log('🧪 Testing with Peak District polygon...\n');
const test = {type:'Polygon',coordinates:[[[-1.8,53.3],[-1.8,53.4],[-1.7,53.4],[-1.7,53.3],[-1.8,53.3]]]};
const res = await pool.query('SELECT * FROM analyze_site_ecology($1)', [JSON.stringify(test)]);
const data = res.rows[0]?.analyze_site_ecology;

console.log('📊 Ecology Results:');
console.log('  - SSSI:', data?.sssi?.length || 0);
console.log('  - NNR:', data?.national_nature_reserves?.length || 0);

if (data?.national_nature_reserves?.length > 0) {
  console.log('\n🌲 National Nature Reserves found:');
  data.national_nature_reserves.slice(0, 3).forEach(n => {
    console.log(`  - ${n.name} (${n.dist_m}m, ${n.on_site ? 'ON-SITE' : n.direction})`);
  });
}

console.log('\n✅ Complete!');
await pool.end();

