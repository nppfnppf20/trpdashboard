-- Create card, Planning Statement Policy and Assessment doc types: for databases where
-- 206 was applied BEFORE it gained the "Choosing what to quote" and "Length of quotations"
-- rules. Inserts whichever of the two is missing, just above the "Verbatim, no exceptions"
-- line that 206 added. Does nothing where both are already there (fresh installs get
-- them from 206 itself) and nothing where that line has been edited away. Safe to run twice.

UPDATE admin_console.create_doc_types
SET structure_notes = replace(
  structure_notes,
  '- Verbatim, no exceptions.',
  CASE WHEN structure_notes NOT LIKE '%Choosing what to quote%'
    THEN $q$- Choosing what to quote. Decide which words matter from what you have been given about THIS proposal: the policy's relevance note, any Drafting Issue notes, ticked meeting transcripts, the proposal facts in the other ticked sources, and the document so far. Quote the part of the policy that those show the application engages (for example the criterion the council or the scheme turns on), not simply its opening sentence. If you have little to go on about the proposal, quote the policy's operative test and say in your reply that you chose it without much context.
$q$ ELSE '' END
  || CASE WHEN structure_notes NOT LIKE '%Length of quotations%'
    THEN $q$- Length of quotations. Keep every quotation short: only the operative words, normally one sentence or part of one, about 15 to 40 words and never more than about 60. One quotation per policy; a second only if it is a separate test the application turns on. Do not quote introductory or explanatory text, do not quote a whole list of criteria (quote only the criterion that applies), and use [...] to cut out anything in the middle that is not needed. If a long passage seems necessary, quote the decisive part and summarise the rest in your own words.
$q$ ELSE '' END
  || '- Verbatim, no exceptions.'
)
WHERE slug = 'planning_statement_policy'
  AND structure_notes LIKE '%Quoting key policies verbatim%'
  AND (structure_notes NOT LIKE '%Choosing what to quote%' OR structure_notes NOT LIKE '%Length of quotations%');

UPDATE admin_console.create_doc_types
SET structure_notes = replace(
  structure_notes,
  '- Verbatim, no exceptions.',
  CASE WHEN structure_notes NOT LIKE '%Choosing what to quote%'
    THEN $q$- Choosing what to quote. For each issue, work out which policy words matter from what you have: the issue itself, its notes (the intended argument), any transcript, the proposal facts in the other ticked sources and the document so far. Quote the part of the policy that the issue actually turns on (the criterion the proposal has to meet, or the one in dispute), not simply the policy's opening sentence. If you have little about the proposal for an issue, quote the policy's operative test and say in your reply that you chose it without much context.
$q$ ELSE '' END
  || CASE WHEN structure_notes NOT LIKE '%Length of quotations%'
    THEN $q$- Length of quotations. Keep every quotation short: only the operative words, normally one sentence or part of one, about 15 to 40 words and never more than about 60. One quotation per policy for an issue; a second only if it is a separate test the issue turns on. Do not quote introductory or explanatory text, do not quote a whole list of criteria (quote only the criterion that applies), and use [...] to cut out anything in the middle that is not needed. If a long passage seems necessary, quote the decisive part and summarise the rest in your own words.
$q$ ELSE '' END
  || '- Verbatim, no exceptions.'
)
WHERE slug = 'planning_statement_assessment'
  AND structure_notes LIKE '%Quoting key policies verbatim%'
  AND (structure_notes NOT LIKE '%Choosing what to quote%' OR structure_notes NOT LIKE '%Length of quotations%');
