/**
 * Appealbase Controller
 * Proxies search + retrieve requests to the Appealbase REST API
 * (https://www.appealbase.com/docs/api-reference) so the API key stays
 * server-side. Manual precedent search for now, no project context yet.
 */

const APPEALBASE_BASE = 'https://www.appealbase.com';

// Fields the frontend is allowed to send through to Appealbase's search
// endpoint, mirrors the documented request body exactly, so an unknown
// field can't be smuggled through.
const SEARCH_FIELDS = [
  'query', 'appeal_type', 'lpa', 'decision', 'development_type', 'procedure',
  'inspector', 'is_section_78', 'date_from', 'date_to', 'date_preset',
  'created_after', 'query_mode', 'must_include', 'any_of', 'must_exclude',
  'exclude_query', 'exact_match', 'main_issues_only', 'sort_by', 'page', 'pageSize'
];

function pickFields(source, fields) {
  const out = {};
  for (const key of fields) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

async function appealbaseFetch(path, body) {
  const apiKey = process.env.APPEALBASE_API_KEY;
  if (!apiKey) {
    const err = new Error('Appealbase API key not configured');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const response = await fetch(`${APPEALBASE_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Appealbase returned ${response.status}`);
    err.status = response.status;
    err.limit = data.limit;
    throw err;
  }
  return data;
}

function handleAppealbaseError(err, res, fallbackMessage) {
  if (err.code === 'NO_API_KEY') {
    return res.status(503).json({ error: 'Appealbase API key not configured. Add APPEALBASE_API_KEY to the backend environment.' });
  }
  console.error(`[appealbase] ${fallbackMessage}:`, err);
  if (err.status === 429) {
    return res.status(429).json({ error: 'Appealbase monthly rate limit exceeded', limit: err.limit });
  }
  if (err.status === 404) {
    return res.status(404).json({ error: 'Appeal not found' });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  res.status(500).json({ error: fallbackMessage, detail: err.message });
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: Search appeals
// POST /api/appealbase/search
// ─────────────────────────────────────────────────────────────────────────────

export async function searchAppeals(req, res) {
  const body = pickFields(req.body || {}, SEARCH_FIELDS);

  // The API requires `query`. For pure filter/date searches with no keyword,
  // fall back to a near-universal term rather than reject the request.
  if (!body.query?.trim()) body.query = 'appeal';

  try {
    const data = await appealbaseFetch('/api/v1/search', body);
    res.json(data);
  } catch (err) {
    handleAppealbaseError(err, res, 'Search failed');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: Retrieve full decision text
// POST /api/appealbase/retrieve
// ─────────────────────────────────────────────────────────────────────────────

export async function retrieveAppeal(req, res) {
  const { reference } = req.body || {};
  if (!reference?.trim()) {
    return res.status(400).json({ error: 'reference is required' });
  }

  try {
    const data = await appealbaseFetch('/api/v1/retrieve', { reference: reference.trim() });
    res.json(data);
  } catch (err) {
    handleAppealbaseError(err, res, 'Retrieve failed');
  }
}
