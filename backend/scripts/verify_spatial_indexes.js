/**
 * Verify spatial indexes exist and are being used by query planner
 */

import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyIndexes() {
  try {
    console.log('🔍 Verifying Spatial Indexes\n');
    console.log('=' .repeat(80));

    // Check if indexes exist
    console.log('\n📊 STEP 1: Checking index existence\n');

    const indexCheckQuery = `
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'Socioeconomics'
        AND indexname LIKE '%geom%'
      ORDER BY tablename, indexname
    `;

    const indexes = await pool.query(indexCheckQuery);

    if (indexes.rows.length === 0) {
      console.log('❌ No spatial indexes found!');
      console.log('   The indexes may not have been created successfully.');
    } else {
      console.log(`✅ Found ${indexes.rows.length} spatial indexes:\n`);
      indexes.rows.forEach(idx => {
        console.log(`   ${idx.tablename}: ${idx.indexname}`);
      });
    }

    // Test query performance with EXPLAIN ANALYZE
    console.log('\n\n📊 STEP 2: Testing if indexes are being used\n');

    // Example test polygon (Barnsley area)
    const testPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-1.5, 53.52],
        [-1.5, 53.55],
        [-1.4, 53.55],
        [-1.4, 53.52],
        [-1.5, 53.52]
      ]]
    };

    console.log('Testing LAD25 query with EXPLAIN ANALYZE...\n');

    const explainQuery = `
      EXPLAIN ANALYZE
      SELECT "LAD23CD", "LAD23NM"
      FROM "Socioeconomics"."LAD25"
      WHERE ST_Intersects(
        geom,
        ST_Transform(ST_GeomFromGeoJSON($1), 27700)
      )
    `;

    const result = await pool.query(explainQuery, [JSON.stringify(testPolygon)]);

    console.log('Query execution plan:\n');
    result.rows.forEach(row => {
      console.log(row['QUERY PLAN']);
    });

    // Check if index is mentioned in the plan
    const planText = result.rows.map(r => r['QUERY PLAN']).join('\n');

    if (planText.includes('Index Scan') || planText.includes('lad25_geom_idx')) {
      console.log('\n✅ GOOD: Query is using the spatial index!');
    } else if (planText.includes('Seq Scan')) {
      console.log('\n⚠️  WARNING: Query is doing a Sequential Scan (not using index)');
      console.log('   This might be because:');
      console.log('   1. The dataset is small and Postgres thinks seq scan is faster');
      console.log('   2. The index needs to be analyzed/rebuilt');
      console.log('   3. Query statistics need to be updated');
    }

    // Show actual timing
    const timingLine = result.rows.find(r => r['QUERY PLAN'].includes('Execution Time'));
    if (timingLine) {
      console.log('\n⏱️  ' + timingLine['QUERY PLAN']);
    }

    // Get table sizes to understand why performance might not improve
    console.log('\n\n📊 STEP 3: Table sizes (context for performance)\n');

    const sizeQuery = `
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        (SELECT count(*) FROM "Socioeconomics"."LAD25") as lad25_rows,
        (SELECT count(*) FROM "Socioeconomics"."LAD19") as lad19_rows,
        (SELECT count(*) FROM "Socioeconomics"."LAD11") as lad11_rows
      FROM pg_tables
      WHERE schemaname = 'Socioeconomics'
        AND tablename IN ('LAD25', 'LAD19', 'LAD11')
      ORDER BY tablename
    `;

    const sizes = await pool.query(sizeQuery);

    sizes.rows.forEach(row => {
      console.log(`${row.tablename}:`);
      console.log(`  Rows: ${row[row.tablename.toLowerCase() + '_rows']}`);
      console.log(`  Size: ${row.total_size}`);
    });

    console.log('\n\n💡 ANALYSIS');
    console.log('=' .repeat(80));

    const totalRows = sizes.rows[0]?.lad25_rows || 0;

    if (totalRows < 1000) {
      console.log('Your tables have relatively few rows (< 1000).');
      console.log('Spatial indexes provide huge benefits for large datasets (10k+ rows),');
      console.log('but with small datasets like yours, the difference may not be noticeable.');
      console.log('\nPerformance is likely dominated by:');
      console.log('  • Network latency to Supabase');
      console.log('  • Frontend rendering time');
      console.log('  • Data processing in the application');
      console.log('\nThe indexes are still beneficial and best practice, but you might');
      console.log('not notice a dramatic speed improvement with this dataset size.');
    } else {
      console.log('Your dataset is large enough that spatial indexes should help significantly.');
      console.log('If you\'re not seeing improvement, there might be other bottlenecks.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyIndexes();
