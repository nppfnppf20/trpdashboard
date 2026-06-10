/**
 * Prompt map data — defines every prompt call in the system,
 * broken down into its component blocks.
 *
 * Component types:
 *   system   — system role / persona (blue)
 *   tone     — tone/style example loaded from file (purple)
 *   template — generation prompt or instruction template, DB or hardcoded (orange)
 *   format   — output format / HTML rules (red)
 *   guide    — guiding brief fetched from DB by document+development type (teal, dashed)
 *   runtime  — assembled at runtime from DB or user input (grey, dashed)
 *
 * For runtime components, `content` is null and `description` explains what gets injected.
 * For static components, `content` holds the actual text and `source` describes where it lives.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared content snippets
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_RULES_HTML = `- Output HTML only — no markdown whatsoever
- Use <h2> for section headings, <h3> for sub-sections, <p> for paragraphs, <strong> for bold
- Do not use **, *, #, ---, or any other markdown characters
- Do not use em dashes (—); use a comma, colon, or rewrite the sentence instead
- Do not add placeholder text — write the full section from the material provided`;

const FORMAT_RULES_JSON = `- Respond ONLY with valid JSON — no markdown, no explanation, no code fences
- Return an empty array or object if nothing relevant is found`;

const TONE_EXAMPLE_PLANNING = {
  type: 'tone',
  label: 'Tone Example',
  source: 'planningstatementexample.md (repo root)',
  content: `Loaded from planningstatementexample.md at server startup. Extracted from section "8.0 Planning Assessment" onwards, truncated to 3,000 characters.

Injected as:
"Writing style reference — match the professional tone, register, and sentence structure of the following planning statement excerpt. Do NOT use any content, facts, project names, site details, or policy references from this example — it is for writing style only."

Used in: Planning Statement section generation, assessment generation, template slot generation, and both suggestion prompts.`
};

// ─────────────────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPT_MAP = [

  // ── HLPV Narrative ─────────────────────────────────────────────────────────
  {
    id: 'hlpv',
    name: 'HLPV Narrative',
    icon: 'la-map-marked-alt',
    description: 'Generates the High-Level Planning View narrative assessment from discipline risk data.',
    operations: [
      {
        id: 'generate-narrative',
        name: 'Generate Narrative',
        output: 'Combined HTML narrative — one section per discipline, plus any extra topics from briefing',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'hlpv.service.js — HLPV_NARRATIVE_SYSTEM',
            content: `You are a specialist planning consultant writing a High-Level Planning View (HLPV). This is a professional site appraisal document that assesses the planning constraints affecting a proposed development. Write with authority and precision in clear, professional planning language.`
          },
          {
            type: 'tone',
            label: 'Tone Example',
            source: 'hlpvexample.md (repo root)',
            content: `Loaded from hlpvexample.md at server startup. Markdown headings stripped. Truncated to 3,000 characters.

Injected as:
"The following is a real High-Level Planning View written by this consultancy. Use it ONLY as a style reference — to learn the professional register, the way conclusions are phrased, the level of detail, and the types of recommendations typically made. Do NOT reproduce any place names, designation names, distances, policy references, or factual content from it. Every fact in your output must come solely from the designation data provided in the user message."`
          },
          {
            type: 'guide',
            label: 'Guiding Brief',
            source: 'DB: admin_console.guiding_briefs (document_type=hlpv, matched by project development type)',
            content: `Fetched from the guiding briefs library at call time using document_type='hlpv' and the project's development type. Falls back to the generic (null development type) brief if no specific match exists.

If found, guidance_content is injected after the tone example as:
"## Document Guidance
[guidance_content]"

The review_checklist is used in a separate post-generation review call to flag missing or underdeveloped topics.`
          },
          {
            type: 'runtime',
            label: 'Discipline Data',
            description: 'For each triggered discipline: name, overall risk level, triggered rules (with level and findings), designation details (specific names and distances), and optional suggested text to calibrate register. Assembled from the HLPV tool at call time.'
          },
          {
            type: 'runtime',
            label: 'Briefing Note',
            description: 'Optional plain text from an uploaded briefing note. If present, the model also extracts additional planning topics not covered by the disciplines (e.g. highways, drainage, noise) and writes 1–2 paragraphs for each.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'hlpv.service.js — buildHlpvCombinedPrompt()',
            content: `1. Write a professional HLPV narrative for each discipline listed (2–3 paragraphs each).
2. If a briefing note is provided, identify additional planning topics NOT covered by the disciplines and write 1–2 paragraphs for each from the briefing only.
3. Output as a single HTML document:
   - <h2> for each discipline/topic heading
   - <p><strong>Overall risk: [level]</strong></p> for HLPV disciplines only
   - <p> tags only for body text
4. Return ONLY the HTML — no preamble, no markdown fences, no explanation.
5. Every fact about specific designations must come from the designation data provided — do not invent designations, distances, or names.
6. Never reference "the briefing note" or "briefing" in the output.
7. Do not copy phrases verbatim from the suggested text or tone example.`
          }
        ],
        assembledPreview: `[SYSTEM ROLE: HLPV specialist planning consultant]
[TONE EXAMPLE: hlpvexample.md — 3,000 chars style reference]

Write a complete HLPV narrative assessment as a single HTML document.

The following disciplines have triggered planning risk rules:

### [RUNTIME: discipline name]
Overall risk: [RUNTIME: risk level]
Triggered rules:
  - [RUNTIME: rule] [RUNTIME: level]: [RUNTIME: findings]
  ...

Individual designations (use these specific names and distances):
[RUNTIME: designation details, if provided]

Suggested text (calibrate register only — rewrite entirely):
[RUNTIME: discipline recommendation, if provided]

## Briefing note
[RUNTIME: plain text briefing note, if uploaded]

Instructions:
[FORMAT RULES: output as single HTML, one section per discipline, additional topics from briefing, no invented data]`
      }
    ]
  },

  // ── Appeal Tool ─────────────────────────────────────────────────────────────
  {
    id: 'appeal',
    name: 'Appeal Tool',
    icon: 'la-balance-scale',
    description: 'Builds the working appeal argument, analyses documents, and generates formal appeal documents.',
    operations: [
      {
        id: 'generate-argument',
        name: 'Generate Initial Argument',
        output: 'HTML working argument (5 sections: Overview, Reasons, Argument by Issue, Risks, Next Steps)',
        components: [
          {
            type: 'runtime',
            label: 'Project Name',
            description: 'The project name from the appeal record.'
          },
          {
            type: 'runtime',
            label: 'Refusal Reasons',
            description: 'Array of refusal reasons with title, optional summary, and risk level. Formatted as a numbered list.'
          },
          {
            type: 'runtime',
            label: 'Key Issues',
            description: 'Array of key issues with label and discipline group. Formatted as a bullet list.'
          },
          {
            type: 'runtime',
            label: 'Initial Notes',
            description: 'Optional strategic notes from the project team — appended as "Initial strategic notes from the team".'
          },
          {
            type: 'format',
            label: 'Output Structure',
            source: 'appeal.service.js — generateAppealArgument()',
            content: `Produce a structured working argument summary in HTML with these five sections:
1. <h2>Appeal Overview</h2> — brief summary of the appeal and the development
2. <h2>Reasons for Refusal</h2> — summarise each reason and its significance
3. <h2>Argument by Issue</h2> — for each key issue, outline the opposing position and initial argument direction
4. <h2>Risks and Unknowns</h2> — identify gaps, risks, and evidence still needed
5. <h2>Next Steps</h2> — practical actions to advance the case

Use <p> for body text. Keep it concise but substantive — this is a working document, not a final submission.`
          }
        ],
        assembledPreview: `You are a planning appeal consultant. Generate a structured working argument summary for the following appeal.

Project: [RUNTIME: project name]

Reasons for refusal:
[RUNTIME: numbered list of refusal reasons with summaries and risk levels]

Key issues to address:
[RUNTIME: bullet list of key issues with discipline groups]

Initial strategic notes from the team:
[RUNTIME: initial notes, if provided]

[FORMAT: five-section HTML structure]`
      },
      {
        id: 'extract-points',
        name: 'Extract Points from Document',
        output: 'JSON: { summary, coverage[], points[] } — each point has track_id, field, headline, detailed_summary, citation, chunk_indices',
        components: [
          {
            type: 'template',
            label: 'Doc Type Instructions',
            source: 'llm.shared.js — DOC_TYPE_INSTRUCTIONS (appeals) / PLANNING_APP_DOC_TYPE_INSTRUCTIONS (planning app)',
            content: `Appeals mode — per document type:
• Officer Report: Extract LPA objections as argument_against; concessions as argument_for
• Refusal Notice: Each reason for refusal → argument_against
• Appeal Decision: Inspector reasoning against → argument_against; findings for appellant → argument_for
• Planning Statement: Extract points supporting the appeal → argument_for
• Proof of Evidence: Technical findings supporting appeal → argument_for
• Expert Report: Supportive findings → argument_for; problems identified → argument_against
• Consultation Response: Objections → argument_against; support → argument_for

Planning App mode — per document type:
• Surveyor/Heritage/Ecology/Transport/Noise Report: Extract technical findings demonstrating policy compliance
• Planning Statement: Extract policy compliance arguments and planning balance conclusions
• Design and Access Statement: Extract design rationale and accessibility provisions`
          },
          {
            type: 'runtime',
            label: 'All Issues',
            description: 'Full list of issues with id, label, discipline, current argument_for and argument_against (or policy tier notes in planning app mode). Used as context for the full argument.'
          },
          {
            type: 'runtime',
            label: 'Target Issues',
            description: 'User-selected subset of issues this document is specifically relevant to. Flags these as "focus extraction on these issues first".'
          },
          {
            type: 'runtime',
            label: 'Existing Points',
            description: 'Points already accepted from prior documents — prevents duplicate extraction. The model is instructed not to repeat these unless the new document provides independent additional evidence.'
          },
          {
            type: 'runtime',
            label: 'Linked Policies',
            description: 'Planning app mode only: policies linked to the target issue(s), with full wording, tier, and supporting context. Triggers planning app mode instead of appeals mode.'
          },
          {
            type: 'runtime',
            label: 'User Notes',
            description: 'Optional guidance flagged as high priority — overrides model judgement where it conflicts.'
          },
          {
            type: 'runtime',
            label: 'Document Block',
            description: 'Document text formatted as indexed chunks (max 4 chunks, ~24,000 chars). High-value sections (Conclusions, Executive Summary) floated to the front. Each chunk labelled [Chunk N] or [Chunk N — HIGH VALUE SECTION].'
          },
          {
            type: 'format',
            label: 'Output Format',
            source: 'llm.shared.js — buildExtractPointsPrompt()',
            content: FORMAT_RULES_JSON + `

Required JSON shape:
{
  "summary": "2–4 sentence overview of the document and its relevance",
  "coverage": [{ "issue_id": 42, "assessment": "one sentence on how this document bears on this issue" }],
  "points": [{
    "track_id": 42,
    "field": "argument_for" | "argument_against" | "policy_national" | "policy_local" | ...,
    "headline": "max 15 words",
    "detailed_summary": "2–4 sentences with technical detail",
    "citation": { "para_ref": "Para 6.4", "quote": "verbatim excerpt max 150 chars" },
    "relevant_chunk_indices": [0, 1]
  }]
}`
          }
        ],
        assembledPreview: `You are a planning [appeal consultant / consultant preparing a planning statement].

[RUNTIME: USER NOTES — high priority, if provided]

Document type: [RUNTIME: document type]
[RUNTIME: doc-type-specific extraction instruction]
[RUNTIME: direction instruction — for/against, appeals mode only]

[RUNTIME: target note — which issues to focus on]

Issues to extract against:
[RUNTIME: issue list with current argument notes or policy tier notes]

[RUNTIME: linked policies block — planning app mode only]

[RUNTIME: full argument context — all issues, for background]

Document (shown as numbered chunks):
<document>
[RUNTIME: document content as indexed chunks, HIGH VALUE sections first]
</document>

[FORMAT: JSON output shape with citation rules]`
      },
      {
        id: 'suggest-addition',
        name: 'Suggest Argument Addition',
        output: 'Prose additions per issue — new sentences/paragraphs to add to the working argument',
        components: [
          {
            type: 'runtime',
            label: 'Briefing Note',
            description: 'Background and strategic context for the project — used to understand client objectives and sensitivities. Injected as "## Project Briefing Note".'
          },
          {
            type: 'runtime',
            label: 'Refusal Reasons',
            description: 'Refusal reasons with title, summary, risk level, and key issue flag. Defines the core issues the appeal must address.'
          },
          {
            type: 'runtime',
            label: 'Issues',
            description: 'Issues with current argument_for and argument_against text. The model is asked to add to these, not restate them.'
          },
          {
            type: 'runtime',
            label: 'User Notes',
            description: 'High-priority guidance — overrides model judgement where it conflicts.'
          },
          {
            type: 'runtime',
            label: 'Document Block',
            description: 'Full document text as indexed chunks (up to 20 chunks). High-value sections floated first.'
          },
          {
            type: 'tone',
            label: 'Tone Example',
            source: 'planningstatementexample.md (repo root)',
            content: TONE_EXAMPLE_PLANNING.content
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'appeal.service.js — buildArgumentSuggestionPrompt()',
            content: `- Suggest additions ONLY — do not restate or rewrite existing argument
- Write in flowing prose — full sentences and paragraphs, no bullet points
- Reference the document inline by title; cite paragraph/section numbers where available
- Reference named experts (e.g. "The heritage consultant concludes...")
- Keep additions concise: 1–4 sentences per issue unless warranted
- If nothing new for an issue, write exactly: "Nothing to add."
- Output ONLY the additions — no preamble, no extra headings`
          }
        ],
        assembledPreview: `You are a planning appeal consultant helping to build the working argument for a planning appeal.

## Project Briefing Note
[RUNTIME: briefing note, or "No briefing note on file."]

## Reasons for Refusal
[RUNTIME: refusal reasons with risk levels and key issue flags]

## Issues to Address
[RUNTIME: each issue with current argument_for and argument_against]

[RUNTIME: user guidance, if provided]

## Document Being Reviewed
Type: [RUNTIME: document type]
Title: [RUNTIME: document title]
Direction: This document is [RUNTIME: for/against].

[TASK: suggest additions only — new evidence, findings, conclusions not already in the existing argument]

[FORMAT RULES: prose only, cite sources, 1–4 sentences per issue, "Nothing to add." if nothing new]

[TONE EXAMPLE: planningstatementexample.md style reference]

Document:
<document>
[RUNTIME: document as indexed chunks, HIGH VALUE sections first]
</document>

[RUNTIME: issue output block — one heading per issue]`
      },
      {
        id: 'evolve-argument',
        name: 'Evolve Argument from Briefing',
        output: 'Revised argument paragraph for a single issue — incorporates new strategic information',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'appeal.service.js — evolveArgumentFromBriefing()',
            content: `You are a planning consultant helping to evolve a planning argument for a specific issue. Your job is to produce a revised, coherent argument that incorporates new strategic information from a briefing note. Be direct and write in formal planning language. Do not use em dashes.`
          },
          {
            type: 'runtime',
            label: 'Issue Label',
            description: 'The label of the issue being evolved.'
          },
          {
            type: 'runtime',
            label: 'Existing Argument',
            description: 'Current argument_for text for the issue, or "(none yet)" if empty.'
          },
          {
            type: 'runtime',
            label: 'New Information',
            description: 'User-provided context from a briefing note to incorporate into the argument.'
          },
          {
            type: 'runtime',
            label: 'Conversation History',
            description: 'Prior turns for multi-turn refinement — allows the user to iterate on the revised argument.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'appeal.service.js — evolveArgumentFromBriefing()',
            content: `- Reflect the updated position — write from the new position rather than layering old and new
- Replace superseded content rather than appending
- Be coherent as a standalone argument
- Write only the revised argument text — no preamble, no explanation of what changed`
          }
        ],
        assembledPreview: `[SYSTEM ROLE: planning consultant evolving an argument]

Issue: [RUNTIME: issue label]

Current argument:
[RUNTIME: existing argument_for text, or "(none yet)"]

New information from briefing note:
[RUNTIME: new information provided by user]

[TASK: produce evolved version of the argument incorporating the new information]

[FORMAT: revised argument text only — no preamble]

[RUNTIME: prior conversation turns for multi-turn refinement]`
      },
      {
        id: 'draft-from-briefing',
        name: 'Draft Arguments from Briefing',
        output: 'JSON array: [{ track_id, argument_for }] — argument starters for each issue the briefing covers',
        components: [
          {
            type: 'runtime',
            label: 'Briefing Summary',
            description: 'HTML-formatted briefing summary, stripped to plain text and truncated to 6,000 chars.'
          },
          {
            type: 'runtime',
            label: 'Issues',
            description: 'Issues with id, label, discipline, and existing argument_for (truncated to 200 chars). Issues with existing notes are supplemented rather than replaced.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'appeal.service.js — draftIssueArgumentsFromBriefing()',
            content: `- Write argument starters (2–5 sentences), not summaries of the briefing
- Do not reference "the briefing" or "the transcript" — state the argument as a working position
- Only include issues where the briefing genuinely provides material
- Omit issues entirely if the briefing has nothing relevant
- Return JSON array only: [{ "track_id": 42, "argument_for": "The proposals..." }]`
          }
        ],
        assembledPreview: `You are a planning consultant building a planning case on behalf of the applicant.

[TASK: extract argument positions from briefing — points that can be advanced IN FAVOUR of the proposal]

Briefing summary:
[RUNTIME: briefing summary plain text, truncated to 6,000 chars]

Issues:
[RUNTIME: issue list with existing notes]

[FORMAT: JSON array of argument starters — omit issues with nothing relevant]`
      },
      {
        id: 'generate-draft',
        name: 'Generate Formal Draft Document',
        output: 'HTML appeal document — stitched from per-section calls, or single call if no sections defined',
        components: [
          {
            type: 'guide',
            label: 'Guiding Brief',
            source: 'DB: admin_console.guiding_briefs (document_type=draft_type slug, matched by project development type)',
            content: `Fetched at call time using the appeal draft type slug (e.g. 'statement_of_case', 'statement_of_common_ground') and the project's development type.

guidance_content injected after the system role as "## Document Guidance [guidance_content]".
review_checklist used in a post-generation review call to flag missing sections or topics.`
          },
          {
            type: 'system',
            label: 'System Role',
            source: 'appeal.service.js — generateDraftSection()',
            content: `You are a planning appeal consultant. You output clean HTML documents. You never use markdown — every paragraph is a <p> tag, lists are <ol> or <ul>, bold is <strong>. If you use **, *, or --- you have made an error. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`
          },
          {
            type: 'template',
            label: 'Section Instructions',
            source: 'DB: appeal_draft_sections.generation_prompt (or fallback default)',
            content: `Per-section instructions loaded from the database (appeal_draft_sections.generation_prompt). If none defined, defaults to:

"Write the [section name] section of a [draft type]. Use formal planning language suitable for submission to the Planning Inspectorate. Produce clean HTML: <h2> for the section heading, <p> for body text, <ol>/<li> for numbered lists. Do not add placeholder text — write the full section from the material provided."`
          },
          {
            type: 'template',
            label: 'Example Block',
            source: 'DB: appeal_draft_sections.example_text (optional)',
            content: `Per-section example loaded from the database (appeal_draft_sections.example_text). If present, injected as:

"The following is an example of this section's tone and format. Match the style but use NO information from it — all content must come from the working argument notes:"`
          },
          {
            type: 'runtime',
            label: 'Issue Context',
            description: 'Full working argument per issue — opposing position, our case, and source evidence from accepted document points. Formatted as "## Issue Label\\nOpposing position:\\n...\\nOur case:\\n...\\nSource evidence:\\n..."'
          },
          {
            type: 'format',
            label: 'Format Rules',
            source: 'appeal.service.js — generateDraftSection()',
            content: FORMAT_RULES_HTML + `
- Begin with <h2>[section name]</h2>
- Do not number individual paragraphs (no 7.1, 7.2 etc.)`
          }
        ],
        assembledPreview: `[SYSTEM ROLE: planning appeal consultant — clean HTML output]

You are drafting the "[RUNTIME: section name]" section of a formal planning appeal document. Output HTML only — no markdown.

CONTENT INSTRUCTIONS:
[TEMPLATE: section-specific generation prompt from DB, or default]

[TEMPLATE: example block from DB, if present]

Project: [RUNTIME: project name]
Document: [RUNTIME: draft type name]

Working argument notes:
[RUNTIME: full issue context — opposing positions, our case, source evidence per issue]

[FORMAT RULES: HTML only, begin with <h2>, no markdown, no em dashes, no paragraph numbering]`
      }
    ]
  },

  // ── Planning Statement ──────────────────────────────────────────────────────
  {
    id: 'planning-statement',
    name: 'Planning Statement',
    icon: 'la-file-contract',
    description: 'Generates planning statement sections, assessment sub-sections, and template-based content.',
    operations: [
      {
        id: 'generate-section',
        name: 'Generate Statement Section',
        output: 'HTML section with programmatic output-variable substitution applied after generation',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'planningStatement.service.js — generatePlanningStatementSection()',
            content: `You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority. Output clean HTML only — no markdown. Every paragraph is <p>, section headings are <h2>, subsection headings are <h3>, lists are <ul>/<li>, bold is <strong>. Never use **, *, #, or --- — those are errors. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.

CRITICAL RULE: If you need to state a fact, figure, name, date, designation, measurement, or project-specific claim that is not explicitly present in the content provided to you, write [SOURCE REQUIRED] in its place. Never invent or infer project-specific information.`
          },
          {
            type: 'tone',
            label: 'Tone Example',
            source: 'planningstatementexample.md (repo root)',
            content: TONE_EXAMPLE_PLANNING.content
          },
          {
            type: 'template',
            label: 'Generation Prompt',
            source: 'DB: planning_statement_sections.generation_prompt',
            content: `The section's generation prompt from the database. Input variables (e.g. {{PROJECT_NAME}}, {{LOCAL_POLICIES_CONTEXT}}) are substituted BEFORE sending to Claude. Output variables (e.g. {{NATIONAL_POLICIES}}, {{PROPOSED_DEVELOPMENT_HTML}}) are preserved as tokens — Claude writes them literally and they are substituted AFTER generation.

Input variables substituted before Claude:
  PROJECT_NAME, APPLICANT_NAME, LPA_NAME, SITE_ADDRESS, DEVELOPMENT_DESCRIPTION,
  PROPOSED_DEVELOPMENT, SITE_SURROUNDINGS, PLANNING_HISTORY,
  DOCUMENT_LIST, LOCAL_POLICIES_CONTEXT, NATIONAL_POLICIES_CONTEXT

Output variables written literally by Claude, substituted after:
  ABOUT_APPLICANT, PRE_APP_SUMMARY, EIA_SUMMARY, SCI_SUMMARY,
  NATIONAL_POLICIES, LOCAL_POLICIES, OTHER_POLICIES,
  LOCAL_POLICIES_KEY, LOCAL_POLICIES_OTHER, SUPPLEMENTARY_POLICIES,
  PROPOSED_DEVELOPMENT_HTML, SITE_SURROUNDINGS_HTML, PLANNING_HISTORY_TABLE,
  DOCUMENT_LIST_DOCS, DOCUMENT_LIST_DRAWINGS,
  NPPF_TEXT, NPPG_TEXT, OTHER_NATIONAL_TEXT, OTHER_GUIDANCE_TEXT`
          },
          {
            type: 'template',
            label: 'Example Block',
            source: 'DB: planning_statement_sections.example_text (optional)',
            content: `Per-section example from the database. If present, injected as:
"The following example shows the target tone and structure. Match the style — do NOT use any content from it."
Stripped to plain text, truncated to 3,000 chars.`
          },
          {
            type: 'guide',
            label: 'Guiding Brief',
            source: 'DB: admin_console.guiding_briefs (document_type=planning_statement, matched by project development type)',
            content: `Fetched at call time using document_type='planning_statement' and the project's development type. Falls back to a generic brief if no specific match exists.

guidance_content injected after the tone example as "## Document Guidance [guidance_content]".
review_checklist used in a post-generation review call.`
          },
          {
            type: 'runtime',
            label: 'Briefing Context',
            description: 'Briefing summary (up to 6,000 chars) injected into the system prompt as: "Briefing context (use this to inform strategic direction, framing, and planning arguments — do not reproduce it verbatim)".'
          },
          {
            type: 'format',
            label: 'Numbering Instruction',
            source: 'planningStatement.service.js — generatePlanningStatementSection()',
            content: `Applied based on sectionNumber parameter.

If section has a number > 0:
  "This is section N. Apply this scheme: main heading → N.0 (<h2>), subsection headings → N.1, N.2... (<h3>), paragraphs → N.0.1, N.0.2... (prefix every <p>). Every <p> must begin with its paragraph number."

If section number is 0:
  "Do not add any numeric prefix to the heading or paragraphs in this section."`
          },
          {
            type: 'format',
            label: 'Output Variable Instruction',
            source: 'planningStatement.service.js — generatePlanningStatementSection()',
            content: `"CRITICAL INSTRUCTION: The following placeholders will be filled in programmatically after you write. Write them EXACTLY as shown — including the double curly braces — wherever you would use that value. Never invent or rephrase these values:"
[Lists only the output variables that have values in this call's variable map]`
          }
        ],
        assembledPreview: `[SYSTEM ROLE: senior planning consultant — [SOURCE REQUIRED] for unverified facts]
[TONE EXAMPLE: planningstatementexample.md — 3,000 chars style reference]
[RUNTIME: briefing context, if available]

[FORMAT: output variable instruction — which tokens to write literally]
[FORMAT: numbering instruction — section N.0, N.0.1 etc.]
[TEMPLATE: example block from DB, if present]

[TEMPLATE: generation prompt from DB, with INPUT VARIABLES already substituted:
  PROJECT_NAME → [RUNTIME: project name]
  APPLICANT_NAME → [RUNTIME: client name]
  LPA_NAME → [RUNTIME: LPA name]
  LOCAL_POLICIES_CONTEXT → [RUNTIME: policy refs + names + supporting text]
  ... etc.
  OUTPUT VARIABLES preserved as {{NATIONAL_POLICIES}} etc. for post-generation substitution]`
      },
      {
        id: 'generate-assessment',
        name: 'Generate Assessment Sub-Section',
        output: 'HTML <h3> sub-section per issue — national policy → local policy → compliance → conclusion',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'planningStatement.service.js — generateSingleAssessmentIssue()',
            content: `You are a planning consultant drafting formal Planning Statements. You output clean HTML only. Every paragraph is a <p> tag, headings are <h2> or <h3>, bold is <strong>. Never use **, *, #, or --- — that is an error. Never use em dashes (—); use a comma, colon, or rewrite the sentence instead.`
          },
          {
            type: 'tone',
            label: 'Tone Example',
            source: 'planningstatementexample.md (repo root)',
            content: TONE_EXAMPLE_PLANNING.content
          },
          {
            type: 'template',
            label: 'Assessment Prompt',
            source: 'DB: planning_statement_sections.generation_prompt, or PLANNING_ASSESSMENT_DEFAULT_PROMPT',
            content: `Default prompt (PLANNING_ASSESSMENT_DEFAULT_PROMPT) unless overridden in the DB.

Default structure:
1. National policy says X. 2. Local policy says X. 3. Other policy says X. 4. How the proposals comply with those policies (using assessment notes + specialist survey references). 5. Conclusion: therefore complies with [list of policies].

The prompt uses these template tokens:
  {{ISSUE_LABEL}}     — the issue being assessed (e.g. "Heritage")
  {{ISSUE_DISCIPLINE}} — the discipline group, if any
  {{PROJECT_NAME}}    — project name
  {{EXAMPLE_BLOCK}}   — style example from DB, if present
  {{POLICY_STRUCTURE}} — either the full policy compliance structure (if policies linked) or a no-policy variant
  {{ISSUE_CONTEXT}}   — policies, assessment notes, and specialist evidence`
          },
          {
            type: 'template',
            label: 'Example Block',
            source: 'DB: planning_statement_sections.example_text (optional)',
            content: `Per-section example from the database. Stripped to plain text, truncated to 2,000 chars. Injected as:
"Match the tone and style of this example. Use NO content from it — all content must come from the notes and policies provided."`
          },
          {
            type: 'runtime',
            label: 'Issue Context',
            description: 'Built from: issue-type national policy text (NPPF, NPPG, other national, other guidance), linked policies per tier (with wording and supporting text, key policies flagged), national policy context notes, assessment notes (argument_for), and specialist evidence points with source citations.'
          },
          {
            type: 'runtime',
            label: 'Policy Structure',
            description: 'If policies are linked: "National policies first... then local... compliance paragraphs... concluding sentence: The proposals are therefore considered to comply with [policy refs]." If no policies: no-policy variant instructing the model not to reference or invent any policy.'
          },
          {
            type: 'runtime',
            label: 'Briefing Context',
            description: 'Briefing summary (up to 6,000 chars) injected into the system prompt — used to inform strategic direction and framing.'
          },
          {
            type: 'format',
            label: 'Format Rules',
            source: 'planningStatement.service.js — PLANNING_ASSESSMENT_DEFAULT_PROMPT',
            content: `- Begin with <h3>{{ISSUE_LABEL}}</h3>
- Write flowing paragraphs — NO sub-headings of any kind (no "National Policy", "Assessment" etc.)
- Every paragraph in <p> tags
- Bold policy names with <strong> — only for policies explicitly listed in the issue context
- NEVER invent, assume, or refer to any planning policy not explicitly listed`
          }
        ],
        assembledPreview: `[SYSTEM ROLE: planning consultant drafting formal Planning Statements]
[TONE EXAMPLE: planningstatementexample.md style reference]
[RUNTIME: briefing context, if available]

[TEMPLATE: assessment prompt (default or DB override) with tokens substituted:
  {{ISSUE_LABEL}} → [RUNTIME: issue label, e.g. "Heritage"]
  {{ISSUE_DISCIPLINE}} → [RUNTIME: discipline group]
  {{PROJECT_NAME}} → [RUNTIME: project name]
  {{EXAMPLE_BLOCK}} → [TEMPLATE: example from DB, if present]
  {{POLICY_STRUCTURE}} → [RUNTIME: policy compliance structure, or no-policy variant]
  {{ISSUE_CONTEXT}} → [RUNTIME: issue-type policy text + linked policies + assessment notes + evidence]
]

[FORMAT RULES: <h3> heading, flowing prose only, no sub-headings, bold policies with <strong>]`
      },
      {
        id: 'generate-template',
        name: 'Generate from Template (LLM Slots)',
        output: 'HTML with {{LLM:slug}} slots filled and all {{VARIABLE}} tokens substituted',
        components: [
          {
            type: 'system',
            label: 'System Role (per slot)',
            source: 'planningStatement.service.js — generateLlmSlot()',
            content: `You are writing a single short passage for a formal Planning Statement submission.

Project context (for reference — do not reproduce these verbatim as they appear elsewhere in the document):
[Project: ..., Applicant: ..., LPA: ..., Site: ..., Development: ...]

RULES:
- Write [SOURCE REQUIRED] for any project-specific fact not in the context above
- Output clean HTML using only <p> tags (and <ul>/<li> only if the instruction explicitly asks for a list)
- No headings, no markdown, no code blocks
- Do not use em dashes (—); use a comma, colon, or rewrite the sentence instead`
          },
          {
            type: 'tone',
            label: 'Tone Example',
            source: 'planningstatementexample.md (repo root)',
            content: TONE_EXAMPLE_PLANNING.content
          },
          {
            type: 'template',
            label: 'Slot Instructions',
            source: 'DB: planning_statement_sections.template_html — {{LLM:slug}}...{{/LLM}} blocks',
            content: `Each {{LLM:slug}}instruction{{/LLM}} block in the template HTML is processed separately. The instruction text has plain-text variables substituted (PROJECT_NAME, APPLICANT_NAME etc.) before being sent to Claude.

Example template slot:
{{LLM:intro}}Write a brief introduction to this planning statement for {{PROJECT_NAME}}, a {{DEVELOPMENT_DESCRIPTION}} proposed at {{SITE_ADDRESS}}.{{/LLM}}

Non-LLM {{VARIABLE}} tokens are substituted programmatically from the resolved variables map without calling Claude.`
          },
          {
            type: 'runtime',
            label: 'Variables',
            description: 'All resolved project variables: PROJECT_NAME, APPLICANT_NAME, LPA_NAME, SITE_ADDRESS, DEVELOPMENT_DESCRIPTION, and all document summary and policy variables. Plain-text values are substituted into slot instructions; HTML values are substituted programmatically after generation.'
          },
          {
            type: 'runtime',
            label: 'Briefing Context',
            description: 'Briefing summary (up to 6,000 chars) injected into the system prompt for each LLM slot call.'
          }
        ],
        assembledPreview: `[Per LLM slot call:]

[SYSTEM ROLE: short passage writer — [SOURCE REQUIRED] for unknown facts]
[TONE EXAMPLE: planningstatementexample.md style reference]
[RUNTIME: briefing context, if available]
[RUNTIME: project context block — project name, applicant, LPA, site, development]

[TEMPLATE: slot instruction from template_html, with plain-text variables substituted:
  e.g. "Write a brief introduction to this planning statement for [RUNTIME: PROJECT_NAME],
  a [RUNTIME: DEVELOPMENT_DESCRIPTION] proposed at [RUNTIME: SITE_ADDRESS]."]

[Post-generation: all {{VARIABLE}} tokens in the full template substituted programmatically]`
      },
      {
        id: 'summarise-document',
        name: 'Summarise Document',
        output: 'HTML structured summary — headings and content vary by document type',
        components: [
          {
            type: 'template',
            label: 'Summary Prompt',
            source: 'DB: planning_applications.doc_type_prompts (custom), or DEFAULT_SUMMARY_PROMPTS (hardcoded)',
            content: `Default prompts per document type:

pre_app: "Summarise this pre-application response. Structure: Overview, Key Concerns Raised, Aspects Supported, Recommended Changes."
eia_response: "Summarise this EIA Scoping Opinion. Structure: Topics Scoped In/Out, Technical Concerns, Methodology Recommendations, Overarching Comments."
sci: "Summarise this SCI/consultation document. Structure: Methods and Timeline, Community Feedback, Objections, Support Received, How Addressed."
site_surroundings: "Summarise this Site and Surroundings document. Structure: Site Description, Surrounding Context, Constraints, Access, Opportunities."
about_applicant: "Format this About the Applicant text for a Planning Statement. Preserve original wording exactly."
proposed_development: "Summarise this Proposed Development description. Cover: formal description, components, technical figures, design principles."
briefing_transcript: "Produce a detailed structured summary of this project briefing transcript: Proposed Development, Planning Strategy, Planning Benefits, Policy Positioning, Constraints, Specific Instructions."
other: "Structured summary: Purpose and Scope, Key Findings, Relevance to Application, Material Considerations."

Custom prompts can be set per project via the planning application settings.`
          },
          {
            type: 'runtime',
            label: 'Document Text',
            description: 'Raw document text, truncated to 80,000 chars. Passed as user message: "Document: [filename]\\n\\n[text]".'
          }
        ],
        assembledPreview: `[SYSTEM: summary prompt — either custom from DB or default for doc type]

Document: [RUNTIME: filename]

[RUNTIME: document text, up to 80,000 chars]`
      },
      {
        id: 'suggest-planning-addition',
        name: 'Suggest Planning Argument Addition',
        output: 'Prose additions per issue — new compliance evidence to add from the reviewed document',
        components: [
          {
            type: 'runtime',
            label: 'Briefing Note',
            description: 'Background and strategic context for the project.'
          },
          {
            type: 'runtime',
            label: 'Issues',
            description: 'Issues with current argument_for (compliance assessment notes) and linked policies per tier — each policy with reference, name, type, and supporting context.'
          },
          {
            type: 'runtime',
            label: 'User Notes',
            description: 'High-priority guidance — overrides model judgement where it conflicts.'
          },
          {
            type: 'runtime',
            label: 'Document Block',
            description: 'Full document as indexed chunks, high-value sections first.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'planningStatement.service.js — buildPlanningArgumentSuggestionPrompt()',
            content: `- Suggest additions ONLY — new compliance evidence not already in the assessment
- Write in formal planning language — prose only, no bullet points
- Reference the document by title, cite paragraph/section numbers
- Reference named experts (e.g. "The Heritage Statement concludes...")
- 1–4 sentences per issue unless warranted
- "Nothing to add." if nothing new`
          }
        ],
        assembledPreview: `You are a planning consultant preparing a planning statement compliance assessment.

## Project Briefing Note
[RUNTIME: briefing note, or "No briefing note on file."]

## Issues and Current Compliance Assessment
[RUNTIME: each issue with argument_for and linked policies with supporting context]

[RUNTIME: user guidance, if provided]

## Document Being Reviewed
Type: [RUNTIME: document type]
Title: [RUNTIME: document title]

[TASK: suggest additions to compliance assessment — new technical findings, expert conclusions]

[FORMAT RULES: prose only, cite sources, reference experts by name, "Nothing to add." if nothing new]

Document:
<document>
[RUNTIME: document as indexed chunks, HIGH VALUE sections first]
</document>

[RUNTIME: issue output block]`
      },
      {
        id: 'draft-issue-summaries',
        name: 'Draft Key Issue Summaries from Briefing',
        output: 'JSON array: [{ track_id, argument_for }] — compliance argument starters for each issue derived from a briefing transcript',
        components: [
          {
            type: 'runtime',
            label: 'Briefing Summary',
            description: 'HTML briefing summary stripped to plain text, truncated to 6,000 chars.'
          },
          {
            type: 'runtime',
            label: 'Issues',
            description: 'Planning application issues with id, label, discipline, and existing argument_for (truncated to 200 chars). Issues with existing notes are supplemented rather than replaced.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'planningStatement.service.js — draftKeyIssueSummariesFromBriefing()',
            content: `- Write compliance argument starters (2–5 sentences) from the planning application perspective
- Do not reference "the briefing" — state the argument as a working position
- Only include issues where the briefing provides material evidence
- Omit issues entirely if nothing relevant
- Return JSON array only: [{ "track_id": 42, "argument_for": "The proposals..." }]`
          }
        ],
        assembledPreview: `You are a planning consultant building the compliance case for a planning application.

[TASK: extract compliance argument positions from briefing]

Briefing summary:
[RUNTIME: briefing summary plain text, up to 6,000 chars]

Issues:
[RUNTIME: issue list with existing compliance notes]

[FORMAT: JSON array of argument starters — omit issues with nothing relevant]`
      },
      {
        id: 'draft-arguments-from-summaries',
        name: 'Draft Arguments from Issue Summaries',
        output: 'JSON array: [{ track_id, argument_for }] — detailed compliance arguments built from existing issue summaries',
        components: [
          {
            type: 'runtime',
            label: 'Issue Summaries',
            description: 'Issues with existing key_issue_summary notes as the basis for generating fuller compliance arguments.'
          },
          {
            type: 'runtime',
            label: 'Project Context',
            description: 'Project name, LPA, development description — used to frame the compliance arguments correctly.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'planningStatement.service.js — draftArgumentsFromIssueSummaries()',
            content: `- Expand issue summaries into fuller planning compliance arguments
- Write in formal planning language suitable for a Planning Statement
- Each argument should address how the proposals comply with the relevant policy context
- Return JSON array: [{ "track_id": 42, "argument_for": "..." }]`
          }
        ],
        assembledPreview: `You are a planning consultant drafting the compliance case for a planning application.

[TASK: expand issue summaries into full compliance arguments]

Issues with summaries:
[RUNTIME: issue list with key_issue_summary notes]

Project: [RUNTIME: project context]

[FORMAT: JSON array of compliance arguments per issue]`
      },
      {
        id: 'incorporate-assessment',
        name: 'Incorporate Document into Planning Assessment',
        output: 'Revised HTML planning assessment section — amended to incorporate evidence from an uploaded specialist report or supporting document',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'planningStatement.service.js — incorporatePlanningAssessment()',
            content: `You are a planning consultant amending a Planning Statement section to incorporate new evidence from a specialist report or supporting document. Write in formal planning language. Output clean HTML only — no markdown, no em dashes.`
          },
          {
            type: 'runtime',
            label: 'Existing Section HTML',
            description: 'The current HTML content of the planning assessment section being amended.'
          },
          {
            type: 'runtime',
            label: 'Document Text',
            description: 'Text of the specialist report or supporting document being incorporated, chunked and joined.'
          },
          {
            type: 'runtime',
            label: 'Issue Context',
            description: 'The issue(s) this section relates to — label, linked policies, and current compliance notes.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'planningStatement.service.js — incorporatePlanningAssessment()',
            content: `- Integrate new evidence naturally into the existing section structure
- Cite the document by name, referencing paragraph numbers where available
- Do not remove or contradict existing content unless the new document supersedes it
- Return the complete revised section as clean HTML`
          }
        ],
        assembledPreview: `[SYSTEM ROLE: planning consultant amending a Planning Statement section]

Existing section:
[RUNTIME: current HTML of the section]

Document to incorporate:
[RUNTIME: specialist report text]

Issue context:
[RUNTIME: issue label, linked policies, compliance notes]

[FORMAT: complete revised HTML section with new evidence integrated]`
      },
      {
        id: 'suggest-transcript',
        name: 'Suggest Field Updates from Transcript',
        output: 'JSON array: [{ field, label, suggested_content (HTML), reason }] — fields to update from transcript',
        components: [
          {
            type: 'system',
            label: 'System Prompt',
            source: 'planningStatement.service.js — suggestTranscriptUpdates()',
            content: `You are a planning consultant analysing a briefing transcript to identify content that should update specific project data fields.

Fields assessed:
1. about_applicant — who the applicant/developer is, background, track record
2. proposed_development — full description of what is being proposed (components, scale, specifications)
3. site_surroundings — description of the site and surrounding context
4. pre_app — any pre-application advice received from the LPA

Only suggest an update if the content is clearly and explicitly present — do not infer, fabricate, or pad.
Return ONLY a valid JSON array. If no fields have clear content, return [].`
          },
          {
            type: 'runtime',
            label: 'Transcript Text',
            description: 'Raw transcript text, truncated to 80,000 chars. Passed as "Transcript:\\n\\n[text]".'
          },
          {
            type: 'format',
            label: 'Output Format',
            source: 'planningStatement.service.js — suggestTranscriptUpdates()',
            content: `JSON array:
[{
  "field": "about_applicant" | "proposed_development" | "site_surroundings" | "pre_app",
  "label": "human-readable label",
  "suggested_content": "HTML using only <p>, <ul>, <li>, <h3> — write the actual content, not a summary",
  "reason": "single sentence explaining what in the transcript justifies this suggestion"
}]`
          }
        ],
        assembledPreview: `[SYSTEM PROMPT: planning consultant identifying field update candidates from transcript]

Transcript:

[RUNTIME: transcript text, up to 80,000 chars]

[FORMAT: JSON array of field suggestions — write actual HTML content, not summaries]`
      }
    ]
  },

  // ── Ingestion Pipeline ──────────────────────────────────────────────────────
  {
    id: 'ingestion',
    name: 'Document Ingestion',
    icon: 'la-file-import',
    description: 'Chunks a document and analyses each chunk against project topics.',
    operations: [
      {
        id: 'run-ingestion',
        name: 'Run Ingestion Pipeline',
        output: '{ topicResults[], documentSummary, unmatchedContent, suggestedTopics[] }',
        components: [
          {
            type: 'system',
            label: 'System Prompt',
            source: 'ingestion.service.js — DEFAULT_SYSTEM_PROMPT (or stageConfig override)',
            content: `Default:
"You are a project document analyst. Your job is to read a section of a project document and assess it against a list of predefined project topics. For each topic, determine whether this section contains relevant information, and if so, summarise what it says about that topic."

Can be overridden per project stage via stageConfig.llm_system_prompt in the database.`
          },
          {
            type: 'template',
            label: 'User Prompt Template',
            source: 'ingestion.service.js — DEFAULT_USER_PROMPT_TEMPLATE (or stageConfig override)',
            content: `Default template:
"Here is a section of a project document:
<document_chunk>{{CHUNK_TEXT}}</document_chunk>

Here are the predefined topics for this project:
<topics>{{TOPICS_JSON}}</topics>

For each topic, respond ONLY with a valid JSON array..."

Can be overridden per project stage via stageConfig.llm_user_prompt_template in the database.`
          },
          {
            type: 'runtime',
            label: 'Document Chunks',
            description: 'Document split into ~6,000-char chunks (max 20 analysed). Each chunk is processed separately with MODEL_FAST (Claude Haiku) for speed and cost.'
          },
          {
            type: 'runtime',
            label: 'Topics JSON',
            description: 'Project topics as JSON: [{ id, code, title, description, keywords }]. Substituted into {{TOPICS_JSON}} in the template.'
          },
          {
            type: 'format',
            label: 'Output Format (per chunk)',
            source: 'ingestion.service.js — DEFAULT_USER_PROMPT_TEMPLATE',
            content: `JSON array per chunk:
[{
  "issue_id": "numeric-id",
  "mentioned": true | false,
  "summary": "1–3 sentence summary or null",
  "sentiment": "positive" | "neutral" | "negative" | "not_mentioned",
  "confidence": "high" | "medium" | "low",
  "source_quote": "verbatim excerpt max 300 chars or null"
}]

Followed by:
- Summary merge (Claude Sonnet) for topics mentioned in multiple chunks
- 200-word document summary call
- Unmatched content + suggested new topics call`
          }
        ],
        assembledPreview: `[Per chunk — MODEL_FAST (Claude Haiku):]
[SYSTEM: DEFAULT_SYSTEM_PROMPT or stageConfig override]

Here is a section of a project document:
<document_chunk>
[RUNTIME: one ~6,000-char chunk of the document]
</document_chunk>

Here are the predefined topics for this project:
<topics>
[RUNTIME: topics JSON]
</topics>

[FORMAT: JSON array — mentioned/summary/sentiment/confidence/source_quote per topic]

---
[After all chunks — MODEL_SONNET:]
[Merge call for topics mentioned across multiple chunks]
[200-word document summary call]
[Unmatched content + suggested topics call]`
      }
    ]
  },

  // ── LPA Decision Analysis ───────────────────────────────────────────────────
  {
    id: 'lpa-analysis',
    name: 'LPA Decision Analysis',
    icon: 'la-landmark',
    description: 'Analyses individual planning decisions and synthesises strategic intelligence across a set of cases.',
    operations: [
      {
        id: 'analyse-document',
        name: 'Analyse LPA Document',
        output: 'JSON: { document_type, outcome, application_ref, lpa_name, summary, key_reasoning, policy_treatment[] }',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'lpaAnalysis.service.js — LPA_DOC_ANALYSIS_SYSTEM',
            content: `You are a specialist planning consultant. Your job is to read planning documents — decision notices, officer reports, appeal decisions, supporting documents — and extract structured intelligence about how a Local Planning Authority (LPA) has approached and decided similar planning applications. You will be given context about a live project (site, description, use type) and a list of relevant planning policies the team is tracking. Your analysis will be used to inform the project team's strategy and advice to their client.`
          },
          {
            type: 'runtime',
            label: 'Project Context',
            description: 'Project name, site address, LPA, use type, and development description. Formatted as a labelled list.'
          },
          {
            type: 'runtime',
            label: 'Tracked Policies',
            description: 'List of policies the project team is tracking — reference, name, type, and key policy flag. Used to focus policy_treatment extraction.'
          },
          {
            type: 'runtime',
            label: 'Document Text',
            description: 'Full document text chunked and joined (max 20 chunks). Passed as the full text in the prompt.'
          },
          {
            type: 'format',
            label: 'Output Format',
            source: 'lpaAnalysis.service.js — LPA_DOC_ANALYSIS_PROMPT',
            content: `JSON object:
{
  "document_type": "Decision Notice | Officer Report | Appeal Decision | Supporting Document | Other",
  "outcome": "Approved | Refused | Allowed | Dismissed | N/A | Unknown",
  "application_ref": "string or null",
  "lpa_name": "string or null",
  "summary": "200 word plain English summary",
  "key_reasoning": "main planning reasoning",
  "policy_treatment": [{ "policy_ref", "policy_name", "treatment" }]
}
Only include policies actually discussed in the document.`
          }
        ],
        assembledPreview: `[SYSTEM ROLE: specialist planning consultant extracting LPA intelligence]

## Live Project Context
[RUNTIME: project name, site, LPA, use type, description]

## Relevant Planning Policies We Are Tracking
[RUNTIME: tracked policies list]

## Document to Analyse
<document>
[RUNTIME: full document text, all chunks joined]
</document>

[FORMAT: JSON object with document_type, outcome, summary, key_reasoning, policy_treatment]`
      },
      {
        id: 'synthesise-analysis',
        name: 'Synthesise Analysis Report',
        output: 'Markdown report: Key Themes, How the LPA Has Been Deciding, How Policies Have Been Treated',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'lpaAnalysis.service.js — LPA_SYNTHESIS_SYSTEM',
            content: `You are a senior planning consultant producing a strategic analysis report. You have reviewed a set of planning documents from similar schemes and must now produce a structured intelligence report to inform your client's project strategy. Write in clear, professional planning language. Be specific, evidence-based, and directly useful to a planning team preparing a case.`
          },
          {
            type: 'runtime',
            label: 'Project Context',
            description: 'Same project context as the individual analysis calls.'
          },
          {
            type: 'runtime',
            label: 'Tracked Policies',
            description: 'Same policy list — used to structure the "How Our Relevant Policies Have Been Treated" section.'
          },
          {
            type: 'runtime',
            label: 'Document Summaries',
            description: 'Per-document analysis results formatted as: document type, outcome, ref, LPA name, summary, key reasoning, policies discussed.'
          },
          {
            type: 'format',
            label: 'Output Structure',
            source: 'lpaAnalysis.service.js — LPA_SYNTHESIS_PROMPT',
            content: `Plain text with markdown headings (not JSON):

## Key Themes
4–8 recurring themes with evidence and contradictions.

## How the LPA Has Been Deciding Similar Cases
Narrative on determining factors, conditions, consistency, appeal outcomes, shifts over time.

## How Our Relevant Policies Have Been Treated
Per-policy section for each tracked policy that appears in the documents:
- How applied across cases
- Used to support refusal / justify approval / neutral factor
- Notable interpretations or weightings
- Implications for our project's position`
          }
        ],
        assembledPreview: `[SYSTEM ROLE: senior planning consultant producing strategic analysis report]

## Live Project Context
[RUNTIME: project context]

## Relevant Planning Policies We Are Tracking
[RUNTIME: tracked policies]

## Individual Document Analyses
[RUNTIME: formatted summaries of each analysed document]

[FORMAT: three-section markdown report — Key Themes, Decision Patterns, Policy Treatment]`
      }
    ]
  },

  // ── Stage Analysis ──────────────────────────────────────────────────────────
  {
    id: 'stage-analysis',
    name: 'Stage Analysis',
    icon: 'la-tasks',
    description: 'Analyses stage documents against tracked issues, building longitudinal notes across the project lifecycle.',
    operations: [
      {
        id: 'analyse-for-stage',
        name: 'Analyse Document for Stage',
        output: '[ { issue_track_id, relevant, suggested_notes, sentiment, source_quote } ] — one entry per tracked issue',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'stageAnalysis.service.js — STAGE_ANALYSIS_SYSTEM',
            content: `You are a planning consultant managing an issue tracker for a planning project. The tracker follows key planning concerns — such as highway impacts, ecology, noise, heritage, drainage — through each stage of the project lifecycle, from pre-application through to decision. Each issue has a recorded history of notes from prior stages. Your job is to analyse documents uploaded at each new stage and write detailed professional notes for each issue, building on that history. Your notes will be saved as the stage record and read by the project team to track progress and inform decisions.`
          },
          {
            type: 'runtime',
            label: 'Stage Name',
            description: 'Display name of the stage being processed (e.g. "EIA", "Pre-Application"). Substituted into {{STAGE_NAME}} in the prompt.'
          },
          {
            type: 'runtime',
            label: 'Document Chunks',
            description: 'Document split into chunks (max 20). Each chunk analysed separately with MODEL_FAST (Claude Haiku).'
          },
          {
            type: 'runtime',
            label: 'Issue Tracks with Prior History',
            description: 'Each tracked issue with: id, label, discipline (source_key), and prior_summaries [ { stage_name, notes } ]. The prior history lets each analysis build on what has already been recorded.'
          },
          {
            type: 'runtime',
            label: 'User Guidance',
            description: 'Optional per-issue guidance — map of issue_track_id → guidance text. Flagged as high priority for that issue\'s analysis.'
          },
          {
            type: 'format',
            label: 'Output + Synthesis',
            source: 'stageAnalysis.service.js — STAGE_ANALYSIS_USER_TEMPLATE + STAGE_SYNTHESIS_PROMPT',
            content: `Per-chunk output (Haiku):
JSON array — { issue_track_id, relevant, summary (~200 words), sentiment, source_quote }

Per-relevant-issue synthesis (Sonnet):
~400–1,000 words of professional prose, building on prior stage history, addressing user guidance. No bullet points — continuous prose suitable for a project record.`
          }
        ],
        assembledPreview: `[Per chunk — MODEL_FAST (Claude Haiku):]
[SYSTEM ROLE: planning consultant managing issue tracker]

You are processing a document at the "[RUNTIME: stage name]" stage.

<document_chunk>
[RUNTIME: one chunk of the document]
</document_chunk>

<issues>
[RUNTIME: JSON array — each issue with id, label, discipline, prior_summaries]
</issues>

[RUNTIME: user guidance block, if provided]

[FORMAT: JSON array — relevant/summary/sentiment/source_quote per issue]

---
[Per relevant issue — MODEL_SONNET synthesis:]
Issue: [RUNTIME: issue label]
Prior stage history: [RUNTIME: prior summaries per stage]
[RUNTIME: user guidance for this issue, if provided]
Extracted chunk summaries: [RUNTIME: all chunk summaries for this issue]
[FORMAT: ~400–1,000 word professional prose stage notes]`
      }
    ]
  },

  // ── Meeting Notes ───────────────────────────────────────────────────────────
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    icon: 'la-clipboard-list',
    description: 'Processes a meeting transcript into a structured HTML summary and extracts action items with owners and due dates. Structure adapts based on whether an agenda is provided.',
    operations: [
      {
        id: 'process-transcript',
        name: 'Process Transcript',
        output: 'JSON object — { summary_html: HTML string, actions: [{ action_text, owner, due_date, notes }] }',
        components: [
          {
            type: 'system',
            label: 'System Role + Structure Rules',
            source: 'meeting.service.js — MEETING_SYSTEM_PROMPT',
            content: `You are a planning consultant assistant. Your job is to process a meeting transcript into a structured, professional record.

PRECEDENCE RULES:
1. CONSULTANT NOTES (if provided) take absolute precedence. Every point must appear in the summary. Actions mentioned must appear in the actions list.
2. AGENDA (if provided) defines the structure of the summary — organise the main body under agenda items as headings.
3. TRANSCRIPT is the primary source for all other content.

SUMMARY STRUCTURE (summary_html) — always in this order:

1. OVERVIEW (always): Opening <p> covering purpose, attendees, date context, headline outcome.

2. CONSULTANT NOTES (if provided):
   <h3>Consultant Notes</h3>
   Reproduce faithfully as a <ul>. Do not paraphrase.

3. MAIN BODY — two variants:
   IF AGENDA PROVIDED: Each agenda item as <h3>. Under each: discussion <p>/<ul>, decisions (<strong>Decision:</strong>), risks (<strong>Note:</strong>). Add <h3>Any Other Business</h3> for off-agenda items if any.
   IF NO AGENDA: Fixed headings — <h3>Key Decisions</h3>, <h3>Discussion Points</h3>, <h3>Risks and Issues</h3>, <h3>Next Steps</h3> (omit irrelevant ones).

4. ACTIONS SUMMARY (if any actions exist):
   <h3>Actions</h3>
   <ul><li><strong>[Owner]</strong> — [action] (due: [date or TBC])</li></ul>`
          },
          {
            type: 'format',
            label: 'Actions Array Rules',
            source: 'meeting.service.js — MEETING_SYSTEM_PROMPT',
            content: `- Extract every action/task/commitment — from consultant notes first, then transcript
- action_text: clear, specific, starts with a verb (e.g. "Instruct heritage consultant", "Circulate draft planning statement")
- owner: person named as responsible; null if not stated
- due_date: YYYY-MM-DD if a date is given; parse relative dates against meeting date if known; null if unclear
- notes: useful context (e.g. "contingent on design review outcome"); null if nothing to add
- If no actions, return []`
          },
          {
            type: 'runtime',
            label: 'Consultant Notes',
            description: 'Optional free-text notes entered by the user. Injected first, labelled "CONSULTANT NOTES (take absolute precedence)". Omitted if blank.'
          },
          {
            type: 'runtime',
            label: 'Agenda',
            description: 'Optional agenda entered by the user. Injected after consultant notes, labelled "MEETING AGENDA". When present, the summary main body is structured under each agenda item as headings. Omitted if blank.'
          },
          {
            type: 'runtime',
            label: 'Meeting Transcript',
            description: 'Full transcript text from uploaded file (PDF, TXT, MD) or pasted text. Truncated to 80,000 characters. Prefixed with the file name if available.'
          }
        ],
        assembledPreview: `[SYSTEM ROLE: meeting notes assistant — structure rules, JSON output format]

CONSULTANT NOTES (take absolute precedence):
[RUNTIME: user notes, if provided]

MEETING AGENDA:
[RUNTIME: agenda items, if provided]

Meeting transcript (filename.pdf):
[RUNTIME: full transcript text, up to 80,000 chars]`
      }
    ]
  },

  // ── Web Scraper Filters ────────────────────────────────────────────────────
  {
    id: 'scrapers',
    name: 'Web Scraper Filters',
    icon: 'la-filter',
    description: 'LLM relevance filters for scraped data. Each category has an editable prompt stored in scraper.llm_filter_prompts. Prompts are loaded live from the DB — what you see here is the current active value.',
    operations: [
      {
        id: 'filter-renewables',
        name: 'Filter: Renewables',
        output: 'JSON array — [{id, relevant, reason}] for each non-dismissed application',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'scraperFilters.controller.js',
            content: `You are a relevance filter assistant. You will be given a list of scraped items and a relevance criterion. For each item, decide if it is relevant based on the criterion provided. Respond ONLY with a valid JSON array — no markdown, no explanation.`
          },
          {
            type: 'template',
            label: 'Relevance Prompt',
            source: 'scraper.llm_filter_prompts WHERE category = \'renewables\' (DB — editable)',
            liveCategory: 'renewables',
            content: null
          },
          {
            type: 'runtime',
            label: 'Scraped Items Batch',
            description: 'Up to 25 non-dismissed records per batch from scraper.planit_renewables. Each item includes: id, uid (title), description (truncated to 500 chars).'
          }
        ],
        assembledPreview: `Relevance criterion:
[TEMPLATE: renewables prompt from DB]

Items to evaluate:
[0] id:123
Title: Solar farm application
Description: ...

[1] id:124
...

Respond with a JSON array:
[
  { "id": 123, "relevant": true, "reason": "..." },
  ...
]`
      },
      {
        id: 'filter-datacentres',
        name: 'Filter: Data Centres',
        output: 'JSON array — [{id, relevant, reason}] for each non-dismissed application',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'scraperFilters.controller.js',
            content: `You are a relevance filter assistant. You will be given a list of scraped items and a relevance criterion. For each item, decide if it is relevant based on the criterion provided. Respond ONLY with a valid JSON array — no markdown, no explanation.`
          },
          {
            type: 'template',
            label: 'Relevance Prompt',
            source: 'scraper.llm_filter_prompts WHERE category = \'datacentres\' (DB — editable)',
            liveCategory: 'datacentres',
            content: null
          },
          {
            type: 'runtime',
            label: 'Scraped Items Batch',
            description: 'Up to 25 non-dismissed records per batch from scraper.planit_datacentres. Each item includes: id, uid (title), description (truncated to 500 chars).'
          }
        ],
        assembledPreview: `Relevance criterion:
[TEMPLATE: datacentres prompt from DB]

Items to evaluate:
[0] id:456
Title: Data centre planning application
Description: ...

Respond with a JSON array:
[
  { "id": 456, "relevant": true, "reason": "..." },
  ...
]`
      },
      {
        id: 'filter-contracts',
        name: 'Filter: Contracts Finder',
        output: 'JSON array — [{id, relevant, reason}] for each non-dismissed contract',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'scraperFilters.controller.js',
            content: `You are a relevance filter assistant. You will be given a list of scraped items and a relevance criterion. For each item, decide if it is relevant based on the criterion provided. Respond ONLY with a valid JSON array — no markdown, no explanation.`
          },
          {
            type: 'template',
            label: 'Relevance Prompt',
            source: 'scraper.llm_filter_prompts WHERE category = \'contracts_finder\' (DB — editable)',
            liveCategory: 'contracts_finder',
            content: null
          },
          {
            type: 'runtime',
            label: 'Scraped Items Batch',
            description: 'Up to 25 non-dismissed records per batch from scraper.contracts_finder. Each item includes: id, title, description (truncated to 500 chars).'
          }
        ],
        assembledPreview: `Relevance criterion:
[TEMPLATE: contracts_finder prompt from DB]

Items to evaluate:
[0] id:789
Title: Planning consultancy services
Description: ...

Respond with a JSON array:
[
  { "id": 789, "relevant": true, "reason": "..." },
  ...
]`
      }
    ]
  },

  // ── PA Workspace ────────────────────────────────────────────────────────────
  {
    id: 'pa-workspace',
    name: 'PA Workspace',
    icon: 'la-drafting-compass',
    description: 'Single-prompt document generation cards in the Planning Application Workspace. Each card uses a prompt stored in appeals.appeal_draft_types with {{VARIABLE}} substitution for guiding brief, starting docs, and briefing notes.',
    operations: [
      {
        id: 'hlpv-narrative',
        name: 'HLPV Narrative Card',
        output: 'HTML HLPV narrative assessment — one section per discipline and designation, using HLPV tool data and consultant site notes',
        components: [
          {
            type: 'guide',
            label: 'Guiding Brief',
            source: 'DB: admin_console.guiding_briefs (document_type=hlpv, matched by selected development type)',
            content: `Fetched using document_type='hlpv' (aliased from slug 'hlpv_narrative' via GUIDING_BRIEF_SLUG_ALIAS in appeal.controller.js). Development type comes from the per-card dropdown in the workspace, defaulting to the project's development type.

Substituted into {{GUIDING_BRIEF}} in the generation prompt.`
          },
          {
            type: 'template',
            label: 'Generation Prompt',
            source: 'DB: appeals.appeal_draft_types WHERE slug = \'hlpv_narrative\' (generation_prompt column)',
            content: `Stored in the database. Key variables substituted at call time:
  {{GUIDING_BRIEF}}           — practice guidance from the guiding briefs library
  {{HLPV_DATA}}               — formatted planning constraint text imported from a saved HLPV analysis session
  {{ADDITIONAL_DESIGNATIONS}} — consultant notes on additional designations and site context (user-pasted)

Prompt instructs the model to write a complete HLPV narrative, discipline by discipline, using only the data provided. Never invent designations, distances, or names.`
          },
          {
            type: 'runtime',
            label: 'HLPV Tool Data',
            description: 'Formatted plain-text export from a saved HLPV analysis session — discipline risk levels, triggered rules, designation names and distances, and optional suggested text. Imported via the Starting Docs modal and substituted into {{HLPV_DATA}}.'
          },
          {
            type: 'runtime',
            label: 'Additional Designations',
            description: 'User-pasted consultant notes covering any further designations, allocations, or site narrative not captured by the HLPV tool. Substituted into {{ADDITIONAL_DESIGNATIONS}}.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'DB: appeals.appeal_draft_types WHERE slug = \'hlpv_narrative\'',
            content: `- <h2> for each discipline or topic heading
- <p><strong>Overall risk: [level]</strong></p> immediately after each discipline heading
- <p> tags for body paragraphs
- No document-wrapper tags, no markdown, no em dashes
- Start directly with the first <h2>
- Do not reference source documents — this is a client-facing document`
          }
        ],
        assembledPreview: `[GUIDE: hlpv guiding brief for the selected development type]

[TEMPLATE: generation prompt from DB — hlpv_narrative]

## Guiding Brief
[RUNTIME: guidance_content from guiding_briefs]

## HLPV Tool Data
[RUNTIME: formatted discipline text from saved HLPV session — {{HLPV_DATA}}]

## Additional Designations and Site Notes
[RUNTIME: consultant-pasted site notes — {{ADDITIONAL_DESIGNATIONS}}]

[FORMAT: HTML fragment, h2 + risk paragraph per discipline, no invented data]`
      },
      {
        id: 'socio-economic-baseline',
        name: 'Socio-economic Baseline Assessment',
        output: 'HTML full socio-economic baseline assessment document — complete structured report with data tables, populated from CSV data, with [PLACEHOLDER] sections preserved for manual completion',
        components: [
          {
            type: 'guide',
            label: 'Guiding Brief',
            source: 'DB: admin_console.guiding_briefs (document_type=socio_economic_baseline, matched by development type)',
            content: `Fetched using document_type='socio_economic_baseline'. Falls back to a generic brief if no development-type-specific match exists.

Substituted into {{GUIDING_BRIEF}} in the generation prompt.`
          },
          {
            type: 'template',
            label: 'Generation Prompt',
            source: 'DB: appeals.appeal_draft_types WHERE slug = \'socio_economic_baseline\' (generation_prompt column)',
            content: `Stores the full template document from a real previous project (Rotherham) alongside instructions to:
1. Reproduce the template structure exactly for the current project
2. Replace all Rotherham-specific data (population, BRES, unemployment, qualifications, health etc.) with data from the CSV
3. Keep every [PLACEHOLDER – ...] and [INSERT X] tag exactly as written — these require manual research
4. Use LAD25 row as the local authority, Regions row as regional comparator, Countries/England as national

Key variables substituted at call time:
  {{GUIDING_BRIEF}} — practice guidance
  {{SOCIO_DATA}}    — CSV from the socio-economics analysis tool (saved via Save to Workspace)
  {{BRIEFING_NOTES}} — project briefing notes`
          },
          {
            type: 'runtime',
            label: 'Socio-economic Data (CSV)',
            description: 'Full CSV export from a saved socio-economics analysis session — all geographic layers (Countries, Regions, LAD25), containing census, employment, BRES, qualifications, health, commuting, EV charging, renewables, and population projection data. Imported via the Starting Docs modal and substituted into {{SOCIO_DATA}}.'
          },
          {
            type: 'runtime',
            label: 'Briefing Notes',
            description: 'Selected project briefing notes, substituted into {{BRIEFING_NOTES}}.'
          },
          {
            type: 'format',
            label: 'Output Instructions',
            source: 'DB: appeals.appeal_draft_types WHERE slug = \'socio_economic_baseline\'',
            content: `- h1/h2/h3 for document structure, p for paragraphs, table/thead/tbody/tr/th/td for all data tables, ul/li for bullets
- No document-wrapper tags, no markdown, no em dashes
- All [PLACEHOLDER – ...] and [INSERT X] tags reproduced verbatim — never fabricated
- All Rotherham place references replaced with correct local authority from CSV geo_name
- Missing data cells marked [DATA NOT AVAILABLE]`
          }
        ],
        assembledPreview: `[GUIDE: socio_economic_baseline guiding brief]

[TEMPLATE: generation prompt from DB — socio_economic_baseline]
Includes full Rotherham template document as structural reference.

## Socio-economic Data (CSV)
[RUNTIME: CSV from saved socioeconomics session — {{SOCIO_DATA}}]

## Briefing Notes
[RUNTIME: selected briefing notes — {{BRIEFING_NOTES}}]

[FORMAT: full HTML document, all tables populated from CSV, [PLACEHOLDER] tags preserved]`
      }
    ]
  },

  // ── Stage 1 Review ──────────────────────────────────────────────────────────
  {
    id: 'stage1-review',
    name: 'Stage 1 Review',
    icon: 'la-table',
    description: 'LLM-assisted Stage 1 Planning Appraisal table generation. Uses a briefing note to populate each section of the appraisal.',
    operations: [
      {
        id: 'generate-table',
        name: 'Generate Appraisal Table',
        output: 'JSON object mapping each appraisal row label to a completed text value, assembled into a full HTML document (title + subtitle + date + appraisal table)',
        components: [
          {
            type: 'system',
            label: 'System Role',
            source: 'stage1Review.controller.js — generateStage1Review()',
            content: `You are a specialist planning consultant at a UK planning consultancy completing a Stage 1 Planning Appraisal. This is a detailed desk-based review document — your entries must be thorough, substantive, and draw out all relevant planning information from the briefing note. Write in the third person in clear, professional UK planning language.`
          },
          {
            type: 'tone',
            label: 'Tone Example',
            source: 'backend/stage1reviewexample.md',
            content: `Loaded from stage1reviewexample.md at server startup. Full text injected (no truncation).

Injected as:
"The following is a real Stage 1 Planning Appraisal written by this consultancy. Use it ONLY as a writing style reference — to learn the professional register, the level of detail expected in each row, and the way conclusions and risks are phrased. Do NOT reproduce any place names, policy references, distances, designations, site details, or factual content from it. Every fact in your output must come solely from the briefing note provided."`
          },
          {
            type: 'guide',
            label: 'Guiding Brief',
            source: 'DB: admin_console.guiding_briefs (document_type=stage1_review, matched by project development type)',
            content: `Fetched from the guiding briefs library using document_type='stage1_review' and the project's development type. Falls back to the generic (null development type) brief if no specific match exists.

If found, guidance_content is injected into the user prompt as:
"## Practice Guidance
[guidance_content]"

Use the Guiding Briefs admin page to add guidance for each development type (Solar, Wind, Residential, etc.).`
          },
          {
            type: 'runtime',
            label: 'Project Data',
            description: 'Project name, address, LPA, and proposal (sub_sectors) — pre-filled into the Site Details rows before the LLM call. Passed to the LLM as context only.'
          },
          {
            type: 'runtime',
            label: 'Briefing Note',
            description: 'Full plain text from the selected briefing note (doc_type=briefing_transcript). HTML tags stripped. No character limit — the complete briefing note is passed to the LLM.'
          },
          {
            type: 'format',
            label: 'Output Format',
            source: 'stage1Review.controller.js — generateStage1Review()',
            content: `- Return ONLY a JSON object — keys are exact row labels, values are completed text
- Entries must be detailed and comprehensive — include specific policy refs, constraint names, distances, designations, risk assessments, and recommended next steps where the briefing provides them
- If the briefing note contains no relevant information for a row, return an empty string
- Do not invent content not in the briefing note
- Plain text only — no markdown, no bullet characters, no HTML

Rows completed by LLM:
Development plan, Neighbourhood plan, Key local policy, Supplementary guidance,
Site description, Planning history, Benefits of proposal, Landscape and visual effects,
Ecology, Trees, Site Access, Heritage and archaeology, Agricultural land grade and use,
Flood risk and drainage, Noise, Glint and glare, Battery safety fire management plan,
Public consultation, Scope of supporting information, Summary and recommendation

Rows pre-filled from project data (NOT sent to LLM for generation):
Site address, Proposal, Local planning authority`
          }
        ],
        assembledPreview: `[SYSTEM: UK planning consultant completing Stage 1 Appraisal — detailed and thorough]
[TONE: stage1reviewexample.md — full real example for style reference]
[GUIDE: stage1_review guiding brief, if configured]

Project: [RUNTIME: project_name]
Address: [RUNTIME: address]
LPA: [RUNTIME: local_planning_authority]
Proposal: [RUNTIME: sub_sectors]

## Full Briefing Note
[RUNTIME: complete briefing note plain text — no character limit]

## Task
Complete the following Stage 1 Planning Appraisal table rows with full detail...
[FORMAT: JSON object — label → detailed text, all facts from briefing only]`
      }
    ]
  }

];
