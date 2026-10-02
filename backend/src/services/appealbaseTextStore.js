/**
 * In-memory store of Appealbase decision text (and basic metadata), shared by the precedent agent and the chat.
 *
 * Licence: Appealbase terms forbid retaining their dataset, so decision text lives in process memory only, expires
 * after a few hours and is capped in size. It is never written to disk or the database.
 */

const TTL_MS = 3 * 60 * 60 * 1000;
const MAX_ENTRIES = 150;
const store = new Map(); // reference -> { text, meta, at }

function evict() {
  const cutoff = Date.now() - TTL_MS;
  for (const [k, v] of store) if (v.at < cutoff) store.delete(k);
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value); // Map keeps insertion order: oldest first
}

export function putText(reference, text, meta = {}) {
  store.delete(reference);
  store.set(reference, { text, meta, at: Date.now() });
  evict();
}

export function getText(reference) {
  const hit = store.get(reference);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(reference);
    return null;
  }
  return hit;
}

/** Get a decision's text from memory, or fetch it with the given Appealbase client (1+ calls) and keep it. */
export async function ensureText(appealbase, reference) {
  const hit = getText(reference);
  if (hit) return hit;
  const { appeal, text } = await appealbase.getAppealFullTextAll(reference);
  const meta = { lpa: appeal.lpa_name, date: appeal.decision_date, decision: appeal.decision, procedure: appeal.procedure };
  putText(reference, text, meta);
  return { text, meta, at: Date.now() };
}
