// Display helpers for appeal precedent results: names and colour classes for level of harm, weight, outcome and scale.

export const LEVEL_NAME = {
  less_than_substantial: 'Less than substantial',
  substantial: 'Substantial',
  major: 'Major',
  significant: 'Significant',
  moderate: 'Moderate',
  minor: 'Minor',
  negligible: 'Negligible',
  none: 'No harm'
};
export const WEIGHT_NAME = { great: 'Great', substantial: 'Substantial', significant: 'Significant', moderate: 'Moderate', limited: 'Limited', none: 'None' };

const LEVEL_CLASS = { substantial: 'high', major: 'high', significant: 'high', less_than_substantial: 'mid', moderate: 'mid' };
const WEIGHT_CLASS = { great: 'high', substantial: 'high', significant: 'mid', moderate: 'mid' };

/** { text, tone } for a harm entry's level of harm; tone is 'high' | 'mid' | 'low' | 'muted'. */
export function levelChip(e) {
  if (e.side !== 'harm') return { text: 'n/a', tone: 'muted' };
  if (e.level === 'not_stated') return { text: 'Not stated', tone: 'muted' };
  if (e.level === 'other') return { text: e.level_wording, tone: 'low' };
  const pos = e.level_position ? ` (${e.level_position})` : '';
  return { text: (LEVEL_NAME[e.level] ?? e.level) + pos, tone: LEVEL_CLASS[e.level] ?? 'low' };
}

export function weightChip(e) {
  if (e.weight === 'not_stated') return { text: 'Not stated', tone: 'muted' };
  if (e.weight === 'other') return { text: e.weight_wording, tone: 'low' };
  return { text: WEIGHT_NAME[e.weight] ?? e.weight, tone: WEIGHT_CLASS[e.weight] ?? 'low' };
}

export const TREATMENT_NAME = { substantive: 'Decided', mentioned: 'Mentioned', not_addressed: 'Not addressed' };
export const EFFECT_NAME = { harm: 'Harm', no_harm: 'No harm', neutral: 'Neutral', unclear: '' };

export function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(d).slice(0, 10);
  }
}

/** Short label for the scale comparison, e.g. "6 MW vs your 30 MW (5x smaller)". Empty when unknown. */
export function scaleLabel(rec) {
  const c = rec.scaleCheck;
  if (!c || c.level === 'unknown') return '';
  const r = c.ratio;
  const rel = r < 1 ? `${(1 / r).toFixed(r < 0.2 ? 0 : 1)}x smaller` : r > 1 ? `${r.toFixed(r > 5 ? 0 : 1)}x larger` : 'same size';
  return `${c.precedent} ${c.metric} vs your ${c.project} ${c.metric} (${rel})`;
}
