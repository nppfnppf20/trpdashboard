import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, ssl: false});

console.log('🚀 Deploying NNR function...\n');
const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'ecology_analysis', 'analyze_national_nature_reserves.sql'), 'utf8');
await pool.query(sql);
console.log('✅ Deployed\n');

console.log('🧪 Testing...\n');
const test = {type:'Polygon',coordinates:[[[-1.8,53.3],[-1.8,53.4],[-1.7,53.4],[-1.7,53.3],[-1.8,53.3]]]};
const res = await pool.query('SELECT * FROM analyze_national_nature_reserves($1)', [JSON.stringify(test)]);

console.log(`📊 Found ${res.rows.length} National Nature Reserves`);
if(res.rows.length > 0) {
  res.rows.slice(0, 3).forEach(r => {
    console.log(`  - ${r.name} (${r.dist_m}m, ${r.on_site ? 'on-site' : r.direction})`);
  });
}

console.log('\n✅ Complete!');
await pool.end();

