/**
 * Appeal tool service.
 * Handles appeal argument generation, document review, point extraction,
 * briefing-driven argument drafting, and prose suggestion flows.
 */

import { client, noEmDash, callClaude, TONE_EXAMPLE_BLOCK, MODEL_SONNET, buildFullDocumentBlock, HOUSE_STYLE_BLOCK } from './llm.shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_DRAFT_PROMPT = `You are an experienced planning appeal consultant drafting a formal appeal document.
You will be given the working argument notes for an appeal — the case built up across all key issues — and you must polish these into a well-structured, professionally written document.

Instructions:
- Write in formal planning language suitable for submission to the Planning Inspectorate
- Structure the document clearly with numbered sections and sub-sections
- Draw on ALL the argument notes provided — do not omit issues
- Where argument_against notes set out the opposing position, acknowledge it before rebutting with the argument_for
- Produce clean HTML using <h2> for main sections, <h3> for sub-sections, <p> for body text, <ol>/<li> for numbered lists
- Do not include a title — start directly with the first section
- Do not add placeholder text or "[INSERT X]" gaps — write the full document from the material provided
- Do not number paragraphs — do not prefix paragraphs with numbers like 1.1, 2.3 etc.
- Do not invent facts, policy references, or project details not present in the material provided`;

// ─────────────────────────────────────────────────────────────────────────────
// Issue context builder (shared with draft generation)
// ─────────────────────────────────────────────────────────────────────────────

export function buildIssueContext(issues, evidenceByTrack = {}) {
  return issues.map(issue => {
    const lines = [`## ${issue.label}${issue.discipline ? ` (${issue.discipline})` : ''}`];
    if (issue.argument_against) lines.push(`Opposing position:\n${issue.argument_against}`);
    if (issue.argument_for)     lines.push(`Our case:\n${issue.argument_for}`);
    if (!issue.argument_against && !issue.argument_for) lines.push('(No notes yet — acknowledge this issue but flag it as to be developed.)');

    const evidence = evidenceByTrack[issue.id];
    if (evidence?.length) {
      const evidenceLines = evidence.map(e => {
        const source = e.source_doc_title ? `[${e.source_doc_title}]` : '[Document]';
        const quote = e.quote_snapshot ? `"${e.quote_snapshot.slice(0, 500)}"` : '(no direct quote)';
        const detail = e.detailed_summary ?? e.headline ?? '';
        return `- ${source}: ${quote}\n  ${detail}`;
      });
      lines.push(`Source evidence from documents:\n${evidenceLines.join('\n')}`);
    }

    return lines.join('\n');
  }).join('\n\n---\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Appeal argument generation
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_GENERATE_APPEAL_ARGUMENT_PROMPT = `You are a planning appeal consultant generating a structured working argument summary.

Produce a structured working argument summary in HTML. Use these five sections:
1. <h2>Appeal Overview</h2> — brief summary of the appeal and the development
2. <h2>Reasons for Refusal</h2> — summarise each reason and its significance
3. <h2>Argument by Issue</h2> — for each key issue, outline both the opposing position and the initial argument direction
4. <h2>Risks and Unknowns</h2> — identify gaps, risks, and what evidence is still needed
5. <h2>Next Steps</h2> — practical actions to advance the case

Use <p> for body text. Keep it concise but substantive — this is a working document, not a final submission.`;

export async function generateAppealArgument({ projectName, refusalReasons, keyIssues, initialNotes, customPrompt = null }) {
  const reasonsText = refusalReasons.length
    ? refusalReasons.map((r, i) => `${i + 1}. ${r.title}${r.summary ? `: ${r.summary}` : ''}${r.risk_level ? ` [${r.risk_level}]` : ''}`).join('\n')
    : 'None recorded';

  const issuesText = keyIssues.length
    ? keyIssues.map(k => `- ${k.label}${k.discipline_group ? ` (${k.discipline_group})` : ''}`).join('\n')
    : 'None recorded';

  const notesBlock = initialNotes?.trim()
    ? `\n\nInitial strategic notes from the team:\n${initialNotes.trim()}`
    : '';

  const systemPrompt = customPrompt ?? DEFAULT_GENERATE_APPEAL_ARGUMENT_PROMPT;
  const userMessage = `Project: ${projectName}\n\nReasons for refusal:\n${reasonsText}\n\nKey issues to address:\n${issuesText}${notesBlock}`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  const raw = response.content[0].text.trim();
  return noEmDash(raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Document review against working argument
// ─────────────────────────────────────────────────────────────────────────────

export async function reviewDocumentAgainstArgument({ documentText, currentArgument, keyIssues, refusalReasons, filename }) {
  const issueLabels = keyIssues.map(k => k.label).join(', ') || 'none listed';
  const reasonTitles = refusalReasons.map(r => r.title).join('; ') || 'none listed';

  const plainArgument = currentArgument.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const prompt = `You are a planning appeal consultant reviewing a document against the current working argument for an appeal.

Document filename: ${filename}

Key issues in this appeal: ${issueLabels}
Reasons for refusal: ${reasonTitles}

Current working argument (condensed):
<current_argument>
${plainArgument.slice(0, 6000)}
</current_argument>

Document to review:
<document>
${documentText.slice(0, 8000)}
</document>

Respond ONLY with valid JSON in this exact shape (no markdown, no explanation):
{
  "relevant": true or false,
  "relevance_summary": "one sentence explaining why this document is or isn't relevant",
  "affected_issues": ["issue label 1", "issue label 2"],
  "extracted_points": {
    "helpful": ["point 1", "point 2"],
    "harmful": ["point 1"],
    "procedural": ["point 1"],
    "policy": ["point 1"]
  },
  "argument_impact": "strengthens" | "weakens" | "qualifies" | "neutral" | "new_sub_point",
  "impact_explanation": "one or two sentences",
  "bullet_suggestions": ["Add under [Issue]: ...", "Under [Issue], note that ..."],
  "draft_paragraph": "optional suggested paragraph text to add to the argument, or null",
  "caution_note": "any verification needed or contradictions to flag, or null"
}`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formal appeal draft document generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDraftSection({ section, projectName, draftTypeName, issueContext, guidingBrief = null, projectBrief = null, exampleDoc = null }) {
  const instructions = section.generation_prompt?.trim() ||
    `Write the "${section.name}" section of a ${draftTypeName}. Use formal planning language suitable for submission to the Planning Inspectorate. Produce clean HTML: <h2> for the section heading, <p> for body text, <ol>/<li> for numbered lists. Do not add placeholder text — write the full section from the material provided.`;

  const sectionExampleBlock = section.example_text?.trim()
    ? `## Example Document\nThe following is a real example section from this type of document written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Most content is project-specific and must not be reproduced. The guiding brief takes precedence — do not follow the example more closely than the guiding brief.\n<section_example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)}\n</section_example>\n`
    : '';

  const contextBlocks = buildContextBlocks({ guidingBrief, projectBrief, exampleDoc });

  const prompt = `You are drafting the "${section.name}" section of a formal planning appeal document. Output HTML only — no markdown.

CONTENT INSTRUCTIONS:
${instructions}

${sectionExampleBlock}${contextBlocks ? contextBlocks + '\n\n' : ''}Project: ${projectName}
Document: ${draftTypeName}

Working argument notes:
${issueContext}

FORMAT RULES (mandatory):
- Your entire response must be valid HTML
- Begin with <h2>${section.name}</h2>
- Every paragraph must be wrapped in <p>...</p> tags
- Numbered lists must use <ol><li>...</li></ol>
- Bullet lists must use <ul><li>...</li></ul>
- Bold text must use <strong>...</strong>
- Do not use **, *, #, ---, or any other markdown characters at all
- Do not use em dashes (—); use a comma, colon, or rewrite the sentence instead
- Do not number individual paragraphs — do not prefix paragraphs with numbers like 7.1, 7.2 etc.`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 2000,
    system: `You are a planning appeal consultant. You output clean HTML documents. You never use markdown — every paragraph is a <p> tag, lists are <ol> or <ul>, bold is <strong>. If you use **, *, or --- you have made an error. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.${HOUSE_STYLE_BLOCK}`,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  return noEmDash(raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
}

export async function generateAppealDraft({ projectName, draftTypeName, sections, issues, evidenceByTrack = {}, guidingBrief = null, projectBrief = null, exampleDoc = null }) {
  const issueContext = buildIssueContext(issues, evidenceByTrack);
  const contextBlocks = buildContextBlocks({ guidingBrief, projectBrief, exampleDoc });

  if (!sections || sections.length === 0) {
    const contextSection = contextBlocks ? `\n\n${contextBlocks}` : '';

    const prompt = `${DEFAULT_DRAFT_PROMPT}${contextSection}

Project: ${projectName}
Document type: ${draftTypeName}

Working argument notes by issue:
${issueContext}

Produce the complete ${draftTypeName} as HTML now.`;

    const response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = response.content[0].text.trim();
    return noEmDash(raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
  }

  const parts = [];
  for (const section of sections) {
    console.log(`[generateAppealDraft] generating section: ${section.name}`);
    const html = await generateDraftSection({ section, projectName, draftTypeName, issueContext, guidingBrief, projectBrief, exampleDoc });
    parts.push(html);
  }

  return parts.join('\n\n');
}

export const DEFAULT_PA_APPEAL_DRAFT_PROMPT = `You are a planning appeal consultant preparing a {{DOCUMENT_TYPE}} for a planning appeal.

Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured:

{{GUIDING_BRIEF}}

You also have access to the project brief which sets out the project background and context, and the key issue notes which set out the planning case for each issue.

Using only the information you have been given, write a first draft of this document following the structure and approach set out in the guiding brief above.

Important:
- Do not invent facts, arguments, or technical information. Every statement must be grounded in the material provided.
- If the notes are thin on a particular issue, reflect that honestly — do not fabricate supporting content.
- Write in formal planning language appropriate for submission to the Planning Inspectorate.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ol>/<li> for numbered lists, <ul>/<li> for bullets
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)`;

// Single broad-prompt generation — for document types where the user controls
// the whole prompt rather than per-section prompts.
// Supports {{GUIDING_BRIEF}} variable substitution in the prompt text.
const STARTING_DOC_VARS = [
  { slug: 'decision_notice',         variable: 'DECISION_NOTICE',         label: 'Decision Notice' },
  { slug: 'officers_report',         variable: 'OFFICERS_REPORT',         label: "Officer's Report" },
  { slug: 'planning_statement',      variable: 'PLANNING_STATEMENT',      label: 'Planning Statement' },
  { slug: 'committee_report',        variable: 'COMMITTEE_REPORT',        label: 'Committee Report' },
  { slug: 'committee_minutes',       variable: 'COMMITTEE_MINUTES',       label: 'Committee Minutes' },
  { slug: 'stage1_review',            variable: 'STAGE1_REVIEW',           label: 'Stage 1 Review' },
  { slug: 'other',                   variable: 'OTHER_DOCS',              label: 'Other Documents' },
  { slug: 'hlpv_data',               variable: 'HLPV_DATA',               label: 'HLPV Tool Data' },
  { slug: 'additional_designations', variable: 'ADDITIONAL_DESIGNATIONS', label: 'Additional Designations & Site Notes' },
  { slug: 'socio_data',              variable: 'SOCIO_DATA',              label: 'Socio-economic Data' },
];

export async function generateAppealDraftFromPrompt({ projectName, draftTypeName, typePrompt, issues, guidingBrief = null, projectBrief = null, startingDocs = {}, briefingNotes = '' }) {
  const issueContext = buildIssueContext(issues, {});

  const cleanProjectBrief = projectBrief?.trim()
    ? projectBrief.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
    : '(no project brief uploaded)';

  const cleanBriefingNotes = briefingNotes?.trim() || '(no briefing notes provided for this document)';

  const basePrompt = typePrompt?.trim() || DEFAULT_DRAFT_PROMPT;

  // Substitute all known variables including starting doc slots
  let instructions = basePrompt
    .replace(/\{\{GUIDING_BRIEF\}\}/g, guidingBrief?.guidance_content?.trim() ?? '(no guiding brief set)')
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{DOCUMENT_TYPE\}\}/g, draftTypeName)
    .replace(/\{\{PROJECT_BRIEF\}\}/g, cleanProjectBrief)
    .replace(/\{\{BRIEFING_NOTES\}\}/g, cleanBriefingNotes)
    .replace(/\{\{STYLE_GUIDE\}\}/g, guidingBrief?.style_example?.trim() || '(no style example set for this document type)');

  for (const { slug, variable } of STARTING_DOC_VARS) {
    instructions = instructions.replace(
      new RegExp(`\\{\\{${variable}\\}\\}`, 'g'),
      startingDocs[slug]?.trim() || '(not provided)'
    );
  }

  const projectBriefBlock = !basePrompt.includes('{{PROJECT_BRIEF}}') && projectBrief?.trim()
    ? `\nProject brief:\n${cleanProjectBrief}`
    : '';

  // Auto-append any starting docs not explicitly referenced in the prompt
  const appendedDocLines = STARTING_DOC_VARS
    .filter(({ slug, variable }) => startingDocs[slug]?.trim() && !basePrompt.includes(`{{${variable}}}`))
    .map(({ slug, label }) => `${label}:\n${startingDocs[slug].trim()}`)
    .join('\n\n');
  const startingDocsBlock = appendedDocLines
    ? `\n\nSource documents:\n${appendedDocLines}`
    : '';

  // Auto-append briefing notes if not explicitly referenced in the prompt
  const briefingNotesBlock = briefingNotes?.trim() && !basePrompt.includes('{{BRIEFING_NOTES}}')
    ? `\n\nProject Briefing Notes:\n${briefingNotes.trim()}`
    : '';

  // Templates that reference {{STYLE_GUIDE}} (e.g. pre_application_request) carry the
  // style example inline via the substitution above — don't also auto-append this block.
  const styleExampleBlock = (!basePrompt.includes('{{STYLE_GUIDE}}') && guidingBrief?.style_example?.trim())
    ? `\n\n## Example Document\nThe following is a real example of this document type written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Some elements are universal — how sections open, how conclusions are framed — and can be reflected in your output. Most content is project-specific and must not be reproduced. The guiding brief takes precedence over this example — do not follow the example more closely than the guiding brief.\n\n${guidingBrief.style_example.trim()}`
    : '';

  const prompt = `${instructions}${projectBriefBlock}${startingDocsBlock}${briefingNotesBlock}${styleExampleBlock}

Project: ${projectName}
Document type: ${draftTypeName}

Working argument notes by issue:
${issueContext}

Produce the complete ${draftTypeName} as HTML now.`;

  const raw = (await client.messages.stream({
    model: MODEL_SONNET,
    max_tokens: 64000,
    system: `You are a planning appeal consultant. You output clean HTML documents. You never use markdown — every paragraph is a <p> tag, lists are <ol> or <ul>, bold is <strong>. Never use em dashes (—).

The guiding brief describes how this type of document should be structured and approached — use it for format, framing, and emphasis. The project brief and other provided materials are your only source of project-specific content. If the guiding brief describes a section or topic for which nothing has been provided in the project materials, omit it — do not invent content to fill it. Never fabricate facts, figures, policy references, site details, or project-specific claims.${HOUSE_STYLE_BLOCK}`,
    messages: [{ role: 'user', content: prompt }]
  }).finalText()).trim();
  return noEmDash(raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue-ordered section generation — for draft types (e.g. Planning Statement v3's
// Policy/Assessment sections) that want one subsection per project issue, each
// drawing on that issue's linked policies and any development-type-specific
// snippets (admin_console.issue_types), rather than one flat call for the section.
// ─────────────────────────────────────────────────────────────────────────────

const POLICY_TIER_LABELS = { national: 'National Policy', local: 'Local Policy', neighbourhood: 'Neighbourhood Policy', supplementary: 'Supplementary Guidance', other: 'Other Policy' };
const POLICY_TIER_ORDER = ['national', 'local', 'neighbourhood', 'supplementary', 'other'];

// New context this adds beyond what generateAppealDraftFromPrompt already injects
// (guiding brief, project brief, briefing notes, that issue's own argument notes).
function buildIssueSnippetContext(linkedPolicies = [], issueType = null) {
  const lines = [];

  if (issueType) {
    if (issueType.nppf_text?.trim())           lines.push(`### NPPF\n${noEmDash(issueType.nppf_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())}`);
    if (issueType.nppg_text?.trim())           lines.push(`### NPPG\n${noEmDash(issueType.nppg_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())}`);
    if (issueType.other_national_text?.trim()) lines.push(`### Other National Policy\n${noEmDash(issueType.other_national_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())}`);
    if (issueType.other_guidance_text?.trim()) lines.push(`### Other Guidance\n${noEmDash(issueType.other_guidance_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())}`);
  }

  for (const tier of POLICY_TIER_ORDER) {
    const tierPolicies = linkedPolicies.filter(p => p.policy_type === tier);
    if (!tierPolicies.length) continue;
    lines.push(`### ${POLICY_TIER_LABELS[tier]}`);
    for (const p of tierPolicies) {
      const ref = p.policy_reference ? `${p.policy_reference}: ` : '';
      const keyTag = p.is_key_policy ? ' [KEY POLICY — quote verbatim in draft]' : '';
      lines.push(`${ref}${p.policy_name}${keyTag}`);
      if (p.policy_text?.trim())              lines.push(`Policy wording: "${p.policy_text.trim()}"`);
      if (p.relevant_supporting_text?.trim()) lines.push(`Supporting context: ${p.relevant_supporting_text.trim().slice(0, 400)}`);
    }
  }

  return lines.join('\n\n');
}

// sectionPromptTemplate may use {{ISSUE_LABEL}}, {{ISSUE_DISCIPLINE}}, and
// {{ISSUE_CONTEXT}} (the linked-policy / issue-type snippet block above) in
// addition to the variables generateAppealDraftFromPrompt already substitutes.
export async function generateIssueOrderedSection({
  sectionName, sectionPromptTemplate, projectName, issues,
  linkedPoliciesByTrack = {}, issueTypesByTrack = {},
  guidingBrief = null, projectBrief = null, startingDocs = {}, briefingNotes = '',
}) {
  const parts = [`<h2>${sectionName}</h2>`];

  for (const issue of issues) {
    const linkedPolicies = linkedPoliciesByTrack[issue.id] ?? [];
    const issueType = issueTypesByTrack[issue.id] ?? null;

    if (!linkedPolicies.length && !issueType && !issue.argument_for?.trim() && !issue.argument_against?.trim()) {
      parts.push(`<h3>${issue.label}</h3>`);
      continue;
    }

    const issueContext = buildIssueSnippetContext(linkedPolicies, issueType);
    const issuePrompt = sectionPromptTemplate
      .replace(/\{\{ISSUE_LABEL\}\}/g, issue.label)
      .replace(/\{\{ISSUE_DISCIPLINE\}\}/g, issue.discipline ? ` (${issue.discipline})` : '')
      .replace(/\{\{ISSUE_CONTEXT\}\}/g, issueContext || '(no linked policies or policy snippets recorded for this issue)');

    const html = await generateAppealDraftFromPrompt({
      projectName,
      draftTypeName: `${sectionName} — ${issue.label}`,
      typePrompt: issuePrompt,
      issues: [issue],
      guidingBrief,
      projectBrief,
      startingDocs,
      briefingNotes,
    });
    parts.push(html);
  }

  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Amend working draft from an uploaded document (briefing note, specialist
// report, expert evidence, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const DOC_TYPE_INSTRUCTIONS = {
  project_briefing: `A project briefing note is provided below. It contains new instructions, updated strategy, revised arguments, or additional project-specific information from the team following a meeting.

Read it carefully alongside the current draft and return an amended version that incorporates the guidance. Where the briefing note updates a position or argument, reflect that update precisely. Make only the changes clearly indicated or implied by the briefing note — do not rewrite sections it does not address.`,

  specialist_report: `A specialist or technical report is provided below (for example a heritage, ecology, landscape, highways or acoustic report). It may have been produced by a consultant for this appeal.

Read it alongside the current draft. Extract the relevant technical conclusions, findings and recommendations. Incorporate them into the appropriate sections of the draft where they support or inform the case. Do not introduce technical claims that are not in the report.`,

  expert_evidence: `Expert evidence or a proof of evidence is provided below. It sets out the expert's conclusions on the matters in dispute.

Read it alongside the current draft. Identify where the expert's conclusions are relevant to the arguments in the draft and incorporate those conclusions, cross-referencing the evidence where appropriate. Do not misrepresent or overstate the expert's position.`,

  revised_document: `A revised version of a source document is provided below (for example an updated planning statement, revised drawings description, or amended conditions schedule).

Read it alongside the current draft. Identify what has changed and update the draft to reflect those changes, correcting any references or arguments that depend on the earlier version.`,

  other: `A supporting document is provided below.

Read it alongside the current draft and incorporate any information that is relevant to the arguments or content of the draft. Do not introduce content that is not in the document.`,
};

export async function amendDraftFromBriefing({ currentHtml, docContent, docType = 'project_briefing', draftTypeName }) {
  const docInstructions = DOC_TYPE_INSTRUCTIONS[docType] ?? DOC_TYPE_INSTRUCTIONS.other;

  const prompt = `You are reviewing a working draft of a ${draftTypeName} for a planning appeal.

${docInstructions}

Rules applying to all document types:
- Preserve the document structure, headings and overall organisation
- Do not invent facts, policy references or content not in the document or current draft
- Write in formal planning language appropriate for submission to the Planning Inspectorate
- Do not number paragraphs

Uploaded document:
${docContent}

---

Current draft:
${currentHtml}

---

Return the complete amended document as clean HTML only:
- <h2> for main section headings, <h3> for sub-sections
- <p> for body paragraphs, <ol>/<ul>/<li> for lists
- No markdown, no em dashes, no document title`;

  const raw = (await client.messages.stream({
    model: MODEL_SONNET,
    max_tokens: 16000,
    system: `You are a planning appeal consultant. You output clean HTML documents. You never use markdown. Never use em dashes (—).${HOUSE_STYLE_BLOCK}`,
    messages: [{ role: 'user', content: prompt }],
  }).finalText()).trim();
  return noEmDash(raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared prompt context builder
// ─────────────────────────────────────────────────────────────────────────────

function buildContextBlocks({ guidingBrief = null, projectBrief = null, exampleDoc = null } = {}) {
  const blocks = [];

  if (guidingBrief?.guidance_content?.trim()) {
    blocks.push(`## Document Type Brief
This describes what this document type is, what it must achieve, and the structure it should follow. Use this as your primary guide to the document's purpose and required content.

${guidingBrief.guidance_content.trim()}`);
  }

  if (projectBrief?.trim()) {
    blocks.push(`## Project Brief
This sets out the project-specific strategy, context, and client position. Use it to understand the background and ensure all content is aligned with the project's goals.

${projectBrief.trim().slice(0, 4000)}`);
  }

  if (exampleDoc?.text?.trim()) {
    blocks.push(`## Example Document
The following is a real example of this document type written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Some elements are universal — how sections open, how conclusions are framed — and can be reflected in your output. Most content is project-specific and must not be reproduced. The guiding brief takes precedence over this example — do not follow the example more closely than the guiding brief.

${exampleDoc.text.trim().slice(0, 6000)}`);
  }

  return blocks.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Document incorporation — Option C: scoping + targeted paragraph update
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SCOPE_INCORPORATION_PROMPT = `You are reviewing which paragraphs of a planning document are directly relevant to a new specialist report.

Identify which paragraph IDs this document directly speaks to — i.e. where incorporating evidence from this document would genuinely improve or update that paragraph. Only include paragraphs where this document has something specific and relevant to contribute. Do not include paragraphs from unrelated disciplines or topics.

Respond ONLY with valid JSON, no markdown:
{
  "relevant_ids": ["p2", "p5", "p8"],
  "summary": "One sentence explaining what this document addresses and which sections are affected."
}`;

export async function scopeDocumentIncorporation({ paragraphs, documentText, filename, issues, guidingBrief = null, customPrompt = null }) {
  const issueLabels = issues.map(i => i.label).join(', ') || 'none listed';

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\nDocument type brief: ${guidingBrief.guidance_content.trim().slice(0, 500)}\n`
    : '';

  const paraList = paragraphs
    .map(p => `${p.id}: ${p.text.slice(0, 120)}${p.text.length > 120 ? '...' : ''}`)
    .join('\n');

  const systemPrompt = customPrompt ?? DEFAULT_SCOPE_INCORPORATION_PROMPT;

  const userMessage = `${guidingBlock}Key issues: ${issueLabels}
Document being incorporated: ${filename}

Draft paragraphs (id: preview):
${paraList}

Document content:
${documentText}`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  const raw = response.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(raw);
}

export const DEFAULT_INCORPORATE_APPEAL_PROMPT = `You are updating a formal planning appeal document to incorporate content from an uploaded document. The uploaded document may be a project briefing note, a specialist technical report, expert evidence, revised source material, or other supporting information.

The following paragraphs are unlocked for editing — treat them as the sections of the document where changes are permitted. You must actively look for ways to incorporate the uploaded content into these paragraphs. Where the uploaded document provides new information, updated arguments, additional evidence, or revised instructions that relate to a paragraph's subject matter, update that paragraph to reflect it. Only leave a paragraph unchanged if the uploaded document genuinely has no bearing on it whatsoever.

Where the uploaded document is a project briefing note: follow any strategic direction, updated arguments or specific instructions it contains, even if they require significant rewrites.
Where it is a technical report: incorporate the relevant conclusions, findings and recommendations into the appropriate paragraphs.

You may also insert new paragraphs where the uploaded document introduces content that has no home in the existing paragraphs. Use id format "INSERT_AFTER_[existing_id]" for these.

Write in formal planning language. Do not use em dashes. Do not number paragraphs.

Return ONLY a valid JSON array — no markdown, no explanation. Include every paragraph you are returning, whether changed or not if it needs to appear in the output:
[
  {"id": "p3", "html": "<p>Updated paragraph...</p>"},
  {"id": "INSERT_AFTER_p3", "html": "<p>New paragraph inserted after p3...</p>"},
  {"id": "p7", "html": "<p>Updated paragraph...</p>"}
]`;

export async function incorporateTargetedParagraphs({ paragraphs, documentText, filename, issues, userNotes = null, projectName = '', draftTypeName = '', guidingBrief = null, projectBrief = null, exampleDoc = null, customPrompt = null }) {
  const issueContext = buildIssueContext(issues);
  const contextBlocks = buildContextBlocks({ guidingBrief, projectBrief, exampleDoc });

  const userNotesBlock = userNotes?.trim()
    ? `## User Guidance — HIGH PRIORITY\nFollow these instructions precisely. They override your own judgement:\n${userNotes.trim()}\n\n`
    : '';

  const paraBlock = paragraphs
    .map(p => `${p.id}:\n${p.html}`)
    .join('\n\n');

  const prompt = `You are a planning consultant revising a ${draftTypeName} for the project "${projectName}".

An uploaded document is provided below. Read it carefully. It may be a project briefing note with strategic direction and revised arguments, a specialist technical report, expert evidence, or other supporting material.${userNotesBlock}

UPLOADED DOCUMENT: ${filename}
${documentText}

---

SELECTED PARAGRAPHS TO REVISE:
${paraBlock}

---

Your task: revise the paragraphs above to incorporate the uploaded document. For each paragraph, consider what the uploaded document adds, changes or requires and update it accordingly. Do not leave paragraphs unchanged just because changes are difficult. Where the uploaded document is a briefing note with strategic direction, follow those instructions even if they require significant rewrites. Where it is a technical report, incorporate the relevant conclusions and findings.

You may insert new paragraphs using id "INSERT_AFTER_[id]" where the uploaded document introduces content with no home in the existing paragraphs.

Write in formal planning language — no em dashes, no paragraph numbers.

Return ONLY a JSON array of paragraphs you changed or added. Omit paragraphs you did not change:
[{"id": "p2", "html": "<p>...</p>"}, {"id": "INSERT_AFTER_p2", "html": "<p>...</p>"}]`;

  const raw = (await client.messages.stream({
    model: MODEL_SONNET,
    max_tokens: 16000,
    system: 'You are a planning consultant. Output only valid JSON arrays. Never wrap your response in markdown code fences.',
    messages: [{ role: 'user', content: prompt }],
  }).finalText()).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Document incorporation — interactive two-panel flow (full-draft fallback)
// ─────────────────────────────────────────────────────────────────────────────

export async function incorporateDocument({ projectName, draftTypeName, currentDraftHtml, documentText, issues, userNotes = null, guidingBrief = null, conversation = [] }) {
  const issueContext = buildIssueContext(issues);

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\nGuiding brief for this document type:\n${guidingBrief.guidance_content.trim()}`
    : '';

  const userNotesBlock = userNotes?.trim()
    ? `## User guidance — HIGH PRIORITY\nThe user has provided specific instructions for this document. Follow these precisely — they override your own judgement about what to include:\n${userNotes.trim()}\n\n`
    : '';

  const currentDraftText = currentDraftHtml?.trim()
    ? `Current working draft:\n${currentDraftHtml}`
    : `Current working draft: (none yet — write the full document from the key issues notes and the document provided)`;

  const userPrompt = `You are a planning appeal consultant updating a formal appeal document to incorporate evidence from a new specialist report or document.

Document type: ${draftTypeName}
Project: ${projectName}${guidingBlock}

${userNotesBlock}Key issues in this appeal:
${issueContext}

${currentDraftText}

Document to incorporate:
${documentText}

Instructions:
- Read the working draft and this document carefully
- Identify which sections of the draft this document directly and specifically addresses
- For sections this document speaks to: add new evidence, reinforce existing arguments with specific references and paragraph/section numbers, or acknowledge and address points raised against the case
- For sections this document does NOT directly address: copy them into the output CHARACTER FOR CHARACTER, word for word, with absolutely no changes — no rephrasing, no restructuring, no removal of content, no improvement of wording
- NEVER remove existing content from the draft unless this document explicitly and directly contradicts or supersedes it — a specialist report in one discipline (e.g. heritage) does not authorise any changes to sections covering a different discipline (e.g. landscape, transport, ecology)
- NEVER rewrite, condense, or paraphrase existing paragraphs that you are not adding new evidence to
- Where the document introduces genuinely new relevant material not already covered, add it in the appropriate section
- Write in formal planning language suitable for submission to the Planning Inspectorate
- Do not use em dashes (—); use a comma, colon, or rewrite the sentence instead
- Do not number paragraphs — do not prefix any paragraph with numbers like 1.1, 2.3 etc.
- Output the complete updated draft HTML only — no markdown, no explanation, no commentary`;

  const messages = [
    { role: 'user', content: userPrompt },
    ...conversation
  ];

  const raw = (await client.messages.stream({
    model: MODEL_SONNET,
    max_tokens: 8000,
    messages
  }).finalText()).trim();

  return noEmDash(raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing-driven argument drafting
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_DRAFT_ARGUMENTS_PROMPT = `You are a planning consultant building a planning case on behalf of the applicant. Your job is to extract and formulate argument positions — points that can be advanced IN FAVOUR of the proposal — drawing on any relevant content in the briefing summary.

For each issue listed, identify whether the briefing contains any information that supports the case: design decisions, technical measures, expert evidence, mitigation, site characteristics, or any other facts that could form the basis of a planning argument for that issue.

If the briefing contains relevant material for an issue, write 2–5 sentences formulating the argument. Write as argument starters that can be developed further — not as a summary of what was discussed. Do not reference "the briefing" or "the transcript" in your output; simply state the argument as if it is your working position ("The proposals...", "It is considered...", "In terms of [issue], the development...").

Only include issues where the briefing genuinely provides something to work with. If there is nothing relevant for an issue, omit it from your response entirely — do not include placeholders or notes about what is missing.

Where an issue already has existing notes, supplement rather than replace — add new angles from the briefing not already captured.

Respond ONLY with valid JSON — no markdown, no explanation:
[
  { "track_id": 42, "argument_for": "The proposals..." }
]

Only include issues where you have substantive argument content to contribute. Omit issues entirely if the briefing has nothing relevant.

Do not use em dashes (—) anywhere in your output; use a comma, colon, or rewrite the sentence instead.`;

export async function draftIssueArgumentsFromBriefing({ briefingSummary, issues, customPrompt = null }) {
  const issueList = issues.map(i =>
    `- id:${i.id} | ${i.label}${i.discipline ? ` (${i.discipline})` : ''}${i.argument_for?.trim() ? `\n  Existing notes: ${i.argument_for.trim().slice(0, 200)}` : ''}`
  ).join('\n');

  const systemPrompt = customPrompt ?? DEFAULT_DRAFT_ARGUMENTS_PROMPT;
  const userMessage = `Briefing summary:\n${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}\n\nIssues:\n${issueList}`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  const raw = response.content[0].text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(s => ({ ...s, argument_for: noEmDash(s.argument_for) }));
  } catch {
    console.error('[draftIssueArgumentsFromBriefing] Failed to parse JSON:', cleaned.slice(0, 300));
    return [];
  }
}

export async function evolveArgumentFromBriefing({ issueLabel, existingArgument, newInformation, conversation = [] }) {
  const hasExisting = existingArgument?.trim();

  const systemPrompt = `You are a planning consultant helping to evolve a planning argument for a specific issue. Your job is to produce a revised, coherent argument that incorporates new strategic information from a briefing note. Be direct and write in formal planning language. Do not use em dashes.`;

  const userPrompt = `Issue: ${issueLabel}

${hasExisting
  ? `Current argument:\n${existingArgument.trim()}`
  : `Current argument: (none yet)`}

New information from briefing note:\n${newInformation.trim()}

Based on this new information, produce an evolved version of the argument for this issue. The revised argument should:
- Reflect the updated position — if the proposals have changed or developed, write from that new position rather than layering old and new
- Replace superseded content rather than appending to it
- Be coherent as a standalone argument — not a list of addenda
- Incorporate the new information naturally

Write only the revised argument text. No preamble, no explanation of what changed.`;

  const messages = [
    { role: 'user', content: userPrompt },
    ...conversation
  ];

  const response = await client.messages.create({
    model: MODEL_SONNET,
    system: systemPrompt,
    max_tokens: 2000,
    messages
  });

  return noEmDash(response.content[0].text.trim());
}

export async function chatArgumentWithBriefing({ issueLabel, existingArgument, briefingContent, conversation }) {
  const systemPrompt = `You are a planning consultant helping to refine a planning argument for a specific planning appeal issue. You have been given the issue label, the current argument text, and the content of a briefing note as context.

The user will ask you to amend or refine the argument based on their instructions. Always respond with ONLY the revised argument text — no preamble, no explanation, no commentary. Write in formal planning language. Do not use em dashes (—).

Issue: ${issueLabel}

Current argument:
${existingArgument?.trim() || '(none yet)'}

Briefing note content:
${briefingContent?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000) || '(no briefing content available)'}`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    system: systemPrompt,
    max_tokens: 2000,
    messages: conversation
  });

  return noEmDash(response.content[0].text.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument suggestion (prose chat)
// ─────────────────────────────────────────────────────────────────────────────

export function buildArgumentSuggestionPrompt({
  text,
  documentBlock,
  documentType,
  documentTitle,
  documentDirection,
  issues,
  briefingNote,
  refusalReasons,
  userNotes
}) {
  const docBlock = documentBlock ?? buildFullDocumentBlock(text);

  const directionLabel = documentDirection === 'for'
    ? 'in favour of the appellant\'s case'
    : 'against the appellant\'s case (e.g. officer report, refusal notice, LPA submission)';

  const briefingSection = briefingNote
    ? `## Project Briefing Note\nThis is background and strategic context for the project — use it to understand the client's overall position, objectives, and sensitivities. Not every part will be relevant to every issue; draw on it where it informs the argument but do not force it in where it does not apply.\n\n${briefingNote.trim()}`
    : '## Project Briefing Note\nNo briefing note on file.';

  const refusalSection = refusalReasons?.length
    ? `## Reasons for Refusal\nThese are the grounds on which planning permission was refused. They define the core issues the appeal must address — use them to understand what the LPA's case rests on and what this document needs to speak to.\n\n` +
      refusalReasons.map(r => {
        const risk = r.risk_level ? ` [${r.risk_level.replace(/_/g, ' ')}]` : '';
        const key  = r.is_key_issue ? ' ★ KEY ISSUE' : '';
        const body = r.summary?.trim() ? `\n${r.summary.trim()}` : '';
        return `- ${r.title}${risk}${key}${body}`;
      }).join('\n')
    : '';

  const issuesSection = issues.map(issue => {
    const forText  = issue.argument_for?.trim()      || 'Nothing recorded yet.';
    const agText   = issue.argument_against?.trim()  || 'Nothing recorded yet.';
    return `### Issue: ${issue.label} (id:${issue.id})\n**Current argument FOR the appellant:**\n${forText}\n\n**Current argument AGAINST (LPA position):**\n${agText}`;
  }).join('\n\n---\n\n');

  const userNotesSection = userNotes
    ? `## User Guidance (high priority — follow this where it conflicts with your judgement)\n${userNotes.trim()}`
    : '';

  const fieldLabel = documentDirection === 'for' ? 'argument FOR the appellant' : 'argument AGAINST (LPA position)';

  const issueOutputBlock = issues.map(i =>
    `**Issue: ${i.label}**\n[New sentences or paragraphs to add — or "Nothing to add." if this document does not contribute anything new for this issue]`
  ).join('\n\n');

  return `You are a planning appeal consultant helping to build the working argument for a planning appeal.

${briefingSection}
${refusalSection ? '\n' + refusalSection : ''}
## Issues to Address
${issuesSection}

${userNotesSection}

## Document Being Reviewed
Type: ${documentType}
Title: ${documentTitle || 'Unknown'}
Direction: This document is ${directionLabel}.

Read the document carefully — conclusions and summaries first, then the supporting detail. Then read the current argument notes for each issue above.

Your task is to suggest **additions only** — new sentences or short paragraphs that this document contributes to the **${fieldLabel}** for each issue. Do not restate, rewrite, or repeat anything already covered in the existing argument. Only output content that is genuinely new: new evidence, findings, technical conclusions, or expert positions that the existing notes do not already capture.

Requirements:
- Write in flowing prose — brief, note-like but in full sentences and paragraphs
- Reference the document inline: name it by title, cite paragraph/section numbers where available (e.g. "At paragraph 7.3 of the ${documentTitle || 'document'}...")
- Where an author or expert is named in the document, reference them (e.g. "The heritage consultant concludes...")
- Do not use bullet points or numbered lists — prose only
- Keep additions concise: 1–4 sentences per issue unless the document warrants more
- If this document adds nothing new for a particular issue, write exactly: "Nothing to add."
- Output ONLY the additions — no preamble, no explanation, no headings other than the issue labels below
- Do not use em dashes (—); use a comma, colon, or rewrite the sentence instead
${TONE_EXAMPLE_BLOCK}

Document (conclusions and summaries shown first):
<document>
${docBlock}
</document>

Suggest additions to the ${fieldLabel} for each issue:

${issueOutputBlock}`;
}

export function buildArgumentSuggestionTemplate({ documentType, documentTitle, documentDirection, issues, briefingNote, refusalReasons, userNotes }) {
  return buildArgumentSuggestionPrompt({ documentBlock: '{{DOCUMENT}}', documentType, documentTitle, documentDirection, issues, briefingNote, refusalReasons, userNotes });
}

export async function suggestArgumentAddition({ text, documentType, documentTitle, documentDirection, issues, briefingNote, refusalReasons, userNotes, conversation = [], customPrompt }) {
  const initialPrompt = customPrompt ?? buildArgumentSuggestionPrompt({ text, documentType, documentTitle, documentDirection, issues, briefingNote, refusalReasons, userNotes });

  const messages = [
    { role: 'user', content: initialPrompt },
    ...conversation
  ];

  console.log('[suggestArgumentAddition] turns:', messages.length, 'doc chunks approx:', Math.ceil(text.length / 6000));

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 3000,
    messages
  });

  return noEmDash(response.content[0].text.trim());
}
