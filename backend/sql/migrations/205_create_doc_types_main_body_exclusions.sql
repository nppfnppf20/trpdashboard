-- Create card, "Planning Statement: Main body": tighten the guidance so it keeps
-- policy and assessment content out of the main body (transcripts often contain
-- it). Only needed where 204 has already been applied; a fresh 204 already has
-- this text. Updates the structure_notes of that one row, so any edits made to
-- it in the admin console since 204 will be replaced.

UPDATE admin_console.create_doc_types
SET structure_notes = $pst$How to use this guidance
This is a guide, not a rigid template. The structure below is the default. Add, drop, merge or reorder sections where the user's instructions in the chat, or a ticked meeting transcript, say so, and do it without asking for confirmation. Edit the document you are given rather than starting again.

Non-invention (this one is firm)
Every project-specific fact, figure, date, name, reference, finding or conclusion must come from the ticked sources, the document so far, or what the user has said in the chat. Do not use general knowledge, the style example or assumptions to fill gaps. Where something material is missing, write [INFORMATION REQUIRED: what is needed] and carry on. Where sources conflict, write [INCONSISTENCY TO BE RESOLVED: brief description]. Where the user or a transcript asks for a "placeholder" for a matter, insert [PLACEHOLDER: what is to be added] there instead of drafting it.

Which sources you have
Look at which sources are actually ticked or provided and say briefly, in your reply, if something this part depends on is missing. Then draft what you can from what you have.

Format and style
Clean HTML. Headings are unnumbered, main sections h2 and subsections h3. Formal British English in the register of an experienced UK planning consultant: factual, concise, evidence-led. No em dashes. The style example sets tone and arrangement only and is never a source of facts.

This part: the main body of the Planning Statement
Default section order:
- Executive Summary
- Submission Documents (omit unless the sources give the detail)
- Consultation and Pre-Application Engagement, where relevant
- Site Description and Context
- Planning History, where relevant
- Lawful Uses, where relevant
- Proposed Development
- Planning Obligations and Community Infrastructure Levy, where relevant
- Planning Benefits, Planning Balance and Conclusion
- Appendices, where relevant
What this part is for
This part describes the scheme and its setting as facts: who is applying, what is proposed, the site and its surroundings, history, consultation, obligations, and the benefits and balance. It does not argue policy and does not assess the proposal against policy.

What this part must NOT contain (firm)
Two sections are written separately, in their own parts (the Policy and Assessment document types): the Planning Policy section and the Planning Considerations and Assessment section. Do not draft, summarise or pre-empt either one, and do not let their content leak in elsewhere. Keep OUT of this part:
- any policy reference or policy name (for example "Policy Ash 9(c)", "CLLP S14", "NPPF paragraph 168"), any plan allocation, designation-as-policy, or statement of what a plan or policy says or requires, including in the site, context, proposal or history sections;
- any summary of the relevant policies, or commentary on them;
- any statement that the proposal complies, accords or conflicts with a policy, or any assessment against policy;
- any issue-by-issue assessment (landscape, heritage, highways, ecology, flood risk and so on), or technical conclusions meant to do the assessment's job.
The ticked sources and transcripts will often contain this material because it was discussed in the meetings. Leave it out here anyway: it belongs in the Policy or Assessment part. Describe the site's physical and planning context neutrally (for example "the Site is within the Green Belt" if the sources say so, or relevant designations), and the planning history as events, but not what policy says about them. Where the user asks you to include such material, include it.
If the document already contains the Policy or Assessment sections, leave them alone. Where they belong in the order, you may leave a clear gap, or a short note on its own line such as [Planning Policy section to follow], but no content.

Drawing on sources
Site, context, proposal, consultation and obligations come from Project Details, the ticked meeting notes and transcripts, and the document so far. Use a transcript for the facts it records about the scheme, not for its policy discussion. Planning history comes from the Planning History source. Do not draw planning balance weight or conclusions from anything the sources do not support. Be candid about harm where the sources record it.

Writing
Use full, well-developed paragraphs. Use bullets where they help (principal components of the development, consultation topics, heads of terms, benefits), not instead of explanation. Use "the proposed development" and "the proposal" consistently unless a defined term is supplied. Avoid repeating a point in more than one section; use a short cross-reference instead.$pst$,
    updated_at = now()
WHERE slug = 'planning_statement_main';
