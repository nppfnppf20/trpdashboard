-- Add {{BRIEFING_NOTES}} variable to SoC and SoCG generation prompts.
-- Uses REPLACE so manual edits to the prompts are preserved around the insertion point.
-- Inserts the new section between the Other Documents block and the closing instructions.

UPDATE appeals.appeal_draft_types
SET generation_prompt = replace(
  generation_prompt,
  '---

You also have access to the project brief',
$insert$---

Project Briefing Notes:
{{BRIEFING_NOTES}}

The above notes were taken from meetings with the project team. They set out the agreed strategy, specific lines of argument to advance or defend, and any project-specific instructions from the client or agreed within the team. Read them carefully alongside the source documents above.

Where the briefing notes specify a particular argument, approach or emphasis, follow it. Use the guiding brief for document structure and conventions; use the briefing notes for project-specific direction and content. The briefing notes take priority where the two differ. If no briefing notes are provided, proceed on the basis of the source documents and issue notes alone.

---

You also have access to the project brief$insert$
)
WHERE slug IN ('statement_of_case', 'statement_of_common_ground');
