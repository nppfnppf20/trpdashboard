/**
 * Verbatim Check Service
 *
 * A cheap, deterministic (non-LLM) check for whether text an LLM claims is
 * "verbatim from the source document" was actually said in that source —
 * used after conditions extraction to flag anything that looks paraphrased
 * before the user reviews it.
 *
 * Method: word-bigram containment. Rather than a sliding-window substring
 * search over the whole document (slow, and brittle against the line-wrap/
 * whitespace noise pdf-parse introduces), this checks what fraction of the
 * extracted field's word-bigrams also occur somewhere in the source
 * document's bigrams. It's order-independent and cheap, and in practice
 * catches paraphrasing well: rewritten text introduces bigrams that simply
 * aren't present anywhere in the source.
 *
 * What this does NOT catch: pdf-parse itself mis-reading the source PDF
 * (multi-column layout, tables, scanned pages). This check only verifies
 * the extraction matches the text pdf-parse actually returned — not that
 * pdf-parse's text matches the real document. That residual risk is a
 * matter for a human to check against the source document directly.
 */

const VERBATIM_THRESHOLD = 0.85;

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function toWords(text) {
  return normalize(text).split(' ').filter(Boolean);
}

function toBigrams(tokens) {
  const set = new Set();
  for (let i = 0; i < tokens.length - 1; i++) set.add(`${tokens[i]} ${tokens[i + 1]}`);
  return set;
}

/**
 * @param {string} extracted - a field the LLM claims is verbatim
 * @param {string} sourceText - the full raw parsed source document text
 * @returns {number} 0-1 fraction of extracted bigrams found in the source
 */
export function verbatimScore(extracted, sourceText) {
  const extractedTokens = toWords(extracted);
  if (extractedTokens.length === 0) return 1;
  if (extractedTokens.length === 1) {
    return normalize(sourceText).includes(extractedTokens[0]) ? 1 : 0;
  }
  const extractedBigrams = toBigrams(extractedTokens);
  const sourceBigrams = toBigrams(toWords(sourceText));
  let matched = 0;
  for (const bg of extractedBigrams) if (sourceBigrams.has(bg)) matched++;
  return matched / extractedBigrams.size;
}

/**
 * @returns {{ verified: boolean, score: number }} score rounded to 2dp
 */
export function checkVerbatim(extracted, sourceText) {
  if (!extracted || !extracted.trim()) return { verified: true, score: 1 };
  const score = Math.round(verbatimScore(extracted, sourceText) * 100) / 100;
  return { verified: score >= VERBATIM_THRESHOLD, score };
}

/**
 * Annotates an array of extracted conditions (as returned by
 * conditionsExtraction.service.js) with a `_verbatim` check per verbatim
 * field, without mutating the input.
 */
export function annotateConditionsVerbatim(conditions, sourceText) {
  return conditions.map(c => ({
    ...c,
    _verbatim: {
      wording: checkVerbatim(c.wording, sourceText),
      reason: checkVerbatim(c.reason, sourceText),
    },
    requirements: (c.requirements || []).map(r => ({
      ...r,
      _verbatim: checkVerbatim(r.requirement_text, sourceText),
    })),
  }));
}
