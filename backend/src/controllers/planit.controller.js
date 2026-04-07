/**
 * PlanIt Controller
 * Proxies searches to the UK PlanIt public API and uses Claude to generate
 * smart keyword suggestions based on the project's HLPV findings.
 */

import { pool } from '../db.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
      return `  - ${f.feature_type.replace(/_/g, ' ')}${grade}: ${f.feature_name || 'unnamed'} — ${loc}`;
    });
    return `${discipline.toUpperCase()}:\n${lines.join('\n')}`;
  }).join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: Suggest Keywords
// POST /api/planit/projects/:projectId/suggest-keywords
// ─────────────────────────────────────────────────────────────────────────────

export async function suggestKeywords(req, res) {
  const { projectId } = req.params;

  try {
    const ctx = await getProjectContext(projectId);
    if (!ctx) return res.status(404).json({ error: 'Project not found' });

    const { project, findings } = ctx;
    const sectors = [
      ...(project.sectors || []),
      ...(project.sub_sectors || [])
    ].join(', ') || project.project_type || 'renewable energy';

    const findingsSummary = buildFindingsSummary(findings);

    const prompt = `You are a UK planning consultant. A project team needs to search the PlanIt UK planning applications database to find similar precedent cases.

Project details:
- Name: ${project.project_name}
- Sector / type: ${sectors}
- Address: ${project.address || 'Not specified'}
- LPA: ${(project.local_planning_authority || []).join(', ') || 'Not specified'}
- Designations on site: ${project.designations_on_site || 'None recorded'}
- Relevant nearby designations: ${project.relevant_nearby_designations || 'None recorded'}
- Risk summary: Heritage=${project.heritage_risk || 'unknown'}, Landscape=${project.landscape_risk || 'unknown'}, Ecology=${project.ecology_risk || 'unknown'}

HLPV analysis findings:
${findingsSummary}

Generate 3 PlanIt search queries to find similar planning applications. The search runs against application description text only, so queries must use terms that actually appear in planning application descriptions — not designations or constraint names.

Rules:
- Use PlanIt's "or" operator to combine synonyms (e.g. "solar farm or photovoltaic or solar park")
- Focus purely on the development type — what words would appear in the description of a similar scheme
- Do not include constraint or designation terms (SSSI, listed building, AONB etc.) — those are searched separately
- First query: broadest synonyms for the development type
- Second query: more specific variant (e.g. sub-type, scale indicator like "ground mounted" or "utility scale")
- Third query: any closely related development type worth finding as precedent

Respond ONLY with valid JSON:
{
  "suggestions": [
    { "label": "Short readable label", "query": "planit search string using or operator" },
    { "label": "Short readable label", "query": "planit search string using or operator" },
    { "label": "Short readable label", "query": "planit search string using or operator" }
  ],
  "lpa": "the primary LPA name as it should be sent to PlanIt auth param"
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });

    const raw = message.content[0].text
      .replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(raw);

    // Fall back to the stored LPA if Claude didn't return one
    const lpa = parsed.lpa ||
      (project.local_planning_authority || [])[0] ||
      null;

    res.json({ suggestions: parsed.suggestions, lpa });
  } catch (err) {
    console.error('suggestKeywords error:', err);
    res.status(500).json({ error: 'Failed to generate keyword suggestions', detail: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: Search PlanIt
// GET /api/planit/projects/:projectId/search?keywords=X&lpa=Y&pg_sz=20&page=1
// ─────────────────────────────────────────────────────────────────────────────

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

    const params = new URLSearchParams({
      auth:     resolvedLpa,
      search:   keywords.trim(),
      pg_sz:    String(Math.min(Number(pg_sz) || 20, 100)),
      page:     String(Math.max(Number(page) || 1, 1)),
      compress: 'on'
    });

    const planitUrl = `${PLANIT_BASE}?${params}`;
    console.log('[planit] fetching:', planitUrl);

    const response = await fetch(planitUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(30_000)
    });

    if (response.status === 429) {
      return res.status(429).json({ error: 'PlanIt rate limit reached — please wait a moment and try again' });
    }
    if (!response.ok) {
      const text = await response.text();
      console.error(`[planit] HTTP ${response.status} from PlanIt:`, text.slice(0, 500));
      return res.status(502).json({ error: 'PlanIt API returned an error', status: response.status, detail: text.slice(0, 500) });
    }

    const data = await response.json();
    if (data.records?.length) console.log('[planit] sample record keys:', Object.keys(data.records[0]));
    res.json({
      records: data.records || [],
      total: data.total ?? 0,
      from: data.from ?? 0,
      to: data.to ?? 0,
      lpa_used: resolvedLpa
    });
  } catch (err) {
    console.error('searchPlanit error:', err);
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
}
