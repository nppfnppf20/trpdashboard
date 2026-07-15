// Temporary read-only diagnostic (deleted after use): fetch the definition,
// schema and owner of every view named chat_quotes, plus any other views
// that depend on the columns we need to widen.
import 'dotenv/config';
import { pool } from './src/db.js';

const { rows: views } = await pool.query(`
  SELECT n.nspname AS schema, c.relname AS view_name,
         pg_get_viewdef(c.oid, true) AS definition
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'v' AND c.relname = 'chat_quotes'
`);
for (const v of views) {
  console.log(`\n=== ${v.schema}.${v.view_name} ===\n${v.definition}`);
}

// Any other views depending on the two tables
const { rows: deps } = await pool.query(`
  SELECT DISTINCT dependent_ns.nspname AS view_schema, dependent.relname AS view_name,
         source.relname AS on_table
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class dependent ON dependent.oid = r.ev_class
  JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent.relnamespace
  JOIN pg_class source ON source.oid = d.refobjid
  JOIN pg_namespace source_ns ON source_ns.oid = source.relnamespace
  WHERE source_ns.nspname = 'admin_console'
    AND source.relname IN ('quotes', 'quote_line_items')
    AND dependent.relkind = 'v'
`);
console.log('\nViews depending on quotes / quote_line_items:');
console.table(deps);
await pool.end();
