/**
 * Stage completion analysis service.
 * Analyses documents uploaded at each project stage against tracked issue list,
 * building longitudinal notes that carry context forward from prior stages.
 */

import { chunkText } from './parser.service.js';
import { callClaude, MAX_CHUNKS, MODEL_FAST, MODEL_SONNET } from './llm.shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt constants
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_ANALYSIS_SYSTEM = `You are a planning consultant managing an issue tracker for a planning project. \
The tracker follows key planning concerns — such as highway impacts, ecology, noise, heritage, drainage — \
through each stage of the project lifecycle, from pre-application through to decision. \
Each issue has a recorded history of notes from prior stages. Your job is to analyse documents uploaded \
at each new stage and write detailed professional notes for each issue, building on that history. \
Your notes will be saved as the stage record and read by the project team to track progress and inform decisions.`;

const STAGE_ANALYSIS_USER_TEMPLATE = `You are processing a document at the "{{STAGE_NAME}}" stage of a planning project.

This project uses an issue tracker to follow planning concerns through each stage of the lifecycle. \
You are extracting the {{STAGE_NAME}}-stage content for each tracked issue from the document section below.

<document_chunk>
{{CHUNK_TEXT}}
</document_chunk>

Here are the tracked issues, each with their prior stage history so you know what has already been recorded:

<issues>
{{ISSUES_JSON}}
</issues>

{{USER_GUIDANCE_BLOCK}}

Instructions:
- Read the document section carefully. For each issue, look for both explicit mentions AND implicit references. \
An issue about traffic impact may be addressed through junction capacity figures without using the word "traffic". \
An ecology issue may be addressed through habitat survey results. An issue about noise may be addressed through \
distance-to-receptor calculations. Use the issue label, discipline, and prior history to guide what to look for.
- If an issue is addressed, write a detailed summary (~200 words) of what this section says about it. \
Focus on new information, decisions, commitments, mitigation proposed, or outstanding concerns — \
do not repeat what is already in the prior history.
- If the user has provided specific guidance for an issue, treat that as your primary focus — \
ensure your summary specifically covers those points even if they appear only briefly in the text.

Respond ONLY with a valid JSON array (no markdown, no explanation):
[
  {
    "issue_track_id": <numeric id>,
    "relevant": true or false,
    "summary": "detailed ~200 word summary of what this section says about this issue, or null if not relevant",
    "sentiment": "positive" | "neutral" | "negative" | "not_mentioned",
    "source_quote": "verbatim excerpt max 300 chars or null"
  }
]
If the issue is not relevant to this section, set relevant: false, sentiment: not_mentioned, summary: null.
Do not skip any issues.`;

const STAGE_SYNTHESIS_PROMPT = `You are a planning consultant writing the "{{STAGE_NAME}}" stage notes \
for a tracked planning issue.

Issue: {{ISSUE_LABEL}}
Discipline: {{DISCIPLINE}}

Prior stage history (what has already been recorded for this issue):
{{PRIOR_HISTORY}}

{{USER_GUIDANCE_BLOCK}}

The following notes were extracted from different sections of the {{STAGE_NAME}} document:
{{CHUNK_SUMMARIES}}

Write comprehensive professional notes for this issue at the {{STAGE_NAME}} stage. \
Aim for around 400 words — but write as much as needed (up to 1000 words) to ensure all important \
information is captured. Do not pad; do not truncate significant content. Your notes should:
- Synthesise all extracted sections into a coherent, detailed record
- Build explicitly on the prior history — identify what has progressed, what has changed position, \
what commitments have been made, and what remains unresolved or outstanding
- Be written in professional planning language suitable for a project record
- If user guidance was provided above, ensure those specific points are prominently addressed
- Cover the substance in depth — this is a reference document for the project team and may be \
referred to at appeal or examination

Return only the notes text. No preamble, no headings, no bullet points — continuous professional prose.`;

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export async function analyseDocumentForStage(rawText, stageName, issueTracks, userGuidance = {}) {
  const chunks = chunkText(rawText).slice(0, MAX_CHUNKS);

  const issuesJson = JSON.stringify(
    issueTracks.map(t => ({
      issue_track_id: t.id,
      label: t.label,
      discipline: t.source_key ?? null,
      prior_summaries: t.prior_summaries ?? []
    }))
  );

  const guidanceEntries = issueTracks
    .filter(t => userGuidance[t.id]?.trim())
    .map(t => `- ${t.label}: ${userGuidance[t.id].trim()}`);
  const userGuidanceBlock = guidanceEntries.length
    ? `The user has provided specific guidance for some issues:\n<guidance>\n${guidanceEntries.join('\n')}\n</guidance>`
    : '';

  const chunkResults = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[stage-analysis] chunk ${i + 1}/${chunks.length}`);
    const chunk = chunks[i];
    const userPrompt = STAGE_ANALYSIS_USER_TEMPLATE
      .replace('{{STAGE_NAME}}', stageName)
      .replace('{{CHUNK_TEXT}}', chunk)
      .replace('{{ISSUES_JSON}}', issuesJson)
      .replace('{{USER_GUIDANCE_BLOCK}}', userGuidanceBlock);

    const raw = await callClaude(STAGE_ANALYSIS_SYSTEM, userPrompt, MODEL_FAST);
    try {
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim());
      chunkResults.push(parsed);
    } catch {
      console.warn('Stage analysis chunk returned malformed JSON — skipping');
      chunkResults.push(issueTracks.map(t => ({
        issue_track_id: t.id,
        relevant: false,
        summary: null,
        sentiment: 'not_mentioned',
        source_quote: null
      })));
    }
  }

  const byTrack = new Map();
  for (const chunkArray of chunkResults) {
    for (const entry of chunkArray) {
      const id = String(entry.issue_track_id);
      if (!byTrack.has(id)) byTrack.set(id, []);
      byTrack.get(id).push(entry);
    }
  }

  const results = [];
  for (const [trackId, entries] of byTrack.entries()) {
    const relevant = entries.some(e => e.relevant);
    const mentionedEntries = entries.filter(e => e.relevant && e.summary);
    const sentiments = entries.map(e => e.sentiment).filter(Boolean);

    let suggested_notes = null;
    if (mentionedEntries.length > 0) {
      console.log(`[stage-analysis] synthesising issue track ${trackId}`);
      const track = issueTracks.find(t => String(t.id) === trackId);

      const priorHistory = (track?.prior_summaries ?? []).length > 0
        ? track.prior_summaries.map(p => `${p.stage_name}:\n${p.notes}`).join('\n\n')
        : 'No prior stage history — this is the first stage entry for this issue.';

      const guidance = userGuidance[Number(trackId)]?.trim() ?? '';
      const guidanceBlock = guidance
        ? `The user has provided specific guidance for this issue — treat this as your primary focus:\n<guidance>\n${guidance}\n</guidance>`
        : '';

      const chunkSummaries = mentionedEntries
        .map((e, i) => `Section ${i + 1}:\n${e.summary}`)
        .join('\n\n---\n\n');

      const synthesisPrompt = STAGE_SYNTHESIS_PROMPT
        .replace(/{{STAGE_NAME}}/g, stageName)
        .replace('{{ISSUE_LABEL}}', track?.label ?? 'Unknown')
        .replace('{{DISCIPLINE}}', track?.source_key ?? 'Not specified')
        .replace('{{PRIOR_HISTORY}}', priorHistory)
        .replace('{{USER_GUIDANCE_BLOCK}}', guidanceBlock)
        .replace('{{CHUNK_SUMMARIES}}', chunkSummaries);

      suggested_notes = (await callClaude(STAGE_ANALYSIS_SYSTEM, synthesisPrompt, MODEL_SONNET)).trim();
    }

    const source_quote = mentionedEntries[0]?.source_quote ?? null;
    const sentiment = sentiments.includes('negative') ? 'negative'
      : sentiments.includes('positive') ? 'positive'
      : sentiments.includes('neutral') ? 'neutral'
      : 'not_mentioned';

    results.push({
      issue_track_id: Number(trackId),
      relevant,
      suggested_notes,
      sentiment,
      source_quote
    });
  }

  return results;
}
