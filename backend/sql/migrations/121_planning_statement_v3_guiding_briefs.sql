-- Guiding briefs for Planning Statement v3.
-- Three rows: the main v3 brief (Policy/Assessment trimmed to a one-line
-- pointer), plus two standalone briefs carrying the content pulled out of
-- v2's sections 7.0 and 9.0, for the dedicated Planning Policy / Planning
-- Assessment section prompts. Upserts, so safe to re-run — if you already
-- created a 'planning_statement_v3' brief by hand in the admin console this
-- will overwrite its content with the version below.

INSERT INTO admin_console.guiding_briefs
  (name, document_type, development_type, guidance_content)
VALUES (
  'Planning Statement v3',
  'planning_statement_v3',
  NULL,
  $v3brief$## Purpose of the Document

A Planning Statement is a formal planning document submitted in support of a planning application.

Its purpose is to explain the application as a whole, tie together the submitted technical documents, describe the site and proposed development in detail, identify the relevant planning policy context, and assess the proposal against that policy context.

The Planning Statement should be capable of being read as the central explanatory document for the application. A reader with no prior knowledge of the site or proposal, including a planning officer, statutory consultee, stakeholder, or member of the public, should be able to read the Planning Statement and understand: where the site is; what the site currently comprises; what is around the site; what development is proposed; what documents have been submitted; what planning history is relevant; what policy framework applies; how the proposal performs against relevant policy; what technical evidence supports the application; what planning obligations or CIL matters may arise; what benefits the proposal would deliver; why planning permission should be granted.

The Planning Statement should not simply describe the scheme. It should provide a structured planning case in support of the application.

## Overall Tone and Approach

The tone of a Planning Statement should be professional, clear, evidence-led, and justificatory.

A Planning Statement supports a formal planning application. It should therefore present a firm planning case for why the development is acceptable and why permission should be granted.

The document should: explain the proposal clearly; assess the proposal against the development plan and material considerations; justify the planning merits of the proposal; acknowledge relevant policy requirements; rely on and cross-reference submitted technical evidence; be transparent about any policy tensions or harms; explain mitigation where required; conclude that the proposal accords with the development plan when read as a whole, or that material considerations justify approval.

The tone should not be speculative or overly tentative. Where the proposal complies with policy, say so clearly. Where the proposal does not fully comply with a policy, do not hide the issue. Acknowledge the position, explain the reason, identify mitigation where relevant, and explain why the development remains acceptable in planning terms.

## Relationship with Other Submission Documents

The Planning Statement should tie together all other documents submitted with the planning application.

It should not duplicate every technical assessment in full, but it should summarise and cross-reference technical conclusions where they are relevant to the planning assessment.

The document should be informed by, and should cross-reference where relevant: Design and Access Statement; application drawings; site location plan; existing and proposed plans; planning drawings; transport assessment or transport statement; travel plan; heritage statement; townscape, landscape, or visual assessment; ecology and biodiversity net gain documents; arboricultural report; flood risk assessment; drainage strategy; daylight and sunlight assessment; noise assessment; air quality assessment; sustainability or energy statement; fire statement, where relevant; waste or servicing strategy; affordable housing statement; viability assessment; statement of community involvement; environmental statement, where relevant; any other submitted technical material.

The Planning Statement should help the reader understand how these documents collectively support the application.

## Numbering and Structure Note

The numbering used in the final Planning Statement should begin with the first substantive section of that document.

The general guidance headings in this brief are not intended to become numbered sections in the final Planning Statement. They are instructions for the writer only.

When drafting the Planning Statement, the document structure should normally begin at 1.0 Executive Summary, with subsequent sections continuing in order, for example 2.0 Submission Documents, 3.0 Consultation and Pre-Application Engagement, 4.0 Site Description and Context.

Do not preserve the unnumbered general guidance headings from this brief as numbered sections in the final Planning Statement.

## Recommended Planning Statement Structure

The Planning Statement will usually follow this structure:

1.0 Executive Summary
2.0 Submission Documents
3.0 Consultation and Pre-Application Engagement
4.0 Site Description and Context
5.0 Planning History
6.0 Lawful Uses, where relevant
7.0 Planning Policy Context (written separately — do not author this section)
8.0 Proposed Development
9.0 Planning Considerations and Assessment (written separately — do not author this section)
10.0 Planning Obligations and Community Infrastructure Levy
11.0 Planning Benefits, Planning Balance and Conclusion

The structure may vary depending on the type of development, the LPA's requirements, and the complexity of the application. However, the core logic should remain the same: first explain the site and proposal; then identify the policy framework; then assess the proposal against that framework; then conclude with the planning balance and justification for approval.

## 1.0 Executive Summary

The Executive Summary should provide a clear, concise overview of the application.

It should usually include: the site address; the applicant name; the Local Planning Authority; confirmation that the application is submitted to the LPA as determining authority; the description of development; a short summary of the proposed scheme; a brief reference to any pre-application discussions, where relevant; a bullet-pointed summary of the key elements of the proposal; a short summary of the overall planning case.

The Executive Summary should be accessible and should allow a reader to understand the broad nature of the application quickly.

It should not contain the full planning assessment. Its role is to orientate the reader.

Where pre-application engagement has taken place, this can be summarised briefly. Where no pre-application engagement has taken place, do not include unnecessary detail.

## 2.0 Submission Documents

The Planning Statement should include a section setting out the documents submitted in support of the application.

This is typically best presented as a table. The table should identify: the document title; the author or consultant, where relevant; the document reference or drawing number, where relevant; the revision, where relevant; the date, where relevant.

The purpose is to provide a clear schedule of the application submission package. The list should include all relevant planning, design, technical, and application documents submitted with the application.

This section should be factual and administrative. It should not assess the content of the documents.

## 3.0 Consultation and Pre-Application Engagement

A section on consultation and pre-application engagement should be included where relevant.

The content and location of this section may depend on the project type and the structure preferred for the application. For some project types, pre-application and consultation material may sit within a broader background section. For others, it may be its own standalone section.

This section may include: pre-application discussions with the LPA; written pre-application advice; meetings with planning officers; meetings with statutory consultees; public consultation events; stakeholder engagement; community engagement; councillor, parish council, or local group engagement; how feedback has influenced the proposal.

The section should be concise unless consultation is a major part of the planning case.

Where a Statement of Community Involvement is submitted separately, the Planning Statement can summarise the key points and cross-reference that document.

## 4.0 Site Description and Context

The site description must be detailed and rigorous.

Because the Planning Statement should allow someone with no prior knowledge of the site to understand the application, the site description should provide a clear account of the existing site and its characteristics.

This section should include, where relevant: site location; site area; existing land use; existing buildings or structures; existing access arrangements; site levels and topography; landscape features; trees and vegetation; watercourses or drainage features; surrounding roads and transport infrastructure; relationship to nearby settlements; relationship to neighbouring uses; ownership or operational context, where relevant; any physical constraints or opportunities.

The Planning Statement should also describe the surrounding area in sufficient detail. This may be included within this section or separated into a subsection.

The surrounding area description should cover: neighbouring land uses; nearby residential properties; nearby commercial, industrial, educational, community, or agricultural uses; nearby infrastructure; nearby transport connections; surrounding built form; surrounding landscape character; nearby heritage assets or conservation areas; sensitive receptors; relevant local character; relationship to the wider settlement, urban area, countryside, or landscape.

The Planning Statement should identify any planning designations or constraints relevant to the site and, where appropriate, nearby land. This may include: site allocations; conservation areas; listed buildings; scheduled monuments; registered parks and gardens; locally listed buildings; Green Belt; Metropolitan Open Land; flood zones; ecological designations; biodiversity designations; landscape designations; protected trees or TPOs; public rights of way; safeguarded land; contamination constraints; minerals safeguarding areas; infrastructure safeguarding; air quality management areas; parking zones or transport designations; other relevant policy designations.

Anything pertinent to understanding the development as a whole should be included.

This section is primarily descriptive. The significance of any constraints or designations should be assessed later in the Planning Considerations and Assessment section.

## 5.0 Planning History

The Planning Statement should include a detailed planning history section where relevant.

This will often be presented as a table setting out relevant on-site and nearby planning history. The table should normally include: application reference; description of development; decision date or status date; decision or current status; relevance to the current application.

Planning history should not be limited to permissions only. It may include: previous approvals; refusals; appeals; certificates of lawful use or development; enforcement history, where relevant; previous pre-application discussions, where relevant; nearby applications that affect the planning context; applications on adjacent or comparable sites.

The level of detail should be proportionate. Include history that helps explain the site, the development strategy, or the planning context. Avoid unnecessary planning history that has no relevance to the current proposal.

## 6.0 Lawful Uses

A section on lawful uses may be required, but it will not be relevant to every application.

Where relevant, this section should explain the lawful established use of the site or parts of the site. This may be important where: the existing use is ambiguous; different parts of the site have different lawful uses; the planning history affects the lawful use position; the proposed development relies on an established fallback position; there are questions about whether a use has been abandoned; there are certificates of lawful use or development; the existing use is material to the assessment of the proposed use.

Where there is ambiguity, the Planning Statement should raise and explain it clearly. If a separate legal or planning note addresses lawful use, cross-reference it.

Do not include a lawful use section as standard where it adds nothing to the planning case.

## 7.0 Planning Policy Context

This section is not written here. It is generated separately from its own dedicated prompt and inserted into the document at this point.

## 8.0 Proposed Development

The Proposed Development section should describe the proposal in detail.

This is a descriptive section. It should explain what is proposed before the Planning Statement moves into policy assessment.

The section should be informed by the Design and Access Statement, the submitted drawings, the development schedule, and any relevant design material.

It should describe, where relevant: proposed land uses; quantum of development; number of units, homes, rooms, beds, jobs, floorspace, energy capacity, or other relevant metrics; height; massing; building envelope; layout; form; appearance; material palette; access arrangements; parking; cycle parking; pedestrian access; servicing; refuse strategy; landscaping; public realm; energy and sustainability measures; drainage or SuDS features; operational arrangements; phasing, where relevant.

This section should also explain the rationale for the proposed use or development type. Where the proposal involves a use that may not be widely understood by the public or decision-maker, such as a specialist residential typology, the Planning Statement should explain what that use is, who it serves, and what benefits it provides.

The subsections will depend on the project type. For an urban residential or specialist residential scheme, common subsections may include: land use and accommodation; design approach; height, massing, and building envelope; materials and appearance; access; pedestrian access; cycle parking; car parking; servicing; refuse and recycling; landscape proposals; energy and sustainability. For other forms of development, such as renewable energy, commercial development, infrastructure, rural development, or mixed-use schemes, the subsections should be adapted to the project.

Each subsection should describe what is proposed, not yet argue whether it is acceptable. Assessment follows in the Planning Considerations and Assessment section.

## 9.0 Planning Considerations and Assessment

This section is not written here. It is generated separately from its own dedicated prompt and inserted into the document at this point.

## 10.0 Planning Obligations and Community Infrastructure Levy

A section on planning obligations and Community Infrastructure Levy should be included for most applications where obligations, mitigation, contributions, or CIL are relevant.

For some small applications, this section may not be required. It should be included where it adds value or where the application is likely to require a Section 106 agreement or CIL liability.

This section should acknowledge whether the applicant expects that planning permission will need to be accompanied by a Section 106 agreement, planning obligations, or CIL. It should also set out the applicant's expected heads of terms, where known.

Potential matters may include: affordable housing; financial contributions; transport contributions; highway works; public realm works; open space contributions; employment and skills plans; carbon offsetting; biodiversity net gain obligations; monitoring fees; travel plan obligations; car club or parking obligations; local procurement or training obligations; site-specific mitigation.

The purpose of this section is to provide a starting point for discussion and negotiation with the LPA. It should not overcommit the applicant beyond the agreed strategy, but it should show that relevant obligations have been considered.

## 11.0 Planning Benefits, Planning Balance and Conclusion

The Planning Statement should end with a section that summarises the planning benefits, undertakes the planning balance, and concludes that planning permission should be granted.

This section should summarise the development as a whole and emphasise the matters that should be afforded positive weight in the planning balance. It should identify the benefits of the scheme and, where appropriate, assign weight to those benefits.

Common weight descriptions include: substantial positive weight; significant positive weight; moderate positive weight; minor positive weight. The most significant benefits should usually be addressed first, followed by benefits of lesser weight.

Planning benefits may include matters that national policy explicitly requires decision-makers to give positive weight to, such as: delivery of new housing; reuse or redevelopment of previously developed land; renewable energy generation. Where relying on national policy, the relevant paragraph or policy basis should be cited.

Planning benefits may also include matters that are not expressly identified in national policy as benefits but can reasonably be argued to carry positive weight when considered against the development plan as a whole. Examples may include: promotion of modal shift; improved public realm; regeneration; economic benefits; employment creation; biodiversity enhancements; landscape improvements; improved accessibility; delivery of specialist housing; meeting local need; infrastructure improvements.

The planning balance should also acknowledge any harms arising from the development. Potential harms may include, depending on the project: less than substantial harm to heritage assets; landscape and visual harm; amenity impacts; policy conflict; transport or highways impacts; ecological impacts; any other adverse effects identified in the assessment.

The section should not ignore harms. It should identify them, explain their extent, and set them against the benefits of the scheme.

The conclusion of the balancing exercise should be that the positive weight attributed to the benefits of the scheme outweighs any harms that would arise as a result of the development.

The final paragraph should clearly state that, overall, the proposed development accords with the development plan when read as a whole, or that material considerations justify approval, and that planning permission should therefore be granted.

## Treatment of Project-Specific Content

Planning Statements are highly project-specific.

The writer should use the project-specific brief, application documents, technical material, and any example template to tailor the Planning Statement to the site and proposal.

Project-specific content may include: applicant name; site address; description of development; submitted document list; site description; planning designations; planning history; lawful use position; policy framework; proposed development details; technical assessment conclusions; planning obligations; planning benefits; planning balance; conclusion.

Where a point from an example or transcript is not universally applicable, treat it as conditional. For example: "Where pre-application engagement has taken place…"; "Where lawful use is relevant…"; "Where the proposal involves specialist residential accommodation…"; "Where a Section 106 agreement is required…"; "Where CIL is payable…"; "Where emerging policy is relevant…"; "Where any harms arise…"

Do not include project-specific assumptions unless they are confirmed by the project brief or supporting material.

## Recommended Drafting Principles

When drafting a Planning Statement: make the document understandable as a standalone explanation of the application; describe the site and proposal in enough detail for a reader with no prior knowledge; clearly separate description from assessment; cross-reference technical documents throughout the assessment; acknowledge any conflict or harm rather than ignoring it; explain mitigation and justification clearly; identify and weight planning benefits; conclude with a clear planning balance; state clearly why planning permission should be granted.

## Expected Output

The final Planning Statement should read as a comprehensive, structured, and persuasive planning case in support of the application.

It should allow the reader to understand the site, proposal, policy context, technical evidence, planning assessment, obligations, benefits, and planning balance without needing to start with any other document.

It should not read as a loose summary of the application. It should be the document that ties the full application together and explains why planning permission should be granted.$v3brief$
)
ON CONFLICT (document_type, COALESCE(development_type, ''))
DO UPDATE SET name = EXCLUDED.name, guidance_content = EXCLUDED.guidance_content;

INSERT INTO admin_console.guiding_briefs
  (name, document_type, development_type, guidance_content)
VALUES (
  'Planning Policy (v3 section)',
  'planning_policy_v3',
  NULL,
  $policybrief$## 7.0 Planning Policy Context

It should begin by identifying the statutory basis for decision-making. In particular, it should state that Section 38(6) of the Planning and Compulsory Purchase Act 2004 requires applications to be determined in accordance with the development plan unless material considerations indicate otherwise.

The section should then identify all relevant policy documents and material considerations that apply to the proposal.

This section is not where the proposal is assessed against the policies. It should set out the policy framework only. The assessment happens in the separate Planning Considerations and Assessment section.

The Planning Policy Context section should include, where relevant: national planning policy; National Planning Policy Framework; Planning Practice Guidance; regional policy; London Plan or other regional spatial strategy, where applicable; adopted Local Plan; site allocation documents; neighbourhood plans; area action plans; supplementary planning documents; design guides; local planning guidance; emerging policy; other material considerations.

The section should clearly identify the adopted development plan. This may include: local plan documents; core strategies; development management policies; site allocations plans; area action plans; minerals and waste plans; neighbourhood plans; regional plans where these form part of the development plan.

For each relevant development plan document, provide a subheading and list the relevant policies within that document. Policies should usually be ordered with the most relevant first. Include any policy that is materially relevant to the proposal, even if it is not central, but avoid unnecessary commentary in this section.

The Planning Statement should also identify relevant material considerations. These may include: National Planning Policy Framework; Planning Practice Guidance; supplementary planning documents; design guides; local planning guidance; conservation area appraisals; masterplans; development briefs; infrastructure plans; emerging planning policy; appeal decisions, where relevant; case-specific evidence or strategies, where relevant.

The Planning Policy Context section should flag relevant emerging policy. This may include: emerging national planning policy; emerging Local Plan documents; emerging site allocations; emerging supplementary guidance; draft neighbourhood plans.

The section should give a brief assessment of the weight that may be afforded to emerging policy, depending on how advanced it is. For example: early-stage emerging policy, such as a Regulation 18 draft Local Plan, may attract only limited weight; more advanced emerging policy may attract moderate or substantial weight, depending on its stage, unresolved objections, and consistency with national policy.

The assessment of weight should be brief in the policy context section. Detailed implications for the proposal should be addressed later in the Planning Considerations and Assessment section.

This section should not assess the proposal against policy. It should only identify and summarise the relevant policy framework.$policybrief$
)
ON CONFLICT (document_type, COALESCE(development_type, ''))
DO UPDATE SET name = EXCLUDED.name, guidance_content = EXCLUDED.guidance_content;

INSERT INTO admin_console.guiding_briefs
  (name, document_type, development_type, guidance_content)
VALUES (
  'Planning Assessment (v3 section)',
  'planning_assessment_v3',
  NULL,
  $assessbrief$## 9.0 Planning Considerations and Assessment

This is the crux of the Planning Statement.

The purpose of this section is to justify the proposal against the policies that the decision-maker will use to assess it.

It should: assess the proposed development against relevant development plan policies; assess relevant material considerations; cross-reference supporting technical evidence; explain compliance with policy; acknowledge and address any areas of tension or non-compliance; identify mitigation where required; make the case that the proposal accords with the development plan as a whole, or that material considerations justify approval.

This section should be organised by issue, with a separate subsection for each relevant planning consideration.

### 9.1 Principle of Development

The Planning Assessment section should usually begin with the principle of development.

This will generally assess the proposed use or uses against national and local policy requirements for the site.

The principle of development section may consider: whether the proposed use is supported by the development plan; whether the site allocation supports the proposal; whether the proposal accords with the spatial strategy; whether the location is appropriate; whether the proposal responds to an identified need; whether the proposal conflicts with any land-use protection policy; whether national policy supports the development type; whether the proposal is acceptable in principle before detailed matters are considered.

The principle section will be highly project-specific. It should provide a clear planning rationale for the proposed use and explain why it should be supported.

### Structure of Each Planning Assessment Subsection

Each issue-based subsection in the Planning Assessment should generally follow this structure: briefly identify what the relevant policy requires or expects; explain the relevant aspects of the proposal; cross-reference any submitted technical evidence; assess the proposal against the policy requirement; explain why the proposal complies with policy or accords with the policy's ambitions; if there is any non-compliance or tension, acknowledge it and explain why it is acceptable; identify mitigation, where relevant; conclude that the proposal accords with the relevant policy, or explain why any conflict is outweighed or otherwise acceptable.

For example, a transport section might: briefly summarise the relevant transport policy requirements; describe the access, parking, servicing, cycle parking, public transport, and movement aspects of the proposal; cross-reference the Transport Assessment or Transport Statement; explain why the proposal is acceptable in transport terms; conclude that the proposal complies with relevant transport policies.

The same logic should be repeated across each relevant issue.

### Scope of the Planning Assessment

The Planning Assessment should be exhaustive. It should assess every materially relevant policy and every relevant issue raised by the proposal. Any technical document submitted in support of the application should be referenced in the Planning Assessment where relevant.

Potential planning assessment topics may include: principle of development; land use; housing need; affordable housing; housing mix; design; height; massing; layout; townscape; streetscape; heritage; landscape and visual impact; transport; access; highways; parking; cycle parking; servicing; refuse and recycling; residential amenity; neighbouring amenity; daylight and sunlight; noise; air quality; fire safety; energy; sustainability; climate change; ecology; biodiversity net gain; trees; flood risk; drainage; land contamination; waste; employment; community infrastructure; public realm; open space; Green Belt; agricultural land; renewable energy generation; utilities and infrastructure.

Only include topics that are relevant to the project, but ensure that the assessment is complete.

### Handling Policy Non-Compliance or Harm

If the proposal does not fully comply with a policy, the Planning Statement should not ignore or hide this.

Instead, it should: identify the relevant policy requirement; explain the extent of the conflict or tension; explain why full compliance is not achieved; identify any mitigation; explain why the position is acceptable in context; explain whether other policies or benefits weigh in favour of the proposal; return to the issue in the planning balance if necessary.

The document should be honest but persuasive. The overall aim remains to explain why planning permission should be granted.$assessbrief$
)
ON CONFLICT (document_type, COALESCE(development_type, ''))
DO UPDATE SET name = EXCLUDED.name, guidance_content = EXCLUDED.guidance_content;
