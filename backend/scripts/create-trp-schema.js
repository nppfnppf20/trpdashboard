import { pool } from '../src/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTRPSchema() {
  try {
    console.log('🔄 Creating TRP database schema...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../sql/trp_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await pool.query(sql);

    console.log('✅ TRP schema created successfully!');

    // Test by checking if tables exist
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('site_analyses', 'trp_reports', 'trp_discipline_risks', 'trp_rule_edits', 'trp_recommendations')
    `);

    console.log('📋 Created tables:', result.rows.map(row => row.table_name));

  } catch (error) {
    console.error('❌ Error creating TRP schema:', error);
  } finally {
    await pool.end();
  }
}

createTRPSchema();