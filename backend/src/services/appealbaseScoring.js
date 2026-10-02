/**
 * Appealbase candidate gathering and scoring (Landulph / solar test configuration).
 *
 * gatherCandidates: one full-text search per issue (scheme variants any_of + issue phrase must_include).
 * scoreCandidates: verifies scheme type from the free `summary` header and ranks by weighted issue coverage.
 */

export const SINCE = '2023-01-01';
export const PAGE_SIZE = 100;

export const SCHEME_ANY_OF = ['solar farm', 'solar farms', 'solar park', 'solar array', 'solar arrays', 'photovoltaic'];
export const SCHEME_REGEX = /solar|photovoltaic|\bPV\b/i;

// One phrase per issue because the API allows a single any_of group (used for the scheme).
export const ISSUES = [
  { id: 'national_landscape', label: 'National Landscape', phrase: 'National Landscape', weight: 5 },
  { id: 'landscape', label: 'Landscape and visual', phrase: 'landscape and visual', weight: 3 },
  { id: 'heritage', label: 'Heritage assets', phrase: 'heritage assets', weight: 3 },
  { id: 'bmv_land', label: 'BMV agricultural land', phrase: 'best and most versatile', weight: 3 },
  { id: 'biodiversity', label: 'Biodiversity net gain', phrase: 'biodiversity net gain', weight: 2 },
  { id: 'flood', label: 'Flood risk', phrase: 'flood risk', weight: 2 },
  { id: 'renewable_need', label: 'Renewable energy benefits', phrase: 'renewable energy', weight: 1 },
];

export const PROJECT = {
  name: 'Landulph',
  scheme: 'ground-mounted solar farm',
  lpa: 'Cornwall',
  setting: 'within or near the Tamar Valley National Landscape',
  concerns:
    'Whether the scheme would harm the setting or special qualities of the Tamar Valley National Landscape, and how decision-makers weighed any such harm (plus landscape, heritage and agricultural land effects) against the benefits of renewable energy.',
};

export const issueListText = () =>
  ISSUES.map(i => `- ${i.id}: ${i.label} (weight ${i.weight}${i.weight === 5 ? ', PRIMARY' : ''})`).join('\n');

export function developmentProposed(summary = '') {
  // Headers wrap mid-sentence, descriptions can be long, and `summary` is cut at ~2000 chars,
  // so take up to 300 chars after the phrase and trim at the first sentence end if there is one.
  // Wording varies: "development proposed is", "development permitted is" (conditions appeals),
  // "proposal is for", "(is) described as".
  const m = summary.match(
    /(?:development\s+(?:proposed|permitted)|proposal)\s+(?:is|was|are)\s+(?:for\s+|described\s+as\s+)?([\s\S]{1,300})/i
  );
  if (!m) return null;
  const text = m[1].replace(/\s+/g, ' ').trim();
  const end = text.search(/\.\s|\n\n/);
  return end > 0 ? text.slice(0, end) : text;
}

/**
 * @returns {Promise<Map<string, { row: object, hits: Set<string>, snippets: Record<string, string[]> }>>}
 */
export async function gatherCandidates(client, { pages = 1, log = console.log } = {}) {
  const candidates = new Map();
  for (const issue of ISSUES) {
    for (let page = 1; page <= pages; page++) {
      try {
        const r = await client.searchAppeals({
          query: 'appeal',
          query_mode: 'structured_boolean',
          any_of: SCHEME_ANY_OF,
          must_include: [issue.phrase],
          date_from: SINCE,
          sort_by: 'relevance',
          pageSize: PAGE_SIZE,
          page,
        });
        log(`${issue.label}: page ${page}/${r.totalPages}, total ${r.totalCount}, got ${r.results.length}`);
        for (const row of r.results) {
          const c = candidates.get(row.reference) ?? { row, hits: new Set(), snippets: {} };
          c.hits.add(issue.id);
          c.snippets[issue.id] = row.snippets ?? [];
          candidates.set(row.reference, c);
        }
        if (page >= r.totalPages) break;
      } catch (e) {
        log(`${issue.label}: ERR ${e.message}`);
        break;
      }
    }
  }
  return candidates;
}

export function scoreCandidates(candidates) {
  const weightOf = Object.fromEntries(ISSUES.map(i => [i.id, i.weight]));
  return [...candidates.values()].map(({ row, hits, snippets }) => {
    const dev = developmentProposed(row.summary);
    return {
      reference: row.reference,
      lpa: row.lpa_name,
      decision: row.decision,
      date: row.decision_date,
      appealType: row.appeal_type,
      dev,
      schemeOk: dev ? SCHEME_REGEX.test(dev) : null,
      hits: [...hits],
      snippets,
      score: [...hits].reduce((s, h) => s + weightOf[h], 0),
      url: row.url,
    };
  });
}
