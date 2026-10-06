// Per-project, in-memory session for the Appeal Precedent tab. It keeps a running search and its results alive while
// switching tabs; the tab also autosaves the results to the server (see AppealPrecedentTab) so a reload can restore them.
// The tab mutates the returned object directly (same reference every time), so state survives the tab unmounting.

const sessions = new Map(); // projectId -> session

export function newSession() {
  return {
    savedChecked: false, // the project's saved results have been looked up (and restored if there were any)
    restoredAt: null, // when the restored save was last written, if this session started from one
    suggested: false, // the optional "read the project" step has run (or been skipped)
    suggesting: false,
    suggestError: '',
    draftedFrom: '', // e.g. "2 meeting notes and 1 document (Notes)" when the setup was drafted from picked sources
    context: {
      scheme: '',
      setting: '',
      lpa: '',
      instructions: '',
      scale: { mw: '', units: '', hectares: '' },
      issues: [], // { label, weight, include }
      dateFrom: ''
    },
    options: { callCap: 40, maxRecords: 12 },
    phase: 'setup', // 'setup' | 'running' | 'results'
    keepResults: false, // next run adds to the current results instead of replacing them
    runId: null,
    status: '',
    error: '',
    stats: null,
    runIssues: [], // issues the current run used: { id, label, weight }
    progress: [],
    cursor: 0,
    baseRecords: [], // results carried over from earlier runs in this session
    records: [], // baseRecords merged with the current run's records
    selected: [], // ticked references
    messages: [] // chat: { role, content, citations? }
  };
}

export function getOrCreateSession(projectId) {
  if (!sessions.has(projectId)) sessions.set(projectId, newSession());
  return sessions.get(projectId);
}

export function clearSession(projectId) {
  sessions.delete(projectId);
}

/** Merge a run's records into existing ones, keeping the higher-rated version of any decision found twice. */
export function mergeRecords(existing, incoming) {
  const byRef = new Map(existing.map(r => [r.reference, r]));
  for (const r of incoming) {
    const prev = byRef.get(r.reference);
    if (!prev || r.relevance > prev.relevance) byRef.set(r.reference, r);
  }
  return [...byRef.values()].sort((a, b) => b.relevance - a.relevance || b.weightedCoverage - a.weightedCoverage);
}
