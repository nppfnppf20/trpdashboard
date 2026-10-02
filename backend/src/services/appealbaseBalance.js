/**
 * Structured planning-balance entries for Appealbase analysis.
 *
 * The model records the inspector's own words for the level of harm and the weight given; this module
 * verifies those words against the decision text and maps them onto fixed scales in code, so entries are
 * comparable across decisions. Nothing is guessed: unstated levels and weights stay "not_stated".
 */

import { ISSUES } from './appealbaseScoring.js';

export const LEVELS = ['substantial', 'major', 'significant', 'moderate', 'minor', 'negligible', 'none']; // plus less_than_substantial
export const WEIGHTS = ['great', 'substantial', 'significant', 'moderate', 'limited', 'none'];

/** Map the inspector's wording for the level of harm onto the fixed scale. Order matters. */
export function mapLevel(wording = '') {
  const w = wording.toLowerCase();
  if (!w.trim()) return { level: 'not_stated', position: '' };
  if (/less than substantial/.test(w)) {
    const position = /(lower|low) (end|level)|low end|at the lower/.test(w) ? 'low' : /upper|higher|high end/.test(w) ? 'upper' : /medium|middle|moderate/.test(w) ? 'middle' : '';
    return { level: 'less_than_substantial', position };
  }
  if (/\bno (harm|adverse|material harm)|not (harm|cause harm)|preserve|neutral|\bnone\b/.test(w)) return { level: 'none', position: '' };
  if (/substantial/.test(w)) return { level: 'substantial', position: '' };
  if (/medium[- ]high|moderately high|medium to high/.test(w)) return { level: 'significant', position: '' };
  if (/\bmajor\b|\bsevere\b|\bhigh\b|very high|heavily/.test(w)) return { level: 'major', position: '' };
  if (/significant|considerable/.test(w)) return { level: 'significant', position: '' };
  if (/moderate|medium/.test(w)) return { level: 'moderate', position: '' };
  if (/negligible|marginal|nominal|very (limited|slight|small)|barely/.test(w)) return { level: 'negligible', position: '' };
  if (/minor|slight|low\b|limited|modest|lower end|low end/.test(w)) return { level: 'minor', position: '' };
  return { level: 'other', position: '' };
}

/** Map the inspector's wording for the weight given onto the fixed scale. Order matters. */
export function mapWeight(wording = '') {
  const w = wording.toLowerCase();
  if (!w.trim()) return 'not_stated';
  if (/\bno weight\b|neutral|not (a )?(benefit|weigh)/.test(w)) return 'none';
  if (/great (weight|importance)|considerable (importance|weight)|considerable|very heavily/.test(w)) return 'great';
  if (/substantial|very significant|overwhelming/.test(w)) return 'substantial';
  if (/significant/.test(w)) return 'significant';
  if (/moderate|some weight|medium/.test(w)) return 'moderate';
  if (/limited|little|modest|minor|minimal|slight|low\b|very limited/.test(w)) return 'limited';
  return 'other';
}

/** Prompt text describing the entry format (shared by the deep read, the agent and the enrichment pass). */
export const ENTRY_PROMPT = `BALANCE ENTRIES: list each harm and each benefit the inspector placed in the balance, as objects:
{ "side": "harm" | "benefit",
  "issue_id": "<one of the listed issue ids, or 'other'>",
  "description": "<max 12 words>",
  "level_wording": "<harms only: the inspector's exact words for how severe the harm is, e.g. 'less than substantial harm', 'moderate adverse', 'just above a medium level of harm on the less than substantial spectrum'; or '' if not stated>",
  "weight_wording": "<the inspector's exact words for the weight given, e.g. 'great weight', 'considerable importance and weight', 'significant weight', 'limited weight'; or '' if not stated>",
  "quote": "<exact span from the decision containing that wording, under 200 characters>",
  "para": "<paragraph number or ''>" }
RULES: copy the wording exactly from the decision. If the inspector does not state a level or a weight, leave that field empty; never infer one. Level of harm (how severe) and weight (how much it counts) are different things, so keep them in their own fields.`;

const ISSUE_IDS = new Set([...ISSUES.map(i => i.id), 'other']);

/**
 * Verify entries against the decision text and map wording onto the scales.
 * An entry is kept only if its quote or at least one wording phrase is found verbatim in the text.
 * @param {Array} entries raw model entries
 * @param {(q: string) => boolean} found verbatim finder (see appealbaseQuotes.makeFinder)
 */
export function processEntries(entries, found) {
  const kept = [];
  let dropped = 0;
  for (const e of entries ?? []) {
    const side = e.side === 'benefit' ? 'benefit' : e.side === 'harm' ? 'harm' : null;
    if (!side) {
      dropped++;
      continue;
    }
    const quoteOk = !!e.quote && found(e.quote);
    const levelOk = !!e.level_wording && found(e.level_wording);
    const weightOk = !!e.weight_wording && found(e.weight_wording);
    if (!quoteOk && !levelOk && !weightOk) {
      dropped++;
      continue;
    }
    const lv = side === 'harm' && levelOk ? mapLevel(e.level_wording) : { level: side === 'harm' ? 'not_stated' : '', position: '' };
    kept.push({
      side,
      issue_id: ISSUE_IDS.has(e.issue_id) ? e.issue_id : 'other',
      description: e.description || '',
      level: lv.level,
      level_position: lv.position,
      level_wording: levelOk ? e.level_wording : '',
      weight: weightOk ? mapWeight(e.weight_wording) : 'not_stated',
      weight_wording: weightOk ? e.weight_wording : '',
      quote: quoteOk ? e.quote : '',
      para: quoteOk || levelOk || weightOk ? e.para || '' : '',
    });
  }
  return { entries: kept, dropped };
}
