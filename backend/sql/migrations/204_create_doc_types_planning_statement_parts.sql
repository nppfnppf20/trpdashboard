-- Create card: three document types for the parts of a Planning Statement.
--
-- Mirrors Planning Statement v3's three prompts (main body, Planning Policy,
-- Planning Assessment) but as editable guidance for the conversational Create
-- card: structure_notes is a default structure and the rules that matter, not a
-- rigid template, and example_text is the style example taken from the v3
-- prompts (migrations 132, 133, 135). The Policy and Assessment slugs are
-- referenced by the frontend (CreateDocument.svelte POLICY_TYPE_SLUGS) to show
-- a "tick your policies" warning.
--
-- ON CONFLICT DO NOTHING so re-running never overwrites later edits made in the
-- admin console (Create Doc Types). To refresh a row, edit it there or delete it
-- and re-run. The existing "Planning statement" type is left untouched.

INSERT INTO admin_console.create_doc_types
  (name, slug, word_template, example_text, structure_notes, sort_order)
VALUES
  ('Planning Statement: Main body', 'planning_statement_main', '/planning%20statement%20template%20c%20and%20s.docx',
$pst$Executive Summary

This Planning Statement accompanies an application submitted by Smart Urban Living Streatham Limited for a proposed 117-unit co-living development, alongside co-working space and the retention of the existing public house at 2A Streatham Hill and 1A and 3 Streatham Place, London SW2 4AH.

This application is submitted to the London Borough of Lambeth Council as the determining Local Planning Authority.

The Applicant seeks permission for the following description of development:

"Refurbishment and extension of Crown and Sceptre public house, 2A Streatham Hill, demolition of existing buildings at 1A and 3 Streatham Place and new-build development providing co-living accommodation and office space, with associated internal and external communal facilities and landscaping."

The application follows extensive pre-application discussions with officers and other stakeholders. The proposed development seeks to optimise an underutilised and highly accessible Site by retaining and enhancing the existing public house and introducing residential and co-working accommodation.

In summary, the scheme comprises:

▪ Demolition of the existing vacant office building.

▪ Demolition of the adjacent dwelling.

▪ Partial demolition, refurbishment and reconfiguration of the existing public house, together with enhanced landscaping, accessible parking and delivery access.

▪ Construction of a five-storey building providing co-living accommodation and co-working facilities, together with streetscape enhancements and additional landscaping.

Submission Documents

The following technical documents have been prepared by the consultant team and are submitted in support of the application:

| Document | Consultant |
|---|---|
| Site Location Plan | Project architect |
| Planning application drawings | Project architect |
| Planning Statement | Planning consultant |
| Design and Access Statement | Project architect |
| Transport Statement | Transport consultant |
| Heritage, Townscape and Visual Impact Assessment | Heritage consultant |
| Preliminary Ecological Appraisal | Ecology consultant |
| Flood Risk and Drainage Assessment | Drainage consultant |

Consultation and Pre-Application Engagement

Full details of the Applicant's engagement are provided within the supporting Statement of Community Involvement.

The preparation of the planning application was informed by a programme of pre-application engagement with the Council's planning, design, heritage and highways officers, together with discussions with relevant stakeholders.

The principal matters discussed included:

▪ Principle of development

▪ Architectural approach

▪ Retention of the public house

▪ Heritage

▪ Residential accommodation

▪ Office floorspace

▪ Energy and sustainability

▪ Transport and access

The evolution of the design in response to officer feedback is set out in the accompanying Design and Access Statement. The design team worked with the Council's officers to develop a scheme that optimises the Site while responding to the character and heritage value of the retained building and surrounding area.

Site Description and Context

The Site

The application Site comprises a 0.19-hectare plot occupying a prominent corner position at the junction of two principal roads. It is located within an established urban area and benefits from a high level of public transport accessibility.

The Site contains three buildings: an existing public house, a vacant office building and a residential dwelling. A substantial part of the land to the rear of the public house is occupied by an outdoor seating area and associated car parking.

The public house comprises a part one-storey and part three-storey building with a basement. It contains a principal bar area at ground-floor level, with ancillary accommodation on the upper floors.

The building is not statutorily listed but has local heritage significance. Its corner position and surviving architectural features contribute to the character of the street.

Surrounding Area

The surrounding area is predominantly residential, with commercial, retail and community uses located nearby. The Site is bounded by principal roads to the north and east.

The adjoining development includes a varied range of building forms and architectural styles. These include Victorian houses, later residential buildings, commercial premises and areas of open space.$pst$,
$pst$How to use this guidance
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
  31),
  ('Planning Statement: Policy', 'planning_statement_policy', '/planning%20statement%20template%20c%20and%20s.docx',
$pst$Planning Policy

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

The Written Ministerial Statement entitled Solar and Protecting our Food Security and Best and Most Versatile Land (March 2024) addresses the deployment of solar development on agricultural land, emphasising the importance of solar generation while directing proposals towards lower-grade agricultural land.$pst$,
$pst$How to use this guidance
This is a guide, not a rigid template. The structure below is the default. Add, drop, merge or reorder sections where the user's instructions in the chat, or a ticked meeting transcript, say so, and do it without asking for confirmation. Edit the document you are given rather than starting again.

Non-invention (this one is firm)
Every project-specific fact, figure, date, name, reference, finding or conclusion must come from the ticked sources, the document so far, or what the user has said in the chat. Do not use general knowledge, the style example or assumptions to fill gaps. Where something material is missing, write [INFORMATION REQUIRED: what is needed] and carry on. Where sources conflict, write [INCONSISTENCY TO BE RESOLVED: brief description]. Where the user or a transcript asks for a "placeholder" for a matter, insert [PLACEHOLDER: what is to be added] there instead of drafting it.

Which sources you have
Look at which sources are actually ticked or provided and say briefly, in your reply, if something this part depends on is missing. Then draft what you can from what you have.

Format and style
Clean HTML. Headings are unnumbered, main sections h2 and subsections h3. Formal British English in the register of an experienced UK planning consultant: factual, concise, evidence-led. No em dashes. The style example sets tone and arrangement only and is never a source of facts.

This part: the Planning Policy section
Identify the national policy, development plan policies and other policy or guidance relevant to the application. Do not assess compliance in this section: that belongs in the Planning Considerations and Assessment part. Do not write "the proposal complies with...", "accords with...", "satisfies..." or similar.

What it needs
The project's policies. Tick Relevant Policies and/or Drafting Issues: Linked Policies, and Policy Documents for the plans. If the user has given policies in the chat, use those. If you have none from either, say so and do not make any up.

Default structure (drop any subsection with nothing supplied)
1. Local Planning Policy
2. Neighbourhood Plan
3. Supplementary Planning Documents
4. National Planning Policy
5. Other Policy and Guidance
Start the section with: "This section identifies relevant national and development plan policy. The proposed development is assessed against these policies in the subsequent sections."

Local Planning Policy
Open with the Section 38(6) of the Planning and Compulsory Purchase Act 2004 quotation, then "The current Development Plan comprises:" followed by each plan as a bullet (▪ Full plan title (status and date as supplied)). Then "The following are considered the key policies for this application." with the key policies grouped under their parent plan: ▪ Policy [reference]: [title], followed by one or two descriptive sentences on why it is relevant, based only on the supplied relevance note. Then "The following policies of the adopted Development Plan are considered relevant to this application:" with the remaining policies listed by reference and title only, grouped by plan where there is more than one.

Neighbourhood Plan, Supplementary Planning Documents, Other Policy and Guidance
Same treatment. Key items get a short relevance note; others are listed by title and date only.

National Planning Policy
Write from the national policy material supplied. Name the document, set out the paragraphs and requirements that matter to this application, and give paragraph numbers where the source does. Quote only where the exact wording matters; otherwise summarise accurately. Use no national policy from general knowledge.

Style
Use plan, policy and document titles exactly as supplied. Use ▪ for bullets and no tables. Keep it concise and mostly list-based. Where a key policy has no relevance note, write [ADD RELEVANCE NOTE FOR reference or title]. Where a plan has no date or status, write [STATUS OR DATE REQUIRED].$pst$,
  32),
  ('Planning Statement: Assessment', 'planning_statement_assessment', '/planning%20statement%20template%20c%20and%20s.docx',
$pst$Planning Assessment

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

Agricultural land$pst$,
$pst$How to use this guidance
This is a guide, not a rigid template. The structure below is the default. Add, drop, merge or reorder sections where the user's instructions in the chat, or a ticked meeting transcript, say so, and do it without asking for confirmation. Edit the document you are given rather than starting again.

Non-invention (this one is firm)
Every project-specific fact, figure, date, name, reference, finding or conclusion must come from the ticked sources, the document so far, or what the user has said in the chat. Do not use general knowledge, the style example or assumptions to fill gaps. Where something material is missing, write [INFORMATION REQUIRED: what is needed] and carry on. Where sources conflict, write [INCONSISTENCY TO BE RESOLVED: brief description]. Where the user or a transcript asks for a "placeholder" for a matter, insert [PLACEHOLDER: what is to be added] there instead of drafting it.

Which sources you have
Look at which sources are actually ticked or provided and say briefly, in your reply, if something this part depends on is missing. Then draft what you can from what you have.

Format and style
Clean HTML. Headings are unnumbered, main sections h2 and subsections h3. Formal British English in the register of an experienced UK planning consultant: factual, concise, evidence-led. No em dashes. The style example sets tone and arrangement only and is never a source of facts.

This part: the Planning Considerations and Assessment section
A concise, policy-led assessment of the proposed development, one subsection per planning issue, in the order of the Drafting Issues unless told otherwise. Use an h3 for each issue and no other headings. Start straight into the first issue; no section-level intro or summary, no overall planning balance unless asked.

What it needs
The Drafting Issues sources: tick Drafting Issues: Linked Policies (which policies and plans relate to each issue) and, if you want the argument notes used, Drafting Issues: Notes. Also tick the meeting transcripts if you want them used. If the user has given the policies or issues in the chat, use those. If you have neither, say so and do not make any up.

How the sources work together
- Linked policies only, with a transcript: build each issue from what the transcript records for it.
- Argument Notes (with or without a transcript): the Argument Notes set the intended structure and sequence of that issue. Notes from successive meetings are stacked under dated headers; where a later one changes or withdraws an earlier point, follow the later one. Where a transcript and a note differ on a fact, follow the transcript.
- Where a source records a decision on how an issue is to be argued (the structure, the order, how policies are grouped), follow it for that issue only, not for the others.
- A specialist-report working note is an anticipated position, not a verified technical report. Present it as such and do not state it as a finding.

Default shape of each issue (a default, not a template)
Identify the relevant policy test briefly; identify only the parts of the proposal that matter; summarise the material findings of any specialist evidence supplied; explain directly whether the proposal meets the requirement; address any harm, conflict or mitigation; end with a brief conclusion (complies, or conflict remains, or mitigation makes it acceptable, or carry into the planning balance). Group similar policies rather than discussing each separately. Quote policy wording only where it has been supplied and the exact wording matters.

Writing
Flowing paragraphs, declarative sentences, no rhetorical flourishes, no promotional language. Be candid about harm or conflict. Do not describe how easy, hard or complex an issue is. Do not reproduce conversational wording from transcripts. Produce a shorter, more direct assessment than the style example.$pst$,
  33)
ON CONFLICT (slug) DO NOTHING;
