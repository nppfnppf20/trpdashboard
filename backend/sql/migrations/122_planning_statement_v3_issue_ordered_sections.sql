-- Rewrite v3's Planning Policy / Planning Assessment section prompts as
-- per-issue templates. They're now generated one project issue at a time
-- (see generateIssueOrderedSection in appeal.service.js) rather than as one
-- flat call for the whole section, so each can use {{ISSUE_LABEL}},
-- {{ISSUE_DISCIPLINE}}, and {{ISSUE_CONTEXT}} (that issue's linked policies
-- plus any development-type-specific NPPF/NPPG/other snippets from
-- admin_console.issue_types). {{GUIDING_BRIEF}} now pulls in the dedicated
-- planning_policy_v3 / planning_assessment_v3 briefs seeded in migration 121.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $policyprompt$You are writing the Planning Policy sub-section for the issue "{{ISSUE_LABEL}}"{{ISSUE_DISCIPLINE}}, for the project "{{PROJECT_NAME}}".

{{GUIDING_BRIEF}}

## Context for this issue
The following contains the policies linked to this issue, and any development-type-specific policy snippets recorded for it. Read it carefully before writing.

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

## Context for this issue
The following contains the policies linked to this issue, any development-type-specific policy snippets recorded for it, and the working assessment notes for this issue. Read it carefully before writing.

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
