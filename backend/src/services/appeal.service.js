/**
 * Appeal tool service.
 * Handles appeal argument generation, document review, point extraction,
 * and formal draft document generation.
 */

import { client, noEmDash, TONE_EXAMPLE_BLOCK, MODEL_SONNET, buildFullDocumentBlock } from './llm.shared.js';

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

export async function generateDraftSection({ section, projectName, draftTypeName, issueContext, guidingBrief = null }) {
  const instructions = section.generation_prompt?.trim() ||
    `Write the "${section.name}" section of a ${draftTypeName}. Use formal planning language suitable for submission to the Planning Inspectorate. Produce clean HTML: <h2> for the section heading, <p> for body text, <ol>/<li> for numbered lists. Do not add placeholder text — write the full section from the material provided.`;

  const exampleBlock = section.example_text?.trim()
    ? `The following is an example of this section's tone and format. Match the style but use NO information from it — all content must come from the working argument notes:\n<example>\n${section.example_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)}\n</example>\n`
    : '';

  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Guiding Brief\nThe following is practice guidance for writing this type of document. Use it to inform your approach, structure, and emphasis where relevant — it is directional, not a script. Apply professional judgement and only follow it where it genuinely applies to the material provided.\n\n${guidingBrief.guidance_content.trim()}`
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
    system: `You are a planning appeal consultant. You output clean HTML documents. You never use markdown — every paragraph is a <p> tag, lists are <ol> or <ul>, bold is <strong>. If you use **, *, or --- you have made an error. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.${guidingBlock}`,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();
  return noEmDash(raw.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
}

export async function generateAppealDraft({ projectName, draftTypeName, sections, issues, evidenceByTrack = {}, guidingBrief = null }) {
  const issueContext = buildIssueContext(issues, evidenceByTrack);

  if (!sections || sections.length === 0) {
    const guidingBlock = guidingBrief?.guidance_content?.trim()
      ? `\n\n## Guiding Brief\nThe following is practice guidance for writing this type of document. Use it to inform your approach, structure, and emphasis where relevant — it is directional, not a script. Apply professional judgement and only follow it where it genuinely applies to the material provided.\n\n${guidingBrief.guidance_content.trim()}`
      : '';

    const prompt = `${DEFAULT_DRAFT_PROMPT}${guidingBlock}

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
    const html = await generateDraftSection({ section, projectName, draftTypeName, issueContext, guidingBrief });
    parts.push(html);
  }

  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sequential doc-summary draft pipeline
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDraftFromDocSummaries({ projectName, draftTypeName, issueContext, documents, guidingBrief = null }) {
  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\nGuiding brief for this document type:\n${guidingBrief.guidance_content.trim()}`
    : '';

  // Step 1: initial draft from issue notes
  const initPrompt = `You are drafting a formal planning appeal document. Output HTML only — no markdown.

Project: ${projectName}
Document type: ${draftTypeName}${guidingBlock}

Working argument notes by issue:
${issueContext}

Write the complete ${draftTypeName} as clean HTML. Use <h2> for main sections, <h3> for sub-sections, <p> for body text, <ol>/<li> for numbered lists, <strong> for bold. Do not use markdown characters or em dashes.`;

  let response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4000,
    messages: [{ role: 'user', content: initPrompt }]
  });

  let draft = noEmDash(response.content[0].text.trim()
    .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());

  // Step 2: refine sequentially with each document summary
  for (const doc of documents) {
    const review = doc.ai_review;
    if (!review?.relevant) continue;

    const helpful = review.extracted_points?.helpful?.map(p => `- ${p}`).join('\n') || '';
    const harmful = review.extracted_points?.harmful?.map(p => `- ${p}`).join('\n') || '';
    const suggestions = review.bullet_suggestions?.map(p => `- ${p}`).join('\n') || '';

    const docBlock = [
      `Document: ${doc.filename}`,
      `Summary: ${review.relevance_summary}`,
      review.affected_issues?.length ? `Relevant to: ${review.affected_issues.join(', ')}` : '',
      helpful ? `Points in favour:\n${helpful}` : '',
      harmful ? `Points against (to acknowledge and address):\n${harmful}` : '',
      suggestions ? `Suggested additions:\n${suggestions}` : '',
      review.draft_paragraph ? `Suggested paragraph:\n${review.draft_paragraph}` : '',
      review.caution_note ? `Caution: ${review.caution_note}` : ''
    ].filter(Boolean).join('\n');

    const refinePrompt = `You are updating a formal planning appeal document to incorporate evidence from a new document. Output the complete updated HTML only — no markdown, no explanation.

Project: ${projectName}
Document type: ${draftTypeName}

New document to incorporate:
${docBlock}

Current draft:
${draft}

Update the draft to naturally incorporate the relevant evidence from this document. Where it strengthens existing arguments, reinforce them. Where it raises points against the case, acknowledge and address them. Where it introduces new relevant points, add them. Preserve the document's structure and formal tone. Output the complete updated draft HTML.`;

    response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 5000,
      messages: [{ role: 'user', content: refinePrompt }]
    });

    draft = noEmDash(response.content[0].text.trim()
      .replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
  }

  return draft;
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning application briefing-driven argument drafting
// (used by planning application controller — kept here as it shares LLM config)
// ─────────────────────────────────────────────────────────────────────────────

export async function draftIssueArgumentsFromBriefing({ briefingSummary, issues }) {
  const issueList = issues.map(i =>
    `- id:${i.id} | ${i.label}${i.discipline ? ` (${i.discipline})` : ''}${i.argument_for?.trim() ? `\n  Existing notes: ${i.argument_for.trim().slice(0, 200)}` : ''}`
  ).join('\n');

  const prompt = `You are a planning consultant building a planning case on behalf of the applicant. Your job is to extract and formulate argument positions — points that can be advanced IN FAVOUR of the proposal — drawing on any relevant content in the briefing summary below.

For each issue listed, identify whether the briefing contains any information that supports the case: design decisions, technical measures, expert evidence, mitigation, site characteristics, or any other facts that could form the basis of a planning argument for that issue.

If the briefing contains relevant material for an issue, write 2–5 sentences formulating the argument. Write as argument starters that can be developed further — not as a summary of what was discussed. Do not reference "the briefing" or "the transcript" in your output; simply state the argument as if it is your working position ("The proposals...", "It is considered...", "In terms of [issue], the development...").

Only include issues where the briefing genuinely provides something to work with. If there is nothing relevant for an issue, omit it from your response entirely.

Where an issue already has existing notes, supplement rather than replace — add new angles from the briefing not already captured.

Briefing summary:
${briefingSummary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)}

Issues:
${issueList}

Respond ONLY with valid JSON — no markdown, no explanation:
[
  { "track_id": 42, "argument_for": "The proposals..." }
]

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

${hasExisting ? `Current argument:\n${existingArgument.trim()}` : `Current argument: (none yet)`}

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
