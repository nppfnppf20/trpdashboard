-- Save the generation prompt for the Appellant's Case section.
-- Matches any section whose name contains "appellant" (case-insensitive).
UPDATE appeals.appeal_draft_sections
SET generation_prompt = 'Write the Appellant''s Case section of this planning appeal statement.

Cover:
1. A brief restatement of the proposal and the appellant''s overall position
2. The applicable policy framework — development plan policies and relevant NPPF paragraphs — and why the proposal accords with them
3. Each refusal reason in turn, using the argument notes to identify where the LPA has misapplied policy, overstated harm, or failed to weigh benefits adequately
4. Any expert evidence or concessions in the argument notes that reinforce the case
5. The planning balance — acknowledge any harms with proportionate weight, then explain why the appeal should succeed

Draw all content from the working argument notes provided. Do not invent policies, facts, or positions not present in the notes.'
WHERE name ILIKE '%appellant%';
