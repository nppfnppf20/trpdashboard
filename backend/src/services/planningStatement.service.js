/**
 * Planning statement and planning application workspace service.
 * Handles section generation, assessment generation, template-slot filling,
 * document summarisation, briefing transcript processing, and prose suggestion.
 */

import { client, noEmDash, callClaude, TONE_EXAMPLE_BLOCK, MODEL_SONNET, buildFullDocumentBlock, PLANNING_TIER_LABELS, PLANNING_TIER_ORDER } from './llm.shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants — Assessment
// ─────────────────────────────────────────────────────────────────────────────

export const PLANNING_ASSESSMENT_DEFAULT_PROMPT = `You are writing a planning assessment section for a planning statement. Here's what I want:
- Each of these sections will take an issue.
- It will outline the national policy, the local policy, and any other policy (this could be supplementary or national guidance etc.).
Here's how it will work:
- The layout will be: The argument structure will be: 1) National policy says X. 2) Local policy says X. 3) Any other policy says X 4) This is how the proposals are compliant with those policies. (That will have user notes, like planning notes, an argument that we've come up with and also specialist surveys, the structure will usually be both of those: this is how we believe the proposal meets the scheme and then we've had this specialist report done and this said X and this is why it meets the scheme.)
  5) Then the conclusion will be: therefore we think it meets and then your list of policies it meets that we mentioned at the start.
That's the structure of each section. Sometimes we might not meet policy, in which case we'll need justification or mitigation, but that will also be included in the note. You're basically polishing up the argument structure but just so you know that's how this will look.

The argument structure and the relevant policies have been provided for you. You are absolutely not to hallucinate anything, only to polish up the information that has been provided for you in the tone that has been shown to you.

You are writing the sub-section for the issue "{{ISSUE_LABEL}}"{{ISSUE_DISCIPLINE}}, for the project "{{PROJECT_NAME}}".

{{EXAMPLE_BLOCK}}{{POLICY_STRUCTURE}}

Issue context — policies, assessment notes, and specialist evidence:
{{ISSUE_CONTEXT}}

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

const DEFAULT_SUMMARY_PROMPTS = {
  pre_app: `You are a planning consultant. Summarise this pre-application response from the Local Planning Authority.
Structure your summary with these headings: Overview of Proposal Assessed, Key Concerns Raised, Aspects Supported or Not Objected To, Recommended Changes or Conditions.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  eia_response: `You are a planning consultant. Summarise this EIA Scoping Opinion or Environmental Statement response.
Structure your summary with these headings: Topics Scoped In and Out, Key Technical Concerns or Requirements, Methodology Recommendations, Overarching Comments.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  sci: `You are a planning consultant. Summarise this Statement of Community Involvement or consultation document.
Structure your summary with these headings: Consultation Methods and Timeline, Key Themes from Community Feedback, Objections and Concerns Raised, Support Received, How Feedback Has Been Addressed.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  site_surroundings: `You are a planning consultant. Summarise this Site and Surroundings document.
Structure your summary with these headings: Site Description and Key Characteristics, Surrounding Context and Land Uses, Planning Constraints and Designations, Access and Infrastructure, Development Opportunities and Constraints.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  about_applicant: `You are a planning consultant. This document contains the applicant's standard 'About the Applicant' text for use in a Planning Statement.
Format this content clearly for inclusion in the statement. Preserve the original wording exactly — do not paraphrase, shorten, or alter the substance.
Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  proposed_development: `You are a planning consultant. Summarise this Proposed Development description for inclusion in a Planning Statement.
Structure your summary to cover: the formal description of development, the main components of the proposal, key technical figures or specifications, and any design or sustainability principles.
Write in clear professional prose. Output clean HTML using only <h3>, <p>, <ul>, <li> tags.`,

  briefing_transcript: `You are a senior planning consultant. You have been given a transcript of a project briefing or client meeting relating to a planning application.

Produce a detailed structured summary of this transcript for use as context when drafting a Planning Statement. Your summary should capture:

1. **Proposed Development** — what is being proposed, at what scale, and with what key components, as described in the briefing (not just formal figures — include the strategic framing of what this project is)
2. **Planning Strategy** — the overall planning angle, how the case is being framed, and the key arguments the consultant or applicant intends to make
3. **Planning Benefits** — the material planning benefits identified or discussed
4. **Policy Positioning** — how the proposal is positioned against key national or local policies, any policy conflicts acknowledged and how they are addressed
5. **Constraints and Sensitivities** — known issues, objections, or sensitivities and the approach to addressing them
6. **Specific Instructions or Directions** — any explicit instructions about tone, emphasis, sections to prioritise, or approaches to avoid

Be comprehensive. This summary will be used as background context by an AI when drafting all sections of a Planning Statement — do not compress or omit nuance.
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
      lines.push(`### NPPF — ${issue.label}`);
      lines.push(stripHtml(issueType.nppf_text));
    }
    if (issueType.nppg_text?.trim()) {
      lines.push(`### NPPG — ${issue.label}`);
      lines.push(stripHtml(issueType.nppg_text));
    }
    if (issueType.other_national_text?.trim()) {
      lines.push(`### Other National Policy — ${issue.label}`);
      lines.push(stripHtml(issueType.other_national_text));
    }
    if (issueType.other_guidance_text?.trim()) {
      lines.push(`### Other Guidance — ${issue.label}`);
      lines.push(stripHtml(issueType.other_guidance_text));
    }
  }

  for (const tier of PLANNING_TIER_ORDER) {
    const tierPolicies = linkedPolicies.filter(p => p.policy_type === tier);
    if (!tierPolicies.length) continue;
    lines.push(`### ${PLANNING_TIER_LABELS[tier]}`);
    for (const p of tierPolicies) {
      const ref = p.policy_reference ? `${p.policy_reference} — ` : '';
      const keyTag = p.is_key_policy ? ' [KEY POLICY — quote verbatim in draft]' : '';
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

async function generateLlmSlot({ instruction, variables, briefingSummary }) {
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

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 600,
    system: `You are writing a single short passage for a formal Planning Statement submission.\n\nProject context (for reference — do not reproduce these verbatim as they appear elsewhere in the document):\n${contextLines}${TONE_EXAMPLE_BLOCK}${briefingBlock}\n\nRULES:\n- Write [SOURCE REQUIRED] for any project-specific fact not in the context above\n- Output clean HTML using only <p> tags (and <ul>/<li> only if the instruction explicitly asks for a list)\n- No headings, no markdown, no code blocks\n- Do not use em dashes (—); use a comma, colon, or rewrite the sentence instead`,
    messages: [{ role: 'user', content: instruction }]
  });

  const html = noEmDash(response.content[0].text.trim()
    .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
  return `<div class="llm-generated">${html}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePlanningStatementAssessment({ projectName, section, issues, linkedPoliciesByTrack, evidenceByTrack, issueTypesByTrack = {}, briefingSummary, guidingBrief = null }) {
  const parts = [`<h2>${section.name}</h2>`];

  for (const issue of issues) {
    const linkedPolicies = linkedPoliciesByTrack[issue.id] ?? [];
    const evidence = evidenceByTrack[issue.id] ?? [];
    const issueType = issueTypesByTrack[issue.id] ?? null;
    if (!linkedPolicies.length && !issue.argument_for?.trim() && !issue.policy_national?.trim() && !evidence.length && !issueType) continue;
    console.log(`[generatePlanningStatementAssessment] generating issue: ${issue.label}`);
    const html = await generateSingleAssessmentIssue({ projectName, section, issue, linkedPolicies, evidence, issueType, briefingSummary, guidingBrief });
    parts.push(html);
  }

  return parts.join('\n\n');
}

export async function generateSingleAssessmentIssue({ projectName, section, issue, linkedPolicies, evidence, issueType = null, briefingSummary, guidingBrief = null }) {
  const exampleBlock = section.example_text?.trim()
    ? `Match the tone and style of this example. Use NO content from it — all content must come from the notes and policies provided:\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)}\n</example>\n\n`
    : '';

  const customPromptTemplate = section.generation_prompt?.trim() || null;

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use to inform strategic direction, planning arguments, and framing — do not reproduce verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Guiding Brief\nThe following is practice guidance for writing this type of document. Use it to inform your approach, structure, and emphasis where relevant — it is directional, not a script. Apply professional judgement and only follow it where it genuinely applies to the material provided.\n\n${guidingBrief.guidance_content.trim()}`
    : '';

  const systemPrompt = `You are a planning consultant drafting formal Planning Statements. You output clean HTML only. Every paragraph is a <p> tag, headings are <h2> or <h3>, bold is <strong>. Never use **, *, #, or --- — that is an error. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.${TONE_EXAMPLE_BLOCK}${briefingBlock}${guidingBlock}`;

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

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = noEmDash(response.content[0].text.trim()
    .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
  return `<div class="llm-generated">${raw}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statement section generation (prompt-based)
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePlanningStatementSection({ section, variables, sectionNumber, briefingSummary, guidingBrief = null }) {
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
    ? `The following example shows the target tone and structure. Match the style — do NOT use any content from it:\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)}\n</example>\n\n`
    : '';

  const fullPrompt = outputVarInstruction + numberingInstruction + exampleBlock + prompt;

  const briefingBlock = briefingSummary?.trim()
    ? `\n\nBriefing context (use this to inform strategic direction, framing, and planning arguments — do not reproduce it verbatim):\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}`
    : '';

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Guiding Brief\nThe following is practice guidance for writing this type of document. Use it to inform your approach, structure, and emphasis where relevant — it is directional, not a script. Apply professional judgement and only follow it where it genuinely applies to the material provided.\n\n${guidingBrief.guidance_content.trim()}`
    : '';

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4096,
    system: `You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority. Output clean HTML only — no markdown. Every paragraph is <p>, section headings are <h2>, subsection headings are <h3>, lists are <ul>/<li>, bold is <strong>. Never use **, *, #, or --- — those are errors. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.\n\nCRITICAL RULE: If you need to state a fact, figure, name, date, designation, measurement, or project-specific claim that is not explicitly present in the content provided to you, write [SOURCE REQUIRED] in its place. Never invent or infer project-specific information.${TONE_EXAMPLE_BLOCK}${briefingBlock}${guidingBlock}`,
    messages: [{ role: 'user', content: fullPrompt }]
  });

  let output = noEmDash(response.content[0].text.trim()
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

export async function generateFromTemplate({ section, variables, briefingSummary }) {
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
    const slotHtml = await generateLlmSlot({ instruction, variables, briefingSummary });
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

export async function summariseDocument(text, fileName, docType, customPrompt = null) {
  const systemPrompt = customPrompt ?? getDefaultSummaryPrompt(docType);
  const userPrompt = `Document: ${fileName || 'Untitled'}\n\n${text.slice(0, 80000)}`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  return response.content[0].text.trim();
}

export async function suggestTranscriptUpdates(text) {
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

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Transcript:\n\n${text.slice(0, 80000)}` }]
  });

  const raw = response.content[0].text.trim();
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

export async function incorporatePlanningAssessment({ paragraphs, documentText, filename, issues, linkedPoliciesByTrack, issueTypesByTrack = {}, userNotes = null, projectName = '', guidingBrief = null, projectBrief = null }) {
  // Build rich per-issue context (policies + argument notes) for each issue
  const issueContextParts = issues.map(issue => {
    const linkedPolicies = linkedPoliciesByTrack[issue.id] ?? [];
    const issueType = issueTypesByTrack[issue.id] ?? null;
    const ctx = buildPlanningAppIssueContext(issue, linkedPolicies, [], issueType);
    return `### Issue: ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}\n${ctx}`;
  }).join('\n\n---\n\n');

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Guiding Brief\n${guidingBrief.guidance_content.trim()}`
    : '';

  const projectBriefBlock = projectBrief?.trim()
    ? `\n\n## Project Brief\n${projectBrief.trim().slice(0, 4000)}`
    : '';

  const userNotesBlock = userNotes?.trim()
    ? `## User Guidance — HIGH PRIORITY\nFollow these instructions precisely:\n${userNotes.trim()}\n\n`
    : '';

  const paraBlock = paragraphs.map(p => `${p.id}:\n${p.html}`).join('\n\n');

  const prompt = `You are updating the Planning Assessment section of a formal Planning Statement to incorporate evidence from a new specialist report.

Project: ${projectName}${guidingBlock}${projectBriefBlock}

## Structure of this section
The Planning Assessment is organised by issue. Each issue sub-section follows this fixed structure:
1. Policy framework — what the relevant national, local, and other policies require (do NOT alter these statements)
2. Compliance argument — how the proposals satisfy those policies, citing expert evidence and specialist reports
3. Concluding sentence — "The proposals are therefore considered to comply with [policy list]" (preserve the policy list)

When incorporating the new document:
- Add its findings to the compliance argument paragraphs only
- Reference the document by name and cite paragraph/section numbers where available (e.g. "The Transport Assessment (para 4.3) confirms...")
- Do not alter policy statements or the concluding sentence
- Leave a paragraph unchanged if the document adds nothing relevant to it
- You may add new paragraphs (use id "INSERT_AFTER_[id]") where the document warrants additional compliance evidence

## Key Issues and Policy Context
${issueContextParts}

## Document Being Incorporated: ${filename}
${documentText}

## In-Scope Paragraphs
${userNotesBlock}${paraBlock}

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {"id": "p3", "html": "<p>Updated paragraph...</p>"},
  {"id": "INSERT_AFTER_p3", "html": "<p>New paragraph...</p>"}
]`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = noEmDash(response.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  return JSON.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing-driven argument drafting (planning app)
// ─────────────────────────────────────────────────────────────────────────────

export async function draftKeyIssueSummariesFromBriefing({ briefingSummary, issues }) {
  const issueList = issues.map(i =>
    `- id:${i.id} | ${i.label}${i.discipline ? ` (${i.discipline})` : ''}${i.summary?.trim() ? `\n  Existing note: ${i.summary.trim().slice(0, 150)}` : ''}`
  ).join('\n');

  const prompt = `You are a planning consultant reviewing a briefing note for a planning application. Based on the briefing, draft a brief position note for each key issue listed below.

Each note should be 2-4 sentences capturing: the consultant's position on this issue, the key evidence or approach, and any sensitivities flagged in the briefing. Write as working notes for the consultant — concise and practical, not formal submission language.

Briefing note:
<briefing>
${briefingSummary}
</briefing>

Key issues:
${issueList}

Respond ONLY with valid JSON — no markdown, no explanation:
[
  { "track_id": 42, "summary": "Our position is..." }
]

Only include issues where the briefing contains relevant content. Omit issues entirely if the briefing has nothing relevant.`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
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

export async function draftArgumentsFromIssueSummaries({ issues, policiesByTrack }) {
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

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
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
          const ref = p.policy_reference ? `${p.policy_reference} — ` : '';
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

export async function suggestPlanningArgumentAddition({ text, documentType, documentTitle, issues, briefingNote, policiesByTrack, userNotes, conversation = [], customPrompt }) {
  const initialPrompt = customPrompt ?? buildPlanningArgumentSuggestionPrompt({ text, documentType, documentTitle, issues, briefingNote, policiesByTrack, userNotes });

  const messages = [
    { role: 'user', content: initialPrompt },
    ...conversation
  ];

  console.log('[suggestPlanningArgumentAddition] turns:', messages.length, 'doc chunks approx:', Math.ceil((text?.length ?? 0) / 6000));

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 3000,
    messages
  });

  return noEmDash(response.content[0].text.trim());
}
