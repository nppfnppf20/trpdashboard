/**
 * Sync orchestrator: fetch OCDS releases for a window from the given source,
 * keep the ones passing the rules pre-filter, match buyers to authorities,
 * upsert, classify. Find a Tender and Contracts Finder share this pipeline —
 * only the client that fetches pages differs.
 */

import { pool } from '../../db.js';
import { fetchReleases as fetchFtsReleases } from './ftsClient.js';
import { fetchReleases as fetchContractsFinderReleases } from './contractsFinderClient.js';
import { normaliseRelease } from './normalise.js';
import { buildMatchMap, matchAuthority } from './authorityMatcher.js';
import { loadRules, applyRules, classifyCandidates } from './relevance.js';

export const SOURCES = ['find_a_tender', 'contracts_finder'];
const DEFAULT_SOURCE = 'find_a_tender';

const CLIENTS = {
  find_a_tender: fetchFtsReleases,
  contracts_finder: fetchContractsFinderReleases,
};

const STALE_RUN_MINUTES = 30;
const OVERLAP_MS = 60 * 60 * 1000; // 1h overlap; the upsert absorbs duplicates
const FALLBACK_WINDOW_DAYS = 7;

// One in-process flag per source so a Contracts Finder sync never blocks an FTS one.
const syncInProgress = { find_a_tender: false, contracts_finder: false };

export class SyncInProgressError extends Error {
  constructor() {
    super('A sync is already in progress');
    this.code = 'SYNC_IN_PROGRESS';
  }
}

function assertValidSource(source) {
  if (!SOURCES.includes(source)) {
    throw new Error(`Unknown tender source: ${source}. Expected one of: ${SOURCES.join(', ')}`);
  }
}

async function deriveWindowFrom(source) {
  const { rows } = await pool.query(
    `SELECT MAX(window_to) AS last_to FROM scraper.tender_sync_runs
     WHERE source = $1 AND status = 'success'`,
    [source]
  );
  if (rows[0]?.last_to) {
    return new Date(new Date(rows[0].last_to).getTime() - OVERLAP_MS);
  }
  return new Date(Date.now() - FALLBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

async function assertNoRunningSync(source) {
  if (syncInProgress[source]) throw new SyncInProgressError();
  const { rows } = await pool.query(
    `SELECT id FROM scraper.tender_sync_runs
     WHERE source = $1 AND status = 'running'
       AND started_at > NOW() - INTERVAL '${STALE_RUN_MINUTES} minutes'`,
    [source]
  );
  if (rows.length > 0) throw new SyncInProgressError();
}

const UPSERT_SQL = `
  INSERT INTO scraper.tender_notices (
    source, source_notice_id, ocid, stage, publication_date, title, description,
    buyer_name, authority_id, value_amount, value_currency, deadline,
    contract_start, contract_end, procurement_method, is_framework,
    cpv_code, cpv_description, additional_cpv_codes,
    contact_name, contact_email, contact_phone, notice_url, submission_url, raw_json
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22, $23, $24, $25
  )
  ON CONFLICT (source, source_notice_id) DO UPDATE SET
    ocid = EXCLUDED.ocid,
    stage = EXCLUDED.stage,
    publication_date = EXCLUDED.publication_date,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    buyer_name = EXCLUDED.buyer_name,
    authority_id = COALESCE(scraper.tender_notices.authority_id, EXCLUDED.authority_id),
    value_amount = EXCLUDED.value_amount,
    value_currency = EXCLUDED.value_currency,
    deadline = EXCLUDED.deadline,
    contract_start = EXCLUDED.contract_start,
    contract_end = EXCLUDED.contract_end,
    procurement_method = EXCLUDED.procurement_method,
    is_framework = EXCLUDED.is_framework,
    cpv_code = EXCLUDED.cpv_code,
    cpv_description = EXCLUDED.cpv_description,
    additional_cpv_codes = EXCLUDED.additional_cpv_codes,
    contact_name = EXCLUDED.contact_name,
    contact_email = EXCLUDED.contact_email,
    contact_phone = EXCLUDED.contact_phone,
    notice_url = EXCLUDED.notice_url,
    submission_url = EXCLUDED.submission_url,
    raw_json = EXCLUDED.raw_json,
    updated_at = NOW()
  -- relevance_status / classified_by / llm_reason / dismissed deliberately untouched:
  -- LLM and human decisions must survive re-syncs of the same notice.
`;

async function upsertNotice(row) {
  await pool.query(UPSERT_SQL, [
    row.source, row.source_notice_id, row.ocid, row.stage, row.publication_date,
    row.title, row.description, row.buyer_name, row.authority_id,
    row.value_amount, row.value_currency, row.deadline,
    row.contract_start, row.contract_end, row.procurement_method, row.is_framework,
    row.cpv_code, row.cpv_description, JSON.stringify(row.additional_cpv_codes),
    row.contact_name, row.contact_email, row.contact_phone,
    row.notice_url, row.submission_url, JSON.stringify(row.raw_json),
  ]);
}

export async function runSync({ source = DEFAULT_SOURCE, from, to, stages, classify = true } = {}) {
  assertValidSource(source);
  await assertNoRunningSync(source);
  syncInProgress[source] = true;

  const windowFrom = from ? new Date(from) : await deriveWindowFrom(source);
  const windowTo = to ? new Date(to) : new Date();

  const runResult = await pool.query(
    `INSERT INTO scraper.tender_sync_runs (source, window_from, window_to)
     VALUES ($1, $2, $3) RETURNING id`,
    [source, windowFrom, windowTo]
  );
  const runId = runResult.rows[0].id;
  const counters = { pages_fetched: 0, notices_seen: 0, notices_stored: 0 };

  try {
    const rules = await loadRules();
    const matchMap = await buildMatchMap();
    const fetchReleases = CLIENTS[source];

    for await (const { releases, pageNumber } of fetchReleases({
      updatedFrom: windowFrom,
      updatedTo: windowTo,
      stages,
    })) {
      counters.pages_fetched = pageNumber;
      for (const release of releases) {
        const row = normaliseRelease(release, source);
        if (!row) continue;
        counters.notices_seen += 1;
        if (!applyRules(row, rules)) continue;
        row.authority_id = await matchAuthority(row.buyer_name, matchMap);
        await upsertNotice(row);
        counters.notices_stored += 1;
      }
      await pool.query(
        `UPDATE scraper.tender_sync_runs
         SET pages_fetched = $2, notices_seen = $3, notices_stored = $4
         WHERE id = $1`,
        [runId, counters.pages_fetched, counters.notices_seen, counters.notices_stored]
      );
    }

    await pool.query(
      `UPDATE scraper.tender_sync_runs SET status = 'success', finished_at = NOW() WHERE id = $1`,
      [runId]
    );
    console.log(
      `[tenders] ${source} sync run ${runId} complete: ${counters.notices_stored}/${counters.notices_seen} stored over ${counters.pages_fetched} pages`
    );
  } catch (err) {
    await pool.query(
      `UPDATE scraper.tender_sync_runs
       SET status = 'failed', finished_at = NOW(), error_message = $2 WHERE id = $1`,
      [runId, err.message]
    ).catch(() => {});
    throw err;
  } finally {
    syncInProgress[source] = false;
  }

  let classification = null;
  if (classify) {
    try {
      classification = await classifyCandidates();
    } catch (err) {
      console.error('[tenders] classification after sync failed (notices are stored):', err.message);
    }
  }

  return {
    run: { id: runId, window_from: windowFrom, window_to: windowTo, ...counters },
    classification,
  };
}

export async function runBackfill({ source = DEFAULT_SOURCE, from, to }) {
  assertValidSource(source);
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error('Backfill requires valid from/to dates with from < to');
  }

  const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  const runs = [];
  for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + WINDOW_MS)) {
    const windowEnd = new Date(Math.min(cursor.getTime() + WINDOW_MS, end.getTime()));
    const result = await runSync({ source, from: cursor, to: windowEnd, classify: false });
    runs.push(result.run);
  }

  let classification = null;
  try {
    classification = await classifyCandidates();
  } catch (err) {
    console.error('[tenders] classification after backfill failed:', err.message);
  }

  return { runs, classification };
}

export async function getStats() {
  const { rows } = await pool.query(`
    SELECT a.id, a.name, a.region, a.authority_type,
      COUNT(n.id) FILTER (WHERE n.publication_date > NOW() - INTERVAL '12 months') AS notices_12m,
      COUNT(n.id) FILTER (WHERE n.publication_date > NOW() - INTERVAL '36 months') AS notices_36m,
      COUNT(n.id) FILTER (WHERE n.stage = 'award' AND n.publication_date > NOW() - INTERVAL '12 months') AS awards_12m,
      COUNT(n.id) FILTER (WHERE n.stage = 'award' AND n.publication_date > NOW() - INTERVAL '36 months') AS awards_36m,
      SUM(n.value_amount) FILTER (WHERE n.publication_date > NOW() - INTERVAL '36 months') AS total_value_36m,
      ROUND(AVG(n.value_amount) FILTER (WHERE n.publication_date > NOW() - INTERVAL '36 months')) AS avg_value_36m,
      MAX(n.publication_date) AS most_recent
    FROM scraper.tender_authorities a
    JOIN scraper.tender_notices n
      ON n.authority_id = a.id AND n.dismissed = FALSE AND n.relevance_status <> 'irrelevant'
    GROUP BY a.id, a.name, a.region, a.authority_type
    ORDER BY notices_12m DESC, notices_36m DESC
  `);
  return rows;
}
