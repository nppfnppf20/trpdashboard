import 'dotenv/config';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tables = await pool.query(`
      select n.nspname as schema,
             c.relname as table,
             a.attname as geom_column,
             postgis_typmod_srid(a.atttypmod) as srid,
             postgis_typmod_type(a.atttypmod) as geom_type
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
      join pg_type t on a.atttypid = t.oid
      where t.typname = 'geometry'
        and a.attnum > 0
        and not a.attisdropped
      order by 1,2;
    `);

    const indexes = await pool.query(`
      select n.nspname as schema,
             c.relname as table,
             i.relname as index,
             pg_get_indexdef(ix.indexrelid) as indexdef
      from pg_index ix
      join pg_class i on i.oid = ix.indexrelid
      join pg_class c on c.oid = ix.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      where i.relkind = 'i'
      order by 1,2;
    `);

    const indexMap = new Map();
    for (const row of indexes.rows) {
      const key = `${row.schema}.${row.table}`;
      const arr = indexMap.get(key) || [];
      arr.push(row.indexdef);
      indexMap.set(key, arr);
    }

    const report = tables.rows.map((t) => {
      const key = `${t.schema}.${t.table}`;
      const idx = (indexMap.get(key) || []).filter((d) => /USING\s+GIST/i.test(d));
      return {
        schema: t.schema,
        table: t.table,
        geom_column: t.geom_column,
        srid: t.srid,
        geom_type: t.geom_type,
        gist_indexes: idx
      };
    });

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


