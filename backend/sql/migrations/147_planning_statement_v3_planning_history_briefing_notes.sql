-- The Planning History section of the planning_statement_v3 master prompt
-- (migration 135) previously drew only on {{PLANNING_HISTORY}} -- the
-- structured public.project_planning_history table (ref/description/
-- decision/date, no relevance column). Anything about a site's history
-- raised only in the briefing meeting (e.g. an earlier attempt under a
-- different scheme, applicant or agent) had no route into the drafted
-- Planning History section at all, since that section didn't read the
-- Project Brief or Briefing Notes.
--
-- This adds a narrow, explicitly-scoped supplementary paragraph: after the
-- structured table, the LLM may add planning-history-relevant material
-- actually supplied in the Project Brief or Briefing Notes but absent from
-- the structured record. It must not merge into or duplicate table rows,
-- and must be omitted where no such material was supplied. Everything else
-- in the prompt is untouched -- targeted replace(), not a full rewrite.
--
-- Scoped to Planning Statement v3's master prompt only.

UPDATE appeals.appeal_draft_types
SET generation_prompt = replace(
  replace(
    generation_prompt,
    '### Planning History

The planning history above contains relevant on-site or nearby planning records.

Each record may include:
- application reference;
- description of development;
- decision or status;
- decision or status date; and
- relevance to the current application.

Only include planning history that has been supplied.

Do not infer why an application is relevant where no relevance note has been provided.',
    '### Planning History

The planning history above contains relevant on-site or nearby planning records.

Each record may include:
- application reference;
- description of development;
- decision or status;
- decision or status date; and
- relevance to the current application.

Only include planning history that has been supplied.

Do not infer why an application is relevant where no relevance note has been provided.

The project brief and briefing notes may also describe planning history relevant to the Site that is not captured in the structured record above -- for example an earlier attempt on the Site under a different scheme, applicant or agent, or other context supplied only in discussion. Use this material only in the supplementary paragraph described under "Planning History" in the "Required Document Structure" below, not to alter or add to individual rows of the structured record.'
  ),
  '## Planning History

Use the exact unnumbered heading:

Planning History

Only include this section where relevant planning history has been supplied.

Present the history in an HTML table where practical.

Possible columns include:
- Reference;
- Description;
- Decision or Status;
- Date; and
- Relevance.

Include only records relevant to understanding:
- lawful use;
- the development strategy;
- previous decisions;
- enforcement matters;
- appeal decisions;
- fallback positions;
- nearby development; or
- the wider planning context.

Do not add a relevance statement where none has been supplied.

Do not treat the absence of an application from the supplied list as evidence that no other history exists.

Do not use the word "dated" when identifying a decision date.',
  '## Planning History

Use the exact unnumbered heading:

Planning History

Only include this section where relevant planning history has been supplied, whether from the structured planning history record or the project brief and briefing notes.

Present the structured planning history record in an HTML table where practical.

Possible columns include:
- Reference;
- Description;
- Decision or Status;
- Date; and
- Relevance.

Include only records relevant to understanding:
- lawful use;
- the development strategy;
- previous decisions;
- enforcement matters;
- appeal decisions;
- fallback positions;
- nearby development; or
- the wider planning context.

Do not add a relevance statement where none has been supplied.

Do not treat the absence of an application from the supplied list as evidence that no other history exists.

Do not use the word "dated" when identifying a decision date.

### Additional Planning History from the Project Brief and Briefing Notes

Where the project brief or briefing notes describe planning history relevant to the Site that is not already captured in the structured record above, add a short paragraph after the table setting this out. This may include an earlier attempt on the Site under a different scheme, applicant or agent, or other relevant history supplied only in discussion.

Only include material that has actually been supplied in the project brief or briefing notes.

Do not merge this material into the table rows above.

Do not repeat a record already presented in the table.

Do not invent a reference, date or decision for history described only in narrative form.

Omit this paragraph where no such material has been supplied.'
)
WHERE slug = 'planning_statement_v3';
