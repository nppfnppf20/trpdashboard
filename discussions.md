1. The core product issue
You are building tools for:
- planning applications
- appeals
Both tools have, or will have, an argument structure feature.
The purpose of that feature is to help the user take messy source material — surveyor reports, consultant reports, planning officer comments, appeal material, policy evidence, site facts, etc. — and turn it into a usable structure for a planning/appeal argument.
The problem you identified was this:
The argument structure needs to stay high-level enough to be readable,
but the final drafted document needs much more evidential detail.
So there is a tension between:
Clean UI now
vs
Detailed drafting later
If the argument structure only stores short headlines, then when you later generate the final document, the model may not have enough detail to write properly.
Example:
UI point:
"Loss of privacy to neighbouring occupiers."
But final drafting may need:
- what the surveyor actually found
- which window causes overlooking
- what room/garden is affected
- exact report wording
- page or paragraph references
- measurements, orientation, distances, or methodology
So the first major issue was: how do you avoid losing valuable evidence while keeping the structure UI clean?

2. The issue with storing only the full document text
One possible solution was:
Store all the original surveyor/report text and let the LLM use it later.
The problem with that approach is that it pushes too much work to the final drafting stage.
Issues:
- The LLM would need to re-read and re-interpret the raw documents later.
- You lose the benefit of the earlier human/AI curation step.
- The model might pick different evidence later from the evidence selected earlier.
- It may use irrelevant passages.
- It may miss the key passages the user already cared about.
- It could be expensive or inefficient if documents are long.
- It makes the final drafting prompt more complex and less predictable.
So storing full documents is useful as a source of truth, but it should not be the only evidence strategy.

3. The issue with storing only short argument points
The opposite problem is storing only the visible argument structure.
Example:
- Impact on neighbouring amenity
- Conflict with local design policy
- Insufficient parking provision
The issue here is that these points are useful for structure, but not enough for final drafting.
Problems:
- The final drafting model has no evidential depth.
- It may write generic planning prose.
- It may invent plausible but unsupported detail.
- It cannot quote the source material.
- It cannot refer accurately to page numbers, paragraph numbers, figures, or findings.
- It loses the technical content from reports.
So a high-level structure alone is not enough.

4. The agreed solution: headline plus hidden detail
We agreed the better approach is to store more than one layer for each argument point.
Each point should have:
1. Headline / display text
2. Detailed AI-generated summary
3. Linked source evidence
4. Verified verbatim extracts
5. Source metadata
The UI can show only the short headline:
Loss of privacy to neighbouring occupiers.
But the database also stores the hidden detail:
The surveyor’s report identifies direct views from the proposed first-floor rear window into the adjoining rear garden and habitable room windows, supporting the argument that the proposal would materially reduce privacy.

And the source evidence:
Surveyor Report, page 4, paragraph 3.2:
"Exact extracted text..."
This solves the original tension:
- clean argument structure for user interaction
- detailed source-backed material for final drafting

5. The issue with AI-generated “detailed summaries”
We discussed whether the hidden detail should simply be an AI-generated fuller version of the point.
The issue with relying only on AI summaries is that they may:
- smooth over important technical nuance
- accidentally overstate the source material
- introduce details not actually in the report
- paraphrase something too confidently
- lose exact measurements, dates, distances, or qualifications
- fail to preserve exact wording needed for quotation
For planning and appeal documents, that matters because the final document often needs to be evidentially precise.
So AI summaries are useful, but they are not enough on their own.

6. The issue with verbatim text
You then asked how to reliably store verbatim text.
The key issue is that LLMs are not reliable quote engines.
If you ask an LLM:
Give me the relevant quote from this surveyor report.
it might:
- paraphrase instead of quote
- tidy up the wording
- join together separate bits of text
- omit caveats
- invent a plausible quote
- get page references wrong
So the issue was:
How do we preserve exact source wording without relying on the LLM to reproduce it?

7. The agreed solution: source-span storage
The answer was to treat verbatim text as a source-span problem, not a drafting problem.
When a document is uploaded, you should extract its text into stored spans/chunks.
Suggested table:
document_text_spans
- id
- document_id
- page_number
- paragraph_number
- section_heading
- text
- char_start
- char_end
- extraction_method
- created_at
Each span is actual extracted document text.
Then, when the LLM analyses the document, it should select or refer to span IDs, not invent quotes.
Instead of returning:
{
  "quote": "The proposed window would overlook the neighbouring garden..."
}
it should ideally return:
{
  "supporting_spans": ["span_00192", "span_00204"]
}
Then the backend retrieves the exact text from those spans.
This makes the database, not the LLM, the source of truth for verbatim quotations.

8. The issue of quote verification
We also identified a second safety step.
If the LLM does propose a shorter quote, the backend should not automatically save it.
The backend should verify:
Does this exact quote exist in the extracted source text?
If yes, save it.
If no:
- reject it
- or replace it with the nearest exact extracted span
- or ask the user to select the relevant text manually
This avoids hallucinated quotations entering the database.
The principle we agreed was:
The AI can help decide what matters.
The backend must verify what the document actually says.

9. The issue of whether to store full source spans or selected evidence
We separated two concepts:
1. Raw extracted document text
2. Evidence attached to an argument point
The raw document spans table stores the document text generally.
But when a particular argument point uses evidence, that should be saved separately.
Suggested table:
argument_point_evidence
- id
- argument_point_id
- document_id
- span_id
- quote_text_snapshot
- page_number
- paragraph_number
- relevance_note
- created_at
The issue this solves is traceability.
You need to know not only that a document contains some text, but that a particular argument point relies on a particular extract.
The quote_text_snapshot is important because if the parsing changes later, you still preserve the actual extract used when the argument point was created.

10. The issue with combining argument-structure prompts and final-drafting prompts
You asked whether the prompt used for format, tone, and examples in the appeals tool should be combined with the argument-structure prompt.
The issue was that there are really two different tasks:
Argument structuring:
"What are the important points and evidence?"
Final drafting:
"Turn the accepted structure and evidence into a polished document."
If you combine these prompts, the ingestion stage may start trying to draft final prose too early.
Problems with combining them:
- the argument structure may become too verbose
- the UI may get cluttered
- the extraction stage may become less objective
- the model may prematurely impose final document tone
- later editing becomes harder
- you blur evidence extraction with advocacy drafting
So we agreed not to combine them.
Instead, keep separate prompts but make the handoff richer.

11. The agreed prompt separation
We agreed the argument-structure prompt should produce structured data, such as:
{
  "headline": "...",
  "detailed_summary": "...",
  "issue_category": "...",
  "argument_role": "...",
  "supporting_span_ids": [],
  "relevance_note": "..."
}
The final drafting prompt should then receive:
- accepted argument structure
- hidden detailed summaries
- verified verbatim extracts
- source references
- tone requirements
- format requirements
- example/style guidance
So the final drafting stage has enough depth without needing to rediscover the evidence.

12. The issue with planning statement sections
You then moved to planning statement generation and asked whether different sections should have individual prompts.
The issue is that planning statement sections do different jobs.
For example:
Introduction:
sets up the application and purpose of the statement.
Planning policy:
identifies relevant policy and explains its relevance.
Planning assessment:
applies the policy to the proposal and evidence.
Conclusion:
summarises why permission should be granted.
If one giant prompt drafts all sections, problems may arise:
- weaker control over each section’s purpose
- duplication between sections
- policy assessment appearing in the policy context section
- generic structure
- inconsistent level of detail
- harder debugging
- harder future improvement


13. The agreed section-prompt approach
We agreed it is best to use individual prompts for individual sections, but with shared context.
Possible section prompts:
- Introduction
- Site and surroundings
- Proposed development
- Planning history
- Planning policy context
- Planning assessment
- Planning balance / benefits
- Conclusion
Each section prompt should say what that section is supposed to do.
For example, the policy section prompt should say:
Identify the relevant policy framework, but do not conduct the full planning assessment here.
The planning assessment prompt should say:
Apply the relevant policy to the proposal and evidence, using issue-based subheadings.
This prevents different sections from doing the same job.

14. The issue of consistency across separate section prompts
The risk with separate prompts is that each section may behave as if it is writing in isolation.
Possible problems:
- inconsistent terminology
- repeated facts
- different descriptions of the proposal
- contradictory statements about policy compliance
- duplicated paragraphs
- inconsistent tone
- different levels of detail
So separate prompts need a shared factual and stylistic base.

15. The agreed solution: shared context pack
We agreed that every section prompt should receive a shared context pack.
That pack could include:
{
  "project_summary": "...",
  "site_description": "...",
  "proposal_description": "...",
  "applicant_position": "...",
  "key_planning_issues": [],
  "argument_structure": [],
  "policy_context": [],
  "verified_evidence": [],
  "defined_terms": {
    "site": "the Site",
    "proposal": "the Proposed Development",
    "council": "the Council"
  }
}
This gives each section the same factual foundation.
The structure becomes:
Global planning statement prompt
+
Shared context pack
+
Section-specific prompt
=
Generated section

16. The issue of where prompts should live
You then asked whether prompts should be stored in a database table.
The issue was balancing flexibility with control.
If prompts live only in code:
- editing prompts requires redeployment
- non-technical users cannot refine them
- A/B testing is harder
- versioning may be less visible
If prompts live only in the database and control everything:
- generation can become chaotic
- business logic is hidden in editable text
- debugging becomes harder
- evidence validation may be weakened
- prompt changes can break orchestration
So we agreed on a hybrid model.

17. The agreed prompt storage approach
Prompts should be stored in the database, especially editable drafting instructions.
Suggested table:
prompt_templates
- id
- tool_type
- document_type
- section_type
- prompt_name
- prompt_body
- version
- status
- created_at
- updated_at
- created_by
But core orchestration should stay in code.
The database stores:
- global prompt text
- document-type prompt text
- section prompts
- tone/style templates
- format templates
- evidence-use instructions
The code controls:
- which prompt modules are used
- how context is assembled
- which evidence is retrieved
- how sections are ordered
- how quotes are verified
- how outputs are stored

18. The issue of debugging and repeatability
Another issue was that generated documents need to be explainable and reproducible.
If a generated statement is bad, you need to know why.
Potential causes:
- weak prompt
- wrong prompt version
- missing evidence
- wrong context pack
- poor argument structure
- missing policy data
- model issue
So we agreed generation runs should be logged.
Suggested table:
document_generation_runs
- id
- document_id
- user_id
- tool_type
- document_type
- prompt_template_ids
- prompt_versions
- model_used
- input_context_snapshot
- output_text
- created_at
This lets you inspect exactly what was sent to the model and what came back.

19. The issue with tone and format templates
You then asked whether template sections for tone, format, etc. need to be part of the prompt itself.
The issue was avoiding duplication.
If every section prompt contains the same tone guidance, then:
- edits must be repeated in many places
- prompts become bloated
- inconsistencies creep in
- maintaining variants becomes harder
For example, you might want the same “professional UK planning consultant tone” across multiple sections and document types.
So it is better not to bake tone into every section prompt.

20. The agreed modular prompt approach
We agreed to store tone, format, evidence rules, global rules, and section instructions as separate reusable prompt modules.
Examples:
global_planning_rules
evidence_use_rules
tone_professional_consultant
tone_inspector_friendly
tone_robust_objection
format_planning_statement
format_appeal_statement
section_introduction
section_planning_policy
section_planning_assessment
section_conclusion
At runtime, the backend assembles the modules.
Example:
final_prompt =
  global_rules
  + evidence_rules
  + tone_template
  + format_template
  + section_prompt
  + project_context
  + argument_points
  + verified_evidence
So the modules are stored separately, but their actual text is injected into the final prompt.

21. The issue with “referencing” prompt modules
We clarified that the model cannot meaningfully use a bare reference like:
Use tone_template_id = 4.
That means nothing to the LLM unless the backend retrieves and includes the full content.
So the system can reference templates internally, but the final model message must contain the actual text.
Correct flow:
Prompt composition references module IDs
  ↓
Backend fetches module bodies
  ↓
Backend assembles full prompt
  ↓
LLM receives complete instructions


22. The agreed composition table
We discussed a possible table for defining which modules apply to which section/document type:
prompt_compositions
- id
- document_type
- section_type
- module_key
- order_index
- required
Example:
Planning Statement / Planning Assessment:
1. global_planning_rules
2. evidence_use_rules
3. tone_professional_consultant
4. format_planning_statement
5. section_planning_assessment
This lets you reuse modules without copying text into every prompt.

23. The issue of over-modularising
We also noted that modular prompts are good, but too many tiny modules can become hard to manage.
Bad pattern:
sentence_length_prompt
paragraph_style_prompt
legal_caution_prompt
citation_style_prompt
persuasiveness_prompt
transition_sentence_prompt
That becomes difficult to debug because it is unclear which module caused which behaviour.
So we agreed to start with a limited number of useful categories:
- Global rules
- Evidence rules
- Tone/style
- Document format
- Section task
That is modular enough without becoming unmanageable.

Final architecture we ended up with
The overall agreed system is:
1. Upload documents
2. Extract text into source spans
3. Store source spans with page/paragraph metadata
4. LLM analyses spans and proposes structured argument points
5. User accepts/edits points
6. Save each point with:
   - headline
   - detailed summary
   - issue/category
   - linked verified evidence spans
   - quote snapshots
7. UI shows only the clean high-level structure
8. Final drafting retrieves:
   - accepted structure
   - hidden summaries
   - verified evidence
   - policy context
   - project facts
9. Backend assembles prompt from:
   - global rules
   - evidence rules
   - tone module
   - format module
   - section-specific prompt
   - runtime context
10. LLM drafts each section
11. System logs:
   - prompt versions
   - context snapshot
   - model used
   - output
12. Optional final consistency pass checks:
   - duplication
   - inconsistent terminology
   - unsupported claims
   - section flow
   - missing references
The big underlying design principle
The main principle from the conversation is:
Separate the layers.
Meaning:
Do not use the argument structure as the evidence store.
Do not use the LLM as the source of truth for quotes.
Do not use one giant prompt for every section.
Do not bake tone into every section prompt.
Do not put orchestration logic entirely into database prompts.
Instead:
UI layer = clean headlines
Evidence layer = verified source spans and quote snapshots
Interpretation layer = AI summaries and relevance notes
Drafting layer = section-specific prompts
Prompt layer = reusable modules assembled at runtime
Code layer = orchestration, validation, retrieval, logging
That is the cleanest architecture from what we discussed.

MVP evidence-retrieval approach
For the first version, we agreed that a simpler page-level evidence model is acceptable. Because the workflow will initially deal with one uploaded document at a time, even where documents are up to around 100 pages, the system does not necessarily need embeddings or fine-grained span retrieval at the outset. Instead, when the argument structure point is created, the LLM can identify the relevant supporting page or pages. Those page references can then be saved against the argument point and used later during final drafting.
The final drafting prompt would therefore receive a focused evidence pack rather than the whole source document. That pack would include the argument point, the hidden detailed summary, a short summary of the source document, and the full extracted text of the relevant page or pages. This should be enough for the model to draft from the evidence without having to search the entire document again. It is less precise than verified paragraph/span-level quotation storage, but it is a practical and simpler MVP. The schema should still leave room to add exact spans or quote snapshots later, so the system can evolve from page-level evidence to more forensic source-linked evidence without needing to rebuild the architecture.

Add this to the note:

Automatic handling of conclusion and summary sections
For the MVP, it would also be useful to treat conclusion, executive summary, recommendations, and similar sections as high-value document sections. Many consultant and surveyor reports will contain a conclusion page or summary section that captures the most important findings, so the ingestion process should try to detect those sections automatically. This can be done initially with simple heading-based rules, looking for headings such as “Conclusion”, “Conclusions”, “Executive Summary”, “Summary and Conclusions”, “Recommendations”, “Key Findings”, or “Overall Assessment”. Pages or sections with those headings can be tagged as high-value and prioritised when generating argument structure points.
The system should still store the full page text, but for these high-value sections it should also split the content into smaller paragraph or bullet-point chunks. The LLM can then create a short structured summary of the key findings, with each finding linked back to the relevant page or chunk. This gives the tool a practical middle ground: it can start from the most useful parts of the report, preserve page references for later drafting, and avoid needing embeddings or full-document retrieval at the outset. Later, this can evolve into more precise chunk/span-level evidence, but for now the hierarchy can simply be: document → pages → detected key sections → key findings → linked argument points.

