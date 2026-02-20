/**
 * Script to check and add spatial indexes to Socioeconomics layers
 * Spatial indexes dramatically improve ST_Intersects and other spatial query performance
 */

import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function manageSpatialIndexes() {
  try {
    console.log('🗺️  Spatial Index Management for Socioeconomics Layers\n');
    console.log('=' .repeat(80));

    const tables = [
      { schema: 'Socioeconomics', table: 'Countries', geomColumn: 'geom' },
      { schema: 'Socioeconomics', table: 'Regions', geomColumn: 'geom' },
      { schema: 'Socioeconomics', table: 'LAD25', geomColumn: 'geom' },
      { schema: 'Socioeconomics', table: 'LAD19', geomColumn: 'geom' },
      { schema: 'Socioeconomics', table: 'LAD11', geomColumn: 'geom' }
    ];

    console.log('\n📊 STEP 1: Checking existing spatial indexes\n');

    for (const { schema, table, geomColumn } of tables) {
      const indexName = `${table.toLowerCase()}_${geomColumn}_idx`;

      // Check if spatial index exists
      const checkQuery = `
        SELECT
          i.relname as index_name,
          am.amname as index_type,
          pg_size_pretty(pg_relation_size(i.oid)) as index_size
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON i.relam = am.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = $1
          AND t.relname = $2
          AND am.amname = 'gist'
      `;

      const result = await pool.query(checkQuery, [schema, table]);

      if (result.rows.length > 0) {
        console.log(`✅ ${schema}.${table}`);
        result.rows.forEach(row => {
          console.log(`   Index: ${row.index_name} (${row.index_type}) - Size: ${row.index_size}`);
        });
      } else {
        console.log(`❌ ${schema}.${table} - No spatial index found`);
      }
    }

    console.log('\n\n📊 STEP 2: Creating missing spatial indexes\n');
    console.log('⚠️  Note: Creating indexes may take a few minutes for large tables\n');

    for (const { schema, table, geomColumn } of tables) {
      const indexName = `${table.toLowerCase()}_${geomColumn}_idx`;

      // Check if index exists
      const checkQuery = `
        SELECT 1
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON i.relam = am.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = $1
          AND t.relname = $2
          AND am.amname = 'gist'
      `;

      const existsResult = await pool.query(checkQuery, [schema, table]);

      if (existsResult.rows.length === 0) {
        console.log(`🔧 Creating spatial index for ${schema}.${table}...`);

        try {
          const createIndexQuery = `
            CREATE INDEX IF NOT EXISTS ${indexName}
            ON "${schema}"."${table}"
            USING GIST (${geomColumn})
          `;

          const startTime = Date.now();
          await pool.query(createIndexQuery);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);

          console.log(`   ✅ Created ${indexName} in ${duration}s`);

          // Get index size
          const sizeQuery = `
            SELECT pg_size_pretty(pg_relation_size('${schema}.${indexName}'::regclass)) as size
          `;
          const sizeResult = await pool.query(sizeQuery);
          console.log(`   📦 Index size: ${sizeResult.rows[0].size}`);

        } catch (err) {
          console.log(`   ❌ Error creating index: ${err.message}`);
        }
      } else {
        console.log(`⏭️  ${schema}.${table} - Spatial index already exists, skipping`);
      }
    }

    console.log('\n\n📊 STEP 3: Analyzing tables for query optimization\n');

    for (const { schema, table } of tables) {
      console.log(`🔍 Running ANALYZE on ${schema}.${table}...`);
      try {
        await pool.query(`ANALYZE "${schema}"."${table}"`);
        console.log(`   ✅ Complete`);
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
    }

    console.log('\n\n✨ SUMMARY');
    console.log('=' .repeat(80));
    console.log('Spatial indexes improve query performance by organizing geometries');
    console.log('in a tree structure for faster spatial operations like ST_Intersects.');
    console.log('\nYour polygon queries should now be significantly faster!');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

manageSpatialIndexes();
