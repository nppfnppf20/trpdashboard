/**
 * HLPV (High-Level Planning View) narrative generation service.
 * Produces professional site appraisal HTML from discipline risk data and briefing notes.
 */

import { callClaude, noEmDash, MODEL_SONNET } from './llm.shared.js';


const HLPV_NARRATIVE_SYSTEM = `You are a specialist planning consultant at Third Revolution Projects writing a High-Level Planning View (HLPV). \
This is a professional client-facing letter that assesses the planning constraints and opportunities affecting a proposed development. \
Write with authority and precision in clear, professional planning language. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`;

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

function buildHlpvCombinedPrompt(disciplines, briefingText, projectVars = {}) {
  const {
    siteName = '[SITE NAME]',
    developmentType = '[TYPE OF PROJECT]',
    lpaName = '[ADMINISTRATIVE AREA]',
    siteLocation = '[LOCATION]',
  } = projectVars;

  const parts = [`Write a complete High-Level Planning View letter in HTML for the following project.

PROJECT INFORMATION (use these as defaults — briefing note takes precedence where it provides better or more specific information):
- Site name: ${siteName}
- Development type: ${developmentType}
- Administrative area / LPA: ${lpaName}
- Location: ${siteLocation}
`];

  if (disciplines.length > 0) {
    parts.push(`\nHLPV ANALYSIS DATA — use this alongside the briefing note to populate the relevant table rows:\n`);
    for (const discipline of disciplines) {
      const riskLabel = (discipline.overallRisk ?? 'unknown').replace(/_/g, ' ');
      const ruleLines = (discipline.triggeredRules ?? [])
        .map(r => `  - ${r.rule} [${r.level.replace(/_/g, ' ')}]: ${r.findings}`)
        .join('\n');
      parts.push(`\n### ${discipline.name}\nOverall risk: ${riskLabel}\nTriggered rules:\n${ruleLines}`);
      if (discipline.designationDetails) {
        parts.push(`\nDesignations (use exact names and distances):\n${discipline.designationDetails}`);
      }
      if (discipline.disciplineRecommendation) {
        parts.push(`\nConsultant notes (calibrate register only):\n${discipline.disciplineRecommendation}`);
      }
    }
  }

  if (briefingText) {
    parts.push(`\n\nBRIEFING NOTE — primary source for all sections. Use this to inform every part of the letter. Where the briefing note provides better or more specific information than the project fields above, prefer the briefing note:\n${briefingText}`);
  }

  parts.push(`

INSTRUCTIONS — write the complete letter as a clean HTML fragment in this exact order:

1. SALUTATION AND HEADING
   <p>Dear [NAME],</p>
   <h2>High Level Planning View – ${siteName}</h2>

2. INTRO PARAGRAPHS — write these verbatim:
   <p>Thank you for sending through the above land for an initial high-level appraisal.</p>
   <p>This letter summarises the main, high-level planning related constraints and opportunities for the red line area shown below for the purpose of understanding the likely scope of a future planning application for a ${developmentType} project.</p>
   <p>Further detailed work will be needed, including a site visit, to determine the position of the development within the preferred parcel and to understand more of the sizing considerations and any constraints. This will form part of our first stage of work, if appointed.</p>

3. SITE LOCATION SUMMARY
   Write 2-4 sentences summarising the site location and key findings, drawing on both the HLPV analysis data and the briefing note. Then add verbatim: <p>Specialist advice will be needed in respect of the key matters identified.</p>

4. TABLE
   Output a two-column HTML table. First row is a header row with <th>Topic</th><th>Detail</th>. Then one <tr> per topic below. Where a cell should be blank, output an empty <td></td>. Use <ul><li> for bullet lists within cells.

   Row instructions — populate the Detail cell for each row as follows:

   Administrative area: the LPA or local authority name. Prefer briefing note; fall back to project information (${lpaName}).
   Location: the site address or location description. Prefer briefing note; fall back to project information (${siteLocation}).
   Planning designations: bullet list of all relevant planning designations. Draw on both the HLPV designation data and the briefing note — include everything mentioned in either source.
   Development Plan / relevant planning policy: bullet list of the relevant local plan and key policies. Draw on both HLPV data and briefing note. Leave blank if neither source addresses this.
   Planning history: any relevant planning history mentioned in the briefing note or HLPV data. Leave blank if nothing is available.
   [COLSPAN ROW]: output <tr><td colspan="2"><strong>Constraints and opportunities</strong></td></tr>
   Principle of development: draft from the briefing note if this topic is mentioned. Leave blank if not.
   Scale, density and character: draft from the briefing note if this topic is mentioned. Leave blank if not.
   Landscape and visual: draw on HLPV Landscape discipline data and briefing note. Leave blank if neither provides content.
   Heritage: draw on HLPV Heritage discipline data and briefing note. Do not reference any map in this cell — a heritage map extract will be inserted separately. Leave blank if neither provides content.
   Ecology and arboriculture: draw on HLPV Ecology and Ancient Woodland discipline data and briefing note combined. Leave blank if neither provides content.
   Flood risk: draw on HLPV Flood Risk discipline data and briefing note. Do not reference any map in this cell — a flood map extract will be inserted separately. Leave blank if neither provides content.
   Highways and parking: draw on HLPV Highways discipline data and briefing note. Leave blank if neither provides content.
   Amenity: draw on HLPV Amenity discipline data and briefing note. Leave blank if neither provides content.
   CIL and Section 106: draft from the briefing note if this topic is mentioned. Leave blank if not.
   Other: include anything not already covered above — any HLPV disciplines not mapped to a named row (e.g. Agricultural Land, Renewables, Aviation, Airfields), plus any other planning topics from the briefing note not captured elsewhere. Leave blank if nothing remains.

5. PLANNING STRATEGY
   If the briefing note addresses planning strategy, write a short paragraph (2-4 sentences). Leave blank if not mentioned.
   Wrap in: <p><strong>Planning Strategy</strong></p> followed by the content paragraph.

6. SUBMISSION DOCUMENTS
   If the briefing note addresses submission documents or application requirements, write a brief note. Leave blank if not mentioned.
   Wrap in: <p><strong>Submission documents</strong></p> followed by the content.

7. SIGN-OFF — write verbatim:
   <p>I trust this provides the information you need at this stage. We look forward to working with you as the scheme progresses.</p>
   <p>Yours sincerely</p>
   <p>[SIGNED]<br>[NAME]<br>[TITLE]<br>e. [EMAIL]</p>

HTML RULES — mandatory:
- Output a clean HTML fragment only — no <html>, <head>, <body>, <style>, or <script> tags, no markdown fences
- Use <p> for paragraphs, <h2> for the main heading, <strong> for bold text
- Use <table><thead><tr><th> for the header row, <tbody><tr><td> for data rows
- Use <ul><li> for bullet lists within table cells
- Never use em dashes (—); use a comma, colon, or rewrite instead
- Every fact about specific designations must come from the data provided — do not invent designations, distances, or names
- Never refer to "the briefing note" or "the HLPV analysis" in the output — this is a client-facing document
- Do not copy phrases verbatim from the style example — use it only to calibrate register`);

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

export async function generateHlpvNarrative(disciplines, briefingText, guidingBrief = null, styleTemplate = null, projectVars = {}) {
  const guidingBlock = guidingBrief?.guidance_content?.trim()
    ? `\n\n## Guiding Brief\nThe following describes how this type of document should be structured and approached — use it for format, framing, and emphasis. The designation data and briefing note provided above are your only source of project-specific content. If the guiding brief describes a section or topic for which nothing has been provided in the project materials, omit it — do not invent content to fill it. Every fact in your output must come from the data provided, not from the guiding brief.\n\n${guidingBrief.guidance_content.trim()}`
    : '';

  const styleExampleText = styleTemplate?.style_text?.trim() || guidingBrief?.style_example?.trim() || null;
  const briefStyleBlock = styleExampleText
    ? `\n\n## Example Document\nThe following is a real example of this document type written by this consultancy. Use it to calibrate tone, register, sentence structure, and level of detail. Some elements are universal — how sections open, how conclusions are framed — and can be reflected in your output. Most content is project-specific and must not be reproduced. The guiding brief takes precedence over this example — do not follow the example more closely than the guiding brief.\n<style_example>\n${styleExampleText}\n</style_example>`
    : '';

  const system = HLPV_NARRATIVE_SYSTEM + briefStyleBlock + guidingBlock;
  const user = buildHlpvCombinedPrompt(disciplines, briefingText, projectVars);
  const raw = await callClaude(system, user, MODEL_SONNET);
  return cleanHlpvHtml(noEmDash(raw));
}
