-- Add generation_prompt column if it doesn't exist (may be missing from older deployments)
ALTER TABLE appeals.appeal_draft_types ADD COLUMN IF NOT EXISTS generation_prompt TEXT;

-- Seed broad generation prompts for appeal document types used in the PA workspace.
-- These are used by generateDraftFromPaNotes and support {{GUIDING_BRIEF}},
-- {{PROJECT_NAME}}, {{PROJECT_BRIEF}}, and {{DOCUMENT_TYPE}} variable substitution.

UPDATE appeals.appeal_draft_types
SET generation_prompt = $prompt$You are a planning appeal consultant preparing a {{DOCUMENT_TYPE}} for a planning appeal.

Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured:

{{GUIDING_BRIEF}}

You also have access to the project brief which sets out the project background and context, and the key issue notes which set out the planning case for each issue.

Using only the information you have been given, write a first draft of this document following the structure and approach set out in the guiding brief above.

Important:
- Do not invent facts, arguments, or technical information. Every statement must be grounded in the material provided.
- If the notes are thin on a particular issue, reflect that honestly — do not fabricate supporting content.
- Write in formal planning language appropriate for submission to the Planning Inspectorate.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ol>/<li> for numbered lists, <ul>/<li> for bullets
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)$prompt$
WHERE slug IN ('statement_of_case', 'statement_of_common_ground');
