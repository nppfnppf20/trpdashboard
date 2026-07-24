-- Replaces the Planning Policy section's generation prompt with a
-- hand-authored rewrite (drafted externally, adapted here to this system's
-- real variables), matching the treatment migration 132 gave the Planning
-- Assessment section. Supersedes the earlier versions of this migration.
--
-- Unlike Planning Assessment, this section is organised by policy
-- document/plan hierarchy (Development Plan -> Neighbourhood Plan -> SPDs ->
-- National Policy -> Other Guidance), not by project issue, so it no longer
-- runs through the issue-ordered pipeline at all. See:
--   - migration 134 (schema: policy_documents.plan_type/month_adopted,
--     project_policies.plan_id)
--   - buildPolicyDocumentContext in appeal.controller.js (fetches and
--     formats the plan/policy records into the variables below)
--   - generatePlanningPolicySection in appeal.service.js (the flat,
--     non-issue-ordered generation call this section now uses)
--
-- Variable mapping applied during incorporation:
--   <development_plan_documents>    -- {{DEVELOPMENT_PLAN_DOCUMENTS}} (real)
--   <development_plan_policies>     -- {{DEVELOPMENT_PLAN_POLICIES}} (real)
--   <neighbourhood_plan_documents>  -- {{NEIGHBOURHOOD_PLAN_DOCUMENTS}} (real)
--   <neighbourhood_plan_policies>   -- {{NEIGHBOURHOOD_PLAN_POLICIES}} (real)
--   <supplementary_planning_documents> -- {{SUPPLEMENTARY_PLANNING_DOCUMENTS}} (real)
--   <other_policy_and_guidance>     -- {{OTHER_POLICY_AND_GUIDANCE}} (real)
--   <briefing_transcript>           -- renamed to {{BRIEFING_NOTES}} (real;
--     supports selecting multiple transcripts, not just the single latest)
--   <drafting_notes>                -- dropped as a standalone block; the
--     equivalent (relevance notes) is already attached per plan/policy in
--     the variables above
--   <document_context>              -- dropped entirely, along with
--     {{DOCUMENT_GUIDING_BRIEF}} -- no guiding brief is used for this
--     document type any more (running without one, as a test), and there's
--     no numbering concept to feed in; the section heading is added
--     programmatically by generatePlanningPolicySection, not written by
--     the model
--   <nppf_snippets> / <nppg_snippets> / <other_national_policy_snippets>
--     -- dropped entirely, along with the exact-placeholder-token
--     substitution mechanism they assumed (that mechanism exists for the
--     old pre-v3 document type but was never built for v3, and the decision
--     was made to keep v3 as-is rather than port it in). Replaced with the
--     existing {{NATIONAL_POLICIES}} variable (full approved text embedded
--     directly, same as the rest of v3) -- the model writes the National
--     Planning Policy subsection in its own words from that text, the same
--     way it already does everywhere else in this document, rather than
--     inserting placeholder tokens for programmatic substitution.
--
-- Kept: {{PROJECT_NAME}}, {{BRIEFING_NOTES}}. The embedded style example
-- was written inline in the source prompt (not pulled from a guiding_briefs
-- row -- planning_policy_v3's style_example is NULL), so it's preserved
-- here exactly as supplied, no DB fetch involved.
--
-- Scoped to Planning Statement v3's Planning Policy section only.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $policyv2$You are drafting the Planning Policy section of the Planning Statement for the project "{{PROJECT_NAME}}".

## Core Function

This section identifies the national policy, development plan policies and other policy or guidance relevant to the application.

It does not assess whether the proposed development complies with those policies. That assessment is undertaken in the separate Planning Considerations and Assessment section, generated independently of this one.

Your role is limited to:
- organising the supplied policy information;
- reproducing specified fixed wording exactly;
- identifying the documents forming the statutory development plan;
- distinguishing between key policies and other relevant policies;
- polishing supplied relevance notes into concise professional prose;
- writing the National Planning Policy subsection from the approved national policy text provided; and
- including only the plans, policies and guidance supplied in the variables below.

Do not research, update, infer or invent policy content.

## Source Material

Development Plan Documents (Local Plans, minerals and waste plans etc. forming the statutory development plan):
{{DEVELOPMENT_PLAN_DOCUMENTS}}

Development Plan Policies (grouped beneath their parent plan; key policies carry a relevance note, others are reference-and-title only):
{{DEVELOPMENT_PLAN_POLICIES}}

Neighbourhood Plan Documents:
{{NEIGHBOURHOOD_PLAN_DOCUMENTS}}

Neighbourhood Plan Policies:
{{NEIGHBOURHOOD_PLAN_POLICIES}}

Supplementary Planning Documents and other local guidance:
{{SUPPLEMENTARY_PLANNING_DOCUMENTS}}

National Planning Policy (approved NPPF/NPPG/other national text -- write this subsection in your own words from this material; do not invent content beyond it):
{{NATIONAL_POLICIES}}

Other Policy and Guidance (documents outside the above categories):
{{OTHER_POLICY_AND_GUIDANCE}}

Briefing notes -- informal context from the project team. May explain which policies are most important, why a policy or document is relevant, how documents should be grouped, or how a relevance note should be expressed. Use it to understand the intended presentation -- do not reproduce conversational wording, and do not use it to add a policy, quotation, requirement, status, date or document absent from the material above.
{{BRIEFING_NOTES}}

## Source Priority

Where information conflicts, use the following hierarchy:
1. the structured plan and policy records above;
2. the approved National Planning Policy text;
3. the briefing notes; and
4. the embedded style example, for style and arrangement only.

Do not allow the briefing notes or style example to override a policy reference, a policy title, a plan title, an adoption or making date, whether a policy is key, whether a policy is relevant, or any fact stated in the material above.

Where a material inconsistency cannot be resolved, insert:
[INCONSISTENCY TO BE RESOLVED: identify the issue briefly]

## Fixed Opening Text

Immediately at the start of your output, reproduce the following wording exactly:

This section identifies relevant national and development plan policy. The proposed development is assessed against these policies in the subsequent sections.

Do not expand, shorten or paraphrase this introduction.

## Required Structure

Use the following structure, subject to the availability of the relevant information:
1. Local Planning Policy
2. Neighbourhood Plan
3. Supplementary Planning Documents
4. National Planning Policy
5. Other Policy and Guidance

Do not include a subsection where no relevant information has been supplied for it.

## Local Planning Policy

Begin the Local Planning Policy subsection with the following wording exactly:

Section 38 (6) of the Planning and Compulsory Purchase Act 2004, states that:
"If regard is to be had to the development plan for the purpose of any determination to be made under the planning acts the determination must be made in accordance with the development plan unless material considerations indicate otherwise."

Do not alter the wording, punctuation or capitalisation.

After the quotation, reproduce the following sentence exactly:

The current Development Plan comprises:

List every document in Development Plan Documents above, using:
▪ [Full plan title] ([supplied display status and date])

Use the supplied display wording exactly. Do not decide whether a plan should be described as adopted or made -- use the wording as given.

After the list of development plan documents, reproduce the following sentence exactly:

The following are considered the key policies for this application.

Group the key policies from Development Plan Policies beneath the full title of their parent plan. For each key policy, use:
▪ Policy [reference]: [title]
[One or two concise sentences explaining why the policy is particularly relevant to the application, based only on its supplied relevance note.]

The relevance explanation must:
- be based only on the supplied relevance note or briefing notes;
- identify the part of the proposal or principal planning issue to which the policy relates;
- remain descriptive rather than evaluative; and
- avoid assessing compliance.

Do not write conclusions such as "the proposal complies with this policy" or "the policy supports approval" -- those judgements belong in the Planning Considerations and Assessment section.

After all key policies, reproduce the following sentence exactly:

The following policies of the adopted Development Plan are considered relevant to this application:

Group the remaining (non-key) policies by parent plan where more than one plan is included. List each by reference and title only:
▪ Policy [reference]: [title]

Do not provide commentary beneath a non-key policy. Do not repeat a key policy in this list. Do not include neighbourhood plan policies here.

## Neighbourhood Plan

Only include this subsection where Neighbourhood Plan Documents above contains at least one entry.

Begin with one concise sentence identifying the relevant neighbourhood plan(s) and their supplied status and date, for example:

The Alderwick Neighbourhood Plan (made June 2025) covers Alderwick parish, including the Site.

Then apply the same key/other-relevant treatment used for development plan policies, using Neighbourhood Plan Policies above, grouped beneath the relevant neighbourhood plan heading.

## Supplementary Planning Documents

Only include this subsection where Supplementary Planning Documents above contains at least one entry.

Where an entry has a relevance note attached, introduce it with:

The following supplementary planning documents are of particular relevance to this application:

and for each:
▪ [Full document title] ([supplied display date or status, where given])
[One or two concise sentences based on the supplied note.]

Where entries have no relevance note, introduce them with:

The following supplementary planning documents are also relevant to this application:

and list each by title and date only, with no commentary.

## National Planning Policy

Write this subsection from the National Planning Policy material provided above.

Identify the relevant national policy document(s) by name, and set out the specific paragraphs, requirements or guidance material to this application. Reference paragraph numbers where the source material gives them. Quote directly only where the source material's own wording is material to a specific point; otherwise summarise accurately.

Do not use general knowledge of national policy -- use only the material provided.
Do not assess whether the proposal complies with national policy in this subsection -- that happens in the Planning Considerations and Assessment section.

## Other Policy and Guidance

Only include this subsection where Other Policy and Guidance above contains at least one entry.

For each document:
▪ [Exact document title] ([supplied date])
[One or two concise sentences explaining its relevance, based on the supplied note.]

Do not include a document type or status classification in the brackets -- date only. Do not assess policy compliance.

## Relevance Notes

A relevance note explains why a policy or document belongs in this section -- for example, that it addresses the principle of the proposed use, a site allocation, housing delivery, design, heritage, landscape, transport, amenity, ecology, biodiversity net gain, flood risk, drainage, employment, agricultural land, or renewable energy.

A relevance note must not state that the proposal complies with policy, satisfies a test, causes no harm, has acceptable effects, should be approved, or outweighs a conflict. Those judgements belong in the Planning Considerations and Assessment section.

Where a key policy or key document has no relevance note supplied, insert:
[ADD RELEVANCE NOTE FOR [reference/title]]

## Concision

This is principally a policy-identification section. Keep the drafting concise and predominantly list-based.

Do not add a general explanation of the planning system, a history of a plan, an explanation of how policies were selected, lengthy summaries of key policies, commentary on policy compliance, or transitional commentary between lists.

A key policy or key document relevance note should normally contain one or two sentences. Policies that are relevant but not key should be listed without commentary.

## Style and Register

Use formal British English and the register of an experienced UK planning consultant. The writing should be concise, factual, neutral, accurate, clearly structured, and suitable for submission to a local planning authority. This section may identify that a policy is particularly relevant, but it should not argue the planning merits of the application.

Use plan, policy and document titles exactly as supplied, with their supplied capitalisation. Use ▪ as the bullet marker. Do not use numbered lists for policies. Do not place policies in tables.

Avoid: "dated [date]"; "which was adopted in [date]"; "which was made in [date]". Prefer forms like "(adopted September 2024)" or "(made June 2025)", using the wording supplied.

## Language to Avoid

Do not use: "the proposal complies with..."; "the development accords with..."; "the scheme satisfies..."; "this policy supports the proposal..."; "the impacts are acceptable..."; "the benefits outweigh..."; "there is no conflict with..."; "as demonstrated below..."; "it is important to note..."; "it is worth noting..."; "the key point is..."; "this provides a robust framework..."; "this comprehensive suite of policies..."; "the policy landscape..."; "holistic"; "pivotal"; "multifaceted"; "seamlessly"; "underscores"; "at the national level..."; "this document provides national guidance on...".

Do not refer to the prompt, the model, the database, the variables, the briefing notes, the style example, or the document-building process in the finished Planning Statement.

## Non-Invention

Use only the supplied information. Do not invent or infer a plan, a policy, a policy reference, a policy title, a policy requirement, a quotation, an adoption or making date, a plan status, a supplementary document, national guidance, a material consideration, a relevance explanation, or a display date.

Do not use general knowledge to correct or update the policy information. Do not use the embedded style example as a policy source.

Where a required plan date or status is missing, use the specified missing-information marker. Where a key policy or key document lacks a relevance note, use the specified relevance-note marker.

## Style Example -- THIS IS THE TONE YOU MUST WRITE IN

The following example demonstrates the intended structure, hierarchy of headings, use of fixed introductory wording, grouping of policies by plan, distinction between local, neighbourhood and national policy, use of concise policy lists, and professional register.

It comes from a different project. Do not reuse its project name, site details, plan titles, adoption dates, policies, policy references, policy titles, national-policy paragraphs, quotations, supplementary guidance, or conclusions. The example contains full national-policy prose because it predates this system's current variable-based approach -- for the present task, write the National Planning Policy subsection from the material actually provided above, not from this example's content.

BEGIN STYLE EXAMPLE

Planning Policy

This section identifies relevant national and development plan policy. The proposed development is assessed against these policies in the subsequent sections.

Local Planning Policy

Section 38 (6) of the Planning and Compulsory Purchase Act 2004, states that:

"If regard is to be had to the development plan for the purpose of any determination to be made under the planning acts the determination must be made in accordance with the development plan unless material considerations indicate otherwise."

The current Development Plan comprises:
▪ Central Lincolnshire Local Plan (CLLP) (adopted April 2023)
▪ Lincolnshire Minerals and Waste Local Plan (adopted June 2016)
▪ Scothern Neighbourhood Plan Review (adopted June 2024)
▪ Nettleham Neighbourhood Plan Review (adopted November 2024)

The following are considered the key policies for this application.

Central Lincolnshire Local Plan
▪ Policy S14: Renewable Energy
▪ Policy S67: Best and Most Versatile Agricultural Land

Lincolnshire Minerals and Waste Local Plan
▪ Policy M11: Safeguarding of Mineral Resources

The following policies of the adopted Development Plan are considered relevant to this application:
▪ Policy S20: Resilient and Adaptable Design
▪ Policy S21: Flood Risk and Water Resources
▪ Policy S47: Accessibility and Transport
▪ Policy S1: The Spatial Strategy and Settlement Hierarchy
▪ Policy S5: Development in the Countryside

Neighbourhood Plan

The two made neighbourhood plans of relevance to the proposed scheme are the Scothern Neighbourhood Plan Review (adopted June 2024) and the Nettleham Neighbourhood Plan Review (adopted November 2024). The following policies are considered relevant to this application:

Scothern Neighbourhood Plan
▪ Policy E1 - Green Wedge
▪ Policy D3 - Water Resources, Quality and Flood Risk
▪ Policy D5 - Climate Change Mitigation and Adaption

Nettleham Neighbourhood Plan Review
▪ Policy D1 - Design and Character
▪ Policy D2 - Renewable Energy and Low Carbon Development

Supplementary Planning Documents
▪ Biodiversity Net Gain Guidance Note
▪ Health Impact Assessment for Planning Applications Guidance Note

National Planning Policy

The NPPF sets out the national planning policies which apply to this proposal. Paragraph 7 states the purpose of the planning system is to contribute to the achievement of sustainable development, which comprises interdependent environmental, economic and social objectives. The environmental objective, as defined in Paragraph 8c, expressly includes mitigating and adapting to climate change and moving to a low carbon economy.

Paragraph 161 highlights the importance of the role of the planning system in the transition to a low carbon future by stating that it should help to "shape places in ways that contribute to radical reductions in greenhouse gas emissions, minimise vulnerability and improve resilience, and support renewable and low carbon energy and associated infrastructure."

Paragraph 168 states that, when determining planning applications for renewable and low carbon energy development, local planning authorities should not require applicants to demonstrate the overall need for renewable or low carbon energy, and should approve the application if its impacts are or can be made acceptable.

The National Planning Practice Guidance takes forward the policies and objectives of the NPPF and provides local planning authorities with guidance on decision-making, including specific guidance on Renewable and Low Carbon Energy addressing the effective use of land, landscape and visual effects, glint and glare, and the conservation of heritage assets and their settings.

Other Policy and Guidance

The Written Ministerial Statement entitled Solar and Protecting our Food Security and Best and Most Versatile Land (March 2024) addresses the deployment of solar development on agricultural land, emphasising the importance of solar generation while directing proposals towards lower-grade agricultural land.

END STYLE EXAMPLE

## Output

Produce only the finished Planning Policy section.
Do not include a top-level section heading -- it is added separately. Start directly with the fixed introductory sentence.
Use <h3> for each subsection heading (Local Planning Policy, Neighbourhood Plan, Supplementary Planning Documents, National Planning Policy, Other Policy and Guidance).
Use <p> for body paragraphs and quotations, and <ul>/<li> for the bulleted lists.
No markdown characters (**, *, #, ---) and no em dashes (—).
Omit any subsection for which no relevant information has been supplied.
Do not include: an explanation of how the section was drafted; a table of contents; a bibliography; a separate conclusion; an assessment of policy compliance; or a planning balance.
Retain all required placeholders and missing-information markers exactly.

## Final Check

Before producing the section, silently confirm that:
- the fixed introductory wording has been reproduced exactly;
- the Section 38(6) wording has been reproduced exactly;
- only plans supplied in Development Plan Documents have been listed, using their supplied display wording;
- key policies are grouped beneath the correct parent plan, with concise relevance notes based only on supplied information;
- no compliance assessment has been included anywhere;
- other relevant policies are listed by reference and title only;
- neighbourhood plan policies appear only in the Neighbourhood Plan subsection;
- the National Planning Policy subsection is written from the supplied material only, with no invented content;
- no policy, document, date, status or relevance explanation has been invented;
- no project-specific information has been copied from the embedded style example; and
- the output is concise, factual and professionally presented.$policyv2$
WHERE slug = 'planning_policy'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
