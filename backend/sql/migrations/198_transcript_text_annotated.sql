-- A lightly formatted, user-markable HTML version of saved transcript / document
-- text, shown in the transcript viewer (Meeting Notes page, the "Meeting notes and
-- docs" widget, and the briefing document viewer). Same idea as
-- project_policies.policy_text_annotated (migration 178): the plain-text original
-- in transcript_text is never touched, so this layer is purely additive: line
-- breaks, spacing, and bold / italic / underline / highlight added by the user.
-- NULL until someone saves a change; the viewer builds its starting layout from
-- transcript_text until then.

ALTER TABLE planning_applications.meeting_transcripts
  ADD COLUMN IF NOT EXISTS transcript_text_annotated TEXT;

ALTER TABLE planning_applications.document_summaries
  ADD COLUMN IF NOT EXISTS transcript_text_annotated TEXT;
