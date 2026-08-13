/**
 * Planning statement and planning application workspace service.
 * Handles section generation, assessment generation, template-slot filling,
 * document summarisation, briefing transcript processing, and prose suggestion.
 */

import { client, noEmDash, callClaude, callLLM, resolveProvider, TONE_EXAMPLE_BLOCK, MODEL_SONNET, buildFullDocumentBlock, PLANNING_TIER_LABELS, PLANNING_TIER_ORDER, HOUSE_STYLE_BLOCK } from './llm.shared.js';
import { BASE_SECTIONS, ISSUE_QUESTIONS, TAIL_SECTIONS } from './meetingGuideContent.js';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants — Assessment
// ─────────────────────────────────────────────────────────────────────────────

export const PLANNING_ASSESSMENT_DEFAULT_PROMPT = `You are writing the planning assessment sub-section for the issue "{{ISSUE_LABEL}}"{{ISSUE_DISCIPLINE}}, for the project "{{PROJECT_NAME}}".

{{EXAMPLE_BLOCK}}
## What you are doing
Your job is to turn the consultant's working notes and policy framework into polished, formal planning statement prose. You are not inventing an argument — you are giving professional form to the argument that has already been constructed. Do not add facts, policies, or conclusions that are not present in the material below.

## Structure of this sub-section
Write in flowing prose with no sub-headings of any kind. The structure must follow this order:

{{POLICY_STRUCTURE}}

## The context provided to you — what each part means

The following material contains everything you need. Read each block carefully before writing.

{{ISSUE_CONTEXT}}

## What each block means
- **Policy sections (National Policy, Local Policy, Supplementary, etc.)** — these are the statutory policies the proposals must be assessed against. They define the policy framework for this issue. Cite each policy by name and reference number in the text. Policies marked [KEY POLICY — quote verbatim in draft] must be quoted directly.
- **Policy Assessment Notes** — this is the consultant's working argument: how the proposals comply with the policies above, what the key planning points are, and any sensitivities or mitigation required. This is the core substance of what you are polishing into formal prose. Follow this argument closely — do not deviate from it or add new arguments not present here.
- **Supporting Evidence from Documents** — these are findings extracted from specialist technical reports (transport assessments, ecology surveys, heritage statements, etc.). Reference each report by its full title inline (e.g. "The Transport Assessment confirms..." or "The Ecological Appraisal (section 4.2) concludes..."). These provide the technical evidence base for the compliance case.

FORMAT RULES (mandatory — failure to follow these is an error):
- Output HTML only — no markdown whatsoever
- Begin with <h3>{{ISSUE_LABEL}}</h3> then write flowing paragraphs — no other headings of any kind
- Do NOT add h4 or h5 headings such as "National Policy", "Local Policy", "Policy Framework", "Assessment", or "Conclusion" — the prose itself carries the structure
- Every paragraph must be wrapped in <p>...</p>
- Bold policy names and references with <strong>...</strong> — only for policies explicitly listed in the issue context above
- Do not use **, *, #, ---, or any other markdown characters anywhere in the output
- Do not add placeholder text — write the full sub-section from the material provided
- NEVER invent, assume, or refer to any planning policy not explicitly listed in the issue context above`;

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants — Statement section generation
// ─────────────────────────────────────────────────────────────────────────────

const PLANNING_STATEMENT_OUTPUT_VARS = new Set([
  'PROJECT_NAME', 'APPLICANT_NAME', 'LPA_NAME', 'SITE_ADDRESS', 'DEVELOPMENT_DESCRIPTION',
  'ABOUT_APPLICANT', 'PRE_APP_SUMMARY', 'EIA_SUMMARY', 'SCI_SUMMARY',
  'NATIONAL_POLICIES', 'LOCAL_POLICIES', 'OTHER_POLICIES',
  'LOCAL_POLICIES_KEY', 'LOCAL_POLICIES_OTHER', 'SUPPLEMENTARY_POLICIES',
  'LOCAL_POLICY_NAMES', 'SUPPLEMENTARY_POLICY_NAMES',
  'PROPOSED_DEVELOPMENT_HTML', 'SITE_SURROUNDINGS_HTML', 'PLANNING_HISTORY_TABLE',
  'DOCUMENT_LIST_DOCS', 'DOCUMENT_LIST_DRAWINGS',
  'NPPF_TEXT', 'NPPG_TEXT', 'OTHER_NATIONAL_TEXT', 'OTHER_GUIDANCE_TEXT',
]);

const OUTPUT_VAR_PLACEHOLDER_LABELS = {
  ABOUT_APPLICANT:            'About the Applicant',
  PRE_APP_SUMMARY:            'Pre-Application Response Summary',
  EIA_SUMMARY:                'EIA / Environmental Statement Summary',
  SCI_SUMMARY:                'Statement of Community Involvement Summary',
  NATIONAL_POLICIES:          'National Policies',
  LOCAL_POLICIES:             'Local Development Plan Policies',
  LOCAL_POLICIES_KEY:         'Key Local Policies',
  LOCAL_POLICIES_OTHER:       'Other Local Policies',
  SUPPLEMENTARY_POLICIES:     'Supplementary Planning Documents',
  OTHER_POLICIES:             'Other Material Policies',
  LOCAL_POLICY_NAMES:         'Local Policy Names',
  SUPPLEMENTARY_POLICY_NAMES: 'Supplementary Policy Names',
  PROPOSED_DEVELOPMENT_HTML:  'Proposed Development',
  SITE_SURROUNDINGS_HTML:     'Site and Surroundings',
  PLANNING_HISTORY_TABLE:     'Planning History Table',
  DOCUMENT_LIST_DOCS:         'Document List',
  DOCUMENT_LIST_DRAWINGS:     'Drawings List',
  NPPF_TEXT:                  'National Planning Policy Framework',
  NPPG_TEXT:                  'National Planning Practice Guidance',
  OTHER_NATIONAL_TEXT:        'Other National Policy',
  OTHER_GUIDANCE_TEXT:        'Other Policy and Guidance',
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants — Document summarisation
// ─────────────────────────────────────────────────────────────────────────────

// Outline of the kick-off meeting guide, rebuilt from meetingGuideContent.js
// so the briefing summary structure always matches the on-screen guide.
// Section titles are stored unnumbered; numbered here by position (mirrors
// buildGuide() on the frontend).
function buildMeetingGuideOutline() {
  const block = (s, n) => `${n}. ${s.title}\n${s.questions.map(q => `- ${q}`).join('\n')}`;
  const issueSectionNumber = BASE_SECTIONS.length + 1;
  const keyIssues = [
    `${issueSectionNumber}. Key Issues`,
    `For each planning issue or constraint discussed (e.g. landscape, heritage, ecology, highways), use a numbered sub-heading per issue (${issueSectionNumber}.1, ${issueSectionNumber}.2, …) and cover:`,
    ...ISSUE_QUESTIONS.map(q => `- ${q}`)
  ].join('\n');
  return [
    ...BASE_SECTIONS.map((s, i) => block(s, i + 1)),
    keyIssues,
    ...TAIL_SECTIONS.map((s, i) => block(s, issueSectionNumber + 1 + i))
  ].join('\n\n');
}

const DEFAULT_SUMMARY_PROMPTS = {
  pre_app: `You are a planning consultant preparing a Planning Statement. Summarise the key content of this pre-application response in 2–3 short paragraphs.
Write as a factual account of what the LPA said — the position taken, the issues raised, and what was supported or accepted. Keep each paragraph brief and to the point. Do not use headings or bullet points.
Output clean HTML using only <p> tags.`,

  eia_response: `You are a planning consultant preparing a Planning Statement. Summarise the key content of this EIA scoping opinion or environmental response in 2–3 short paragraphs.
Write as a factual account of what the document covers — topics scoped in or out, requirements set, and overarching conclusions. Keep each paragraph brief and to the point. Do not use headings or bullet points.
Output clean HTML using only <p> tags.`,

  sci: `You are a planning consultant preparing a Planning Statement. Summarise the key content of this community consultation document in 2–3 short paragraphs.
Write as a factual account of what the consultation involved — how it was carried out, what feedback was received, and how it has been addressed. Keep each paragraph brief and to the point. Do not use headings or bullet points.
Output clean HTML using only <p> tags.`,

  site_surroundings: `You are a planning consultant preparing a Planning Statement. Summarise the key content of this site and surroundings description in 2–3 short paragraphs.
Write as a factual account of the site — its location and characteristics, the surrounding context, and any relevant designations or constraints. Keep each paragraph brief and to the point. Do not use headings or bullet points.
Output clean HTML using only <p> tags.`,

  about_applicant: `You are a planning consultant. This document contains the applicant's standard 'About the Applicant' text for use in a Planning Statement.
Format this content clearly for inclusion in the statement. Preserve the original wording exactly — do not paraphrase, shorten, or alter the substance.
Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  proposed_development: `You are a planning consultant. Summarise this Proposed Development description for inclusion in a Planning Statement.
Structure your summary to cover: the formal description of development, the main components of the proposal, key technical figures or specifications, and any design or sustainability principles.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  briefing_transcript: `You are a senior planning consultant. You have been given a transcript of a project briefing or kick-off meeting relating to a planning application. The meeting followed (or loosely followed) TRP's standard project kick-off meeting guide.

Produce a detailed structured summary of this transcript, organised under the meeting guide's sections below. Capture everything material that was said — figures, names, dates, contacts, positions taken, decisions made, and instructions given. Do not compress or omit nuance: this summary will be used as background context when drafting all sections of a Planning Statement, so missing detail is worse than length.

Meeting guide sections (use the section titles as <h3> headings, in this order; the bullet points under each show what the guide asked — cover whichever were actually discussed):

${buildMeetingGuideOutline()}

If the transcript contains material that does not fit any section above, add a final section headed "Other" and summarise it there. Only include "Other" if it is needed.

Strict rules:
- Only use information actually present in the transcript. Never invent, infer, or pad.
- If a section was not addressed in the meeting, omit that section entirely: no heading, no placeholder.
- Within a section, only cover the points that were actually discussed.
- Absolutely no em dashes or en dashes, ever. Use commas, brackets, colons, or separate sentences instead, and write ranges with "to" (e.g. "20 to 30 years").

Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  other: `You are a planning consultant. Provide a structured summary of this document.
Structure your summary with these headings: Purpose and Scope, Key Findings or Conclusions, Relevance to the Planning Application, Material Considerations Raised.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildPlanningAppIssueContext(issue, linkedPolicies, evidence = [], issueType = null) {
  const lines = [];

  if (issueType) {
    const stripHtml = s => s?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
    if (issueType.nppf_text?.trim()) {
      lines.push(`### NPPF: ${issue.label}`);
      lines.push(stripHtml(issueType.nppf_text));
    }
    if (issueType.nppg_text?.trim()) {
      lines.push(`### NPPG: ${issue.label}`);
      lines.push(stripHtml(issueType.nppg_text));
    }
    if (issueType.other_national_text?.trim()) {
      lines.push(`### Other National Policy: ${issue.label}`);
      lines.push(stripHtml(issueType.other_national_text));
    }
    if (issueType.other_guidance_text?.trim()) {
      lines.push(`### Other Guidance: ${issue.label}`);
      lines.push(stripHtml(issueType.other_guidance_text));
    }
  }

  for (const tier of PLANNING_TIER_ORDER) {
    const tierPolicies = linkedPolicies.filter(p => p.policy_type === tier);
    if (!tierPolicies.length) continue;
    lines.push(`### ${PLANNING_TIER_LABELS[tier]}`);
    for (const p of tierPolicies) {
      const ref = p.policy_reference ? `${p.policy_reference}: ` : '';
      const keyTag = p.is_key_policy ? ' [KEY POLICY: quote verbatim in draft]' : '';
      lines.push(`**${ref}${p.policy_name}**${keyTag}`);
      if (p.policy_text?.trim()) {
        lines.push(`Policy wording: "${p.policy_text.trim()}"`);
      }
      if (p.relevant_supporting_text?.trim()) {
        lines.push(`Supporting context: ${p.relevant_supporting_text.trim().slice(0, 400)}`);
      }
    }
  }

  if (issue.policy_national?.trim()) {
    lines.push(`### National Policy Context`);
    lines.push(issue.policy_national.trim());
  }

  if (issue.argument_for?.trim()) {
    lines.push(`### Policy Assessment Notes`);
    lines.push(issue.argument_for.trim());
  }

  if (evidence.length) {
    lines.push(`### Supporting Evidence from Documents`);
    for (const e of evidence) {
      const source = e.source_doc_title ? `[${e.source_doc_title}]` : '[Document]';
      const ref = e.relevance_note ? ` (${e.relevance_note})` : '';
      const quote = e.quote_snapshot ? `"${e.quote_snapshot.slice(0, 300)}"` : '';
      lines.push(`- ${source}${ref}${quote ? ': ' + quote : ''}`);
      if (e.detailed_summary) lines.push(`  ${e.detailed_summary}`);
    }
  }

  return lines.join('\n');
}

async function generateLlmSlot({ instruction, variables, briefingSummary, styleTemplate = null, provider = null }) {
  const contextLines = [
    variables.PROJECT_NAME            && `Project: ${variables.PROJECT_NAME}`,
    variables.APPLICANT_NAME          && `Applicant: ${variables.APPLICANT_NAME}`,
    variables.LPA_NAME                && `LPA: ${variables.LPA_NAME}`,
    variables.SITE_ADDRESS            && `Site: ${variables.SITE_ADDRESS}`,
    variables.DEVELOPMENT_DESCRIPTION && `Development: ${variables.DEVELOPMENT_DESCRIPTION}`,
  ].filter(Boolean).join('\n');

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use this to inform strategic direction, framing, and planning arguments — do not reproduce it verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const styleBlock = styleTemplate?.style_text?.trim()
    ? `\n\n## Example Document\nThe following is a real example of this document type written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Some elements are universal — how sections open, how conclusions are framed — and can be reflected in your output. Most content is project-specific and must not be reproduced. The guiding brief takes precedence over this example — do not follow the example more closely than the guiding brief.\n\n${styleTemplate.style_text.trim().slice(0, 4000)}`
    : '';

  const text = await callLLM({
    provider: await resolveProvider('planning_statement_draft', provider),
    maxTokens: 600,
    system: `You are writing a single short passage for a formal Planning Statement submission.\n\nProject context (for reference — do not reproduce these verbatim as they appear elsewhere in the document):\n${contextLines}${TONE_EXAMPLE_BLOCK}${briefingBlock}${styleBlock}\n\nRULES:\n- Write [SOURCE REQUIRED] for any project-specific fact not in the context above\n- Output clean HTML using only <p> tags (and <ul>/<li> only if the instruction explicitly asks for a list)\n- No headings, no markdown, no code blocks\n- Do not use em dashes (—); use a comma, colon, or rewrite the sentence instead`,
    prompt: instruction
  });

  const html = noEmDash(text.trim()
    .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
  return `<div class="llm-generated">${html}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePlanningStatementAssessment({ projectName, section, issues, linkedPoliciesByTrack, evidenceByTrack, issueTypesByTrack = {}, briefingSummary, guidingBrief = null, styleTemplate = null, provider = null }) {
  const parts = [`<h2>${section.name}</h2>`];

  for (const issue of issues) {
    const linkedPolicies = linkedPoliciesByTrack[issue.id] ?? [];
    const evidence = evidenceByTrack[issue.id] ?? [];
    const issueType = issueTypesByTrack[issue.id] ?? null;
    if (!linkedPolicies.length && !issue.argument_for?.trim() && !issue.policy_national?.trim() && !evidence.length && !issueType) {
      parts.push(`<h3>${issue.label}</h3>`);
      continue;
    }
    console.log(`[generatePlanningStatementAssessment] generating issue: ${issue.label}`);
    const html = await generateSingleAssessmentIssue({ projectName, section, issue, linkedPolicies, evidence, issueType, briefingSummary, guidingBrief, styleTemplate, provider });
    parts.push(html);
  }

  return parts.join('\n\n');
}

export async function generateSingleAssessmentIssue({ projectName, section, issue, linkedPolicies, evidence, issueType = null, briefingSummary, guidingBrief = null, styleTemplate = null, provider = null }) {
  const exampleBlock = section.example_text?.trim()
    ? `## Example Document\nThe following is a real example section from this type of document written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Most content is project-specific and must not be reproduced. The guiding brief takes precedence — do not follow the example more closely than the guiding brief.\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)}\n</example>\n\n`
    : '';

  const customPromptTemplate = section.generation_prompt?.trim() || null;

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use to inform strategic direction, planning arguments, and framing — do not reproduce verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Guiding Brief\nThe following describes how this type of document should be structured and approached — use it for format, framing, and emphasis. The project brief and other provided materials are your only source of project-specific content. If the guiding brief describes a section or topic for which nothing has been provided in the project materials, omit it — do not invent content to fill it.\n\n${guidingBrief.guidance_content.trim()}`
    : '';

  const styleBlock = styleTemplate?.style_text?.trim()
    ? `\n\n## Example Document\nThe following is a real example of this document type written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Some elements are universal — how sections open, how conclusions are framed — and can be reflected in your output. Most content is project-specific and must not be reproduced. The guiding brief takes precedence over this example — do not follow the example more closely than the guiding brief.\n\n${styleTemplate.style_text.trim().slice(0, 8000)}`
    : '';

  const systemPrompt = `You are a planning consultant drafting formal Planning Statements. You output clean HTML only. Every paragraph is a <p> tag, headings are <h2> or <h3>, bold is <strong>. Never use **, *, #, or --- — that is an error. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.${HOUSE_STYLE_BLOCK}${TONE_EXAMPLE_BLOCK}${briefingBlock}${guidingBlock}${styleBlock}`;

  const issueContext = buildPlanningAppIssueContext(issue, linkedPolicies, evidence, issueType);

  const hasPolicies = linkedPolicies.length > 0;
  const allPolicyRefs = linkedPolicies
    .filter(p => p.policy_reference)
    .map(p => p.policy_reference);
  const policyRefList = allPolicyRefs.join(', ');

  const policyStructure = hasPolicies
    ? `Follow this structure — write entirely in flowing prose, no sub-headings of any kind:
1. National policies first — state what each requires in one or two flowing sentences in running prose. Then local plan policies in the same way. Then any neighbourhood, supplementary, or other policies. Reference each policy by name and number in the text.
2. Write paragraphs explaining how the proposals comply with those policies. Draw directly on the assessment notes and specialist evidence provided — reference expert documents specifically where cited (e.g. "The Transport Assessment confirms..."). Where the scheme does not fully comply or relies on mitigation, explain the justification or mitigation measure.
3. Close with a concluding sentence in the final paragraph: "The proposals are therefore considered to comply with ${policyRefList}." If compliance depends on mitigation: "Subject to [the mitigation described above], the proposals are therefore considered to comply with ${policyRefList}."`
    : `Write as a series of flowing paragraphs — no sub-headings of any kind:
- Write paragraphs explaining why the proposals are acceptable for this issue, drawing on the assessment notes and specialist evidence provided. Reference any expert documents cited in the notes specifically (e.g. "The Noise Assessment concludes..."). Where mitigation is involved, explain how it makes the proposals acceptable.
- Close with a brief concluding sentence in the final paragraph confirming the proposals are considered acceptable for this issue.

IMPORTANT: There are no planning policies linked to this issue. Do NOT reference, invent, or imply any planning policy. Write solely on the basis of the assessment notes and evidence provided.`;

  const prompt = (customPromptTemplate ?? PLANNING_ASSESSMENT_DEFAULT_PROMPT)
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{SECTION_NAME\}\}/g, section.name)
    .replace(/\{\{ISSUE_LABEL\}\}/g, issue.label)
    .replace(/\{\{ISSUE_DISCIPLINE\}\}/g, issue.discipline ? ` (${issue.discipline})` : '')
    .replace(/\{\{POLICY_STRUCTURE\}\}/g, policyStructure)
    .replace(/\{\{ISSUE_CONTEXT\}\}/g, issueContext)
    .replace(/\{\{EXAMPLE_BLOCK\}\}/g, exampleBlock);

  const text = await callLLM({
    provider: await resolveProvider('planning_statement_draft', provider),
    maxTokens: 2000,
    system: systemPrompt,
    prompt
  });

  const raw = noEmDash(text.trim()
    .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
  return `<div class="llm-generated">${raw}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statement section generation (prompt-based)
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePlanningStatementSection({ section, variables, sectionNumber, briefingSummary, guidingBrief = null, styleTemplate = null, provider = null }) {
  let prompt = section.generation_prompt ?? '';

  for (const [key, value] of Object.entries(variables)) {
    if (!PLANNING_STATEMENT_OUTPUT_VARS.has(key)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
    }
  }

  const outputVarLines = [...PLANNING_STATEMENT_OUTPUT_VARS]
    .filter(k => variables[k] !== undefined)
    .map(k => `  {{${k}}}`)
    .join('\n');
  const outputVarInstruction = outputVarLines
    ? `CRITICAL INSTRUCTION: The following placeholders will be filled in programmatically after you write. Write them EXACTLY as shown — including the double curly braces — wherever you would use that value. Never invent or rephrase these values:\n${outputVarLines}\n\n`
    : '';

  let numberingInstruction = '';
  if (sectionNumber > 0) {
    const n = sectionNumber;
    numberingInstruction = `NUMBERING: This is section ${n} of the Planning Statement. Ignore any section numbers written in the instructions below. Apply this scheme to every heading and paragraph — no exceptions:
  - Main section heading → ${n}.0  (use <h2>)
  - Subsection headings → ${n}.1, ${n}.2, ${n}.3 …  (use <h3>, only where the section has genuinely distinct sub-topics)
  - Paragraphs directly under the ${n}.0 heading → ${n}.0.1, ${n}.0.2, ${n}.0.3 …  (prefix every <p> with the number, e.g. <p>${n}.0.1 Lorem ipsum…</p>)
  - Paragraphs within subsection ${n}.1 → ${n}.1.1, ${n}.1.2 …  (same pattern)
  - Every <p> must begin with its paragraph number. Do not write any unnumbered paragraph.\n\n`;
  } else {
    numberingInstruction = `NUMBERING: Do not add any numeric prefix to the heading or paragraphs in this section.\n\n`;
  }

  const exampleBlock = section.example_text?.trim()
    ? `## Example Document\nThe following is a real example section from this type of document written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Most content is project-specific and must not be reproduced. The guiding brief takes precedence — do not follow the example more closely than the guiding brief.\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)}\n</example>\n\n`
    : '';

  const fullPrompt = outputVarInstruction + numberingInstruction + exampleBlock + prompt;

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use this to inform strategic direction, framing, and planning arguments — do not reproduce it verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Guiding Brief\nThe following describes how this type of document should be structured and approached — use it for format, framing, and emphasis. The project brief and other provided materials are your only source of project-specific content. If the guiding brief describes a section or topic for which nothing has been provided in the project materials, omit it — do not invent content to fill it.\n\n${guidingBrief.guidance_content.trim()}`
    : '';

  const styleBlock = styleTemplate?.style_text?.trim()
    ? `\n\n## Example Document\nThe following is a real example of this document type written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Some elements are universal — how sections open, how conclusions are framed — and can be reflected in your output. Most content is project-specific and must not be reproduced. The guiding brief takes precedence over this example — do not follow the example more closely than the guiding brief.\n\n${styleTemplate.style_text.trim().slice(0, 8000)}`
    : '';

  const text = await callLLM({
    provider: await resolveProvider('planning_statement_draft', provider),
    maxTokens: 4096,
    system: `You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority. Output clean HTML only — no markdown. Every paragraph is <p>, section headings are <h2>, subsection headings are <h3>, lists are <ul>/<li>, bold is <strong>. Never use **, *, #, or --- — those are errors. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.\n\nCRITICAL RULE: If you need to state a fact, figure, name, date, designation, measurement, or project-specific claim that is not explicitly present in the content provided to you, write [SOURCE REQUIRED] in its place. Never invent or infer project-specific information.${HOUSE_STYLE_BLOCK}${TONE_EXAMPLE_BLOCK}${briefingBlock}${guidingBlock}${styleBlock}`,
    prompt: fullPrompt
  });

  let output = noEmDash(text.trim()
    .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());

  for (const key of PLANNING_STATEMENT_OUTPUT_VARS) {
    const value = variables[key];
    const replacement = value || (() => {
      const label = OUTPUT_VAR_PLACEHOLDER_LABELS[key] ?? key;
      return `<p class="draft-placeholder">[${label} — not yet provided. Upload and summarise the relevant document to populate this section.]</p>`;
    })();
    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacement);
  }

  return output;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template-based generation ({{LLM:slug}} slots)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateFromTemplate({ section, variables, briefingSummary, styleTemplate = null, provider = null }) {
  let output = section.template_html;

  const llmSlotRegex = /\{\{LLM:([^}]+)\}\}([\s\S]*?)\{\{\/LLM\}\}/g;
  const slots = [...output.matchAll(llmSlotRegex)];
  for (const [fullMatch, , rawInstruction] of slots) {
    let instruction = rawInstruction.trim();
    for (const [key, value] of Object.entries(variables)) {
      if (value && typeof value === 'string' && !value.includes('<')) {
        instruction = instruction.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }
    const slotHtml = await generateLlmSlot({ instruction, variables, briefingSummary, styleTemplate, provider });
    output = output.replace(fullMatch, slotHtml);
  }

  const placeholderLabel = (key) => {
    const labels = {
      ABOUT_APPLICANT: 'About the Applicant',
      PRE_APP_SUMMARY: 'Pre-Application Response Summary',
      EIA_SUMMARY:     'EIA / Environmental Statement Summary',
      SCI_SUMMARY:     'Statement of Community Involvement Summary',
      NATIONAL_POLICIES:          'National Policies',
      LOCAL_POLICIES:             'Local Development Plan Policies',
      OTHER_POLICIES:             'Other Material Policies',
      LOCAL_POLICY_NAMES:         'Local Policy Names',
      SUPPLEMENTARY_POLICY_NAMES: 'Supplementary Policy Names',
      PROPOSED_DEVELOPMENT_HTML:  'Proposed Development',
      SITE_SURROUNDINGS_HTML:     'Site and Surroundings',
      PLANNING_HISTORY_TABLE:     'Planning History Table',
      DOCUMENT_LIST_DOCS:         'Document List',
      DOCUMENT_LIST_DRAWINGS:     'Drawings List',
    };
    return labels[key] ?? key.replace(/_/g, ' ').toLowerCase();
  };

  for (const [key, value] of Object.entries(variables)) {
    const hasValue = value && String(value).trim();
    const replacement = hasValue
      ? String(value)
      : `<p class="draft-placeholder">[${placeholderLabel(key)} — not yet provided]</p>`;
    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacement);
  }

  return noEmDash(output);
}

// ─────────────────────────────────────────────────────────────────────────────
// Document summarisation
// ─────────────────────────────────────────────────────────────────────────────

export function getDefaultSummaryPrompt(docType) {
  return DEFAULT_SUMMARY_PROMPTS[docType] ?? DEFAULT_SUMMARY_PROMPTS.other;
}

export async function summariseDocument(text, fileName, docType, customPrompt = null, provider = null) {
  const systemPrompt = customPrompt ?? getDefaultSummaryPrompt(docType);
  const userPrompt = `Document: ${fileName || 'Untitled'}\n\n${text.slice(0, 80000)}`;

  const resolvedProvider = await resolveProvider('planning_statement_helpers', provider);
  const text_ = await callLLM({
    provider: resolvedProvider,
    model: MODEL_SONNET,
    maxTokens: 16000,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return noEmDash(text_.trim()).replace(/\s*–\s*/g, ' to ');
}

export async function suggestTranscriptUpdates(text, provider = null) {
  const systemPrompt = `You are a planning consultant analysing a briefing transcript to identify content that should update specific project data fields.

For each field listed below, assess whether the transcript contains clear, explicit content that belongs in that field. Only suggest an update if the content is clearly and explicitly present — do not infer, fabricate, or pad. If the transcript does not clearly address a field, omit it from your response.

Fields to assess:

1. field: "about_applicant" | label: "About the Applicant" — Who the applicant/developer is, their background, track record, and what they do. Only suggest if the transcript explicitly describes the applicant organisation.

2. field: "proposed_development" | label: "Proposed Development" — A full description of what is being proposed: components, scale, layout, technical specifications, key design features. Only suggest if the transcript contains a detailed description of the proposal.

3. field: "site_surroundings" | label: "Site and Surroundings" — Description of the site and its surrounding context, land uses, physical characteristics, constraints, designations. Only suggest if the transcript explicitly describes the site.

4. field: "pre_app" | label: "Pre-Application Response" — Any pre-application advice received from the LPA. Only suggest if the transcript explicitly references pre-application advice.

For each field where clear content exists, return a JSON object with:
- "field": the field identifier exactly as listed above
- "label": the human-readable label as listed above
- "suggested_content": the content written as clean HTML using only <p>, <ul>, <li>, <h3> tags — write the actual content, not a summary of what the transcript says
- "reason": a single sentence explaining what in the transcript justifies this suggestion

Return ONLY a valid JSON array with no preamble, explanation, or code fences. If no fields have clear content, return [].`;

  const resolvedProvider = await resolveProvider('planning_statement_helpers', provider);
  const responseText = await callLLM({
    provider: resolvedProvider,
    model: MODEL_SONNET,
    maxTokens: 4000,
    system: systemPrompt,
    prompt: `Transcript:\n\n${text.slice(0, 80000)}`,
  });

  const raw = responseText.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('[suggestTranscriptUpdates] Failed to parse JSON:', cleaned.slice(0, 300));
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning assessment incorporation — structure-aware document update
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_INCORPORATE_ASSESSMENT_PROMPT = `You are updating the Planning Assessment section of a formal Planning Statement to incorporate evidence from a new specialist report.

## Structure of each issue sub-section
Each issue sub-section has three parts:
1. Policy framework paragraphs — state what the relevant national, local, and other policies require. Do NOT alter these.
2. Compliance argument paragraphs — explain how the proposals satisfy those policies, drawing on expert evidence and specialist reports. This is where you add and update content.
3. Concluding sentence — "The proposals are therefore considered to comply with [policy list]." Preserve the policy list exactly.

## Your task
Rewrite the compliance section of each relevant issue sub-section to incorporate the evidence from this specialist report. You are working holistically — assess the paragraphs as a whole and return an updated version of the section.

Rules:
- Do NOT change any paragraph that is setting out policy (i.e. paragraphs that describe what national or local policy requires). Leave those exactly as they are.
- Everything else is fair game: compliance argument paragraphs, evidence paragraphs, and the conclusion.
- Keep the existing argument being made — do not change the position or conclusions. Your job is to back up that argument with specific evidence and citations from the specialist report.
- Where the existing text makes a claim about compliance, harm level, or planning balance, add the report's findings to support it. Always refer to the document by a formal report title (e.g. "The Heritage Statement concludes...", "The Ecological Appraisal (section 5.2) finds...", "The Transport Assessment confirms..."). Never refer to "the specialist", "the appellant's consultant", "the heritage specialist" or similar — always use the document's title. The document title is shown in the heading below.
- The section must end with a concluding sentence of the form: "The proposals are therefore considered to comply with [policy references]." If one already exists, you may update it but keep the policy list. If none exists, add one.
- Write in formal planning language. Do not use em dashes.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {"id": "p3", "html": "<p>Updated paragraph with evidence woven in...</p>"},
  {"id": "INSERT_AFTER_p3", "html": "<p>New compliance paragraph constructed from report...</p>"}
]`;

export async function incorporatePlanningAssessment({ paragraphs, documentText, filename, issues, linkedPoliciesByTrack, issueTypesByTrack = {}, userNotes = null, projectName = '', guidingBrief = null, projectBrief = null, exampleText = null, customPrompt = null, provider = null }) {
  // Build rich per-issue context (policies + argument notes) for each issue
  const issueContextParts = issues.map(issue => {
    const linkedPolicies = linkedPoliciesByTrack[issue.id] ?? [];
    const issueType = issueTypesByTrack[issue.id] ?? null;
    const ctx = buildPlanningAppIssueContext(issue, linkedPolicies, [], issueType);
    return `### Issue: ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}\n${ctx}`;
  }).join('\n\n---\n\n');

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Guiding Brief\nThe following describes how this type of document should be structured and approached — use it for format, framing, and emphasis. The project brief and other provided materials are your only source of project-specific content. If the guiding brief describes a section or topic for which nothing has been provided in the project materials, omit it — do not invent content to fill it.\n\n${guidingBrief.guidance_content.trim()}`
    : '';

  const projectBriefBlock = projectBrief?.trim()
    ? `\n\n## Project Brief\n${projectBrief.trim().slice(0, 4000)}`
    : '';

  const exampleBlock = exampleText?.trim()
    ? `\n\n## Example Document\nThe following is a real example of this document type written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Some elements are universal — how sections open, how conclusions are framed — and can be reflected in your output. Most content is project-specific and must not be reproduced. The guiding brief takes precedence over this example — do not follow the example more closely than the guiding brief.\n\n${exampleText.trim().slice(0, 8000)}`
    : '';

  const userNotesBlock = userNotes?.trim()
    ? `## User Guidance — HIGH PRIORITY\nFollow these instructions precisely:\n${userNotes.trim()}\n\n`
    : '';

  const paraBlock = paragraphs.map(p => `${p.id}:\n${p.html}`).join('\n\n');

  const instructionBlock = customPrompt ?? DEFAULT_INCORPORATE_ASSESSMENT_PROMPT;

  const prompt = `Project: ${projectName}${guidingBlock}${projectBriefBlock}${exampleBlock}

${instructionBlock}

## Key Issues and Policy Context
${issueContextParts}

## Document Being Incorporated${filename ? `: "${filename}"` : ' (no title provided — derive an appropriate formal title from the document content, e.g. "the Heritage Statement", "the Transport Assessment")'}
${documentText}

## In-Scope Paragraphs
${userNotesBlock}${paraBlock}`;

  const resolvedProvider = await resolveProvider('planning_statement_helpers', provider);
  const responseText = await callLLM({
    provider: resolvedProvider,
    model: MODEL_SONNET,
    maxTokens: 4000,
    prompt,
  });

  const raw = noEmDash(responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  return JSON.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing-driven argument drafting (planning app)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_DRAFT_KEY_SUMMARIES_PROMPT = `You are a planning consultant reviewing a briefing note for a planning application. Based on the briefing, do two things:

1. Draft a brief position note for each key issue listed below that the briefing actually discusses.
2. Identify anything discussed in the briefing that is a genuine planning issue in its own right but is NOT in the list below.

Each note should be 2-4 sentences capturing: the consultant's position on this issue, the key evidence or approach, and any sensitivities flagged in the briefing. Write as working notes for the consultant — concise and practical, not formal submission language.

What counts as a planning issue worth flagging as new (part 2): a distinct topic that will need its own assessment in the Planning Policy and Planning Assessment sections of the statement — e.g. a technical discipline (heritage, ecology, drainage, noise), a specific site constraint, or a matter the LPA is known to weigh separately. Do NOT flag something as new if it is really part of an issue already in the list, a passing remark with no substance, or a project fact rather than an assessable issue (e.g. "the site is 2 hectares" is not an issue).

A library of reusable issue-type templates is provided below (each has pre-written national policy snippets attached). If a new issue you identify in part 2 clearly corresponds to one of these templates — even if the wording differs, e.g. "Flood Risk and Drainage" matching a template called "Flood Risk" — include its id as "matched_issue_type_id" so it can be linked automatically. Only match when genuinely confident; a wrong match is worse than no match, so when in doubt omit it or set it to null.

Respond ONLY with valid JSON — no markdown, no explanation:
[
  { "track_id": 42, "summary": "Our position is..." },
  { "new_issue": true, "suggested_label": "Bat surveys", "suggested_discipline": "Ecology", "summary": "Our position is...", "matched_issue_type_id": 7 }
]

Only include entries where the briefing contains relevant content. Omit an issue entirely if the briefing has nothing relevant to it, and omit part 2 entirely if nothing new comes up.`;

export async function draftKeyIssueSummariesFromBriefing({ briefingSummary, issues, issueTypes = [], customPrompt = null, provider = null }) {
  const issueList = issues.length
    ? issues.map(i =>
        `- id:${i.id} | ${i.label}${i.discipline ? ` (${i.discipline})` : ''}${i.summary?.trim() ? `\n  Existing note: ${i.summary.trim().slice(0, 150)}` : ''}`
      ).join('\n')
    : '(none tracked yet for this project — this is expected for an early-stage project. Skip part 1 entirely and go straight to part 2: identify any new issues discussed in the briefing.)';

  const issueTypeList = issueTypes.length
    ? issueTypes.map(t => `- id:${t.id} | ${t.label}${t.development_type ? ` (${t.development_type})` : ' (generic)'}`).join('\n')
    : '(none available — omit matched_issue_type_id for every new issue.)';

  const systemPrompt = customPrompt ?? DEFAULT_DRAFT_KEY_SUMMARIES_PROMPT;
  const userMessage = `Briefing note:\n<briefing>\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}\n</briefing>\n\nKey issues:\n${issueList}\n\nAvailable issue-type templates:\n${issueTypeList}`;

  const resolvedProvider = await resolveProvider('planning_statement_helpers', provider);
  const responseText = await callLLM({
    provider: resolvedProvider,
    model: MODEL_SONNET,
    maxTokens: 2000,
    system: systemPrompt,
    prompt: userMessage,
  });

  const raw = responseText.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(s => ({ ...s, summary: noEmDash(s.summary) }));
  } catch {
    console.error('[draftKeyIssueSummariesFromBriefing] Failed to parse JSON:', cleaned.slice(0, 300));
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft from Briefing Note — Drafting Issues tab (Planning Statement v3)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_DRAFT_ISSUES_FROM_BRIEFING_PROMPT = `You are a specialist planning consultant drafting the working argument notes for a Planning Statement, based on a project briefing meeting.

In this meeting, the team discusses the project issue by issue — for each issue, what the relevant policy says, and what the project's argument will be in response to that policy. Sometimes the team also discusses a specialist report commissioned for that issue. Your job is to read the briefing note(s) below and do four things:

1. For each issue already listed below, extract and write up what was actually said about it — grounded specifically in the policies already linked to that issue.
2. Identify any issue that the briefing explicitly names as an issue but which is not in the list below. Only include something here if it is explicitly identified as an issue in the briefing — not merely mentioned in passing, not inferred by you. If in doubt, leave it out. These will become subsections of the Planning Assessment (and potentially other sections) of the Planning Statement.
3. For each issue (existing or new), identify any policies from the project's full policy library (provided below) that the briefing explicitly discusses or names in connection with that issue. This must come from what was actually said in the transcript — not from you judging that a policy's wording looks thematically relevant to the issue. If the briefing does not explicitly reference a policy for an issue, do not include it, even if you think it might apply.
4. For each issue (existing or new), if the briefing discusses a specialist report relevant to it, write up the key information about that report: the organisation or consultant who completed it, when it was done, and what its key findings were that are relevant to the argument for this issue. Only include this if a specialist report is actually discussed for that issue in the briefing — leave it out entirely if none is mentioned, rather than guessing or leaving placeholder text.

For each issue you are given:
- Its label and discipline.
- The policies already linked to it — exact, verbatim wording. Do not cite any policy not listed here or in the full policy library, and do not invent policy references.
- The project's development type — from its recorded sub-sector, and/or however it comes up in the briefing itself. Use both to judge development type; where they conflict, prefer what the briefing actually says.
- The project's full policy library, for identifying newly-discussed policy links (see point 3 above).
- A library of national policy snippet templates, each with an id, a topic, a development type, and up to four separate fields of boilerplate text: NPPF, NPPG, Other National, and Other Guidance. Not every template has content in every field.

This is for drafting working notes, not a polished argument — do not try to craft the perfect argument or write persuasive prose. Your job is simply to capture, in full, the detail of what was actually said about each issue in the transcript: the policy points raised, the position taken, the evidence or approach mentioned, and any sensitivities or concerns flagged. Be thorough and specific rather than concise — do not compress or summarise away detail. Ground every claim in what the briefing note and the linked policies actually say. Do not invent facts, figures, or policy positions not present in the material provided.

For every issue (existing or new), also identify which specific fields of which snippet templates from the library plausibly apply, based on its topic and the project's development type. Match at the individual field level, not the whole template — a template's NPPF text might apply while its NPPG text does not, for example, and each listing below shows you which fields actually have content. This one works differently from the policy matching above: include every field that could reasonably apply — do not narrow it down to a single "best" one, and it is fine to include none if nothing fits. Only ever reference a field that the listing shows as present for that template.

Respond ONLY with valid JSON — no markdown, no explanation. Omit "specialist_report" entirely for an issue if no specialist report was discussed for it:
[
  { "drafting_issue_id": 42, "argument_for": "Our position is...", "specialist_report": "Ecology report prepared by Acme Ecology in March 2025, finding...", "matched_snippet_fields": [{ "issue_type_id": 7, "field": "nppf_text" }, { "issue_type_id": 7, "field": "nppg_text" }, { "issue_type_id": 12, "field": "other_national_text" }], "matched_policy_ids": [3] },
  { "new_issue": true, "suggested_label": "Bat surveys", "suggested_discipline": "Ecology", "argument_for": "Our position is...", "matched_snippet_fields": [], "matched_policy_ids": [] }
]

Only include an issue if the briefing note actually discusses it.`;

export async function draftIssuesFromBriefingNote({ briefingText, issues, policiesByIssue = {}, allPolicies = [], subSectors = [], allIssueTypes = [], customPrompt = null, provider = null }) {
  const issueList = issues.length
    ? issues.map(i => {
        const policies = policiesByIssue[i.id] ?? [];
        const policyLines = policies.length
          ? policies.map(p => {
              const ref = p.policy_reference ? `${p.policy_reference}: ` : '';
              const keyTag = p.is_key_policy ? ' [KEY POLICY]' : '';
              const wording = p.policy_text?.trim() ? `\n    Wording: "${p.policy_text.trim()}"` : '';
              return `  - ${ref}${p.policy_name}${keyTag}${wording}`;
            }).join('\n')
          : '  (no policies linked yet)';
        return `- id:${i.id} | ${i.label}${i.discipline ? ` (${i.discipline})` : ''}\n${policyLines}`;
      }).join('\n')
    : '(none tracked yet — go straight to identifying explicitly-named new issues.)';

  const policyLibrary = allPolicies.length
    ? allPolicies.map(p => {
        const ref = p.policy_reference ? `${p.policy_reference}: ` : '';
        return `- id:${p.id} | ${ref}${p.policy_name}${p.policy_type ? ` (${p.policy_type})` : ''}`;
      }).join('\n')
    : '(none recorded — omit matched_policy_ids for every issue.)';

  const SNIPPET_FIELD_LABELS = {
    nppf_text: 'nppf_text (NPPF)',
    nppg_text: 'nppg_text (NPPG)',
    other_national_text: 'other_national_text (Other National)',
    other_guidance_text: 'other_guidance_text (Other Guidance)',
  };
  const snippetLibrary = allIssueTypes.length
    ? allIssueTypes.map(t => {
        const fields = Object.keys(SNIPPET_FIELD_LABELS).filter(f => t[f]?.trim());
        const fieldText = fields.length
          ? `available fields: ${fields.map(f => SNIPPET_FIELD_LABELS[f]).join(', ')}`
          : 'no fields with content';
        return `- id:${t.id} | ${t.label}${t.development_type ? ` (${t.development_type})` : ' (generic)'} — ${fieldText}`;
      }).join('\n')
    : '(none available — omit matched_snippet_fields for every issue.)';

  const subSectorText = subSectors?.length ? subSectors.join(', ') : '(not recorded on the project)';

  const systemPrompt = customPrompt ?? DEFAULT_DRAFT_ISSUES_FROM_BRIEFING_PROMPT;
  const userMessage = `Briefing note(s):\n<briefing>\n${briefingText.trim().slice(0, 60000)}\n</briefing>\n\nProject's recorded sub-sector(s): ${subSectorText}\n\nExisting drafting issues, with their currently linked policies:\n${issueList}\n\nProject's full policy library (for identifying newly-discussed policy links only — not for grounding the argument text):\n${policyLibrary}\n\nAvailable snippet template library:\n${snippetLibrary}`;

  const resolvedProvider = await resolveProvider('planning_statement_helpers', provider);
  const responseText = await callLLM({
    provider: resolvedProvider,
    model: MODEL_SONNET,
    maxTokens: 8000,
    system: systemPrompt,
    prompt: userMessage,
  });

  const raw = responseText.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(r => ({
      ...r,
      argument_for: r.argument_for ? noEmDash(r.argument_for) : r.argument_for,
      specialist_report: r.specialist_report ? noEmDash(r.specialist_report) : r.specialist_report,
    }));
  } catch {
    console.error('[draftIssuesFromBriefingNote] Failed to parse JSON:', cleaned.slice(0, 300));
    return [];
  }
}

export async function draftArgumentsFromIssueSummaries({ issues, policiesByTrack, provider = null }) {
  const issueList = issues
    .filter(i => i.summary?.trim())
    .map(i => {
      const policies = policiesByTrack?.[i.id] ?? [];
      const policyList = policies.length
        ? '\n  Relevant policies:\n' + policies.map(p => {
            const ref  = p.policy_reference || 'Policy';
            const name = p.policy_name ? ` — ${p.policy_name}` : '';
            const tier = p.policy_type ? ` (${p.policy_type.replace(/_/g, ' ')})` : '';
            const wording = p.relevant_supporting_text?.trim()
              ? `\n    Wording: ${p.relevant_supporting_text.trim().slice(0, 500)}`
              : '';
            return `  - ${ref}${name}${tier}${wording}`;
          }).join('\n')
        : '';
      const existing = i.argument_for?.trim()
        ? `\n  Existing argument: ${i.argument_for.trim().slice(0, 200)}`
        : '';
      return `- id:${i.id} | ${i.label}${i.discipline ? ` (${i.discipline})` : ''}\n  Position note: ${i.summary.trim()}${policyList}${existing}`;
    }).join('\n\n');

  if (!issueList) return [];

  const prompt = `You are a planning consultant building the compliance case for a planning application. Based on the position notes below, draft a substantive argument for each issue — content that would go into the "argument for" section of the compliance notes.

Each argument should:
- Expand the position note into a proper compliance argument
- Reference the relevant policies where provided
- Be written in formal planning language suitable for a planning statement
- Be 3-6 sentences — substantive but not a full essay
- Build on any existing argument rather than repeating it

Issues and position notes:
${issueList}

Respond ONLY with valid JSON — no markdown, no explanation:
[
  { "track_id": 42, "argument_for": "The proposals..." }
]

Only include issues where the position note gives you enough to work with.`;

  const resolvedProvider = await resolveProvider('planning_statement_helpers', provider);
  const responseText = await callLLM({
    provider: resolvedProvider,
    model: MODEL_SONNET,
    maxTokens: 3000,
    prompt,
  });

  const raw = responseText.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(s => ({ ...s, argument_for: noEmDash(s.argument_for) }));
  } catch {
    console.error('[draftArgumentsFromIssueSummaries] Failed to parse JSON:', cleaned.slice(0, 300));
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning argument suggestion (prose chat)
// ─────────────────────────────────────────────────────────────────────────────

export function buildPlanningArgumentSuggestionPrompt({
  text,
  documentBlock,
  documentType,
  documentTitle,
  issues,
  briefingNote,
  policiesByTrack,
  userNotes
}) {
  const docBlock = documentBlock ?? buildFullDocumentBlock(text);

  const briefingSection = briefingNote
    ? `## Project Briefing Note\nThis is background and strategic context for the project — use it to understand the client's overall position, objectives, and sensitivities.\n\n${briefingNote.trim()}`
    : '## Project Briefing Note\nNo briefing note on file.';

  const issuesSection = issues.map(issue => {
    const forText = issue.argument_for?.trim() || 'Nothing recorded yet.';
    const policies = policiesByTrack?.[issue.id] ?? [];
    const policyBlock = policies.length
      ? '\n\n**Relevant policies:**\n' + policies.map(p => {
          const ref = p.policy_reference ? `${p.policy_reference}: ` : '';
          const tier = p.policy_type ? ` (${p.policy_type.replace(/_/g, ' ')})` : '';
          const support = p.relevant_supporting_text?.trim()
            ? `\n  Context: ${p.relevant_supporting_text.trim().slice(0, 300)}`
            : '';
          return `- **${ref}${p.policy_name}**${tier}${support}`;
        }).join('\n')
      : '';
    return `### Issue: ${issue.label} (id:${issue.id})\n**Current compliance assessment:**\n${forText}${policyBlock}`;
  }).join('\n\n---\n\n');

  const userNotesSection = userNotes
    ? `## User Guidance (high priority — follow this where it conflicts with your judgement)\n${userNotes.trim()}`
    : '';

  const issueOutputBlock = issues.map(i =>
    `**Issue: ${i.label}**\n[New sentences or paragraphs to add to the compliance assessment — or "Nothing to add." if this document does not contribute anything new]`
  ).join('\n\n');

  return `You are a planning consultant preparing a planning statement compliance assessment.

${briefingSection}

## Issues and Current Compliance Assessment
${issuesSection}

${userNotesSection}

## Document Being Reviewed
Type: ${documentType}
Title: ${documentTitle || 'Unknown'}

Read the document carefully. Then read the current compliance assessment notes for each issue above.

Your task is to suggest **additions only** — new sentences or short paragraphs that this document contributes to the compliance assessment for each issue. Only output content that is genuinely new: new technical findings, expert conclusions, or evidence that demonstrates policy compliance and is not already captured in the existing notes.

Requirements:
- Write in flowing prose — formal planning language suitable for a planning statement
- Reference the document inline: name it by title, cite paragraph/section numbers where available
- Where an expert is named, reference them (e.g. "The Heritage Statement concludes...", "The Transport Assessment confirms...")
- Do not use bullet points or numbered lists — prose only
- Keep additions concise: 1–4 sentences per issue unless the document warrants more
- If this document adds nothing new for a particular issue, write exactly: "Nothing to add."
- Output ONLY the additions — no preamble, no explanation, no headings other than the issue labels below
- Do not use em dashes (—); use a comma, colon, or rewrite the sentence instead

Document (conclusions and summaries shown first):
<document>
${docBlock}
</document>

Suggest additions to the compliance assessment for each issue:

${issueOutputBlock}`;
}

export function buildPlanningArgumentSuggestionTemplate({ documentType, documentTitle, issues, briefingNote, policiesByTrack, userNotes }) {
  return buildPlanningArgumentSuggestionPrompt({ documentBlock: '{{DOCUMENT}}', documentType, documentTitle, issues, briefingNote, policiesByTrack, userNotes });
}

export async function suggestPlanningArgumentAddition({ text, documentType, documentTitle, issues, briefingNote, policiesByTrack, userNotes, conversation = [], customPrompt, provider = null }) {
  const initialPrompt = customPrompt ?? buildPlanningArgumentSuggestionPrompt({ text, documentType, documentTitle, issues, briefingNote, policiesByTrack, userNotes });

  const messages = [
    { role: 'user', content: initialPrompt },
    ...conversation
  ];

  console.log('[suggestPlanningArgumentAddition] turns:', messages.length, 'doc chunks approx:', Math.ceil((text?.length ?? 0) / 6000));

  const resolvedProvider = await resolveProvider('planning_statement_helpers', provider);
  const responseText = await callLLM({
    provider: resolvedProvider,
    model: MODEL_SONNET,
    maxTokens: 3000,
    messages,
  });

  return noEmDash(responseText.trim());
}
