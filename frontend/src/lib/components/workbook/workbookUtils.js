// @ts-nocheck
// Shared constants and pure helpers for the Project Workbook (Beta) page.

export const STATUSES = ['not started', 'in progress', 'completed'];
export const SOURCES = ['Note', 'Meeting notes', 'Email', 'Phone call', 'Site visit'];
export const TYPE_LABEL = { risk: 'Risk', action: 'Action', issue: 'Issue', decision: 'Decision' };

// Singular / plural wording for the Linked with chips and popup headings.
export const LK = {
  gate: ['gate ref', 'gate refs'],
  risk: ['risk', 'risks'],
  action: ['action', 'actions'],
  issue: ['issue', 'issues'],
  decision: ['decision', 'decisions'],
};
export const LINK_ORDER = ['gate', 'risk', 'action', 'issue', 'decision'];

// What can be added from the + in the Linked with popup, by the type of row it was opened on.
export const ADD_TYPES = {
  gate: ['risk', 'action', 'issue', 'decision'],
  risk: ['action', 'issue'],
  action: ['issue'],
  issue: [],
  decision: [],
};

export const today = () => new Date().toISOString().slice(0, 10);
export const isOpen = i => i.status !== 'completed';
export const isOverdue = i => i.type !== 'decision' && isOpen(i) && !!i.target && i.target < today();

export function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function fmtLong(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const typeLabelPlural = t => (LK[t] ? LK[t][1] : t + 's');

// Svelte action: grow a textarea to fit its text. Pass the bound value so it refits when the value changes.
export function autosize(node, _value) {
  const fit = () => {
    node.style.height = 'auto';
    node.style.height = node.scrollHeight + 2 + 'px';
  };
  fit();
  node.addEventListener('input', fit);
  return {
    update: fit,
    destroy() { node.removeEventListener('input', fit); },
  };
}

// Progress log: newest first.
export function sortedLog(item) {
  return [...(item.log || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
}

export function latestEntry(item) {
  return sortedLog(item)[0] || null;
}

// "G2 3.8.1" style references. A risk takes its first gate ref plus a running number; an action under a risk
// takes the risk's ref plus a running number. Anything else gets a plain type + number (A7, I2, D1).
export function computeRefs(items, gateNo = 2) {
  const refs = {};
  const byType = t => items.filter(i => i.type === t).sort((a, b) => a.seq - b.seq);
  const riskCount = {};
  for (const r of byType('risk')) {
    const g = r.gate_refs?.[0];
    if (g) {
      riskCount[g] = (riskCount[g] || 0) + 1;
      refs[r.id] = `G${gateNo} ${g}.${riskCount[g]}`;
    } else {
      refs[r.id] = `R${r.seq}`;
    }
  }
  const actionCount = {};
  for (const a of byType('action')) {
    const p = refs[a.parent_id];
    if (p) {
      actionCount[p] = (actionCount[p] || 0) + 1;
      refs[a.id] = `${p}.${actionCount[p]}`;
    } else {
      refs[a.id] = `A${a.seq}`;
    }
  }
  for (const i of byType('issue')) refs[i.id] = `I${i.seq}`;
  for (const d of byType('decision')) refs[d.id] = `D${d.seq}`;
  return refs;
}

// Everything linked to a gate question or to an item, grouped by type.
//   kind 'gate': id is the gate question's id
//   kind 'item': id is the item's id
export function linksOf(gate, items, kind, id) {
  const out = { gate: [], risk: [], action: [], issue: [], decision: [] };
  const gateByRef = ref => gate.find(g => g.ref === ref);
  const ofType = t => items.filter(i => i.type === t).sort((a, b) => a.seq - b.seq);

  if (kind === 'gate') {
    const g = gate.find(x => x.id === id);
    if (!g) return out;
    out.risk = ofType('risk').filter(r => (r.gate_refs || []).includes(g.ref));
    const riskIds = new Set(out.risk.map(r => r.id));
    out.action = ofType('action').filter(a => riskIds.has(a.parent_id) || (a.gate_refs || []).includes(g.ref));
    const parentIds = new Set([...riskIds, ...out.action.map(a => a.id)]);
    out.issue = ofType('issue').filter(i => parentIds.has(i.parent_id) || (i.gate_refs || []).includes(g.ref));
    out.decision = ofType('decision').filter(d => (d.gate_refs || []).includes(g.ref));
    return out;
  }

  const it = items.find(x => x.id === id);
  if (!it) return out;
  out.gate = (it.gate_refs || []).map(gateByRef).filter(Boolean);
  const parent = items.find(x => x.id === it.parent_id);
  if (parent) out[parent.type].push(parent);
  if (it.type === 'risk') out.action = ofType('action').filter(a => a.parent_id === it.id);
  if (it.type === 'risk' || it.type === 'action') out.issue = ofType('issue').filter(i => i.parent_id === it.id);
  return out;
}

export function addTypesFor(items, kind, id) {
  if (kind === 'gate') return ADD_TYPES.gate;
  const it = items.find(x => x.id === id);
  return it ? ADD_TYPES[it.type] : [];
}

export function linkCounts(gate, items, kind, id) {
  const l = linksOf(gate, items, kind, id);
  return LINK_ORDER.filter(t => l[t].length).map(t => ({ type: t, count: l[t].length, label: `${l[t].length} ${LK[t][l[t].length === 1 ? 0 : 1]}` }));
}

// Parent choices for the Parent dropdown / new-item form.
export function parentOptions(type, items, refs) {
  const label = i => `${refs[i.id] || ''} ${i.subject}`.trim();
  const sorted = t => items.filter(i => i.type === t).sort((a, b) => a.seq - b.seq);
  if (type === 'action') return [{ value: '', label: 'None (floating action)' }, ...sorted('risk').map(r => ({ value: String(r.id), label: label(r) }))];
  if (type === 'issue') return [{ value: '', label: 'None' }, ...sorted('action').map(a => ({ value: String(a.id), label: label(a) })), ...sorted('risk').map(r => ({ value: String(r.id), label: label(r) }))];
  return [];
}

// Things worth a look: overdue or unowned items, priority 1 not started, open risks with no open action,
// low-scoring gate questions with nothing linked, and actions with no progress for two weeks.
export function computeFlags(gate, items, refs) {
  const out = [];
  const t = today();
  for (const i of items.filter(x => x.type !== 'decision' && isOpen(x))) {
    const r = refs[i.id] || '';
    const name = `${r} ${i.subject}`.trim();
    if (i.target && i.target < t) out.push({ sev: 'hi', tab: i.type, msg: `${name} was due ${fmtShort(i.target)}.` });
    if (!i.owner) out.push({ sev: 'mid', tab: i.type, msg: `${name} has no owner.` });
    if (!i.target && i.type !== 'issue') out.push({ sev: 'lo', tab: i.type, msg: `${name} has no target date.` });
    if (i.type === 'action') {
      const last = (latestEntry(i) || {}).date || i.raised;
      if (last && (Date.parse(t) - Date.parse(last)) / 864e5 > 14) out.push({ sev: 'lo', tab: 'action', msg: `${name} has had no progress logged since ${fmtShort(last)}.` });
    }
    if (i.priority === 1 && i.status === 'not started') out.push({ sev: 'mid', tab: i.type, msg: `${name} is priority 1 but not started.` });
  }
  for (const r of items.filter(x => x.type === 'risk' && isOpen(x))) {
    if (!items.some(a => a.type === 'action' && isOpen(a) && a.parent_id === r.id)) {
      out.push({ sev: 'mid', tab: 'risk', msg: `${refs[r.id] || ''} ${r.subject} is an open risk with no open action.`.trim() });
    }
  }
  for (const g of gate.filter(x => x.score <= 2)) {
    const hasAction = linksOf(gate, items, 'gate', g.id).action.some(isOpen);
    if (!hasAction) out.push({ sev: 'mid', tab: 'gate', msg: `Gate question ${g.ref} scores ${g.score} and has no open action linked to it.` });
  }
  const order = { hi: 0, mid: 1, lo: 2 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]);
}
