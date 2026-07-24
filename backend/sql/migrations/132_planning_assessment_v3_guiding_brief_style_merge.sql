-- Replaces the Planning Assessment section's generation prompt with a
-- hand-authored rewrite (drafted externally, adapted here to this system's
-- real variables). Supersedes the earlier version of this migration, which
-- only inlined the old guiding-brief/style text without changing structure.
--
-- Variable mapping applied during incorporation:
--   <project_brief> + <briefing_transcript> -- merged into {{BRIEFING_NOTES}}
--     (the real token; supports selecting multiple briefing transcripts,
--     not just the single latest one)
--   <planning_issues>          -- renamed to {{ISSUE_LIST}}
--   <drafting_notes>            -- dropped as a standalone block; the
--     equivalent content (tier notes, argument notes, issue summary) is
--     already bundled per-issue inside {{ISSUES_CONTEXT}}, not a separate
--     document-wide note
--   <linked_policy_material>    -- dropped as a standalone block; each
--     issue's linked policies are already inside {{ISSUES_CONTEXT}}
--   <technical_evidence>        -- dropped as a standalone block; each
--     issue's specialist_report is already inside {{ISSUES_CONTEXT}}
--   <document_context>          -- dropped entirely: no guiding brief is
--     used for this section any more (this document type is being run
--     without one, as a test), and there is no numbering concept to feed
--     in -- the issue heading is the only heading
--
-- Kept: {{PROJECT_NAME}}, {{ISSUE_LIST}}, {{ISSUES_CONTEXT}}, {{BRIEFING_NOTES}}.
-- The embedded style example is inlined as literal text as before.
-- {{DOCUMENT_GUIDING_BRIEF}} is dropped (see the corresponding
-- appeal.controller.js change removing the guiding-brief fetch for
-- planning_statement_v3 sections).
--
-- Scoped to Planning Statement v3's Planning Assessment section only.

UPDATE appeals.appeal_draft_sections
SET generation_prompt = $assessv2$You are drafting the Planning Considerations and Assessment section of the Planning Statement for the project "{{PROJECT_NAME}}", covering every issue below in turn.

## Core Task

Prepare a concise, policy-led assessment of the proposed development.

For each planning issue:
1. state the relevant policy requirement;
2. identify the relevant aspects of the proposal;
3. summarise the material findings of any specialist evidence;
4. assess whether the proposal meets the policy requirement;
5. address any harm, conflict or mitigation; and
6. reach a clear conclusion.

The assessment should make the planning case directly. It should not contain commentary about how easy, difficult, straightforward or complex an issue is.

## Source Material

Briefing notes -- background, strategy, and the intended planning argument. May be informal, repetitive, or expressed in shorthand -- convert the intended argument into concise professional prose. Do not reproduce conversational wording from it.
{{BRIEFING_NOTES}}

Issues to cover, in order:
{{ISSUE_LIST}}

Context for each issue -- linked policies, development-type-specific policy snippets, working notes (tier notes, argument notes) previously recorded for that issue, and any specialist report:
{{ISSUES_CONTEXT}}

## Use of the Sources

The briefing notes provide the confirmed facts about the Site, the proposed development and the application, and explain the intended planning argument.
The issues to cover identify the subsections to prepare and the order in which they should appear.
Each issue's own context above identifies the policy requirements relevant to that issue, any specialist findings that support or qualify the assessment, and any working notes recorded for it. Use a given issue's context only for that issue's sub-section -- not for another issue's.
Do not reproduce conversational wording from the briefing notes.
Do not refer to the briefing notes, an issue's working notes, source material or these instructions in the finished assessment.

## Source Priority

Where information conflicts, apply the following order:
1. exact policy wording;
2. findings stated in a supplied technical or specialist report;
3. confirmed facts in the briefing notes;
4. the intended argument in an issue's own working notes; and
5. the embedded style example, which controls style only.

An issue's working notes and the briefing notes may determine how the case is presented, but they must not override confirmed facts, policy wording or technical findings.

Where a material conflict cannot be resolved, insert:
[INCONSISTENCY TO BE RESOLVED: identify the issue briefly]

Do not select the version that is most favourable to the proposal without evidential support.

## Scope

Prepare a separate subsection for each issue listed above, in the order supplied.
Do not add generic planning topics that have not been requested.
Do not include an overall planning balance unless it is expressly identified as one of the issues above.
Where the principle of development is included, place it first unless instructed otherwise.

## Required Approach to Each Subsection

Each subsection should normally contain the following elements.

### Policy

Briefly identify the relevant policy test.
Do not provide a general history of the policy topic.
Do not repeat the full policy review contained elsewhere in the Planning Statement.
Where several policies contain similar requirements, summarise them together rather than discussing each in a separate paragraph.
Quote policy wording only where:
- the exact wording has been supplied;
- the wording is material to the assessment; and
- paraphrasing would lose an important distinction.
Otherwise, summarise the policy accurately.

### Proposal and Evidence

Identify only those elements of the proposal that are relevant to the policy test.
Refer to the relevant specialist report and summarise its material conclusions.
Do not provide a general description of the report.
Do not describe its methodology unless the methodology is relevant to the planning judgement.
Do not list every finding merely because it has been supplied.
Use the findings necessary to support the assessment.

### Assessment

Explain directly how the proposal meets or does not meet the policy requirement.
Connect the policy, proposal and evidence within the same paragraph where this produces a clearer and shorter assessment.
Do not separate information into multiple paragraphs where one paragraph would be sufficient.

### Conclusion

End with a brief conclusion.
The conclusion should normally state:
- whether the proposal complies with the relevant policy;
- whether a conflict or harm remains;
- whether mitigation makes the position acceptable; or
- whether the issue should be carried into the overall planning balance.
Do not repeat the complete assessment in the conclusion.

## Concision

Concision is a primary requirement.
The assessment should contain the information needed by the decision-maker, but no unnecessary commentary or repetition.
As a general guide:
- straightforward issues should normally require approximately 250 to 450 words;
- more complex issues may require approximately 450 to 700 words; and
- a longer assessment should only be produced where the policy tests, technical findings or identified harm genuinely require it.
These are guides rather than mandatory word limits.
Do not lengthen a subsection merely to reach a target word count.
Each paragraph should perform a clear function.
Delete any sentence that merely:
- announces that an issue is being considered;
- comments on whether an issue is straightforward or difficult;
- tells the reader that a distinction needs to be made;
- restates the heading;
- repeats a fact already established;
- summarises the previous paragraph without adding a planning judgement; or
- previews material that immediately follows.
Move directly to the relevant policy, evidence or assessment.

## Prohibited Commentary

Do not use narrative or editorial commentary such as:
- "The starting point for considering this issue is..."
- "The position is less straightforward."
- "This matter requires a more qualified assessment."
- "It is important to distinguish between..."
- "This issue requires careful consideration."
- "The implications must therefore be considered."
- "The assessment must first consider..."
- "It is useful to begin by..."
- "The key point to note is..."
- "This is a complex matter."
- "The situation is nuanced."
- "This is not a case where..."
- "It is worth setting out..."

Instead, state the relevant fact or policy position directly.

For example, do not write:
"The treatment of the former forge is less straightforward. The proposal would involve its demolition."

Write:
"The proposal would demolish the former forge, resulting in the total loss of a non-designated heritage asset."

Do not write:
"It is important to distinguish between the conservation area and the locally listed buildings."

Write:
"The Built Heritage Assessment identifies no harm to the Alderwick Station Conservation Area. The demolition of the locally listed forge would, however, result in the loss of a non-designated heritage asset."

## Policy Discussion

The assessment should apply policy rather than reproduce it.
Use policy as the framework for the planning judgement.
Suitable concise constructions include:
- "Policy [reference] requires..."
- "At the national level..."
- "National policy supports..."
- "The relevant policy test is whether..."
- "Policy [reference] permits..."
- "The development plan seeks to..."
- "The proposal responds to this requirement by..."
Vary the wording naturally, but do not use different introductory expressions merely for stylistic variety where a direct formulation would be clearer.
Do not repeat a policy requirement in both the opening and concluding paragraphs.
Do not discuss a policy that has no bearing on the assessment.

## Technical Evidence

Identify a technical report by its correct title and author where supplied.
Summarise its material findings accurately and briefly.
A report should not normally be introduced more than once within the same subsection.
Where possible, combine the report introduction and findings:
"The Transport Assessment prepared by Junction Transport Consultants confirms that the altered access would provide the required visibility and that the development would not result in a severe cumulative effect on the road network."
Avoid longer formulations such as:
"A Transport Assessment has been prepared by Junction Transport Consultants to consider the transport and highways implications of the proposed development. The assessment considers matters including access, visibility, trip generation, parking, servicing and sustainable transport. Its findings are summarised below."
Do not reproduce technical methodology unless it is material.
Do not repeat the same technical conclusion in the assessment and again in the conclusion.
Do not invent or overstate:
- report findings;
- effect classifications;
- measurements;
- recommendations;
- mitigation measures; or
- specialist conclusions.
Retain any qualification or uncertainty stated in the report.

## Compliance

Where the proposal complies with policy, demonstrate compliance briefly through the relevant fact and evidence.
Avoid unsupported statements such as:
- "The proposal is fully policy compliant."
- "There would be no unacceptable impacts."
- "The development represents sustainable development."
- "The impact is acceptable."
Prefer:
"The proposed two- and three-storey form, brick material palette and retention of the office building and chimney respond to the characteristics identified in the Alderwick Design Guide. The proposal therefore accords with Policy D2."
The assessment should not use several paragraphs where the same conclusion can be demonstrated in one.

## Harm, Conflict and Non-Compliance

Acknowledge any identified harm or policy conflict directly.
Do not precede it with commentary about the difficulty or sensitivity of the issue.
State:
- the relevant policy requirement;
- the nature and extent of the conflict or harm;
- the relevant specialist finding;
- any mitigation;
- the justification relied upon; and
- the resulting planning judgement.
Do not describe a proposal as fully compliant where a genuine conflict remains.
Do not minimise harm by changing the terminology used in a specialist report.
Do not say that mitigation removes harm unless the supplied evidence says so.
Where recording is proposed following the loss of a heritage asset, describe it as mitigation. Do not suggest that recording eliminates the loss.
Where a conflict remains but is considered justified, say so directly.
For example:
"Demolition of the forge would conflict with the retention objective of Policy HE4. The building has low-to-medium significance, has been substantially altered and is in poor condition. Its retention would prevent delivery of the route required by Policy SA3 and reduce housing delivery by approximately nine homes. The loss would therefore be justified by the regeneration and heritage benefits of the wider scheme, although the residual harm should be considered in the planning balance."
Do not add several further paragraphs repeating the same judgement.

## Benefits

Refer only to benefits supported by the supplied information.
Do not list every project feature as a benefit.
Use benefits where they are relevant to:
- a policy test;
- justification for a conflict;
- the weight to be given to an issue; or
- the overall planning balance.
Avoid repeating the same benefits under multiple issues.
Where several benefits are relevant, they may be stated in one concise sentence rather than a long list.

## Principle of Development

Where included, the principle of development section should focus on:
- the site allocation or spatial strategy;
- the acceptability of the proposed use;
- the principal land-use policy requirements;
- any loss or change of an existing use;
- evidence addressing that change; and
- the resulting policy conclusion.
Do not repeat detailed design, heritage, transport or ecology arguments. Signpost those matters briefly where necessary.
Avoid general discussion of sustainability where the site-specific policy position is sufficient.
Where the site is allocated for the proposed form of development, begin with that allocation directly.
For example:
"Policy SA3 allocates the Site for mixed-use regeneration comprising residential development and employment-generating floorspace. The proposal would provide 58 homes and 350 square metres of Class E workspace and therefore accords with the principal land-use requirements of the allocation."

## Style

Use formal British English and the register of an experienced UK planning consultant.
The writing should be:
- concise;
- factual;
- policy-led;
- evidence-based;
- professional;
- persuasive without being promotional; and
- candid about harm or conflict.
Prefer clear declarative sentences.
Use complete paragraphs rather than notes.
Do not use elaborate transitions or rhetorical flourishes.
Do not add emphasis through unnecessary adjectives.
Avoid words such as:
- clear, where the conclusion is already apparent;
- comprehensive, unless it has a specific planning meaning;
- significant, unless supported by policy or evidence;
- substantial, unless supported by the source material;
- important;
- notable;
- compelling;
- robust;
- strong; and
- valuable
where they are not necessary to the planning judgement.
Do not describe evidence as "robust" merely because it supports the proposal.
Use "would" for the anticipated effects of the development.
Use "will" only for a confirmed action or secured requirement.
Use "the proposed development", "the proposal" and any defined terms consistently.

## Repetition

Do not repeat:
- the full description of the proposal;
- the location and accessibility of the Site;
- the name and author of a technical report;
- the same policy requirement;
- the same mitigation measure;
- the same benefit; or
- the same conclusion
within one subsection unless repetition is essential for clarity.
Do not include both a long opening summary and a long concluding summary.
A subsection should generally open with policy and close with the planning judgement.

## Headings and Lists

Use the issue heading for each issue's subsection, taken from the issue list above -- one per issue, in the order listed.
Do not create additional headings such as:
- Policy Context;
- Assessment;
- Technical Evidence;
- Planning Judgement; or
- Conclusion
unless expressly requested.
Use bullet points sparingly.
Where a short sentence can present the information clearly, use prose instead of bullets.

## Style Example -- THIS IS THE TONE YOU MUST WRITE IN

The following is a real document of this type written by this consultancy. This is not a loose reference -- it is the exact tone, register, vocabulary, sentence structure, and paragraph rhythm you are to reproduce. Match it as closely as you can. It does not control length -- the concision instructions above take precedence over the length and level of detail in this example.

Do not reproduce:
- its project facts;
- policy references;
- quotations;
- technical evidence;
- conclusions;
- repetition;
- drafting errors; or
- unnecessarily long passages.

Match its professional planning tone, but produce a shorter and more direct assessment than this example.

Planning Assessment

Principle of development

Climate change and renewable energy

In the 21st Century, climate change is a recognised phenomenon of international and global significance. The scientific evidence is overwhelming and has recently led to cross-party support for legislation that enshrines “net-zero greenhouse gas emissions” within the Climate Change Act 2008. Additionally, the recent volatile political climate globally has heightened the need for energy security, further encouraging renewable energy production in the UK.

The Government’s policy position on energy and commitment to achieving net zero has been further underlined in a recent keynote speech by the Secretary of State for Energy Security and Net Zero at the Energy UK conference 2024. In commenting on the recent cost of living crisis and the impact of significant energy price increases, The Secretary of State stated that “the central lesson of the crisis for Britain is that we paid a heavy price because of our exposure to fossil fuels”, and made clear there is now:

“a clean energy imperative: the drive to clean energy is right not just on grounds of climate, which we all knew back then, but also energy security and affordability. The lesson for this government is that we must build a new era of greater energy independence on the foundation of clean energy.”

The NPPF underlines that position and is clear that “planning system should support the transition to net zero by 2050 … shape places in ways that contribute to radical reductions in greenhouse gas emissions, … and support renewable and low carbon energy and associated infrastructure” (Paragraph 161). Great weight should be given to this benefit, especially in light of the recent Written Ministerial Statement, which sets out the Government’s position on boosting the weight that planning policy gives to the benefits associated with renewables, as set out in the NPPF.

In 2019, the Government adopted a legally binding net zero emissions target with scientific evidence leading to cross-party support for legislation enshrining a requirement to achieve “net zero greenhouse gas emissions” within the Climate Change Act 2008. The Committee on Climate Change (CCC) – the Government’s advisors on achieving net-zero – has assessed the identified a need for renewable energy to not only supply low carbon energy to meet current needs, but to support the increased demand for electricity as the country moves to electric technologies including EV’s, ASHP in buildings and industrial energy demands such as data centres. The most recent assessment by the CCC states the UK need to deploy 82GW of solar by 2040[1] in conjunction with increases in other energy sources, to keep on track to deliver net zero. This is a substantial increase on previous targets of 54GW.

At the local level, CLLP policy S14 states that the council is “committed to supporting the transition to a net zero carbon future and will seek to maximise appropriately located renewable energy generated in Central Lincolnshire (such energy likely being wind and solar based)”. As such, proposals for renewable energy schemes will be supported where the “direct, indirect, individual and cumulative impacts on the following considerations are, or will be made, acceptable”.

In addition, WLDC’s Environment and Sustainability Strategy has been developed in line with the Council’s strategic target for West Lindsey to become a net zero Council by 2050 and to “enable the wider district through its role as community steward to achieve the same objective”.

As mentioned in Section 6.3, the recent WMS (July 2024), highlights that boosting the delivery of renewables will be critical to meeting the Government’s commitment to zero carbon electricity generation by 2030 and seeks to boost the weight that planning policy gives to the benefits associated with renewables.

The proposed development will generate approximately 44,617 Megawatt hours (MWh) of renewable electricity every year, which is enough to power the equivalent of 13,512 homes in the local area (average yearly power consumption in a UK home of 3.1MWh). The equivalent saving of carbon emission is estimated at 8,160.48 tonnes of CO2 every year, thereby making a very significant contribution to climate change targets. It therefore accords with local plan policy S14, the recent WMS and the relevant provisions of the NPPF in this regard.

Supporting energy security and alleviating fuel poverty

The latest national statistics published in 2023, which are based on 2021 data, estimate that for the Gainsborough parliamentary constituency, 6,393, or 14.4%1, of households meet the government’s Low-Income Low Energy efficiency definition of fuel poverty. This predates the current cost of living crisis, and the figure is now likely to be substantially higher. Businesses are not protected by an energy price cap and are facing significant inflationary pressures, which is dampening business confidence and leading to plans for job cuts.

Solar farms are one of the cheapest forms of new energy generation and can be deployed very quickly, making them ideal for rapid emissions reductions and are a critical part of reducing energy costs for communities and businesses over time.

They are an essential part of reducing the UK’s reliance on imported energy. Up to 44GW of capacity is expected to be lost from the system this decade as a result of the retirement of all coal stations and most of the nuclear fleet. Added to this, overall electricity demand is likely to rise during the 2020s as a greater proportion of the UK’s heat and transportation systems electrify.

The proposed development will generate low-cost power which will help to reduce the overall cost of energy and therefore help tackle fuel poverty.

In summary, climate emergency and net-zero have been key policy objectives since the Government adopted a legally binding net zero emissions target in 2019 which will continue to guide development for the next decades. The new Government has made it explicitly clear that the deployment of renewable energy projects is of key importance to their agenda and the December 2024 updated NPPF reflects this heightened emphasis on renewable energy to ensure schemes are coming forward in a timely manner.

Solar farms typically have low impacts on their surroundings and can be deployed very quickly, making them ideal for rapid emissions reductions. At the same time, they are essential in reducing energy costs for communities and businesses over time. The proposed development would make a

1 https://www.gov.uk/government/statistics/sub-regional-fuel-poverty-data-2023-2021-data

valuable contribution towards energy security and national and local net-zero targets and, therefore, considerable weight should be given to this benefit.

Landscape and visual effects

Paragraph 165 of the NPPF states that “to help increase the use and supply of renewable and low carbon energy and heat, plans should” maximise “the potential for suitable development, while ensuring that adverse impacts are addressed appropriately (including cumulative landscape and visual impacts)”. Furthermore, The NPPG (Reference ID: 5-013-20150327) states that “the visual impact of a well-planned and well-screened solar farm can be properly addressed within the landscape if planned sensitively.”

At local level the Central Lincolnshire Local Plan lends explicit support for renewables through Policy S14 (Renewable Energy), which supports schemes where their siting, scale and design keep impacts on landscape character and visual amenity within acceptable limits. Policy S53 (Design and Amenity) requires all development to achieve high-quality, sustainable design that contributes positively to local character and landscape. The Scothern Neighbourhood Plan Review (Policy D1: Design and Character requires that developers:

“should demonstrate that design options, proportionate to the nature and scale of development, informed by an understanding of local context have been used to determine the most appropriate form of development.”

Policy D4 (Design of New Development and Parish Design Code Principles) of the Nettleham Neighbourhood Plan states that:

“Development proposals should be design-led and ensure that built development and associated spaces are high quality and distinctive to the parish. Development proposals should positively address the relevant principles in the Nettleham Character Assessment and Design Code principles for the relevant character area in which they are located”Minimising landscape and visual impact, particularly to the visual receptors mentioned above, has been a key focus point during the design evolution of the development.

A Landscape and Visual Impact Assessment (LVIA) has been prepared by Tyler Grange to inform the scale, layout and mitigation of the proposal. The LVIA concludes that the site is neither nationally nor locally designated and is not regarded as a “valued landscape” in NPPF terms. Visual effects are assessed as being limited in nature due to the flat topography of the Solar site and its local context and the combination of gently undulating landscape and field boundary hedgerow in the case of the Substation site. As a result, the majority of receptors—nearby dwellings, local roads and more distant vantage-points—would experience only minor adverse to negligible effects. The notable exception is for walkers on Public Footpaths 150 and 152, which cross the Solar site: here the LVIA anticipates a localised major-to-moderate adverse effect in Year 1, diminishing to no more than moderate adverse by Year 10 once mitigation planting has matured.

Regarding mitigation, the Landscape Strategy Plan produced by Tyler Grange (Plan 8 of the submitted Landscape and Visual Impact Assessment) illustrates the specific landscaping and mitigation measures being brought forward. They include planting of native trees, species rich hedgerows and tussock grassland. The proposed development will retain and enhance the existing landscape features within the Site and will result in an increase in biodiverse habitat, including trees and hedgerows which will remain in situ following decommissioning of solar development. This will contribute positively to both the on-site and published landscape character and will further break up and soften the panels in views. As outlined in the submitted Landscaping strategy, a new footbridge will also be provided to allow PRoW users to cross an on-site wet ditch whilst crossing the site.

As outlined in further detail in Section 8, the proposals have undergone a series of design iterations in order to reduce visual impact on the surrounding area. These include a larger setback at the southern boundary, the removal of a section of panels immediately west of Dunholme Road, and the re-designing of the cable route in order to reduce impact on nearby trees. In terms of its visual impact and impact on the landscape, taking on board the specialist advice, it is demonstrated that the proposal is acceptable in landscape and visual terms and therefore accords with the NPPF, and local plan policies S14, S53, S63 and Scothern Neighbourhood Plan policy D1.

Use of agricultural land and food security

Agricultural land

The NPPF seeks for planning decisions to contribute to the enhancement of the natural and local environment, including by “recognising… …the wider benefits from natural capital and ecosystem services – including the economic and other benefits of the best and most versatile agricultural land” (Paragraph 187(b)).

Footnote 65 notes that “Where significant development of agricultural land is demonstrated to be necessary, areas of poorer quality land should be preferred to those of a higher quality.” The supporting NPPG sets out the particular factors a local planning authority will need to consider:

“Encouraging the effective use of land by focussing large scale solar farms on previously developed and non agricultural land, provided that it is not of high environmental value;

Where a proposal involves greenfield land, whether

(i) the proposed use of any agricultural land has been shown to be necessary and poorer quality land has been used in preference to higher quality land; and

(ii) the proposal allows for continued agricultural use where applicable and/or encourages biodiversity improvements around arrays. See also a speech by the Minister for Energy and Climate Change, the Rt Hon Gregory Barker MP, to the solar PV industry on 25 April 2013 and written ministerial statement on solar energy: protecting the local and global environment made on 25 March 2015.” (Reference ID: 5-013-20150327)”

The Written Ministerial Statement (WMS) ‘Solar and protecting our Food Security and Best and Most Versatile (BMV) Land’ (May 2024) highlights the current progress towards net zero through deployment of renewable energy and emphasises the importance of solar in meeting these targets. The WMS directs solar farms to lower grade land emphasising the weight of each land grade scale, with Grade 1 being of best quality and Grade 5 being of poorest (best and most versatile land is considered to be 1, 2 and 3a). According to the statement, the higher the land grade, the more “there is a greater onus on developers to show that the use of higher quality land is necessary”.

However, importantly the December 2024 NPPF removes the reference to the availability of land for food production to be considered. Food security is covered in the next section.

The National Policy Statement Energy EN-1 (January 2024), which is also a material consideration for local level schemes, outlines that development should not be on best and most versatile land without justification. However, it is stated “where development of agricultural land is demonstrated to be necessary, areas of poorer quality land should be preferred to those of a higher quality” (Paragraph 5.11.34).

The NPS for Renewable Energy Infrastructure EN-3 (January 2024) is also a material consideration in decision making at local level and confirms that while the preference should be to use lower grade agricultural land, this should not be the predominating factor in site selection (Paragraph 2.10.29).

At the local level, CLLP Policy S67 (Best and Most Versatile Agricultural Land) S67 stipulates that significant development resulting in the loss of BMV land will only be supported if:

“a) The need for the proposed development has been clearly established and there is insufficient lower grade land available at that settlement (unless development of such lower grade land would be inconsistent with other sustainability considerations); and

b) The benefits and/or sustainability considerations outweigh the need to protect such land, when taking into account the economic and other benefits of the best and most versatile agricultural land; and

c) The impacts of the proposal upon ongoing agricultural operations have been minimised through the use of appropriate design solutions; and

d) Where feasible, once any development which is supported has ceased its useful life the land will be restored to its former use (this condition will be secured by planning condition where appropriate).

Where proposals are for sites of 1 hectare or larger, which would result in the loss of best and most versatile agricultural land, an agricultural land classification report should be submitted, setting out the justification for such a loss and how criterion b has been met.”An Agricultural Land Classification survey was undertaken by Amet Property, which found the site to be comprised of 44.2ha Grade 2, 46.6ha Grade 3a, and 10.2ha Grade 3b land. Despite the development containing some BMV land, the development brings forward substantial sustainability benefits in the form of renewable energy generation supporting the low carbon transition, as well as incorporating ecological benefits which will enhance local biodiversity and allowing for continued agriculture in the form of grazing. These are considered to outweigh the temporary reduction in the intensity of the agricultural use.

Compliance with policy guidance combined with significant benefits secured by the project provides compelling justification, as outlined below:

▪ The development is temporary and completely reversible at the end of its life.

▪ Generating enough secure available, and affordable renewable energy to power approximately 13,512 homes and offset over 8,160.48 tonnes of CO2 per year.

▪ Improved resilience of the electricity grid by offering energy security.

▪ Planting of new trees, hedges, and meadow around the solar farm to provide a significant uplift in overall habitat compared to the existing use. This will support the diversity and abundance of flora and fauna, and in accordance with policy, will secure wider benefits from natural capital and ecosystem services.

▪ An important contribution towards other ecosystem services, including habitat to support pollinators and for prey species, reduced pollution, and continued agriculture for food production.

▪ Farm diversification to ensure the continued viability of the farm holding.

▪ Some, albeit, minor loss of agricultural land and the possibility of grazing sheep throughout the development’s operation.

The applicant acknowledges that some of the land will be altered during the life of the development. However, whilst it is considered that while some of the agricultural land will be temporarily removed from intensive agriculture, agriculture can continue on site through sheep grazing underneath and around the solar panels. At the end of the development’s life, all equipment will be removed, and the site restored to its original use. Additionally, the project brings a very substantial net gain in biodiversity and soil quality, as the ground will be allowed to rest from intensive farming and pesticides, allowing the land grade to improve. The Site Justification Document submitted with this application outlines the robust approach the applicant has undertaken in choosing a suitable site for this development and provides justification for the use of BMV land.

Food security

The development also supports food security instead of jeopardising it as is often falsely claimed. The research paper ‘Solar Farms and Food Security: The Facts’ published by Solar Energy UK (September 2022) demonstrates that solar farms have an important role to play in supporting the UK’s food supply and land use needs in the following ways:

▪ Solar helps address climate change, which is the single biggest threat to UK food security. This is according to the Department for Environment, Food and Rural Affairs, which says that climate change could reduce the UK’s stock of high-grade agricultural land by nearly three-quarters by 2050. Because solar farms generate near zero-carbon electricity, they help address climate change and are actually helping to improve the UK’s food security.

▪ Solar cuts costs, which helps keep UK farmers in business. Solar provides some of the cheapest electricity in history. Without solar, energy prices would be even higher. This is important, because costs are increasing for agricultural businesses, just like everyone else. Solar can also provide a direct and long-term revenue stream for farmers who choose to host a project on their land. By helping to keep UK farming profitable, solar is also helping to secure the UK’s domestic food supply.

▪ Solar preserves agricultural land. Planning permission for a solar farm is time limited, and installations can be completely dismantled at the end of their operation. Solar does not take agricultural land, it borrows it, and because agricultural land under a solar farm is in effect left fallow, soil health can recover. Solar farms currently account for around 0.06%-0.07% of total land use in the UK. If we continue to deploy rooftop solar and ground-mounted installations at current proportions, a total of between 0.22% to 0.39% of total UK land (or 0.45% to 0.82% of agricultural land) might be needed for solar farms in the future to meet our energy and decarbonisation objectives. This figure includes existing solar farms. 2

In summary, the sustainability benefits of the site have been demonstrated to outweigh any harm, which involve the generation of renewable energy, the continued use of agriculture throughout the operational period, and implementing biodiversity measures. Therefore, the proposed development complies with the NPPF, NPPG, EN-1, EN-3, and the WMS.

Heritage and archaeology

The NPPF requires that in determining applications, local planning authorities should require an applicant to describe the significance of any heritage assets affected, including any contribution made by their setting. When considering the impact of a proposed development on the significance of a designated heritage asset, great weight should be given to the asset’s conservation (and the more important the asset is, the greater the weight should be). Paragraph 213 states that “substantial harm” to Grade II Listed Buildings should be exceptional and that local planning authorities should refuse consent, unless it can be demonstrated that the substantial harm or total loss is necessary to achieve substantial public benefits that outweigh that harm or loss. Where a development proposal will lead to “less than substantial harm” to the significance of a designated heritage asset, this harm should be weighed against the public benefits of the proposal.

At the local level, CLLP Policy S14 (Renewable Energy) requires that proposals for renewable energy infrastructure demonstrate that their impacts on heritage assets and their settings are acceptable. Policy S53 (Design and Amenity) ensures that development is grounded in a strong understanding of its local context, including the area's history and character. In support of this, Policy S57 (Historic Environment) stipulates proposals should protect, conserve and seek opportunities to enhance the historic environment of Central Lincolnshire.

Scothern Neighbourhood Plan Review Policy D1 (Design and Character) calls for careful consideration of heritage assets and their settings, encouraging development that reinforces local distinctiveness. Similarly, Nettleham Neighbourhood Plan Review Policy E4 (The Historic Environment) supports proposals that actively conserve or enhance the significance of heritage assets and their setting.

A Historic Environment Desk-Based Assessment (HEDBA) has been prepared by Cotswold Archaeology to evaluate potential heritage and archaeological impacts associated with the proposed solar farm development at Dunholme Road, Scothern. The assessment draws on a combination of desk-based research, historic mapping analysis, aerial photography, LiDAR interpretation, and field survey, and has been undertaken in line with the NPPF and guidance issued by the Chartered Institute for Archaeologists (CiFA). The findings of this assessment are summarised below:

Heritage

A 1km radius study area, measured from the boundaries of the Site for the proposed solar farm and substation, and a 250m radius for the area proposed for the cable route was considered sufficient to

2 Hollie Blaydes, J. Duncan Whyatt, Fabio Carvalho, Hing Kin Lee, Kevin McCann, Juliana M. Silveira, and Alona Armstrong, “Shedding Light on Land Use Change for Solar Farms,” Progress in Energy 7, no. 3 (2025): 033001

capture the relevant HER data and provide the necessary context for understanding archaeological potential and heritage significance in respect of the Site.

There are no nationally designated Scheduled Monuments, Listed Buildings, Registered Parks or Gardens, Registered Battlefields or Conservation Areas within site boundaries. A total of 33 designated heritage assets are recorded within the study area. These include one Scheduled Monument, one Conservation Area, three Grade I, one Grade II* and 27 Grade II Listed Buildings.

Regarding the Substation site, the nearest designated heritage assets are the Scheduled remains of a medieval bishop's palace at Bishop's Manor, located c. 330m north-east of the site. This is in turn included within the Nettleham Conservation Area, which also comprises one Grade I and 21 Grade II Listed Buildings and which is located c.250m north-east of the site.

Following the Site walkover survey, the only heritage assets identified as being potentially susceptible to impact as a result of changes to their setting, due to their proximity to, or potential inter-visibility with the Site comprise:

▪ The Grade II Listed Manor House and Grade II* Listed Church of St Germain in Scothern

▪ Nettleham Conservation Area and the Scheduled remains at Bishop's Manor

▪ Grade I Listed Lincoln Cathedral Church of St Mary

The development will not result in any non-physical impact upon the heritage significance and the settings of any other designated heritage assets. Where glimpsed views of Church towers are possible from the site, these views are considered ‘incidental’ and not as focal points contributing to these asset’s settings. The assessment has therefore identified that there will be no harm to the heritage significance of any of those assets as a result of the change within their setting from the proposed development.

Two designated heritage assets have been considered to potentially be susceptible to non-physical impact upon their significance as results of the proposed development occurring within the northern parts of the Site. These are Grade II Listed Manor House and Grade II* Listed Church of St Germain, in Scothern.

With regards to Manor House (located c. 250m south of the solar site) the proposals will introduce a small degree of change in the specific use of a portion of the landscape pertinent to the historical agricultural activity, which is one of the aspects of the setting of the Grade II Listed Building which contributes to its significance. However, a buffer from the solar farm had been introduced to provide appropriate mitigation and ensure that the asset would continue to be experienced within a setting comprising agricultural fields. As such it is concluded that the heritage significance of this Listed Building would not be affected (no harm).

The Church of St Germain is located in Scothern, approximately 440m south of the solar site. The proposed development would not affect any of the contributors to the significance of the church, namely the heritage values embodied within its physical fabric, and would preserve the key elements of its setting, comprising its surrounding churchyard and its historical relationship with the village of Scothern. The key rural setting of the asset, specifically embodied by the rural character of the wider surrounding landscape, will not be impacted by the proposed development which will preserve the extant field layout. On this basis it is considered that the proposed development would result in no harm to the significance of the Grade II Listed Church of St Germain.

## Language to Avoid

Avoid:
- conversational language;
- promotional wording;
- rhetorical questions;
- generic introductions;
- scene-setting that is not relevant to a policy test;
- commentary on the drafting or analysis;
- exaggerated conclusions;
- formulaic transitions;
- unnecessary qualifications; and
- generic AI language.
Do not use:
- "delve into";
- "multifaceted";
- "holistic";
- "pivotal";
- "seamlessly";
- "underscores";
- "it is worth noting";
- "it is important to note";
- "considered in the round", unless an actual combined judgement is required;
- "the position is...";
- "the starting point is...";
- "the key consideration is...";
- "the issue is...";
- "the assessment demonstrates", where the evidence or conclusion can be stated directly; or
- "for the avoidance of doubt".
Do not refer to:
- the prompt;
- the model;
- the user;
- the inputs;
- the briefing notes;
- an issue's working notes;
- the style example; or
- the source hierarchy
in the finished assessment.

## Accuracy

Use only the supplied project-specific information.
Do not invent:
- policies;
- policy wording;
- policy references;
- legislation;
- designations;
- site facts;
- statistics;
- technical reports;
- report findings;
- mitigation;
- benefits;
- cross-references;
- planning conditions;
- obligations; or
- conclusions.
Do not use the embedded style example as a factual source.
Do not update supplied policy using general knowledge.
Where a material fact is missing, insert:
[INFORMATION REQUIRED: identify the missing information briefly]
Use this only where the gap prevents a reliable assessment.

## Output format -- clean HTML only

Produce only the finished Planning Considerations and Assessment section.
- One <h3>Issue Label</h3> per issue, in the order listed above, each followed by flowing paragraphs for that issue -- no other headings of any kind
- <p> for body paragraphs
- No markdown characters (**, *, #, ---) and no em dashes (—)
- Do not include a section-level heading (e.g. <h2>) -- start directly with the first issue's <h3>
Do not include:
- an explanation of how the section was prepared;
- a table of contents;
- a bibliography;
- a source list;
- a separate executive summary;
- an overall planning balance unless requested; or
- generic introductory or concluding text.

## Final Check

Before producing the assessment, silently confirm that:
- each requested issue has been addressed;
- the relevant policy test is stated concisely;
- the proposal and technical evidence are applied directly to that test;
- no commentary about the complexity of an issue has been included;
- no fact or conclusion has been repeated unnecessarily;
- no policy, fact or technical conclusion has been invented;
- harm or conflict has been stated directly;
- each subsection ends with a brief planning judgement;
- the embedded example has influenced tone but not length or factual content; and
- every sentence contributes to the policy assessment.$assessv2$
WHERE slug = 'planning_assessment'
  AND draft_type_id = (SELECT id FROM appeals.appeal_draft_types WHERE slug = 'planning_statement_v3');
