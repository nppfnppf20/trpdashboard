/**
 * PlanIt Controller
 * Proxies searches to the UK PlanIt public API, drafts the search (keywords, LPA and
 * a description of what to find) from the project and chosen sources, and has Claude
 * triage the results against that description.
 */

import { pool } from '../db.js';
import { callClaude, parseJSON, MODEL_FAST, MODEL_SONNET } from '../services/llm.shared.js';
import { assembleContext, assembleSourceTexts } from '../services/projectChat.service.js';
import { TRACKER_GROUPS } from '../services/appealPrecedent.service.js';

const PLANIT_BASE  = 'https://www.planit.org.uk/api/applics/json';
const PLANIT_AREAS = 'https://www.planit.org.uk/api/areas/json';

const FETCH_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; TRPDashboard/1.0)'
};

// Simple in-process cache so we don't hit the areas API on every search
const lpaCache = new Map();

/**
 * Strip common UK council suffixes to get a shorter search term,
 * then query PlanIt's areas API to resolve the exact authority name.
 * Returns the best matching area_name, or the original string if no match.
 */
async function resolveLpaName(raw) {
  const key = raw.trim().toLowerCase();
  if (lpaCache.has(key)) return lpaCache.get(key);

  // Strip suffixes PlanIt doesn't use
  const stripped = raw
    .replace(/\b(district|borough|city|county|metropolitan|unitary|community)\s+council\b/gi, '')
    .replace(/\bcouncil\b/gi, '')
    .trim();

  const candidates = [stripped, raw.trim()];

  for (const candidate of candidates) {
    try {
      const params = new URLSearchParams({
        auths: candidate,
        pg_sz: '5',
        select: 'area_name,long_name'
      });
      const res = await fetch(`${PLANIT_AREAS}?${params}`, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(10_000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      const records = data.records || [];
      if (records.length > 0) {
        // Prefer an exact or close match on long_name/area_name
        const match = records.find(r =>
          r.long_name?.toLowerCase().includes(stripped.toLowerCase()) ||
          r.area_name?.toLowerCase().includes(stripped.toLowerCase())
        ) || records[0];
        const resolved = match.area_name;
        console.log(`[planit] resolved "${raw}" → "${resolved}"`);
        lpaCache.set(key, resolved);
        return resolved;
      }
    } catch { /* try next candidate */ }
  }

  // Fall back to stripped name and hope for the best
  console.warn(`[planit] could not resolve LPA name "${raw}", using stripped: "${stripped}"`);
  lpaCache.set(key, stripped);
  return stripped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch project data and its latest HLPV findings from the DB.
 */
async function getProjectContext(projectId) {
  const { rows: projects } = await pool.query(
    `SELECT
       p.id, p.project_name, p.address,
       p.sectors, p.sub_sectors, p.project_type,
       p.local_planning_authority,
       p.designations_on_site, p.relevant_nearby_designations,
       p.heritage_risk, p.landscape_risk, p.ecology_risk,
       p.ag_land_risk, p.renewables_risk,
       p.comments
     FROM projects p
     WHERE p.id = $1`,
    [projectId]
  );
  if (!projects.length) return null;
  const project = projects[0];

  // Fetch the most recent HLPV analysis session for this project
  const { rows: sessions } = await pool.query(
    `SELECT id FROM analysis_sessions
     WHERE project_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [projectId]
  );

  let findings = [];
  if (sessions.length) {
    const sessionId = sessions[0].id;
    const { rows } = await pool.query(
      `SELECT discipline, feature_type, feature_name, grade,
              distance_m, on_site, within_1km, within_3km
       FROM analysis_findings
       WHERE session_id = $1
       ORDER BY discipline, distance_m ASC NULLS LAST`,
      [sessionId]
    );
    findings = rows;
  }

  return { project, findings };
}

/**
 * Build a concise text summary of HLPV findings for the LLM prompt.
 */
function buildFindingsSummary(findings) {
  if (!findings.length) return 'No HLPV analysis available.';

  const byDiscipline = {};
  for (const f of findings) {
    if (!byDiscipline[f.discipline]) byDiscipline[f.discipline] = [];
    byDiscipline[f.discipline].push(f);
  }

  return Object.entries(byDiscipline).map(([discipline, items]) => {
    const lines = items.slice(0, 6).map(f => {
      const loc = f.on_site ? 'on site' : f.distance_m ? `${Math.round(f.distance_m)}m away` : 'nearby';
      const grade = f.grade ? ` (${f.grade})` : '';
      return `  - ${f.feature_type.replace(/_/g, ' ')}${grade}: ${f.feature_name || 'unnamed'}, ${loc}`;
    });
    return `${discipline.toUpperCase()}:\n${lines.join('\n')}`;
  }).join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: Generate the search from the project and chosen sources
// POST /api/planit/projects/:projectId/generate
// Body: { sources?: { document_ids, meeting_ids, trackers, mode } }
// Returns the keyword terms, LPA and a detailed description of what to look for.
// ─────────────────────────────────────────────────────────────────────────────

const clampIds = ids => (Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite).slice(0, 25) : []);

const GENERATE_SYSTEM = `You are a UK planning consultant setting up a search of the PlanIt planning applications database to find comparable schemes (precedents) for a live project.

PlanIt only searches the short description of development on each application, so keywords must be words that appear in those descriptions. From the project information return ONLY JSON:
{
  "terms": ["<single word or short phrase>", ...],
  "lpa": "<the primary local planning authority, as a plain name e.g. South Holland>",
  "brief": "<2 to 4 sentences describing what a comparable scheme looks like>"
}

Rules for "terms":
- 4 to 10 entries: the development type and its common synonyms and wordings (e.g. solar farm, solar park, photovoltaic, ground mounted solar), plus any key associated element (e.g. battery storage) only if the project includes it
- Plain words or short phrases only. No operators, quotes, or the word "or"
- Never designations or constraints (SSSI, AONB, listed building and so on): they are not in descriptions

Rules for "brief":
- Keep it BROAD and SHORT: one or two sentences, under 40 words. It is used to sift application descriptions, which only say what is being built, so describe the kind of scheme wanted, not the project itself
- Cover only the development type and, if the sources state it, a rough scale band (for example "commercial ground-mounted solar, around 50MW or larger"). Widen the scale to a sensible range rather than quoting an exact figure
- Leave out the site, setting, designations, constraints, landowner, client concerns and policy issues: none of these appear in application descriptions
- You may add one short exclusion if it is obvious (for example "not domestic or rooftop")
- Never invent facts. Leave something out rather than guess`;

export async function generateSearch(req, res) {
  const projectId = Number(req.params.projectId);
  try {
    const ctx = await getProjectContext(projectId);
    if (!ctx) return res.status(404).json({ error: 'Project not found' });
    const { project, findings } = ctx;

    const picked = req.body?.sources;
    const mode = ['notes', 'transcript', 'both'].includes(picked?.mode) ? picked.mode : 'notes';
    const trackers = Array.isArray(picked?.trackers) ? picked.trackers.filter(t => TRACKER_GROUPS.includes(t)) : [];
    const documentIds = clampIds(picked?.document_ids);
    const meetingIds = clampIds(picked?.meeting_ids);
    const hasSources = !!(documentIds.length || meetingIds.length || trackers.length);

    const { blocks } = await assembleContext(projectId, { project_details: true, groups: trackers });
    const chosen = hasSources ? (await assembleSourceTexts(projectId, { documentIds, meetingIds, mode })).blocks : [];

    const totalCap = 130000;
    let used = 0;
    const sourceText = [
      ...blocks.map(b => ({ label: b.label, text: b.text, cap: 30000 })),
      ...chosen.map(b => ({ label: b.label, text: b.text, cap: 40000 }))
    ]
      .map(b => `### ${b.label}\n${b.text.slice(0, b.cap)}`)
      .filter(t => (used += t.length) < totalCap)
      .join('\n\n');

    const sectors = [...(project.sectors || []), ...(project.sub_sectors || [])].join(', ') || project.project_type || 'not stated';
    const lpas = [].concat(project.local_planning_authority || []).filter(Boolean);

    const out = parseJSON(
      await callClaude(
        GENERATE_SYSTEM,
        `PROJECT: ${project.project_name}\nSector / type: ${sectors}\nAddress: ${project.address || 'not stated'}\nLPA on record: ${lpas.join(', ') || 'not stated'}\nDesignations on site: ${project.designations_on_site || 'none recorded'}\nNearby designations: ${project.relevant_nearby_designations || 'none recorded'}\n\nHLPV FINDINGS:\n${buildFindingsSummary(findings)}\n\n${sourceText}`,
        hasSources ? MODEL_SONNET : MODEL_FAST,
        1200
      )
    );

    const terms = [...new Set((out.terms ?? []).map(t => clip(String(t).replace(/["“”]/g, ''), 60)).filter(Boolean))].slice(0, 12);
    res.json({
      terms,
      lpa: lpas[0] || clip(out.lpa, 120) || '',
      brief: clip(out.brief, 400),
      usedSources: { trackers: trackers.length, meetings: meetingIds.length, documents: documentIds.length, mode: hasSources ? mode : null }
    });
  } catch (err) {
    if (/credit balance/i.test(err.message)) {
      return res.status(503).json({ error: 'The AI provider is out of credit. Top up the Anthropic balance and try again.' });
    }
    console.error('generateSearch error:', err);
    res.status(500).json({ error: 'Failed to generate the search', detail: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: Search PlanIt
// GET /api/planit/projects/:projectId/search?keywords=X&lpa=Y&pg_sz=20&page=1
// ─────────────────────────────────────────────────────────────────────────────

const APP_STATES = ['Undecided', 'Permitted', 'Conditions', 'Rejected', 'Withdrawn', 'Referred', 'Unresolved', 'Other'];
const APP_TYPES  = ['Full', 'Outline', 'Amendment', 'Conditions', 'Heritage', 'Trees', 'Advertising', 'Telecoms', 'Other'];
const APP_SIZES  = ['Small', 'Medium', 'Large'];

/** Keep only values PlanIt knows, as a comma-separated string (empty = no filter). */
function listParam(value, allowed) {
  const list = (Array.isArray(value) ? value : String(value ?? '').split(','))
    .map(v => String(v).trim())
    .filter(v => allowed.includes(v));
  return [...new Set(list)].join(',');
}

/** Build PlanIt query params for a keyword + LPA search with the optional filters. */
function buildSearchParams({ lpa, keywords, filters = {}, pgSz, page }) {
  const params = new URLSearchParams({
    auth:     lpa,
    search:   keywords.trim(),
    pg_sz:    String(pgSz),
    page:     String(page),
    sort:     '-start_date',
    compress: 'on'
  });
  const state = listParam(filters.appState, APP_STATES);
  const type  = listParam(filters.appType, APP_TYPES);
  const size  = listParam(filters.appSize, APP_SIZES);
  if (state) params.set('app_state', state);
  if (type)  params.set('app_type', type);
  if (size)  params.set('app_size', size);
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.since ?? '')) params.set('start_date', filters.since);
  return params;
}

class PlanitError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function fetchPlanit(params) {
  const planitUrl = `${PLANIT_BASE}?${params}`;
  console.log('[planit] fetching:', planitUrl);

  const response = await fetch(planitUrl, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(30_000)
  });

  if (response.status === 429) {
    throw new PlanitError(429, 'PlanIt rate limit reached, please wait a moment and try again');
  }
  if (!response.ok) {
    const text = await response.text();
    console.error(`[planit] HTTP ${response.status} from PlanIt:`, text.slice(0, 500));
    throw new PlanitError(502, 'PlanIt API returned an error', text.slice(0, 500));
  }
  return response.json();
}

function sendPlanitError(res, err, fallback) {
  if (err instanceof PlanitError) {
    return res.status(err.status).json({ error: err.message, ...(err.detail ? { detail: err.detail } : {}) });
  }
  console.error(`${fallback}:`, err);
  res.status(500).json({ error: fallback, detail: err.message });
}

export async function searchPlanit(req, res) {
  const { keywords, lpa, pg_sz = '20', page = '1' } = req.query;

  if (!keywords?.trim()) {
    return res.status(400).json({ error: 'keywords is required' });
  }
  if (!lpa?.trim()) {
    return res.status(400).json({ error: 'lpa is required' });
  }

  try {
    const resolvedLpa = await resolveLpaName(lpa.trim());
    const params = buildSearchParams({
      lpa: resolvedLpa,
      keywords,
      filters: { appState: req.query.app_state, appType: req.query.app_type, appSize: req.query.app_size, since: req.query.since },
      pgSz: Math.min(Number(pg_sz) || 20, 100),
      page: Math.max(Number(page) || 1, 1)
    });

    const data = await fetchPlanit(params);
    if (data.records?.length) console.log('[planit] sample record keys:', Object.keys(data.records[0]));
    res.json({
      records: data.records || [],
      total: data.total ?? 0,
      from: data.from ?? 0,
      to: data.to ?? 0,
      lpa_used: resolvedLpa
    });
  } catch (err) {
    sendPlanitError(res, err, 'Search failed');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: AI triage
// POST /api/planit/projects/:projectId/triage
// Pulls a wide pool of PlanIt records for the keyword/LPA/filter search, then has
// an LLM judge each one against the user's written brief.
// ─────────────────────────────────────────────────────────────────────────────

const POOL_PAGE_SIZE = 100;
const POOL_MAX_RECORDS = 500;
const TRIAGE_BATCH = 40;
const TRIAGE_CONCURRENCY = 3;
const RELEVANT_FROM = 5;

/** Fetch up to POOL_MAX_RECORDS records, newest first, one page at a time to stay polite to PlanIt. */
async function fetchPool(baseArgs) {
  const records = [];
  let total = 0;
  for (let page = 1; records.length < POOL_MAX_RECORDS; page++) {
    const data = await fetchPlanit(buildSearchParams({ ...baseArgs, pgSz: POOL_PAGE_SIZE, page }));
    total = data.total ?? 0;
    const got = data.records || [];
    records.push(...got);
    if (got.length < POOL_PAGE_SIZE || records.length >= total) break;
    await new Promise(r => setTimeout(r, 300));
  }
  return { records: records.slice(0, POOL_MAX_RECORDS), total };
}

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function describeForTriage(r, i) {
  const o = r.other_fields || {};
  return [
    `#${i}`,
    clip(r.description, 400) || '(no description)',
    `Address: ${clip(r.address, 120) || '-'}`,
    `Type: ${r.app_type || '-'} | Size: ${r.app_size || '-'} | State: ${r.app_state || '-'}`,
    `Applicant: ${clip(o.applicant_company || o.applicant_address, 80) || '-'} | Agent: ${clip(o.agent_company || o.agent_address, 80) || '-'}`
  ].join('\n');
}

const TRIAGE_SYSTEM = `You are a UK planning consultant screening planning applications to find precedents for a live project.

You are given the project brief (written by the user) and a numbered batch of planning applications. Each has only a description of development, an address and some metadata. Judge how useful each is as a comparable scheme.

Score each from 0 to 10:
- 8-10: clearly the same kind of scheme as the brief, at a comparable scale where the description gives one
- 5-7: related or partly comparable (same technology but different scale, a variation, or a different stage such as a phased extension)
- 0-4: not comparable. Examples: householder or small domestic installations, rooftop or garden schemes when the brief is for a large ground-mounted scheme, discharge or variation of conditions, minor works, unrelated developments that only share a keyword

Rules:
- Use only what is given. Never assume scale, capacity or site details that the description does not state.
- Follow any instructions in the brief about what to include or avoid.
- Give each reason as ONE short plain sentence (under 25 words) saying why this application is, or is not, a useful comparable to the brief. For a relevant one, name what matches (kind of scheme, scale, setting) in your own words, for example "Ground-mounted 49.9MW solar farm with battery storage on agricultural land, close to the brief." For a poor one, say what rules it out, for example "Domestic rooftop panels on a house, not a utility-scale scheme."

Respond ONLY with JSON: {"results":[{"i":<number>,"score":<0-10>,"reason":"..."}]} with one entry for every application in the batch.`;

async function triageBatch(brief, batch) {
  const user = `PROJECT BRIEF:\n${brief}\n\nAPPLICATIONS:\n\n${batch.map(({ r, i }) => describeForTriage(r, i)).join('\n\n')}`;
  const out = parseJSON(await callClaude(TRIAGE_SYSTEM, user, MODEL_FAST, 4096));
  const byIndex = new Map();
  for (const x of out.results ?? []) byIndex.set(Number(x.i), x);
  return byIndex;
}

export async function triageSchemes(req, res) {
  const { keywords, lpa, brief, filters } = req.body ?? {};

  if (!keywords?.trim()) return res.status(400).json({ error: 'keywords is required' });
  if (!lpa?.trim())      return res.status(400).json({ error: 'lpa is required' });
  if (!brief?.trim())    return res.status(400).json({ error: 'Describe what you are looking for so the AI can judge the results' });

  try {
    const resolvedLpa = await resolveLpaName(String(lpa).trim());
    const { records, total } = await fetchPool({ lpa: resolvedLpa, keywords: String(keywords), filters: filters || {} });

    const indexed = records.map((r, i) => ({ r, i: i + 1 }));
    const batches = [];
    for (let k = 0; k < indexed.length; k += TRIAGE_BATCH) batches.push(indexed.slice(k, k + TRIAGE_BATCH));

    const verdicts = new Map();
    let failedBatches = 0;
    let next = 0;
    const worker = async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        try {
          const got = await triageBatch(clip(brief, 3000), batch);
          for (const [i, v] of got) verdicts.set(i, v);
        } catch (err) {
          if (/credit balance/i.test(err.message)) throw err;
          failedBatches++;
          console.warn('[planit] triage batch failed:', err.message);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(TRIAGE_CONCURRENCY, batches.length) }, worker));

    const scored = indexed.map(({ r, i }) => {
      const v = verdicts.get(i);
      const score = v ? Math.max(0, Math.min(10, Number(v.score) || 0)) : null;
      return { ...r, ai: { score, reason: v ? clip(v.reason, 220) : 'Not assessed', relevant: score !== null && score >= RELEVANT_FROM } };
    });
    scored.sort((a, b) => (b.ai.score ?? -1) - (a.ai.score ?? -1));

    res.json({
      records: scored,
      total,
      reviewed: scored.length,
      relevant: scored.filter(r => r.ai.relevant).length,
      failedBatches,
      lpa_used: resolvedLpa
    });
  } catch (err) {
    if (/credit balance/i.test(err.message)) {
      return res.status(503).json({ error: 'The AI provider is out of credit. Top up the Anthropic balance and try again.' });
    }
    sendPlanitError(res, err, 'AI search failed');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved schemes (picked from the results, shared by everyone on the project)
// GET    /api/planit/projects/:projectId/saved
// POST   /api/planit/projects/:projectId/saved        { schemes: [...] }
// DELETE /api/planit/projects/:projectId/saved?name=  (the PlanIt application name)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SAVED_PER_REQUEST = 100;

/** Keep only the fields we show, so nothing else from the browser is stored. */
function snapshotScheme(r) {
  return {
    name: clip(r.name, 200),
    description: clip(r.description, 2000),
    address: clip(r.address, 300),
    postcode: clip(r.postcode, 20),
    area_name: clip(r.area_name, 100),
    app_type: clip(r.app_type, 40),
    app_size: clip(r.app_size, 20),
    app_state: clip(r.app_state, 40),
    start_date: clip(r.start_date, 10),
    decided_date: clip(r.decided_date, 10),
    location_x: Number.isFinite(Number(r.location_x)) && r.location_x !== null ? Number(r.location_x) : null,
    location_y: Number.isFinite(Number(r.location_y)) && r.location_y !== null ? Number(r.location_y) : null,
    url: /^https?:\/\//i.test(r.url ?? '') ? clip(r.url, 1000) : '',
    reason: clip(r.ai?.reason ?? r.reason, 300)
  };
}

async function listSavedSchemes(projectId) {
  const { rows } = await pool.query(
    `SELECT data, saved_at FROM similar_schemes_saved WHERE project_id = $1 ORDER BY saved_at DESC, id DESC`,
    [projectId]
  );
  return rows.map(r => ({ ...r.data, saved_at: r.saved_at }));
}

export async function getSavedSchemes(req, res) {
  try {
    res.json({ schemes: await listSavedSchemes(Number(req.params.projectId)) });
  } catch (err) {
    console.error('getSavedSchemes error:', err);
    res.status(500).json({ error: 'Failed to load the saved schemes' });
  }
}

export async function saveSchemes(req, res) {
  const projectId = Number(req.params.projectId);
  const schemes = (Array.isArray(req.body?.schemes) ? req.body.schemes : [])
    .filter(r => r && typeof r.name === 'string' && r.name.trim())
    .slice(0, MAX_SAVED_PER_REQUEST)
    .map(snapshotScheme);
  if (!schemes.length) return res.status(400).json({ error: 'Choose at least one scheme to save' });

  try {
    for (const data of schemes) {
      await pool.query(
        `INSERT INTO similar_schemes_saved (project_id, planit_name, data, saved_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, planit_name) DO UPDATE SET data = EXCLUDED.data, saved_by = EXCLUDED.saved_by, saved_at = now()`,
        [projectId, data.name, data, req.user?.id ?? null]
      );
    }
    res.json({ schemes: await listSavedSchemes(projectId) });
  } catch (err) {
    console.error('saveSchemes error:', err);
    res.status(500).json({ error: 'Failed to save the schemes' });
  }
}

export async function removeSavedScheme(req, res) {
  const projectId = Number(req.params.projectId);
  const name = String(req.query.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    await pool.query(`DELETE FROM similar_schemes_saved WHERE project_id = $1 AND planit_name = $2`, [projectId, name]);
    res.json({ schemes: await listSavedSchemes(projectId) });
  } catch (err) {
    console.error('removeSavedScheme error:', err);
    res.status(500).json({ error: 'Failed to remove the scheme' });
  }
}
