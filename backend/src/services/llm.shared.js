/**
 * Shared LLM utilities, constants, and document-extraction helpers.
 * Imported by all tool-specific service files.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chunkText } from './parser.service.js';

export function noEmDash(str) {
  if (!str) return str;
  return str.replace(/ — /g, ', ').replace(/—/g, '-');
}

// Load tone example from repo root — used as writing style reference in all generation calls
const __dirname = dirname(fileURLToPath(import.meta.url));
let TONE_EXAMPLE_BLOCK = '';
try {
  const raw = readFileSync(join(__dirname, '../../../planningstatementexample.md'), 'utf-8');
  const startIdx = raw.indexOf('8.0 Planning Assessment');
  const src = startIdx !== -1 ? raw.slice(startIdx, startIdx + 4000) : raw.slice(0, 4000);
  const cleaned = src
    .split('\n')
    .filter(l => !/^\d+$/.test(l.trim()))
    .filter(l => !l.match(/^[A-Z].{5,30}, PDAS$/))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3000);
  if (cleaned.length > 200) {
    TONE_EXAMPLE_BLOCK = `\n\nWriting style reference — match the professional tone, register, and sentence structure of the following planning statement excerpt. Do NOT use any content, facts, project names, site details, or policy references from this example — it is for writing style only:\n<tone_example>\n${cleaned}\n</tone_example>`;
    console.log('[llm.shared] Tone example loaded:', cleaned.length, 'chars');
  }
} catch (e) {
  console.warn('[llm.shared] Could not load planningstatementexample.md:', e.message);
}
export { TONE_EXAMPLE_BLOCK };

export const HOUSE_STYLE_BLOCK = `\n\nHOUSE STYLE — apply these rules consistently throughout:
- Capitalise: document names, organisation names, place names, and formal references to Statements, Sections, Figures, Tables, the Application, the Appeal.
- Lower case: site, development area, proposed development, planning officer, local planning authority, council, applicant, appellant, planning committee, planning condition.
- Bulleted list items begin with a capital letter and end with a full stop.
- Quotations: use italics (<em>) and double quotation marks "like this".
- Acronyms: write in full on first use with the acronym in brackets, e.g. Local Planning Authority (LPA), then use the acronym only thereafter.
- Use digits not words for numbers: "2 storeys" not "two storeys".
- Use commas in numbers of 1,000 or more: 1,000 not 1000.
- Single space after full stops.`;

export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODEL_FAST   = 'claude-haiku-4-5-20251001';
export const MODEL_SONNET = 'claude-sonnet-4-6';

export const ANALYSE_CHUNKS = 20;
export const REJECT_CHUNKS  = 35;
export const MAX_CHUNKS     = ANALYSE_CHUNKS;

export const HIGH_VALUE_PATTERN = /^(conclusions?|executive summary|summary(?: and conclusions)?|recommendations|key findings|overall assessment)\s*$/im;

export const DOC_TYPE_INSTRUCTIONS = {
  'Officer Report':        'This is a local authority officer report recommending refusal. Extract points that articulate the planning authority\'s objections — these should populate "argument_against". Also extract any concessions or positive observations that could support the appeal — these go to "argument_for".',
  'Refusal Notice':        'This is the formal refusal notice. Extract each reason for refusal as an "argument_against" point, mapped to the most relevant key issue.',
  'Appeal Decision':       'This is an appeal inspector\'s decision. Extract the inspector\'s reasoning against the proposal as "argument_against" points and any findings that favour the appellant as "argument_for" points.',
  'Planning Statement':    'This is a planning statement supporting the proposal. Extract points that support the argument for the appeal — these go to "argument_for".',
  'Proof of Evidence':     'This is an expert proof of evidence. Extract technical findings and conclusions that support the appeal case — these go to "argument_for".',
  'Expert Report':         'This is an expert technical report. Extract findings and conclusions relevant to the key issues — "argument_for" if supportive, "argument_against" if they identify problems.',
  'Consultation Response': 'This is a consultation response. Extract objections as "argument_against" and any supportive comments as "argument_for".',
  'Other':                 'Extract any points relevant to the key issues. Use your judgement on whether each point supports "argument_for" or "argument_against".'
};

export const PLANNING_APP_DOC_TYPE_INSTRUCTIONS = {
  'Surveyor Report':       'This is a specialist surveyor\'s or consultant\'s report commissioned to support the proposal. Extract technical findings, assessments, and conclusions that demonstrate the proposal\'s compliance with the linked policies. Focus on what the expert concludes, what technical evidence they cite, and any conditions or mitigation they propose to secure compliance.',
  'Heritage Statement':    'This is a heritage statement. Extract assessments of heritage significance, the expert\'s conclusions on impact, and any findings that show the proposal preserves or enhances the character, appearance, or significance of heritage assets as required by policy.',
  'Ecology Report':        'This is an ecology report. Extract species survey results, impact assessments, and mitigation or enhancement measures that demonstrate policy compliance.',
  'Transport Assessment':  'This is a transport assessment. Extract trip generation figures, capacity assessments, and conclusions on highway safety and accessibility that demonstrate policy compliance.',
  'Noise Assessment':      'This is a noise assessment. Extract measured levels, comparison against standards, and mitigation proposed that demonstrate the proposal would not cause unacceptable harm.',
  'Planning Statement':    'This is a planning statement. Extract the policy compliance arguments, assessments of need, and planning balance conclusions that support the application.',
  'Design and Access Statement': 'This is a design and access statement. Extract the design rationale, character assessments, and accessibility provisions that demonstrate policy compliance.',
  'Other':                 'This is a supporting document. Extract any technical findings, assessments, or conclusions that demonstrate the proposal\'s compliance with the linked planning policies.'
};

export const PLANNING_TIER_LABELS = {
  national:      'National Planning Policy',
  local:         'Local Plan Policy',
  neighbourhood: 'Neighbourhood Plan Policy',
  supplementary: 'Supplementary Planning Guidance',
  other:         'Other Material Considerations'
};

export const PLANNING_TIER_ORDER = ['national', 'local', 'neighbourhood', 'supplementary', 'other'];

// ─────────────────────────────────────────────────────────────────────────────
// Core API wrapper + JSON parser
// ─────────────────────────────────────────────────────────────────────────────

export async function callClaude(system, user, model = MODEL_SONNET, maxTokens = 4096) {
  const MAX_RETRIES = 3;
  let delay = 15000;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }]
      });
      return message.content[0].text;
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.message?.includes('rate_limit');
      if (isRateLimit && attempt < MAX_RETRIES) {
        console.warn(`Rate limit hit — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

export function parseJSON(text) {
  // Strip code fences if present
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Try direct parse first
  try {
    return JSON.parse(stripped);
  } catch {}

  // Fall back: find the outermost { ... } and parse that
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {}
  }

  throw new SyntaxError('Could not extract valid JSON from LLM response');
}

// ─────────────────────────────────────────────────────────────────────────────
// Document size check
// ─────────────────────────────────────────────────────────────────────────────

export function checkDocumentSize(rawText) {
  const allChunks = chunkText(rawText);
  const total = allChunks.length;
  if (total <= ANALYSE_CHUNKS) {
    return { status: 'ok', totalChunks: total, analysedChunks: total, warningMessage: null };
  }
  if (total > REJECT_CHUNKS) {
    return {
      status: 'rejected',
      totalChunks: total,
      analysedChunks: 0,
      warningMessage: `This document is too large to analyse in full (approx. ${Math.round(total * 6000 / 5)} words across ${total} sections). Please paste the specific section you want analysed — e.g. the relevant chapter or appendix.`
    };
  }
  return {
    status: 'truncated',
    totalChunks: total,
    analysedChunks: ANALYSE_CHUNKS,
    warningMessage: `Document is large — only the first ~${Math.round(ANALYSE_CHUNKS * 6000 / 5).toLocaleString()} words (${ANALYSE_CHUNKS} of ${total} sections) were analysed. For better coverage, paste the most relevant section directly.`
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Document block builders (shared by appeal + planning app extraction)
// ─────────────────────────────────────────────────────────────────────────────

export function buildDocumentBlock(text, maxChunks = 4) {
  const allChunks = chunkText(text);

  const highValueIndices = new Set(
    allChunks
      .map((c, i) => HIGH_VALUE_PATTERN.test(c.trim().slice(0, 200)) ? i : -1)
      .filter(i => i !== -1)
  );

  const regularIndices = allChunks.map((_, i) => i).filter(i => !highValueIndices.has(i));
  const ordered = [...highValueIndices, ...regularIndices].slice(0, maxChunks);

  return ordered.map(i => {
    const label = highValueIndices.has(i)
      ? `[Chunk ${i} — HIGH VALUE SECTION: read this first, weight it heavily]`
      : `[Chunk ${i}]`;
    return `${label}\n${allChunks[i]}`;
  }).join('\n\n');
}

export function buildFullDocumentBlock(text) {
  const allChunks = chunkText(text);
  const capped = allChunks.slice(0, ANALYSE_CHUNKS);

  const highValueIndices = new Set(
    capped
      .map((c, i) => HIGH_VALUE_PATTERN.test(c.trim().slice(0, 200)) ? i : -1)
      .filter(i => i !== -1)
  );
  const regularIndices = capped.map((_, i) => i).filter(i => !highValueIndices.has(i));
  const ordered = [...highValueIndices, ...regularIndices];

  return ordered.map(i => {
    const label = highValueIndices.has(i)
      ? `[Chunk ${i} — HIGH VALUE SECTION: read this first]`
      : `[Chunk ${i}]`;
    return `${label}\n${capped[i]}`;
  }).join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract points — shared by appeal tool and planning app (two modes)
// ─────────────────────────────────────────────────────────────────────────────

export function buildExtractPointsTemplate({ allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies = [], existingPointsByTrack = {}, argumentPoints = {} }) {
  return buildExtractPointsPrompt({ documentBlock: '{{DOCUMENT}}', allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies, existingPointsByTrack, argumentPoints });
}

export function buildExtractPointsPrompt({ text, documentBlock, allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies = [], existingPointsByTrack = {}, argumentPoints = {} }) {
  const docBlock = documentBlock ?? buildDocumentBlock(text);
  const issues = targetIssues.length > 0 ? targetIssues : allIssues;
  const isPlanningApp = linkedPolicies.length > 0;

  const tierOrder = ['national', 'local', 'neighbourhood', 'supplementary', 'other'];
  const tierLabels = { national: 'National Policy', local: 'Local Plan Policy', neighbourhood: 'Neighbourhood Plan Policy', supplementary: 'Supplementary Guidance', other: 'Other Policy' };
  const tierFields = { national: 'policy_national', local: 'policy_local', neighbourhood: 'policy_neighbourhood', supplementary: 'policy_supplementary', other: 'policy_other' };

  const linkedPoliciesBlock = linkedPolicies.length > 0
    ? '\n\n## Policies Linked to the Target Issue(s)\n' +
      'The following policies have been linked to the relevant issue(s) by the project team. ' +
      'Assess the document\'s content against these policies specifically — ' +
      'find evidence that supports compliance with each one.\n\n' +
      tierOrder
        .flatMap(tier => linkedPolicies.filter(p => p.policy_type === tier))
        .map(p => {
          const header = `### ${tierLabels[p.policy_type] ?? p.policy_type} — ${p.policy_reference ? p.policy_reference + ': ' : ''}${p.policy_name}${p.is_key_policy ? ' [KEY POLICY]' : ''}`;
          const policyText = p.policy_text?.trim() ? `Policy wording:\n${p.policy_text.trim()}` : '(No policy wording recorded)';
          const support = p.relevant_supporting_text?.trim() ? `\nRelevant context/guidance:\n${p.relevant_supporting_text.trim()}` : '';
          return `${header}\n${policyText}${support}`;
        })
        .join('\n\n')
    : '';

  const userNotesSection = userNotes
    ? `\n\n⚑ USER GUIDANCE (treat this as high priority context — it overrides your own judgement where it conflicts):\n${userNotes}\n`
    : '';

  const targetNote = targetIssues.length > 0
    ? `The user has indicated this document is specifically relevant to: ${targetIssues.map(i => i.label).join(', ')}. Focus extraction on these issues first, but still surface any other relevant points.`
    : `No specific issues were flagged — review against all issues and use your judgement.`;

  if (isPlanningApp) {
    const docInstruction = PLANNING_APP_DOC_TYPE_INSTRUCTIONS[documentType] || PLANNING_APP_DOC_TYPE_INSTRUCTIONS['Other'];

    const issueList = issues.map(issue => {
      const tierNotes = [
        issue.policy_national      && `    National policy notes: ${issue.policy_national.slice(0, 300)}`,
        issue.policy_local         && `    Local policy notes: ${issue.policy_local.slice(0, 300)}`,
        issue.policy_neighbourhood && `    Neighbourhood policy notes: ${issue.policy_neighbourhood.slice(0, 300)}`,
        issue.policy_supplementary && `    Supplementary notes: ${issue.policy_supplementary.slice(0, 300)}`,
      ].filter(Boolean).join('\n');
      const existing = existingPointsByTrack[issue.id] ?? [];
      const existingBlock = existing.length
        ? `\n    Existing argument points (already accepted from prior documents):\n` +
          existing.map(p => `      • ${p.headline}${p.source ? ` [${p.source}]` : ''}`).join('\n')
        : '';
      return `- id:${issue.id} | ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}${tierNotes ? '\n' + tierNotes : ''}${existingBlock}`;
    }).join('\n');

    const tierFieldList = tierOrder.map(t => `"${tierFields[t]}" → ${tierLabels[t]} points`).join(', ');

    return `You are a planning consultant preparing a planning statement. Your job is to read a specialist consultant's report and extract evidence that demonstrates the proposal's compliance with the linked planning policies.
${userNotesSection}
Document type: ${documentType}
${docInstruction}

This is a SUPPORTING document. Extract technical findings, assessments, and conclusions that show the proposal complies with the relevant policies. Where the expert proposes mitigation or conditions to secure compliance, extract those too.

${targetNote}

Issues to assess (with existing policy notes for context):
${issueList}
${linkedPoliciesBlock}

Document (shown as numbered chunks — note the chunk index for each point you extract):
<document>
${docBlock}
</document>

Instructions:
- Chunks marked HIGH VALUE SECTION contain conclusions, summaries or recommendations — read these first and extract all relevant compliance evidence from them
- For each point, identify which linked policy it most directly addresses and use that policy's tier as the field value
- Field values must be one of: ${tierFieldList}, or "argument_for" for generally supportive points not tied to a specific policy tier
- The existing argument points shown above are already accepted — do not extract the exact same point from the same source. However, if THIS document provides independent or additional evidence for the same conclusion (reinforcing evidence), extract it as a new point — note what the new evidence adds
- Focus on filling genuine gaps in the argument structure where no evidence exists yet
- Map each point to the most relevant issue id, or null if general
- Write a short headline (max 15 words) and a detailed_summary (2–4 sentences including the specific technical finding, figure, or assessment that supports compliance)
- For every point, record the citation: the most specific paragraph/section/page reference available, and a verbatim quote (max 150 chars) of the key phrase
- Record which chunk index or indices contain the source evidence
- If the user guidance above directs you to specific themes or paragraphs, prioritise those

Respond ONLY with valid JSON in this exact shape — no markdown, no explanation:
{
  "summary": "2-4 sentence overview of the document and what it demonstrates about the proposal's policy compliance",
  "coverage": [
    { "issue_id": 42, "assessment": "one sentence on how this document addresses the policy compliance case for this issue" }
  ],
  "points": [
    {
      "track_id": 42,
      "field": "policy_local",
      "headline": "Heritage consultant concludes no less than substantial harm",
      "detailed_summary": "Section 7.3 of the Heritage Statement concludes that the proposed works would result in less than substantial harm to the significance of the Listed Building, engaging NPPF paragraph 208. The consultant finds the harm sits at the lower end of the scale, to be weighed against the public benefits of the enabling development.",
      "citation": { "para_ref": "Section 7.3", "quote": "the proposed works would result in less than substantial harm to the significance of the Listed Building" },
      "relevant_chunk_indices": [0]
    }
  ]
}

citation rules:
- para_ref: the paragraph number, section heading, page number, or table reference where the point appears — use the most specific reference available (e.g. "Para 6.4", "Section 7.3", "p.24", "Table 3", "Conclusions") — null if none found
- quote: a verbatim excerpt from the document, max 150 characters, capturing the key phrase that carries the point — must be exact text from the document

If no relevant points are found, return points as an empty array but still provide the summary and coverage.`;
  }

  // ── Appeals mode ──────────────────────────────────────────────────────────

  const docInstruction = DOC_TYPE_INSTRUCTIONS[documentType] || DOC_TYPE_INSTRUCTIONS['Other'];

  const directionInstruction = documentDirection === 'for'
    ? 'This document SUPPORTS the proposal. Unless a point clearly articulates an objection or problem, default to tagging it as "argument_for".'
    : 'This document is AGAINST the proposal (e.g. officer report, refusal notice, objection). Unless a point clearly supports the appellant, default to tagging it as "argument_against".';

  const issueList = issues.map(issue => {
    const points = argumentPoints[issue.id] ?? [];
    const forPoints     = points.filter(p => p.field === 'argument_for');
    const againstPoints = points.filter(p => p.field === 'argument_against');

    let againstSection, forSection;
    if (againstPoints.length > 0) {
      againstSection = '\n    Established argument_against:\n' +
        againstPoints.map(p => `      • ${p.headline}${p.detailed_summary ? `\n        ${p.detailed_summary}` : ''}`).join('\n');
    } else if (issue.argument_against) {
      againstSection = `\n    Current against: ${issue.argument_against.slice(0, 400)}`;
    } else {
      againstSection = '';
    }
    if (forPoints.length > 0) {
      forSection = '\n    Established argument_for:\n' +
        forPoints.map(p => `      • ${p.headline}${p.detailed_summary ? `\n        ${p.detailed_summary}` : ''}`).join('\n');
    } else if (issue.argument_for) {
      forSection = `\n    Current for: ${issue.argument_for.slice(0, 400)}`;
    } else {
      forSection = '';
    }
    return `- id:${issue.id} | ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}${againstSection}${forSection}`;
  }).join('\n');

  const fullContext = allIssues.map(issue => {
    const points = argumentPoints[issue.id] ?? [];
    const forPoints     = points.filter(p => p.field === 'argument_for');
    const againstPoints = points.filter(p => p.field === 'argument_against');
    const parts = [];
    if (againstPoints.length > 0)    parts.push(`Against: ${againstPoints.map(p => p.headline).join('; ')}`);
    else if (issue.argument_against) parts.push(`Against: ${issue.argument_against.slice(0, 200)}`);
    if (forPoints.length > 0)        parts.push(`For: ${forPoints.map(p => p.headline).join('; ')}`);
    else if (issue.argument_for)     parts.push(`For: ${issue.argument_for.slice(0, 200)}`);
    return parts.length ? `${issue.label}: ${parts.join(' | ')}` : null;
  }).filter(Boolean).join('\n');

  return `You are a planning appeal consultant helping to build the argument structure for a planning appeal. Your job is to read a document and extract points that could strengthen or inform the working argument.
${userNotesSection}
Document type: ${documentType}
${directionInstruction}
${docInstruction}

${targetNote}

Issues to extract against (with current working notes):
${issueList}

Full working argument context (all issues, for background):
${fullContext || 'No notes yet.'}

Document (shown as numbered chunks — note the chunk index for each point you extract):
<document>
${docBlock}
</document>

Instructions:
- Chunks marked HIGH VALUE SECTION contain conclusions, summaries or recommendations — these carry the most weight; extract all relevant points from them before moving to regular chunks
- Extract every point from the document that could be useful to the argument, including things that fill gaps in the current notes
- Do NOT repeat points already captured in the established argument points above — check both headline and detail before suggesting a point
- Map each point to the most relevant issue id, or null if it is general
- Tag each point as "argument_against" (articulates the opposing position) or "argument_for" (supports the appeal)
- For each point, write a short headline (max 15 words) and a fuller detailed_summary (2–4 sentences with any technical detail, measurements, or specific findings)
- For every point, record the citation: the most specific paragraph/section/page reference available, and a verbatim quote (max 150 chars) of the key phrase
- Record which chunk index or indices contain the source evidence for each point
- If the user guidance above directs you to specific themes or paragraphs, prioritise those

Respond ONLY with valid JSON in this exact shape — no markdown, no explanation:
{
  "summary": "2-4 sentence overview of the document and its overall relevance to the appeal",
  "coverage": [
    { "issue_id": 42, "assessment": "one sentence on how this document bears on this issue" }
  ],
  "points": [
    {
      "track_id": 42,
      "field": "argument_against",
      "headline": "Officer found overlooking impact unacceptable",
      "detailed_summary": "The officer's report finds that the proposed first-floor rear window would result in direct views into the neighbouring garden at No. 14, reducing residential amenity in a manner contrary to Policy DM10. The report notes a separation distance of only 8m, well below the 21m guideline.",
      "citation": { "para_ref": "Para 5.12", "quote": "direct views into the neighbouring garden at No. 14, reducing residential amenity" },
      "relevant_chunk_indices": [0]
    }
  ]
}

citation rules:
- para_ref: the paragraph number, section heading, page number, or table reference where the point appears — use the most specific reference available (e.g. "Para 6.4", "Section 7.3", "p.24", "Table 3") — null if none found
- quote: a verbatim excerpt from the document, max 150 characters, capturing the key phrase that carries the point — must be exact text from the document

If no relevant points are found, return points as an empty array but still provide the summary and coverage.`;
}

export async function extractPointsFromDocument({ text, allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies = [], existingPointsByTrack = {}, customPrompt }) {
  const prompt = customPrompt ?? buildExtractPointsPrompt({ text, allIssues, targetIssues, documentType, documentDirection, userNotes, linkedPolicies, existingPointsByTrack });

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  console.log('[extractPointsFromDocument] raw response length:', raw.length);
  console.log('[extractPointsFromDocument] raw response preview:', raw.slice(0, 300));

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[extractPointsFromDocument] JSON.parse failed. cleaned length:', cleaned.length);
    console.error('[extractPointsFromDocument] cleaned preview:', cleaned.slice(0, 500));
    throw new Error(`LLM returned unparseable response: ${parseErr.message}`);
  }

  return {
    ...parsed,
    points: (parsed.points ?? []).map(p => ({
      track_id:               p.track_id ?? null,
      field:                  p.field,
      headline:               p.headline ?? p.point ?? '',
      detailed_summary:       p.detailed_summary ?? null,
      citation:               p.citation ?? null,
      relevant_chunk_indices: p.relevant_chunk_indices ?? []
    }))
  };
}
