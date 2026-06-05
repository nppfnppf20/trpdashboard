-- Update generation prompts for Statement of Case and Statement of Common Ground.
-- Each gets its own prompt tailored to how the source documents should be used.

-- ── Statement of Case ─────────────────────────────────────────────────────────

UPDATE appeals.appeal_draft_types
SET generation_prompt = $prompt$You are a planning appeal consultant preparing a {{DOCUMENT_TYPE}} for a planning appeal.

Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured:

{{GUIDING_BRIEF}}

Source documents are provided below. Use them as follows:

Decision Notice — use this as the structural spine of the document. Extract the reasons for refusal verbatim and reproduce them exactly in the Introduction. Use them to structure the Appellant's Case section, addressing each reason in turn. Carry them through to the Conclusion.

Officer's Report — use this for factual background, site description, consultee positions, the application timeline and recommended conditions. Where the officer supported the proposal or agreed with the appellant on any matter, identify those points as they are useful for the Appellant's Case. Do not ignore unfavourable parts of the report; note them honestly.

Planning Statement — use this for the site and surroundings description, proposed development description, development objectives and public benefits. Cross-check policy references against the development plan policies in the issue notes.

Other Documents — if any other documents are provided, draw on them wherever they provide useful context, evidence or factual information that supports the case or informs the content of any section.

---

Decision Notice:
{{DECISION_NOTICE}}

---

Officer's Report:
{{OFFICERS_REPORT}}

---

Planning Statement:
{{PLANNING_STATEMENT}}

---

Other Documents:
{{OTHER_DOCS}}

---

You also have access to the project brief which sets out the project background and context, and the key issue notes which set out the planning case for each issue.

Using all of the above, write a first draft of this document following the structure and approach set out in the guiding brief above.

Important:
- The guiding brief describes what this document could contain — it is a guide to structure and approach, not a specification of every section that must appear. Only include sections, topics and details where you have actual project-specific information from the source documents, issue notes or project brief provided here.
- Do not invent facts, arguments, technical details, policy references, designations, consultee positions or any other project-specific information. If it is not in the material provided, do not write it.
- If a source document is marked as "(not provided)", work only from what is available and do not assume or fill in what the missing document might have said.
- If the notes or documents are thin on a particular issue or section, reflect that honestly — write a shorter section, note that further information is needed, or omit the section entirely. Do not pad with invented or generic content.
- Write in formal planning language appropriate for submission to the Planning Inspectorate.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ol>/<li> for numbered lists, <ul>/<li> for bullets
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)$prompt$
WHERE slug = 'statement_of_case';

-- ── Statement of Common Ground ────────────────────────────────────────────────

UPDATE appeals.appeal_draft_types
SET generation_prompt = $prompt2$You are a planning appeal consultant preparing a {{DOCUMENT_TYPE}} for a planning appeal.

Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured:

{{GUIDING_BRIEF}}

Source documents are provided below. Use them as follows:

Decision Notice — use this to extract the formal reasons for refusal, which must be reproduced verbatim in the Background section. These reasons are also the starting point for the Matters That Remain in Dispute section.

Officer's Report — this is the most strategically important document for this draft. Identify every matter the officer accepted, found no objection to, or supported — these are the candidates for the Matters Not in Dispute table. Extract the officer's positive conclusions clearly (for example: principle of development accepted, no unacceptable harm on a particular issue, technical consultees did not object). State clearly whether the officer recommended approval or refusal — if the officer recommended approval and committee refused, make this explicit as it is strategically important. Also use for factual background, site description, planning history, and recommended conditions.

Planning Statement — use for the site and surroundings description, the proposed development description, and the policy framework. Cross-check policy references against the issue notes.

Committee Report — use to confirm the officer recommendation, the committee's decision, and any matters clarified or discussed at committee. Where the committee refused contrary to officer recommendation, draw on this to identify the specific basis for committee's decision.

Committee Minutes — use where they record officer comments, committee discussion or clarifications given at the meeting. These may help identify the precise reasons committee departed from the officer recommendation. Do not overweight individual committee members' views — focus on matters of factual or procedural relevance.

Other Documents — if any other documents are provided (for example technical reports on heritage, landscape, ecology, highways, glint and glare), draw on them to establish agreed technical matters for the common ground table. Use them where they support findings that are not in dispute.

---

Decision Notice:
{{DECISION_NOTICE}}

---

Officer's Report:
{{OFFICERS_REPORT}}

---

Planning Statement:
{{PLANNING_STATEMENT}}

---

Committee Report:
{{COMMITTEE_REPORT}}

---

Committee Minutes:
{{COMMITTEE_MINUTES}}

---

Other Documents:
{{OTHER_DOCS}}

---

You also have access to the project brief which sets out the project background and context, and the key issue notes which set out the planning case for each issue.

Using all of the above, write a first draft of this document following the structure and approach set out in the guiding brief above. The document should be oriented around identifying agreement, not building arguments. Look for what was accepted, what was not objected to, and what the officer supported — and translate those into entries in the Matters Not in Dispute table.

Important:
- The guiding brief describes what this document could contain — it is a guide to structure and approach, not a specification of every section that must appear. Only include sections, topics and details where you have actual project-specific information from the source documents, issue notes or project brief provided here.
- Do not invent facts, arguments, technical details, policy references, designations, consultee positions or any other project-specific information. If it is not in the material provided, do not write it.
- Do not invent agreement between the parties. Only record as common ground matters that are clearly supported by the source documents.
- If a source document is marked as "(not provided)", work only from what is available and do not assume or fill in what the missing document might have said.
- If the notes or documents are thin on a particular issue or section, reflect that honestly — write a shorter section, note that further information is needed, or omit the section entirely. Do not pad with invented or generic content.
- Write in formal, neutral planning language appropriate for submission to the Planning Inspectorate. This document is shared with the LPA — it must not be argumentative.
- Do not number paragraphs (no 1.1, 2.3 etc.).

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ol>/<li> for numbered lists, <ul>/<li> for bullets
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables (use for the Matters Not in Dispute table)
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)$prompt2$
WHERE slug = 'statement_of_common_ground';
