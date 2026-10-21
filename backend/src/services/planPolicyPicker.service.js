/**
 * Plan Policy Picker service.
 *
 * Lets a user upload a full development plan (far larger than a model's
 * context window) and pick out specific policies verbatim. Three stages:
 *
 *   1. identifyPlan       — one small call on the cover/front matter: what is
 *                           this document and where does it sit in Relevant
 *                           Documents (adopted / emerging / supplementary / other).
 *   2. buildPolicyIndex   — a map of where each policy starts and ends in the
 *                           text. Regex over heading lines first (free, exact),
 *                           an LLM pass over sequential batches only if the
 *                           plan's headings don't follow a recognisable pattern.
 *   3. extractSelectedPolicies — for each chosen policy, only that policy's
 *                           section is sent to the model, which returns short
 *                           ANCHORS (first/last words) rather than the full
 *                           wording. The wording is then sliced out of the real
 *                           text, so it is verbatim by construction; the
 *                           bigram check from verbatimCheck.service.js is kept
 *                           as an independent second opinion.
 *
 * Policy wording is kept distinct from supporting text ("Reasoned
 * Justification" etc.): the model returns anchors for both.
 */

import { callClaude, parseJSON, MODEL_SONNET, buildSequentialBatches } from './llm.shared.js';
import { checkVerbatim } from './verbatimCheck.service.js';

const MAX_SECTION_CHARS = 30000;
const MIN_REGEX_INDEX_ENTRIES = 3;
const SECTION_VALUES = new Set(['adopted', 'emerging', 'supplementary', 'other']);
const PLAN_TYPE_VALUES = new Set(['local', 'neighbourhood']);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Plan identification
// ─────────────────────────────────────────────────────────────────────────────

const IDENTIFY_SYSTEM = `You are a specialist planning consultant. You are shown the opening pages (and a short closing extract) of a planning-related document and must say what it is, so it can be filed in a project's "Relevant Documents" list. \
Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

const IDENTIFY_PROMPT = `Identify this document from its front matter.

<document_start>
{{START}}
</document_start>

<document_end>
{{END}}
</document_end>

Respond ONLY with valid JSON, no markdown fences:
{
  "plan_name": "the document's full title as it appears, e.g. 'Anytown District Local Plan 2018-2036'",
  "section": "adopted | emerging | supplementary | other",
  "plan_type": "local | neighbourhood | null",
  "year_adopted": 2021,
  "month_adopted": null,
  "authority": "the issuing authority, or null",
  "summary": "one or two plain sentences saying what the document is and covers",
  "placement_reason": "one sentence saying why you chose that section, quoting the evidence (e.g. 'Cover says Adopted March 2021')",
  "confidence": "high | medium | low"
}

Section guide:
- adopted: an adopted/made Local Plan, Core Strategy, or Neighbourhood Plan.
- emerging: a draft / submission / Regulation 18 or 19 / examination-stage Local or Neighbourhood Plan not yet adopted/made.
- supplementary: an SPD, SPG, design guide, or similar guidance.
- other: anything else (national guidance, technical standard, strategy, evidence base).
plan_type is only for adopted/emerging; otherwise null. year_adopted/month_adopted are the adoption/made/publication date if stated (null if the plan is emerging or no date is given; never guess).`;

/**
 * @returns {Promise<{plan_name:string, section:string, plan_type:string|null, year_adopted:number|null,
 *   month_adopted:number|null, authority:string|null, summary:string, placement_reason:string, confidence:string}>}
 */
export async function identifyPlan(rawText) {
  const start = rawText.slice(0, 9000);
  const end = rawText.length > 14000 ? rawText.slice(-2000) : '';
  const prompt = IDENTIFY_PROMPT.replace('{{START}}', start).replace('{{END}}', end || '(not provided)');
  const raw = await callClaude(IDENTIFY_SYSTEM, prompt, MODEL_SONNET, 1500);
  const p = parseJSON(raw);

  const section = SECTION_VALUES.has(p.section) ? p.section : 'other';
  const month = Number.isInteger(p.month_adopted) && p.month_adopted >= 1 && p.month_adopted <= 12 ? p.month_adopted : null;
  return {
    plan_name: typeof p.plan_name === 'string' ? p.plan_name.trim() : '',
    section,
    plan_type: (section === 'adopted' || section === 'emerging') && PLAN_TYPE_VALUES.has(p.plan_type) ? p.plan_type : null,
    year_adopted: Number.isInteger(p.year_adopted) && section !== 'emerging' ? p.year_adopted : null,
    month_adopted: section !== 'emerging' ? month : null,
    authority: typeof p.authority === 'string' && p.authority.trim() ? p.authority.trim() : null,
    summary: typeof p.summary === 'string' ? p.summary.trim() : '',
    placement_reason: typeof p.placement_reason === 'string' ? p.placement_reason.trim() : '',
    confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'medium',
  };
}

// Suggests an existing Relevant Documents row this upload probably is, so the
// user can add policies to it rather than creating a duplicate.
const nameTokens = s => new Set((s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1));

export function findExistingPlanMatch(planName, existingDocs) {
  const target = nameTokens(planName);
  if (!target.size) return null;
  let best = null;
  let bestScore = 0;
  for (const doc of existingDocs) {
    const cand = nameTokens(doc.plan_name);
    if (!cand.size) continue;
    let shared = 0;
    for (const t of target) if (cand.has(t)) shared++;
    const score = shared / Math.min(target.size, cand.size);
    if (score > bestScore) { bestScore = score; best = doc; }
  }
  return bestScore >= 0.7 ? best : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Policy index
// ─────────────────────────────────────────────────────────────────────────────

const normRef = ref => (ref || '').toUpperCase().replace(/^POLICY\s+/, '').replace(/[\s\-_.]/g, '');

// "Policy DM4: Design Quality", "POLICY H1 – Housing", "Policy 12"
const POLICY_LINE = /^(?:policy|policies)\s+((?:[A-Z]{1,6}[\s\-]?)?\d{1,3}[A-Za-z]?(?:\.\d{1,2})?)\s*[:\-–—.)]*\s*(.*)$/i;
// "DM4: Design Quality", "H1 - Housing", "GA2. Green Space" (needs a separator and a capitalised title)
const REF_TITLE_LINE = /^([A-Z]{1,6}[\s\-]?\d{1,3}[a-z]?)\s*[:\-–—.]\s*([A-Z].{2,100})$/;
const TOC_LINE = /(?:\.{3,}|\s{2,}|\t)\s*\d{1,3}\s*$|\s\d{1,3}$/;

function lineLooksLikeSentence(text) {
  const words = text.split(/\s+/).length;
  return words > 14 || (/[.;]$/.test(text) && words > 8);
}

function candidateFromLine(line, nextLine) {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 140) return null;

  let m = trimmed.match(POLICY_LINE);
  let reference;
  let name;
  if (m) {
    reference = `Policy ${m[1].replace(/\s+/g, ' ').trim().toUpperCase()}`;
    name = m[2].trim();
    if (!name && nextLine) {
      const next = nextLine.trim();
      if (next && next.length < 100 && /^[A-Z0-9]/.test(next) && !lineLooksLikeSentence(next)) name = next;
    }
  } else {
    m = trimmed.match(REF_TITLE_LINE);
    if (!m) return null;
    reference = m[1].replace(/\s+/g, ' ').trim();
    name = m[2].trim();
  }

  const isToc = TOC_LINE.test(trimmed);
  const cleanName = name.replace(/(?:\.{2,}|\s{2,}|\t)\s*\d{1,3}\s*$/, '').replace(/\s\d{1,3}$/, '').trim();
  if (lineLooksLikeSentence(cleanName || trimmed)) return null;
  // "Policy DM4 states that…" mid-sentence references that start a line
  if (/^(states|requires|sets|seeks|will|is|are|and|or|of|in|for|to|says|provides)\b/i.test(cleanName)) return null;

  return { reference, name: cleanName, heading: trimmed, isToc };
}

/**
 * Regex pass. Returns the entries in document order with [start, end) offsets
 * into rawText; each policy's section ends where the next policy heading starts.
 */
export function buildRegexIndex(rawText) {
  const candidates = [];
  const lines = [];
  let offset = 0;
  for (const text of rawText.split('\n')) {
    lines.push({ text, offset });
    offset += text.length + 1;
  }

  for (let i = 0; i < lines.length; i++) {
    const c = candidateFromLine(lines[i].text, lines[i + 1]?.text);
    if (c) candidates.push({ ...c, start: lines[i].offset });
  }
  return finaliseIndex(candidates, rawText.length);
}

// Turns raw heading candidates into the final per-policy index: removes
// contents-page duplicates by keeping, for each reference, the candidate with
// the longest section, then closes each section at the next kept heading.
function finaliseIndex(candidates, textLength) {
  candidates.sort((a, b) => a.start - b.start);
  const spanOf = new Map();
  candidates.forEach((c, i) => {
    spanOf.set(c, (candidates[i + 1]?.start ?? textLength) - c.start);
  });

  const bestByRef = new Map();
  for (const c of candidates) {
    const key = normRef(c.reference);
    const prev = bestByRef.get(key);
    const score = (c.isToc ? 0 : 1_000_000) + spanOf.get(c);
    const prevScore = prev ? (prev.isToc ? 0 : 1_000_000) + spanOf.get(prev) : -1;
    if (score > prevScore) bestByRef.set(key, c);
  }

  const kept = [...bestByRef.values()].sort((a, b) => a.start - b.start);
  return kept.map((c, i) => ({
    id: i + 1,
    reference: c.reference,
    name: c.name,
    heading: c.heading,
    start: c.start,
    end: kept[i + 1]?.start ?? textLength,
  }));
}

const INDEX_SYSTEM = `You are indexing a development plan document. List every planning policy heading that appears in the section you are given. \
Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

const INDEX_PROMPT = `Below is one section of a development plan (other sections are sent separately). List every distinct POLICY HEADING in it: the line that introduces a policy (e.g. "Policy DM4: Design Quality", "H1 Housing Mix", or a boxed policy title). Do NOT list contents-page lines, paragraph cross-references, or supporting-text headings like "Reasoned Justification".

<document>
{{DOCUMENT}}
</document>

Respond ONLY with valid JSON, no markdown fences:
{ "policies": [ { "reference": "Policy DM4 (as shown, or null)", "name": "Design Quality", "heading_line": "the heading line copied EXACTLY as it appears in the text" } ] }
Return { "policies": [] } if there are none.`;

async function buildLlmIndex(rawText) {
  const { batches, warningMessage } = buildSequentialBatches(rawText);
  const candidates = [];
  let searchFrom = 0;
  let failed = 0;

  for (const batch of batches) {
    let parsed;
    try {
      parsed = parseJSON(await callClaude(INDEX_SYSTEM, INDEX_PROMPT.replace('{{DOCUMENT}}', batch), MODEL_SONNET, 6000));
    } catch (err) {
      console.error('[planPolicyPicker] LLM index batch failed:', err.message);
      failed++;
      continue;
    }
    for (const p of (Array.isArray(parsed.policies) ? parsed.policies : [])) {
      const heading = typeof p.heading_line === 'string' ? p.heading_line.trim() : '';
      if (!heading || !p.name?.trim()) continue;
      let at = rawText.indexOf(heading, searchFrom);
      if (at === -1) at = rawText.indexOf(heading);
      if (at === -1) continue;
      searchFrom = at;
      candidates.push({
        reference: p.reference?.trim() || '',
        name: p.name.trim(),
        heading,
        isToc: false,
        start: at,
      });
    }
  }

  const warning = [
    warningMessage,
    failed ? `${failed} of ${batches.length} section(s) could not be indexed, so some policies may be missing from the list.` : null,
  ].filter(Boolean).join(' ') || null;
  return { entries: finaliseIndex(dedupeByStart(candidates), rawText.length), warning };
}

function dedupeByStart(candidates) {
  const seen = new Set();
  return candidates.filter(c => (seen.has(c.start) ? false : (seen.add(c.start), true)));
}

/**
 * @returns {Promise<{ entries: Array<{id:number, reference:string, name:string, heading:string, start:number, end:number}>,
 *   method: 'regex'|'llm', warning: string|null }>}
 */
export async function buildPolicyIndex(rawText) {
  const regexEntries = buildRegexIndex(rawText);
  if (regexEntries.length >= MIN_REGEX_INDEX_ENTRIES) {
    return { entries: regexEntries, method: 'regex', warning: null };
  }
  const { entries, warning } = await buildLlmIndex(rawText);
  return { entries, method: 'llm', warning };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Targeted, anchor-based verbatim extraction
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are a specialist planning consultant locating the exact boundaries of one planning policy inside a section of a development plan, so its wording can be copied out of the source text programmatically. \
You do NOT reproduce the policy. You return short ANCHORS: the first words and the last words of the operative policy wording, and of any supporting text, copied character for character from the text you are given. \
Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

const EXTRACT_PROMPT = `Locate policy "{{POLICY}}" in the text below.

Two kinds of text sit around a policy and MUST be kept apart:
- POLICY WORDING: the operative, normative text of the policy itself ("Development will be permitted where...", the lettered or numbered criteria, "The Council will..."). In many plans it is in a coloured or shaded box, or set in bold; that formatting is lost in this plain text, so judge by content and position. It begins directly under the policy's heading and ends before the explanatory material starts.
- SUPPORTING TEXT: everything explanatory: "Reasoned Justification", "Supporting Text", "Explanation", "Justification", "Background", "Implementation", introductory paragraphs, and numbered paragraphs (e.g. 4.12, 4.13) that explain the policy. This is not policy wording.
{{HINT}}
How to give anchors:
- policy_start: the first 8 to 12 words of the policy wording, copied EXACTLY (same words, order, punctuation, capitalisation). Do not include the heading line unless it is part of the wording itself.
- policy_end: the last 8 to 12 words of the policy wording, copied EXACTLY. If the wording is shorter than 12 words, copy all of it into both.
- supporting_start / supporting_end: the same for the supporting text that belongs to this policy, or null for both if there is none in this text.
- Never paraphrase or tidy anything inside an anchor. Never join words from different places.
- The policy wording must end before the heading of the next policy, if that appears in the text.
- If this policy's wording is not in the text (e.g. only a contents entry or a cross-reference), return null for every anchor.

<text>
{{SECTION}}
</text>

Respond ONLY with valid JSON, no markdown fences:
{
  "policy_start": "exact first words, or null",
  "policy_end": "exact last words, or null",
  "supporting_start": "exact first words, or null",
  "supporting_end": "exact last words, or null",
  "distinguished_by": "box | heading | paragraph_numbering | layout | unclear",
  "confidence": "high | medium | low",
  "note": "one short sentence only if something is ambiguous (e.g. policy and supporting text are interleaved), else empty"
}`;

const HINTS = {
  boxed: 'The user says: in this plan the policy wording sits in a coloured or shaded box (so it is the text immediately under the heading, before the unboxed explanatory paragraphs).',
  numbered_paras: 'The user says: in this plan the supporting text is made of numbered paragraphs (e.g. 4.12), while the policy wording is NOT numbered that way (it is usually lettered/bulleted criteria).',
  bold: 'The user says: in this plan the policy wording is set in bold; the supporting text is normal weight.',
  headings: 'The user says: in this plan the supporting text sits under an explicit sub-heading (e.g. "Reasoned Justification"); the policy wording is everything before it.',
};

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whitespace-, quote- and dash-tolerant regex for an anchor phrase.
function anchorRegex(anchor, { fromWords = null } = {}) {
  let words = anchor.trim().split(/\s+/).filter(Boolean);
  if (fromWords) words = words.slice(0, fromWords);
  if (!words.length) return null;
  const pattern = words
    .map(w => escapeRegExp(w)
      .replace(/['‘’]/g, "['‘’]")
      .replace(/["“”]/g, '["“”]')
      .replace(/[-–—]/g, '[-–—]'))
    .join('\\s+');
  return new RegExp(pattern, 'i');
}

function findAnchor(section, anchor, fromIndex = 0, opts = {}) {
  if (!anchor || typeof anchor !== 'string') return null;
  const re = anchorRegex(anchor, opts);
  if (!re) return null;
  const m = re.exec(section.slice(fromIndex));
  if (!m) return null;
  return { start: fromIndex + m.index, end: fromIndex + m.index + m[0].length };
}

// Returns [start, end) of a located span, trying the full start anchor and
// then a shorter prefix (models occasionally mis-copy the tail of a long anchor).
function locateSpan(section, startAnchor, endAnchor) {
  const s = findAnchor(section, startAnchor) || findAnchor(section, startAnchor, 0, { fromWords: 5 });
  if (!s) return null;
  const e = findAnchor(section, endAnchor, s.start) || findAnchor(section, endAnchor, s.start, { fromWords: 5 });
  if (!e) return null;
  return { start: s.start, end: e.end };
}

// pdf-parse returns hard line breaks mid-sentence. Rejoin those (keeping
// paragraph breaks and list items) so stored wording reads as written. Only
// whitespace changes; no characters are added or removed.
export function reflow(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/([^\n])\n(?!\n)(?!\s*(?:\(?[a-zA-Z0-9]{1,3}[.)]\s|[•▪●\-–—*]\s|\(?[ivxIVX]{1,5}\)\s))/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const wsNorm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * @param {string} rawText full parsed plan text
 * @param {Array<{id:number, reference:string, name:string, start:number, end:number}>} selections
 * @param {{ hint?: string, hintNote?: string }} [opts]
 * @returns {Promise<Array<{ id:number, reference:string, name:string, status:'ok'|'not_found'|'failed',
 *   wording:string|null, supporting_text:string|null, verbatim:{verified:boolean,score:number,exact:boolean}|null,
 *   distinguished_by:string|null, confidence:string|null, note:string, section_text:string|null }>>}
 */
export async function extractSelectedPolicies(rawText, selections, { hint = '', hintNote = '' } = {}) {
  const hintText = [HINTS[hint], hintNote?.trim() ? `Further note from the user: ${hintNote.trim()}` : '']
    .filter(Boolean).join('\n');
  const hintBlock = hintText ? `\n${hintText}\n` : '';

  const results = [];
  // Sequential keeps rate-limit pressure low; each call is small (one policy's section).
  for (const sel of selections) {
    const sectionEnd = Math.min(sel.end, sel.start + MAX_SECTION_CHARS);
    const section = rawText.slice(sel.start, sectionEnd);
    const label = `${sel.reference ? `${sel.reference}: ` : ''}${sel.name}`;
    const base = { id: sel.id, reference: sel.reference, name: sel.name };

    let parsed;
    try {
      const prompt = EXTRACT_PROMPT
        .replace('{{POLICY}}', label)
        .replace('{{HINT}}', hintBlock)
        .replace('{{SECTION}}', section);
      parsed = parseJSON(await callClaude(EXTRACT_SYSTEM, prompt, MODEL_SONNET, 1500));
    } catch (err) {
      console.error(`[planPolicyPicker] extraction failed for ${label}:`, err.message);
      results.push({ ...base, status: 'failed', wording: null, supporting_text: null, verbatim: null, distinguished_by: null, confidence: null, note: 'The AI call failed for this policy. Try again or paste the wording manually.', section_text: section.slice(0, 6000) });
      continue;
    }

    const span = locateSpan(section, parsed.policy_start, parsed.policy_end);
    if (!span) {
      results.push({ ...base, status: 'not_found', wording: null, supporting_text: null, verbatim: null, distinguished_by: null, confidence: null, note: parsed.policy_start ? 'The policy boundaries the AI gave could not be found in the text. Copy the wording from the section below.' : 'The policy wording was not found under this heading.', section_text: section.slice(0, 6000) });
      continue;
    }

    const wording = reflow(section.slice(span.start, span.end));
    const supSpan = parsed.supporting_start ? locateSpan(section, parsed.supporting_start, parsed.supporting_end) : null;
    const supporting = supSpan && supSpan.start >= span.end - 1 ? reflow(section.slice(supSpan.start, supSpan.end)) : null;

    const exact = wsNorm(rawText).includes(wsNorm(wording));
    const { verified, score } = checkVerbatim(wording, rawText);

    results.push({
      ...base,
      status: 'ok',
      wording,
      supporting_text: supporting,
      verbatim: { verified: verified || exact, score, exact },
      distinguished_by: typeof parsed.distinguished_by === 'string' ? parsed.distinguished_by : null,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : null,
      note: typeof parsed.note === 'string' ? parsed.note.trim() : '',
      section_text: null,
    });
  }
  return results;
}
