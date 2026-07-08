-- Add {{STYLE_GUIDE}} placeholder to the stage1_review_v2 prompt, so a style
-- template attached to a stage1_review_v2 guiding brief (admin_console.document_style_templates)
-- flows into the generated appraisal instead of the fixed stage1reviewexample.md file.
-- Scoped to v2 only — the stage1_review (v1) prompt has no {{STYLE_GUIDE}} token and
-- keeps using the fixed tone reference in the system prompt, unchanged.

UPDATE admin_console.llm_prompts
SET prompt_text = $template$Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured:

{{GUIDING_BRIEF}}

## High Level Planning Review
The following is a high-level planning review prepared by the project team. The Stage 1 appraisal builds on this review — bring all relevant information from it through into the Stage 1 appraisal, expanding and adding detail as instructed by the rest of this prompt and the guiding brief. If it says "(not provided)", disregard this section.

{{HIGH_LEVEL_PLANNING_REVIEW}}

## Briefing Note
The following briefing note has been prepared by the project team and contains the primary project-specific information for this appraisal. Extract all relevant detail — site description, proposal, planning policy context, constraints, planning history, and any other matters covered.

{{BRIEFING_NOTES}}

{{PLANNING_HISTORY}}

## Planning Policy
The following policies apply to this project. Use them in any sections of the appraisal where they are relevant according to the guiding brief.

### Local Policies
{{LOCAL_POLICIES}}

### National Policies
{{NATIONAL_POLICIES}}

## House Style
The following is a real Stage 1 Planning Appraisal written by this consultancy. Use it ONLY as a writing style reference — to learn the professional register, the level of detail expected in each section, and the way conclusions and risks are phrased. Do NOT reproduce any place names, policy references, distances, designations, site details, or factual content from it. Every fact in your output must come solely from the briefing note provided:

{{STYLE_GUIDE}}

---

Write a complete Stage 1 Planning Appraisal following the structure set out in the guiding brief above.

Important:
- Follow the structure described in the guiding brief precisely.
- Extract specific detail from the briefing note — policy references, constraint names, distances, designations, risk assessments, and recommended next steps where provided.
- Do not invent facts. Every statement must come from the briefing note or planning history provided.
- If the briefing note contains no information on a particular row or topic, leave that cell blank or note that further information is needed — do not pad with invented content.
- Write in the third person in formal, professional UK planning language.
- This document is client-facing: do not reference the briefing note, the client, or internal documents in your output — present all information as established fact.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ul>/<li> for bullet points
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)$template$
WHERE prompt_key = 'stage1_review_v2';
