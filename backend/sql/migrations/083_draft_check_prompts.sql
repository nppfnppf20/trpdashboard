-- Draft Check prompts — user prompt templates for the "Check Draft" panel.
-- Three checks in Phase 1: guiding brief coverage, project information
-- consistency, grammar & style. Each is stored in admin_console.llm_prompts
-- so it can be tuned without a deploy. {{VARIABLE}} slots are substituted
-- in draftCheck.controller.js.

INSERT INTO admin_console.llm_prompts (prompt_key, prompt_text)
VALUES (
  'draft_check_brief',
  $template$You are reviewing a working draft of a planning document against the practice's guiding brief for this document type.

## Guiding Brief
{{GUIDING_BRIEF}}

## Review Checklist
{{REVIEW_CHECKLIST}}

## Working Draft (plain text)
{{DRAFT_TEXT}}

Go through every distinct topic, requirement, or expectation in the guiding brief and review checklist. For each one, assess whether the working draft covers it adequately, and frame a question to put to the author.

Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "items": [
    {
      "topic": "short label for the checklist topic",
      "question": "a direct question to the author, e.g. 'Have you considered the impact on the setting of nearby listed buildings?'",
      "status": "present" | "partial" | "missing",
      "suggestion": "one concise sentence on what is missing or could be strengthened, or null if status is present"
    }
  ]
}

Rules:
- "present" = clearly and adequately addressed; "partial" = mentioned but thin, vague, or incomplete; "missing" = not addressed at all
- Always include the question, even for "present" items — it lets the author sanity-check the coverage
- Some topics may legitimately not apply to this project. Absence is not automatically an error — flag it and ask the question so the author can confirm it was considered and dismissed
- Keep suggestions short and actionable — one sentence maximum$template$
),
(
  'draft_check_consistency',
  $template$You are checking a working draft of a planning document for factual consistency against the project's recorded information.

## Recorded Project Information (ground truth)
{{PROJECT_INFO}}

## Working Draft (plain text)
{{DRAFT_TEXT}}

Check every project detail used in the draft against the recorded information: project and site names, applicant name, local planning authority, site address, description of development, application references, dates, and any other facts listed. Also flag internal inconsistencies within the draft itself — figures, names, or descriptions that change between sections.

Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "items": [
    {
      "field": "what is being checked, e.g. 'Site address'",
      "expected": "the value from the recorded project information, or null for internal draft inconsistencies",
      "found_in_draft": "what the draft actually says (verbatim where possible), or null if not mentioned",
      "status": "consistent" | "mismatch" | "not_mentioned",
      "note": "one sentence explanation, or null if consistent"
    }
  ]
}

Rules:
- Report each recorded field exactly once, in the order given
- "not_mentioned" is informational — some fields legitimately do not appear in every document type
- For mismatches, quote the draft wording exactly in found_in_draft
- Append any internal draft inconsistencies as extra items after the recorded fields$template$
),
(
  'draft_check_grammar',
  $template$You are proofreading a working draft of a professional UK planning document.

## House Style Guide
{{STYLE_GUIDE}}

## Working Draft (plain text)
{{DRAFT_TEXT}}

Identify grammar, spelling, punctuation, and style issues: typos; grammatical errors; inconsistent terminology or abbreviations (e.g. an abbreviation used before it is defined, or "the Council" and "the LPA" used interchangeably); inconsistent capitalisation of defined terms; US spellings; repeated or missing words; and departures from the house style guide above.

Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "items": [
    {
      "excerpt": "verbatim text from the draft containing the issue (max 120 characters)",
      "issue": "short description of the problem",
      "suggestion": "the corrected text or recommended approach",
      "severity": "high" | "medium" | "low"
    }
  ]
}

Rules:
- "high" = errors a client would notice (wrong words, broken grammar, misspellings); "medium" = inconsistencies in terminology, capitalisation, or formatting; "low" = polish
- Surface mechanical issues only — do not rewrite for tone and do not restructure content
- Return at most 30 items, the most important first, ordered by severity$template$
)
ON CONFLICT (prompt_key) DO UPDATE
  SET prompt_text = EXCLUDED.prompt_text;
