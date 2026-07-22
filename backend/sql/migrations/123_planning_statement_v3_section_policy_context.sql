-- Add the project's full policy list ({{LOCAL_POLICIES}} / {{NATIONAL_POLICIES}})
-- to v3's Planning Policy and Planning Assessment section prompts. These are
-- already substituted generically by substituteAppealPromptVariables before
-- the per-issue loop runs (appeal.controller.js), same as the main v3 prompt
-- — no code change needed, just adding the placeholders to the stored text.
--
-- {{ISSUE_CONTEXT}} already carries the policies specifically linked to this
-- one issue (via policy_track_relevance) plus any matched snippet template.
-- This adds the project's whole policy list alongside it, so a policy that
-- hasn't been manually linked to this issue is still visible — the model is
-- trusted to judge relevance from the issue itself and the project context,
-- same approach as the issue_types snippet library in migration 122.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $policyprompt$You are writing the Planning Policy sub-section for the issue "{{ISSUE_LABEL}}"{{ISSUE_DISCIPLINE}}, for the project "{{PROJECT_NAME}}".

{{GUIDING_BRIEF}}

## Local Policy Context
The full list of local policies identified as relevant to this proposal. Not all of these will apply to every issue — only reference the ones genuinely relevant to this specific issue.

{{LOCAL_POLICIES}}

## National Policy Context
{{NATIONAL_POLICIES}}

## Context for this issue
The following contains the policies specifically linked to this issue, and any development-type-specific policy snippets recorded for it. Read it carefully before writing.

{{ISSUE_CONTEXT}}

Write the policy position for this issue only — set out which policies apply and what they require. Do not assess or judge compliance here; that happens in the separate Planning Assessment section. Reference each policy by its exact name and number. Do not cite policies not present in the context above.

Important:
- Do not invent policies, references, or wording not supplied above.
- Write in formal planning language appropriate for submission to a local planning authority.
- Follow any instructions above about how to open the sub-section or how to use specific policy snippets (e.g. quoting verbatim) — those instructions take precedence over your own judgement.

Output format — clean HTML only:
- Begin with <h3>{{ISSUE_LABEL}}</h3>, then write flowing paragraphs — no other headings of any kind
- <p> for body paragraphs
- No markdown characters (**, *, #, ---) and no em dashes (—)$policyprompt$
WHERE slug = 'planning_policy'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $assessprompt$You are writing the Planning Assessment sub-section for the issue "{{ISSUE_LABEL}}"{{ISSUE_DISCIPLINE}}, for the project "{{PROJECT_NAME}}".

{{GUIDING_BRIEF}}

## Local Policy Context
The full list of local policies identified as relevant to this proposal. Not all of these will apply to every issue — only reference the ones genuinely relevant to this specific issue.

{{LOCAL_POLICIES}}

## National Policy Context
{{NATIONAL_POLICIES}}

## Context for this issue
The following contains the policies specifically linked to this issue, any development-type-specific policy snippets recorded for it, and the working assessment notes for this issue. Read it carefully before writing.

{{ISSUE_CONTEXT}}

Weigh the proposal against the policies for this issue and reach a clear planning judgement. Reference each policy by its exact name and number. Do not cite policies not present in the context above.

Important:
- Do not invent facts, effects, or mitigation not grounded in the material provided.
- Write in formal planning language appropriate for submission to a local planning authority.
- Follow any instructions above about how to open the sub-section or how to use specific policy snippets (e.g. quoting verbatim) — those instructions take precedence over your own judgement.

Output format — clean HTML only:
- Begin with <h3>{{ISSUE_LABEL}}</h3>, then write flowing paragraphs — no other headings of any kind
- <p> for body paragraphs
- No markdown characters (**, *, #, ---) and no em dashes (—)$assessprompt$
WHERE slug = 'planning_assessment'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
