-- Add {{HIGH_LEVEL_PLANNING_REVIEW}} variable to the stage1_review prompt template.
-- This slot holds a high-level planning review prepared before the Stage 1 appraisal;
-- the LLM is instructed to carry all relevant content through into the Stage 1.

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
WHERE prompt_key = 'stage1_review';
