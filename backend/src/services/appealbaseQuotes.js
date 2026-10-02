/**
 * Quote verification for Appealbase analysis. Every quote an LLM returns must be found verbatim
 * in the source text (decision excerpts or full text); anything else is dropped by the caller.
 */

// Ignore quote marks, markdown emphasis and whitespace so only wording differences count as a mismatch.
export const norm = s => s.replace(/["'“”‘’`_*]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const stripEllipsis = s => s.replace(/^\.{3}|\.{3}$|^…|…$/g, '');

/** Returns a function: quote => true if the quote appears verbatim (after normalisation) in `text`. */
export function makeFinder(text) {
  const hay = norm(text);
  return q => !!q && hay.includes(norm(stripEllipsis(q)));
}
