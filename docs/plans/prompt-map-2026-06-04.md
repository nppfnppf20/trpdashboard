# Prompt Map — 2026-06-04

All LLM prompts in the dashboard: where they appear in the UI, which table stores them, and their current default text.

---

## 1. Global prompts — `admin_console.llm_prompts`

Editable via the ⓘ (sliders) button next to each action button. Edits apply across all projects. "Reset to default" restores the seeded text. Migrations: `064_global_llm_prompts.sql` (PA prompts), `065_llm_prompts_appeal.sql` (appeal prompts).

---

### `draft_key_summaries`

**UI location:** Planning Application tool → Key Issues tab → "Draft issue notes from briefing" button (⓪ next to it)  
**Also used in:** Appeal tool → Key Issues tab → same button  
**Purpose:** Reads the briefing note and drafts a 2–4 sentence position note for each key issue.

```
You are a planning consultant reviewing a briefing note for a planning application. Based on the briefing, draft a brief position note for each key issue listed below.

Each note should be 2-4 sentences capturing: the consultant's position on this issue, the key evidence or approach, and any sensitivities flagged in the briefing. Write as working notes for the consultant — concise and practical, not formal submission language.

Respond ONLY with valid JSON — no markdown, no explanation:
[
  { "track_id": 42, "summary": "Our position is..." }
]

Only include issues where the briefing contains relevant content. Omit issues entirely if the briefing has nothing relevant.
```

---

### `draft_arguments_from_briefing`

**UI location:** Planning Application tool → briefing upload modal → ⓪ next to "Upload & draft arguments" button  
**Also used in:** Appeal tool → briefing upload modal → same; Appeal tool → Argument Structure tab → ⓪ next to "Draft from briefing" button  
**Purpose:** Reads the briefing note and drafts substantive argument positions (argument_for) for each issue.

```
You are a planning consultant building a planning case on behalf of the applicant. Your job is to extract and formulate argument positions — points that can be advanced IN FAVOUR of the proposal — drawing on any relevant content in the briefing summary.

For each issue listed, identify whether the briefing contains any information that supports the case: design decisions, technical measures, expert evidence, mitigation, site characteristics, or any other facts that could form the basis of a planning argument for that issue.

If the briefing contains relevant material for an issue, write 2–5 sentences formulating the argument. Write as argument starters that can be developed further — not as a summary of what was discussed. Do not reference "the briefing" or "the transcript" in your output; simply state the argument as if it is your working position ("The proposals...", "It is considered...", "In terms of [issue], the development...").

Only include issues where the briefing genuinely provides something to work with. If there is nothing relevant for an issue, omit it from your response entirely — do not include placeholders or notes about what is missing.

Where an issue already has existing notes, supplement rather than replace — add new angles from the briefing not already captured.

Respond ONLY with valid JSON — no markdown, no explanation:
[
  { "track_id": 42, "argument_for": "The proposals..." }
]

Only include issues where you have substantive argument content to contribute. Omit issues entirely if the briefing has nothing relevant.

Do not use em dashes (—) anywhere in your output; use a comma, colon, or rewrite the sentence instead.
```

---

### `scope_incorporation`

**UI location:** Planning Application tool → Draft Document tab → incorporate panel → ⓪ (sliders icon) next to "Incorporate into assessment"  
**Also used in:** Appeal tool → Draft Document tab → incorporate panel → same  
**Also used in:** Scoped paragraphs step → "Incorporate N paragraphs" ⓪  
**Purpose:** Reviews the document and identifies which paragraph IDs are relevant (step 1 of 2-step incorporation).

```
You are reviewing which paragraphs of a planning document are directly relevant to a new specialist report.

Identify which paragraph IDs this document directly speaks to — i.e. where incorporating evidence from this document would genuinely improve or update that paragraph. Only include paragraphs where this document has something specific and relevant to contribute. Do not include paragraphs from unrelated disciplines or topics.

Respond ONLY with valid JSON, no markdown:
{
  "relevant_ids": ["p2", "p5", "p8"],
  "summary": "One sentence explaining what this document addresses and which sections are affected."
}
```

---

### `incorporate_assessment`

**UI location:** Planning Application tool → Draft Document tab → incorporate panel → ⓪ (branch icon) next to "Incorporate into assessment"  
**Also used in:** Scoped paragraphs step → "Incorporate N paragraphs" ⓪  
**Purpose:** Rewrites the selected planning assessment paragraphs to weave in evidence from the specialist report (step 2 of 2).

```
You are updating the Planning Assessment section of a formal Planning Statement to incorporate evidence from a new specialist report.

## Structure of each issue sub-section
Each issue sub-section has three parts:
1. Policy framework paragraphs — state what the relevant national, local, and other policies require. Do NOT alter these.
2. Compliance argument paragraphs — explain how the proposals satisfy those policies, drawing on expert evidence and specialist reports. This is where you add and update content.
3. Concluding sentence — "The proposals are therefore considered to comply with [policy list]." Preserve the policy list exactly.

## Your task
Rewrite the compliance section of each relevant issue sub-section to incorporate the evidence from this specialist report. You are working holistically — assess the paragraphs as a whole and return an updated version of the section.

Rules:
- Do NOT change any paragraph that is setting out policy ...
- Everything else is fair game ...
- Keep the existing argument being made ...
- Always refer to the document by a formal report title ...
- The section must end with a concluding sentence ...
- Write in formal planning language. Do not use em dashes.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {"id": "p3", "html": "<p>Updated paragraph with evidence woven in...</p>"},
  {"id": "INSERT_AFTER_p3", "html": "<p>New compliance paragraph constructed from report...</p>"}
]
```

---

### `stage1_review`

**UI location:** Planning Application tool → Stage 1 Review tab → ⓪ next to "Generate Stage 1 Review" button  
**Purpose:** System prompt for Stage 1 Planning Appraisal generation. The user message (project data + briefing) is injected separately and is not editable here.

```
You are a specialist planning consultant at a UK planning consultancy completing a Stage 1 Planning Appraisal. This is a detailed desk-based review document — your entries must be thorough, substantive, and draw out all relevant planning information from the briefing note. Write in the third person in clear, professional UK planning language. This document is client-facing: never reference the briefing note, the client, or internal documents in your output — present all information as established fact as if you are the author of the appraisal.
```

---

### `incorporate_appeal`

**UI location:** Appeal tool → Draft Document tab → incorporate panel → ⓪ (branch icon)  
**Also used in:** Scoped paragraphs step → "Incorporate N paragraphs" ⓪  
**Purpose:** Rewrites selected paragraphs in an appeal document to incorporate specialist report evidence (step 2 of 2).

```
You are updating a section of a formal planning appeal document to incorporate evidence from a new specialist report.

The following paragraphs are unlocked for editing. All other parts of the document are fixed. You may update in-scope paragraphs and add new paragraphs where the document warrants it. Leave a paragraph unchanged if the document adds nothing relevant to it.

For new paragraphs, use id format "INSERT_AFTER_[id]".

Write in formal planning language. Cite paragraph or section numbers from the document where available. Do not use em dashes. Do not number paragraphs.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {"id": "p3", "html": "<p>Updated paragraph...</p>"},
  {"id": "INSERT_AFTER_p3", "html": "<p>New paragraph...</p>"},
  {"id": "p7", "html": "<p>Unchanged or updated...</p>"}
]
```

---

### `generate_appeal_argument`

**UI location:** Not currently surfaced in the UI (the `generateArgument` API function exists but no button calls it). Stored in DB for future use.  
**Purpose:** Generates the initial structured working argument summary for an appeal.

```
You are a planning appeal consultant generating a structured working argument summary.

Produce a structured working argument summary in HTML. Use these five sections:
1. <h2>Appeal Overview</h2> — brief summary of the appeal and the development
2. <h2>Reasons for Refusal</h2> — summarise each reason and its significance
3. <h2>Argument by Issue</h2> — for each key issue, outline both the opposing position and the initial argument direction
4. <h2>Risks and Unknowns</h2> — identify gaps, risks, and what evidence is still needed
5. <h2>Next Steps</h2> — practical actions to advance the case

Use <p> for body text. Keep it concise but substantive — this is a working document, not a final submission.
```

---

## 2. Per-project prompts — `planning_applications.prompt_settings`

Stored per project (project_id + prompt_key). Editable within the Planning Application workspace via existing prompt modal buttons.

| prompt_key | UI location | Purpose |
|---|---|---|
| `extract_points` | PA tool → analyse document panel → prompt button | Template for document analysis / extract argument points. Has `{{DOCUMENT}}` placeholder. |
| `suggest_argument` | PA tool → suggest argument panel → prompt button | Template for suggest argument (prose chat) flow. Has `{{DOCUMENT}}` placeholder. |

---

## 3. Per-project prompts — `public.appeal_prompt_settings`

Stored per project. Editable within the Appeal workspace via existing prompt modal buttons.

| Column | UI location | Purpose |
|---|---|---|
| `extract_points_template` | Appeal tool → analyse document panel → prompt button | Template for document analysis / extract argument points. Has `{{DOCUMENT}}` placeholder. |
| `suggest_argument_template` | Appeal tool → suggest argument panel → prompt button | Template for suggest argument (prose chat) flow. Has `{{DOCUMENT}}` placeholder. |

---

## 4. Per-section generation prompts — `planning_applications.draft_sections.generation_prompt`

Each planning statement draft section has its own generation prompt. Editable in the Planning Application tool → Draft Document tab → Sections modal → Edit → "Generation prompt" textarea.

The special `planning_assessment` slug section falls back to the `PLANNING_ASSESSMENT_DEFAULT_PROMPT` constant in `planningStatement.service.js` if no custom prompt is set. That default is a large template using variables:

- `{{ISSUE_LABEL}}`, `{{ISSUE_DISCIPLINE}}`, `{{PROJECT_NAME}}`, `{{SECTION_NAME}}`
- `{{POLICY_STRUCTURE}}` — auto-built from linked policies
- `{{ISSUE_CONTEXT}}` — policies + assessment notes + specialist evidence
- `{{EXAMPLE_BLOCK}}` — style example if set on the section

The planning_assessment prompt is also resettable to default via the "Reset to default" button in the prompt editor.

---

## 5. Per-section template HTML — `planning_applications.draft_sections.template_html`

Some sections use a fixed HTML template instead of a prompt. Editable in the same Sections modal → "Template" textarea. Templates support `{{VARIABLE}}` substitution and `{{LLM:slug}}...{{/LLM}}` blocks for inline generation.

---

## 6. Document summary prompts — `planning_applications.doc_type_prompts`

One prompt per document type. Editable in Admin Console → Doc Type Prompts (if surfaced there) or via the PA tool's document summarisation flow.

| doc_type | When used |
|---|---|
| `briefing_transcript` | Upload briefing note → summarise |
| `about_applicant` | Summarise "About the Applicant" doc |
| `proposed_development` | Summarise proposed development doc |
| `site_surroundings` | Summarise site and surroundings doc |
| `pre_app` | Summarise pre-application response |
| `eia_response` | Summarise EIA scoping response |
| `sci` | Summarise SCI / consultation doc |
| `other` | Any other document type |

---

## 7. Appeal draft section prompts — `appeals.appeal_draft_sections` (or equivalent)

Each appeal draft section has a `generation_prompt` field. Editable in the Appeal tool → Draft Document tab → Sections modal → Edit → prompt textarea.

---

## Summary table

| Prompt | Table | Scope | ⓘ button? |
|---|---|---|---|
| draft_key_summaries | admin_console.llm_prompts | Global | ✅ PA + Appeal key-issues toolbar |
| draft_arguments_from_briefing | admin_console.llm_prompts | Global | ✅ Briefing upload modal; Appeal argument toolbar |
| scope_incorporation | admin_console.llm_prompts | Global | ✅ Incorporate panel (idle + scoped states) |
| incorporate_assessment | admin_console.llm_prompts | Global | ✅ PA incorporate panel (idle + scoped states) |
| stage1_review | admin_console.llm_prompts | Global | ✅ Stage 1 Review tab |
| incorporate_appeal | admin_console.llm_prompts | Global | ✅ Appeal incorporate panel (idle + scoped states) |
| generate_appeal_argument | admin_console.llm_prompts | Global | ❌ No button in current UI |
| extract_points (PA) | planning_applications.prompt_settings | Per-project | ✅ Existing prompt button in PA analyse panel |
| suggest_argument (PA) | planning_applications.prompt_settings | Per-project | ✅ Existing prompt button in PA suggest panel |
| extract_points (Appeal) | public.appeal_prompt_settings | Per-project | ✅ Existing prompt button in Appeal analyse panel |
| suggest_argument (Appeal) | public.appeal_prompt_settings | Per-project | ✅ Existing prompt button in Appeal suggest panel |
| planning_assessment default | planningStatement.service.js (code) + draft_sections.generation_prompt override | Per-section | ✅ Sections modal → Edit → prompt textarea |
| Other section prompts | planning_applications.draft_sections.generation_prompt | Per-section | ✅ Sections modal → Edit → prompt textarea |
| Document summary prompts | planning_applications.doc_type_prompts | Global (by doc type) | ❌ Not yet surfaced via ⓘ |
