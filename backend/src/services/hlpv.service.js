/**
 * HLPV (High-Level Planning View) narrative generation service.
 * Produces professional site appraisal HTML from discipline risk data and briefing notes.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { callClaude, noEmDash, MODEL_SONNET } from './llm.shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let HLPV_TONE_EXAMPLE_BLOCK = '';
try {
  const raw = readFileSync(join(__dirname, '../../../hlpvexample.md'), 'utf-8');
  const cleaned = raw.trim().replace(/^#.*\n?/gm, '').trim();
  if (cleaned.length > 100) {
    HLPV_TONE_EXAMPLE_BLOCK = `\n\nThe following is a real High-Level Planning View written by this consultancy. Use it ONLY as a style reference — to learn the professional register, the way conclusions are phrased, the level of detail, and the types of recommendations typically made. Do NOT reproduce any place names, designation names, distances, policy references, or factual content from it. Every fact in your output must come solely from the designation data provided in the user message:\n<tone_example>\n${cleaned.slice(0, 3000)}\n</tone_example>`;
    console.log('[hlpv.service] HLPV tone example loaded:', cleaned.slice(0, 3000).length, 'chars');
  }
} catch (e) {
  console.warn('[hlpv.service] Could not load hlpvexample.md:', e.message);
}

const HLPV_NARRATIVE_SYSTEM = `You are a specialist planning consultant writing a High-Level Planning View (HLPV). \
This is a professional site appraisal document that assesses the planning constraints affecting a proposed development. \
Write with authority and precision in clear, professional planning language.`;

function buildHlpvCombinedPrompt(disciplines, briefingText) {
  const parts = [
    'Write a complete HLPV (High-Level Planning View) narrative assessment as a single HTML document.',
    '\n\nThe following disciplines have triggered planning risk rules:\n',
  ];

  for (const discipline of disciplines) {
    const riskLabel = (discipline.overallRisk ?? 'unknown').replace(/_/g, ' ');
    const ruleLines = (discipline.triggeredRules ?? [])
      .map(r => `  - ${r.rule} [${r.level.replace(/_/g, ' ')}]: ${r.findings}`)
      .join('\n');

    parts.push(`\n### ${discipline.name}\nOverall risk: ${riskLabel}\nTriggered rules:\n${ruleLines}`);

    if (discipline.designationDetails) {
      parts.push(`\nIndividual designations (use these specific names and distances):\n${discipline.designationDetails}`);
    }

    if (discipline.disciplineRecommendation) {
      parts.push(`\nSuggested text (calibrate register only — rewrite entirely):\n${discipline.disciplineRecommendation}`);
    }
  }

  if (briefingText) {
    parts.push(`\n\n## Briefing note\n${briefingText}`);
  }

  parts.push(`\n\nInstructions:
1. Write a professional HLPV narrative for each discipline listed above (2-3 paragraphs each).
2. If a briefing note is provided, also identify any additional planning topics or constraints mentioned in it that are NOT already covered by the disciplines above (e.g. highways, drainage, flood risk, noise, ground conditions, utilities). For each additional topic found, write 1-2 professional paragraphs drawing only on briefing note content.
3. Output as a single HTML document. For each section:
   - <h2>Discipline or topic name</h2>
   - For HLPV disciplines only: <p><strong>Overall risk: [risk level]</strong></p>
   - Then the assessment paragraphs using <p> tags only
4. Return ONLY the HTML — no preamble, no markdown fences, no explanation.
5. Every fact about specific designations must come from the designation data provided — do not invent designations, distances, or names.
6. Never reference "the briefing note" or "briefing" in the output — this is a client-facing document. Incorporate the information naturally as part of the planning assessment.
7. Do not copy phrases verbatim from the suggested text or tone example — use them only to calibrate register.`);

  return parts.join('');
}

export async function generateHlpvNarrative(disciplines, briefingText) {
  const system = HLPV_NARRATIVE_SYSTEM + HLPV_TONE_EXAMPLE_BLOCK;
  const user = buildHlpvCombinedPrompt(disciplines, briefingText);
  const raw = await callClaude(system, user, MODEL_SONNET);
  return noEmDash(raw.trim());
}
