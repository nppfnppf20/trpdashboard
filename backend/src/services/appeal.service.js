/**
 * Appeal tool service.
 * Handles appeal argument generation, document review, point extraction,
 * briefing-driven argument drafting, and prose suggestion flows.
 */

import { client, noEmDash, callClaude, TONE_EXAMPLE_BLOCK, MODEL_SONNET, buildFullDocumentBlock } from './llm.shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DRAFT_PROMPT = `You are an experienced planning appeal consultant drafting a formal appeal document.
You will be given the working argument notes for an appeal — the case built up across all key issues — and you must polish these into a well-structured, professionally written document.

Instructions:
- Write in formal planning language suitable for submission to the Planning Inspectorate
- Structure the document clearly with numbered sections and sub-sections
- Draw on ALL the argument notes provided — do not omit issues
- Where argument_against notes set out the opposing position, acknowledge it before rebutting with the argument_for
- Produce clean HTML using <h2> for main sections, <h3> for sub-sections, <p> for body text, <ol>/<li> for numbered lists
- Do not include a title — start directly with the first section
- Do not add placeholder text or "[INSERT X]" gaps — write the full document from the material provided`;

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

export async function generateAppealArgument({ projectName, refusalReasons, keyIssues, initialNotes }) {
  const reasonsText = refusalReasons.length
    ? refusalReasons.map((r, i) => `${i + 1}. ${r.title}${r.summary ? ` — ${r.summary}` : ''}${r.risk_level ? ` [${r.risk_level}]` : ''}`).join('\n')
    : 'None recorded';

  const issuesText = keyIssues.length
    ? keyIssues.map(k => `- ${k.label}${k.discipline_group ? ` (${k.discipline_group})` : ''}`).join('\n')
    : 'None recorded';

  const notesBlock = initialNotes?.trim()
    ? `\n\nInitial strategic notes from the team:\n${initialNotes.trim()}`
    : '';

  const prompt = `You are a planning appeal consultant. Generate a structured working argument summary for the following appeal.

Project: ${projectName}

Reasons for refusal:
${reasonsText}

Key issues to address:
${issuesText}
${notesBlock}

Produce a structured working argument summary in HTML. Use these five sections:
1. <h2>Appeal Overview</h2> — brief summary of the appeal and the development
2. <h2>Reasons for Refusal</h2> — summarise each reason and its significance
3. <h2>Argument by Issue</h2> — for each key issue, outline both the opposing position and the initial argument direction
4. <h2>Risks and Unknowns</h2> — identify gaps, risks, and what evidence is still needed
5. <h2>Next Steps</h2> — practical actions to advance the case

Use <p> for body text. Keep it concise but substantive — this is a working document, not a final submission.`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
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

export async function generateDraftSection({ section, projectName, draftTypeName, issueContext }) {
  const instructions = section.generation_prompt?.trim() ||
    `Write the "${section.name}" section of a ${draftTypeName}. Use formal planning language suitable for submission to the Planning Inspectorate. Produce clean HTML: <h2> for the section heading, <p> for body text, <ol>/<li> for numbered lists. Do not add placeholder text — write the full section from the material provided.`;

  const exampleBlock = section.example_text?.trim()
    ? `The following is an example of this section's tone and format. Match the style but use NO information from it — all content must come from the working argument notes:\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)}\n</example>\n`
    : '';

  const prompt = `You are drafting the "${section.name}" section of a formal planning appeal document. Output HTML only — no markdown.

CONTENT INSTRUCTIONS:
${instructions}

${exampleBlock}Project: ${projectName}
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
    system: 'You are a planning appeal consultant. You output clean HTML documents. You never use markdown — every paragraph is a <p> tag, lists are <ol> or <ul>, bold is <strong>. If you use **, *, or --- you have made an error. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.',
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  return noEmDash(raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
}

export async function generateAppealDraft({ projectName, draftTypeName, sections, issues, evidenceByTrack = {} }) {
  const issueContext = buildIssueContext(issues, evidenceByTrack);

  if (!sections || sections.length === 0) {
    const prompt = `${DEFAULT_DRAFT_PROMPT}

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
    const html = await generateDraftSection({ section, projectName, draftTypeName, issueContext });
    parts.push(html);
  }

  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Briefing-driven argument drafting
// ─────────────────────────────────────────────────────────────────────────────

export async function draftIssueArgumentsFromBriefing({ briefingSummary, issues }) {
  const issueList = issues.map(i =>
    `- id:${i.id} | ${i.label}${i.discipline ? ` (${i.discipline})` : ''}${i.argument_for?.trim() ? `\n  Existing notes: ${i.argument_for.trim().slice(0, 200)}` : ''}`
  ).join('\n');

  const prompt = `You are a planning consultant building a planning case on behalf of the applicant. Your job is to extract and formulate argument positions — points that can be advanced IN FAVOUR of the proposal — drawing on any relevant content in the briefing summary below.

For each issue listed, identify whether the briefing contains any information that supports the case: design decisions, technical measures, expert evidence, mitigation, site characteristics, or any other facts that could form the basis of a planning argument for that issue.

If the briefing contains relevant material for an issue, write 2–5 sentences formulating the argument. Write as argument starters that can be developed further — not as a summary of what was discussed. Do not reference "the briefing" or "the transcript" in your output; simply state the argument as if it is your working position ("The proposals...", "It is considered...", "In terms of [issue], the development...").

Only include issues where the briefing genuinely provides something to work with. If there is nothing relevant for an issue, omit it from your response entirely — do not include placeholders or notes about what is missing.

Where an issue already has existing notes, supplement rather than replace — add new angles from the briefing not already captured.

Briefing summary:
${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}

Issues:
${issueList}

Respond ONLY with valid JSON — no markdown, no explanation:
[
  { "track_id": 42, "argument_for": "The proposals..." }
]

Only include issues where you have substantive argument content to contribute. Omit issues entirely if the briefing has nothing relevant.

Do not use em dashes (—) anywhere in your output; use a comma, colon, or rewrite the sentence instead.`;

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
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
