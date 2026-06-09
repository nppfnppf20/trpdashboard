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

/**
 * Strip any document-level wrapper elements that the LLM might add despite instructions.
 * A <style> block injected via innerHTML affects the entire page globally.
 */
function cleanHlpvHtml(raw) {
  let html = raw.trim();

  // Strip markdown code fences (```html ... ```)
  html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // If the LLM returned a full HTML document, extract just the body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    html = bodyMatch[1].trim();
  }

  // Strip any remaining structural / dangerous tags
  html = html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<meta[^>]*\/?>/gi, '')
    .replace(/<link[^>]*\/?>/gi, '');

  return html.trim();
}

function buildHlpvCombinedPrompt(disciplines, briefingText) {
  const parts = [
    'Write a complete HLPV (High-Level Planning View) narrative assessment.',
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
3. Output as an HTML fragment — content elements only. For each section:
   - <h2>Discipline or topic name</h2>
   - For HLPV disciplines only: <p><strong>Overall risk: [risk level]</strong></p>
   - Then the assessment paragraphs using <p> tags
4. Return ONLY the raw HTML content — absolutely no <html>, <head>, <body>, <style>, or <script> tags, no markdown fences, no preamble, no explanation. Start directly with the first <h2> tag.
5. Every fact about specific designations must come from the designation data provided — do not invent designations, distances, or names.
6. Never reference "the briefing note" or "briefing" in the output — this is a client-facing document. Incorporate the information naturally as part of the planning assessment.
7. Do not copy phrases verbatim from the suggested text or tone example — use them only to calibrate register.`);

  return parts.join('');
}

const DISCIPLINE_DISPLAY_NAMES = {
  heritage: 'Heritage',
  landscape: 'Landscape',
  ecology: 'Ecology',
  trees: 'Ancient Woodland',
  renewables: 'Renewables Development',
  airfields: 'Airfields',
  ag_land: 'Agricultural Land',
  flood: 'Flood Risk',
  aviation: 'Aviation',
  highways: 'Highways',
  amenity: 'Amenity',
};

const FEATURE_TYPE_LABELS = {
  listed_building:          'Listed Buildings',
  conservation_area:        'Conservation Areas',
  scheduled_monument:       'Scheduled Monuments',
  registered_park_garden:   'Registered Parks & Gardens',
  world_heritage_site:      'World Heritage Sites',
  aonb:                     'AONBs / National Landscapes',
  national_park:            'National Parks',
  green_belt:               'Green Belt',
  sssi:                     'SSSIs',
  sac:                      'SACs',
  spa:                      'SPAs',
  ramsar:                   'Ramsar Sites',
  national_nature_reserve:  'National Nature Reserves',
  gcn:                      'Great Crested Newt Records',
  os_priority_pond:         'Priority Ponds',
  drinking_water:           'Drinking Water Safeguard Zones',
  ancient_woodland:         'Ancient Woodland',
  renewable_development:    'Nearby Renewable Developments',
  uk_airport:               'Airports / Airfields',
  agricultural_land:        'Agricultural Land',
};

function fmtDistance(dist_m, on_site) {
  if (on_site) return 'within site';
  if (!dist_m && dist_m !== 0) return 'unknown distance';
  return dist_m >= 1000 ? `${(dist_m / 1000).toFixed(1)}km` : `${Math.round(dist_m)}m`;
}

/**
 * Convert raw DB rows (from analysis_discipline_summary, analysis_rules_triggered,
 * analysis_findings, analysis_edits) into the disciplines array shape expected by
 * formatHlpvDataAsText.
 */
export function buildDisciplinesFromSessionData(summaries, rules, findings, edits) {
  return summaries
    .filter(s => s.overall_risk || rules.some(r => r.discipline === s.discipline))
    .map(summary => {
      const discipline = summary.discipline;
      const edit = edits.find(e => e.discipline === discipline);
      const overallRisk = edit?.edited_overall_risk || summary.overall_risk || 'unknown';
      const editedRecs = edit?.edited_recommendations;
      const disciplineRecommendation = editedRecs?.length
        ? (Array.isArray(editedRecs) ? editedRecs.join('\n') : editedRecs)
        : (summary.discipline_recommendation || null);

      const triggeredRules = rules
        .filter(r => r.discipline === discipline)
        .map(r => ({ rule: r.rule_name, level: r.risk_level, findings: r.findings_text }));

      // Build designation details text grouped by feature type
      const disciplineFindings = findings.filter(f => f.discipline === discipline);
      const byType = {};
      for (const f of disciplineFindings) {
        const type = f.feature_type;
        if (!byType[type]) byType[type] = [];
        byType[type].push(f);
      }
      const detailLines = [];
      for (const [type, feats] of Object.entries(byType)) {
        const label = FEATURE_TYPE_LABELS[type] || type;
        detailLines.push(`${label}:`);
        for (const f of feats) {
          const name = f.feature_name || 'Unnamed';
          const grade = f.grade ? ` (${f.grade})` : '';
          const pct = f.percentage_coverage ? ` (~${Math.round(f.percentage_coverage)}% of site)` : '';
          detailLines.push(`  - ${name}${grade}: ${fmtDistance(f.distance_m, f.on_site)}${pct}`);
        }
      }

      return {
        name: DISCIPLINE_DISPLAY_NAMES[discipline] || discipline,
        overallRisk,
        triggeredRules,
        designationDetails: detailLines.length ? detailLines.join('\n') : null,
        disciplineRecommendation,
      };
    })
    .filter(d => d.triggeredRules.length > 0 || d.designationDetails);
}

/**
 * Format disciplines array as structured plain text for the PA Workspace starter doc slot.
 * Keeps designation names and distances precise so the LLM can't hallucinate them.
 */
export function formatHlpvDataAsText(disciplines) {
  const lines = ['HLPV Planning Constraint Data', '='.repeat(30), ''];

  for (const d of disciplines) {
    const riskLabel = (d.overallRisk ?? 'unknown').replace(/_/g, ' ');
    lines.push(`DISCIPLINE: ${d.name}`);
    lines.push(`Overall risk: ${riskLabel}`);

    if (d.triggeredRules?.length) {
      lines.push('');
      lines.push('Triggered rules:');
      for (const r of d.triggeredRules) {
        lines.push(`  - ${r.rule} [${(r.level ?? '').replace(/_/g, ' ')}]: ${r.findings}`);
      }
    }

    if (d.designationDetails?.trim()) {
      lines.push('');
      lines.push('Designations:');
      for (const dl of d.designationDetails.split('\n')) {
        lines.push(`  ${dl}`);
      }
    }

    if (d.disciplineRecommendation?.trim()) {
      lines.push('');
      lines.push('Suggested text (style reference only — do not copy verbatim):');
      lines.push(d.disciplineRecommendation.trim());
    }

    lines.push('');
    lines.push('-'.repeat(30));
    lines.push('');
  }

  return lines.join('\n');
}

export async function generateHlpvNarrative(disciplines, briefingText, guidingBrief = null) {
  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Practice Guidance\nThe following is practice guidance from this consultancy on approaching HLPV assessments. Use it only to inform how you structure, frame and prioritise the information already provided above — the discipline data and any briefing note. Do NOT introduce any topic, issue, observation, or recommendation that is not directly supported by the specific data you have been given. If the guidance refers to something that has no basis in the data provided, ignore it entirely. Every sentence in your output must be grounded in the designation data or briefing note above — the guidance is a professional reference, not a list of things to write about.\n\n${guidingBrief.guidance_content.trim()}`
    : '';

  const briefStyleBlock = guidingBrief?.style_example?.trim()
    ? `\n\nThe following is a real example HLPV written by this consultancy. Use it ONLY as a style reference — to learn the professional register, structure, and level of detail. Do NOT reproduce any place names, designation names, distances, policy references, or factual content from it. Every fact in your output must come solely from the designation data provided:\n<style_example>\n${guidingBrief.style_example.trim()}\n</style_example>`
    : HLPV_TONE_EXAMPLE_BLOCK;

  const system = HLPV_NARRATIVE_SYSTEM + briefStyleBlock + guidingBlock;
  const user = buildHlpvCombinedPrompt(disciplines, briefingText);
  const raw = await callClaude(system, user, MODEL_SONNET);
  return cleanHlpvHtml(noEmDash(raw));
}
