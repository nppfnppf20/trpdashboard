import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in .env file');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Running migration: ${fileName}`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
    console.log(`✅ ${fileName} completed successfully`);
  } catch (error) {
    console.error(`❌ ${fileName} failed:`, error.message);
    throw error;
  }
}

async function runMigrations() {
  console.log('🚀 Starting migrations...\n');

  const migrationsDir = path.join(__dirname, '..', 'sql', 'migrations');

  // Get all SQL files in migrations directory
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // This will run them in order: 001, 002, 003, etc.

  console.log(`Found ${files.length} migration files:\n`);
  files.forEach(file => console.log(`  - ${file}`));

  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      await runMigration(filePath);
    }

    console.log('\n✅ All migrations completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed. Stopping.\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
