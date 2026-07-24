-- Folds this document type's own guiding brief and style example directly
-- into the top-level planning_statement_v3 generation prompt as literal text,
-- replacing {{GUIDING_BRIEF}} and the implicit {{STYLE_GUIDE}} auto-append
-- (see generateAppealDraftFromPrompt in appeal.service.js) with the actual
-- prose. Matches the same merge already applied to this document's two
-- spliced sections (migrations 129, 130) — the point is to have the whole
-- prompt for this document type visible and editable as one piece of text
-- in the "Edit generation prompt" UI, rather than needing to cross-reference
-- a separate guiding_briefs row to know what the document actually says.
--
-- This is deliberately NOT done for {{DOCUMENT_GUIDING_BRIEF}} in the two
-- section prompts (planning_assessment_v3, planning_policy_v3) — that
-- variable reads this same admin_console.guiding_briefs row
-- (document_type = 'planning_statement_v3') to give each section the
-- overall document's brief, so the row must stay in place and stays a
-- live import there. Inlining it here as well is fine — it's a second use
-- of the same underlying text, not a replacement for the section imports.
--
-- The guiding_briefs row itself (document_type='planning_statement_v3') is
-- untouched by this migration — only appeals.appeal_draft_types.generation_prompt
-- changes.
--
-- Scoped to Planning Statement v3 only — not rolled out to other draft
-- types in this migration.

UPDATE appeals.appeal_draft_types
SET generation_prompt = $topprompt$You are a specialist planning consultant preparing a {{DOCUMENT_TYPE}}.

CRITICAL EXCEPTION — read this before the guiding brief below: this document type normally includes a Planning Policy section and a Planning Assessment section. You must NOT write either of them yourself. Wherever the guiding brief's structure calls for a Planning Policy section, output the exact text [[POLICY_SECTION]] alone on its own line instead, with no heading and no other content. Wherever it calls for a Planning Assessment section, output the exact text [[PLANNING_ASSESSMENT_SECTION]] alone on its own line instead. Those two sections are generated separately by a different process and spliced into your output afterwards — do not pre-empt them. Write every other section from the guiding brief's structure in full, exactly as you normally would.

Read the guiding brief below carefully — it tells you exactly what this document is, what it must achieve, and how it should be structured. Its description of the Planning Policy and Planning Assessment sections does not apply to you: use the markers instead, as instructed above.

## Purpose of the Document

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

It should not read as a loose summary of the application. It should be the document that ties the full application together and explains why planning permission should be granted.

## Site Details
Address: {{SITE_ADDRESS}}
Local Planning Authority: {{LPA_NAME}}
Proposed Development: {{DEVELOPMENT_DESCRIPTION}}

## Local Policy Context
The following local policies have been identified as relevant to this proposal. Reference specific policies by number and name throughout the document where applicable.

{{LOCAL_POLICIES}}

## National Policy Context
{{NATIONAL_POLICIES}}

## Planning History
{{PLANNING_HISTORY}}

## Briefing Notes
The following has been prepared by the project team and contains key project information, context, and strategy. This is where you will get the project-specific information from to be then used to create a project specific document in line with the more general guiding brief.

{{BRIEFING_NOTES}}

## Style Example — THIS IS THE TONE YOU MUST WRITE IN
The following is a real document of this type written by this consultancy. This is not a loose reference — it is the exact tone, register, vocabulary, sentence structure, and paragraph rhythm you are to reproduce. Match it as closely as you can: how formal or plain the language is, how long sentences and paragraphs run, how directly claims are stated, how transitions between points are handled. Write as if the person who wrote this example is the one writing your output. Do NOT reproduce any content, facts, project names, site details, or policy references from it — every fact must come only from the material provided elsewhere in this prompt. The guiding brief takes precedence for structure and required content, but for tone and voice, this example is authoritative.

# The Crown and Sceptre, 2A Streatham Hill and 1A & 3 Streatham Place London SW2 4AH

# Planning Statement

Applicant: Smart Urban Living Streatham Limited

April 2026

---

# Contents

Contents ................................................................................................................................................ 2  
1.0 Executive Summary .................................................................................................................... 4  
Submission documents .................................................................................................................................. 5  
Consultation and pre-application engagement .............................................................................................. 6  
2.0 Site Description and Context ....................................................................................................... 9  
The site........................................................................................................................................................... 9  
Surrounding area ......................................................................................................................................... 10  
Planning policy designations ........................................................................................................................ 10  
Site history ................................................................................................................................................... 11  
Lawful uses ................................................................................................................................................... 13  
3.0 Planning Policy Context............................................................................................................. 15  
The Development Plan ................................................................................................................................. 16  
Other material considerations ..................................................................................................................... 17  
4.0 The Proposed Development ...................................................................................................... 19  
Rationale for the development .................................................................................................................... 19  
Design and built form ................................................................................................................................... 20  
Proposed uses .............................................................................................................................................. 21  
Pedestrian access ......................................................................................................................................... 22  
Car and cycle parking ................................................................................................................................... 22  
Servicing and refuse ..................................................................................................................................... 23  
Energy and sustainability ............................................................................................................................. 24  
Landscape proposals .................................................................................................................................... 24  
5.0 Planning Considerations and Assessment .................................................................................. 26  
Principle of development ............................................................................................................................. 26  
Assessment against co-living design standards. ........................................................................................... 28  
Demolition of adjacent C3 dwelling ............................................................................................................. 30  
Retention of the Crown & Sceptre Public House ......................................................................................... 31  
Office use ..................................................................................................................................................... 32  
Heritage ....................................................................................................................................................... 33  
Transport ..................................................................................................................................................... 35  
Townscape and visual impact ...................................................................................................................... 35  
Ecology ......................................................................................................................................................... 38  
Biodiversity .............................................................................................................................................. 38  
Urban greening ........................................................................................................................................ 39  
Energy, sustainability, BREEAM and circular economy ................................................................................ 39  
Trees ............................................................................................................................................................ 40  
Noise ............................................................................................................................................................ 41  
Daylight / sunlight ........................................................................................................................................ 42  
Fire ............................................................................................................................................................... 44  
Energy .......................................................................................................................................................... 44  
Air quality ..................................................................................................................................................... 45  
Flood risk.................................................................................................................................................. 46  
6.0 Planning Obligations and Community Infrastructure Levy .......................................................... 48  
7.0 Planning Benefits, Balance and Conclusion ................................................................................ 49  
8.0 Appendix 1 – LBL Enforcement Notice for 1A Streatham Place (August 2016) ............................. 51  

Version – v1.5

Prepared by: Third Revolution Projects Ltd.

Third Revolution Reference: 1198_PS

Applicant: Smart Urban Living Streatham Limited

---

# 1.0 Executive Summary

This Planning Statement accompanies an application submitted by Smart Urban Living Streatham Limited for a proposed 117-unit co-living development, alongside co-working space and the retention of the existing pub (“the Crown & Sceptre”) at 2A Streatham Hill and 1A & 3 Streatham Place, London SW2 4AH.

This application is submitted to the London Borough of Lambeth Council (“LBLC”) as the determining local planning authority.

The applicant seeks permission for the following description of development:

> “Refurbishment and extension of Crown & Sceptre public house, 2A Streatham Hill (use class sui-generis), demolition of existing building at 1A and 3 Streatham Place (use class E(g)(i)) and new build development providing co-living accommodation comprising 117 units (use class sui-generis) and office space (use class E(g)(i)), with associated internal and external communal facilities and landscaping.”

The application is submitted following extensive pre-application discussions with LBLC officers and other key stakeholders including TfL, local Councillors and residents. The proposed development seeks to optimise an underutilised and highly sustainable site by retaining and enhancing the existing pub and co-locating it with 117 high quality non-self-contained residential co-living units, addressing an identified urgent need for housing within the Borough.

The proposals would provide high-quality indoor and outdoor amenity space for co-living residents, as well as office floorspace in the form of a co-working facility which would operate independently from the co-living element of the development.

In summary the scheme comprises:

▪ Demolition of the existing vacant office building at 1A Streatham Place.  
▪ Demolition of the adjacent dwelling at 3 Streatham Place.  
▪ Partial demolition, refurbishment and reconfiguration of the existing Crown and Sceptre public house at 2a Streatham Hill, maintaining the existing floor area as well as re-providing the ancillary manager’s flat, while providing additional outdoor seating to the front of the pub, as well as enhanced landscaping, accessible parking and delivery access.  
▪ Erection of a five-storey building on the pub car park and rear outdoor area, providing 117 non-self-contained co-living units in addition to a co-working facility as well as streetscape enhancements and additional landscaping along Streatham Place.

The co-living units comprise of fully furnished non-self-contained studios with a high-quality standard of accommodation and excellent communal amenities, including spacious open-plan kitchen dining and living spaces, a fitness suite and outdoor amenity space in the form of two garden roof terraces.

The co-working space comprises of a dedicated working environment available both to co-living residents and on a paid membership basis to non-residents seeking a flexible working environment.

## Submission documents

The following technical documents have been prepared by the consultant team and are submitted in support of this application:

| Document | Consultant |
|---|---|
| Planning application fee | Applicant |
| Relevant Forms and Certificates | Third Revolution Projects |
| Site Location Plan | RG+P Architects |
| Full set of planning application drawings | RG+P Architects |
| Covering letter | Third Revolution Projects |
| Community Infrastructure Levy Form | Third Revolution Projects |
| Planning Statement | Third Revolution Projects |
| Design & Access Statement | RG+P Architects |
| Acoustic Assessment (including baseline assessment and plant noise impact assessment) | Redfan Solutions |
| Affordable Housing Statement | Third Revolution Projects |
| Air Quality Assessment | Global Air Quality |
| Arboricultural Impact Assessment | Hayden’s Arboricultural Consultants |
| Biodiversity Net Gain Assessment | Phlorum |
| BREEAM Pre-Assessment | Focus Consultants |
| Circular Economy Statement | Focus Consultant |
| Contaminated Land Assessment | Georisk |
| Daylight / Sunlight Assessment | AWH |
| Daylight / Sunlight Assessment – self test | AWH |
| Delivery & Services Management Plan | Paul Basham Associates |
| Outline Employment & Skills Plan | Third Revolution Projects |
| Energy & Sustainability Strategy | Achieve Green |
| Overheating Assessment | Achieve Green |
| Fire Statement | Jensen Hughes |
| Flood Risk & Drainage Assessment | ABA Consulting |
| Heritage, Townscape and Visual Impact Assessment | Iceni Projects |
| Landscape Plans | BEA Landscape |
| Operational Management Plan | Homes for Students |
| Preliminary Ecological Appraisal | Phlorum |
| Social Infrastructure Assessment | Third Revolution Projects |
| Statement of Community Involvement | SEC Newgate |
| Transport Statement | Paul Basham Associates |
| Travel Plan | Paul Basham Associates |
| Tree Survey | Hayden’s Arboricultural Consultants |
| Viability Assessment | Third Revolution Projects |
| Waste Management Plan | RG+P Architects |
| Basement Impact Assessment | Axiom Structures |
| Urban Greening Factor Drawing | Bea Landscape |

## Consultation and pre-application engagement

Full details of the applicant’s engagement are provided within the supporting Statement of Community Involvement.

As part of the ongoing process of community consultation and engagement, the applicant has sought to keep local stakeholders well informed as the proposals have developed by maintaining a dedicated project website and holding both virtual and in-person meetings with stakeholders, where any concerns and feedback could be appropriately raised and used to inform the design evolution of the development.

The preparation of this planning application has been guided through a thorough pre-application process which included five meetings and workshops between the applicant’s design team and the Council’s planning, design and heritage officers, together with three meetings between the applicant’s transport team, TfL and LBLC highways officers. The meetings took place from the early design stages of the project in April 2023, with continuous engagement that shaped the design evolution of the scheme, concluding with the submission of this application.

Key principles discussed within these meetings included:

▪ Principle of development  
▪ Architectural approach  
▪ Recognition of the pub as a community asset  
▪ Approach to preserving the pub’s heritage value  
▪ Quality of co-living units and amenity space  
▪ Re-provision of lost office floorspace  
▪ Sustainability Strategy  
▪ Approach to affordable Housing  
▪ Transport and access  

The evolution of the design in response to officer feedback is set out in detail in section 6 of the accompanying Design & Access Statement, prepared by RG+P Architects. The applicant’s design team have worked proactively in collaboration with the Council’s officers to develop a scheme which optimises the site, while respecting the character and heritage value of the retained public house and the adjacent Conservation Area.

## Post-pre-application design evolution

The Applicant has undertaken an extensive programme of pre-application engagement with LB Lambeth officers as summarised at Section 1.10 and evidenced in the submitted Design & Access Statement and Statement of Community Involvement. Details of pre-application engagement with TfL are set out in the supporting Healthy Streets Transport Assessment.

The pre-application discussions were undertaken on the basis of an earlier iteration of the proposals comprising approximately 100 co-living units. As the design developed, further technical work and detailed layout testing identified an opportunity to increase the number of co-living units to 117 within a comparable built envelope by the introduction of no. 3 Streatham Place into the application. The proposals will maintain the key design principles established through the pre-application process, including the retention and enhancement of the Crown & Sceptre public house and the creation of an appropriate townscape response to this prominent corner site.

The decision to progress the 117-unit scheme was taken for the following reasons, each of which results in clear planning benefits:

▪ Increased housing delivery; the revised proposals optimise a highly sustainable site and deliver an increased contribution towards Lambeth’s acute housing need.  
▪ The use of a currently underutilised site which constitutes previously developed land.  
▪ Improved townscape and architectural approach; the revised arrangement provides a more coherent relationship between the retained pub, the new building line along Streatham Place, and neighbouring development, eliminating the awkward leftover space and improving legibility at street level.  
▪ Enhanced urban greening; the revised scheme has been designed to improve performance against London Plan and local policy objectives relating to biodiversity net gain and urban greening.

The Applicant recognises that officers have not previously reviewed the 117-unit scheme through the formal pre-application process. This Planning Statement and the supporting technical submissions therefore provide a comprehensive assessment of the updated scheme against the Development Plan and other material considerations, and demonstrate that the key principles established through pre-application engagement have been carried forward and strengthened.

---

# 2.0 Site Description and Context

## The site

The application site forms a 0.19 hectare plot located in a prominent position to the south-western corner of the junction between the South Circular Road (A205) and the A23 (Streatham/Brixton Hill). Streatham Hill leads to the south; Brixton Hill to the north; Christchurch Road to the east; and Streatham Place to the west. The site is situated within the Streatham Hill West and Thornton Ward of LB Lambeth. It falls within PTAL level 6a, which indicates excellent public transport accessibility, and so is considered to be a highly sustainable location.

The site comprises of three separate buildings: the Crown & Sceptre Pub at 2A Streatham Hill, a small unused office building at 1A Streatham Place and a vacant residential dwelling at 3 Streatham Place. A large proportion of the site to the rear of the pub is occupied by a seating area and 14 parking spaces associated with the pub, some of which are currently being used to host mobile food vendors.

The pub comprises a part 1 and part 3 storey building with basement across 852sqm of floorspace, with associated forecourt and a beer garden. It features a large open bar area at ground floor, and the upper levels of the public house are arranged as ancillary residential accommodation in the form of bedsits, which provide accommodation for the pub manager / staff (the principal lawful use of the building is as a public house with ancillary accommodation).

The pub building represents a high-quality example of a Victorian pub, having retained many of its original features. Its siting on the corner of Streatham Place and Streatham Hill contributes to the character of the street.

Although the pub does not carry a statutory listing, it does have local heritage significance and was added to the Council’s Local List in March 2012, which describes the building as a “mid-19th century public house with two storey canted bays and hipped roof. Faïence pub front. Landmark on South Circular. Childhood home of Royal fashion designer Norman Hartnell (1901–1979).” It is locally listed for both its historic interest and its townscape value. Further details relating to the pub’s heritage significance are set out in the accompanying Heritage, Townscape & Visual Assessment.

The vacant building at 1A Streatham Place forms part of the site along the South Circular Road. While not currently in use, it has historically consisted of a motor mechanics at ground floor level with office space at first floor level. As confirmed by Enforcement Notice ref: 15/00880/3COU (included in Appendix 1 of this Statement), the lawful use of the entire building is E(g)(i). The building’s form is inconsistent with the pattern and architectural style of the terraced residential buildings along Streatham Place, and so it detracts from the existing streetscape.

3 Streatham Place, a dwelling house located adjacent to the vacant building, is also part of the site and forms the site’s western boundary. As with 1A Streatham Place, its inconsistent architectural style and siting weakens the building line and streetscape of the South Circular Road and detracts from the character of the area.

## Surrounding area

The wider area is predominantly residential in nature, with scattered commercial retail and community premises in the vicinity. The site is bounded by Streatham Place (A205) to the north and Streatham Hill (A23) to the east.

Directly to the west of the site at 2-11b Streatham Place, is a terrace of flats and dwellinghouses of mixed architectural styles, ranging from late Victorian brick houses to late 20th century modern buildings. The opposite corner plot to the north (across Streatham Place) is currently vacant and is adjacent to the Brixton Hill/New Park Road designated Loal Centre. This leads northwards to a terrace of retail units with residential flats above. Leading west on the northern side of Streatham Place is a single storey McDonald’s restaurant and car park.

To the north-east of the site is a six-storey residential block (Christchurch House) which is set back from the street frontage. Further east, the corner plot is occupied by open space leading further east along Christchurch Road, with several trees behind

Directly to the south of the Crown and Sceptre is an open space which includes a children’s play area. Further south of this is a part 3, part 4-storey residential block of flats (Claremont Estate) which is set back from the street offering a substantial amount of open space around it.

## Planning policy designations

The site is subject to the following designations as identified in the Lambeth Local Plan (2021) (“LLP”) policies map:

▪ Edge of Centre to Brixton Hill/New Park Road Local Centre (LLP Policy ED6)  
▪ Air Quality Focus Area (Lambeth Air Quality Guidance Notes)  
▪ Local Open Space Deficiency (LLP Policy EN1)  
▪ Locally Listed Building (LLP Policy Q23)  
▪ Archaeological Priority Area (LLP Policy Q23) (only a small part of the front of the site, occupied by the pub, falls within this designation)  
▪ Local Views (LLP Policy Q25)  

The site is not subject to any specific allocations within the LLP.

The site is not located within a Conservation Area, but is in close proximity to both the Brixton Hill & Rush Common Conservation Area (CA49) and the Streatham High Road and Streatham Hill Conservation Area (CA54). The following listed buildings are in proximity to the site.

---

Write the {{DOCUMENT_TYPE}} now, following the structure set out in the guiding brief above, with two exceptions:

- Do not write a Planning Policy section, or any heading resembling "Planning Policy" or "Planning Policy Context", or any paragraphs setting out or assessing individual policies. Output the exact text [[POLICY_SECTION]] alone on its own line in its place.
- Do not write a Planning Assessment section, or any heading resembling "Planning Assessment", or any paragraphs weighing the proposal against policy. Output the exact text [[PLANNING_ASSESSMENT_SECTION]] alone on its own line in its place.
- Your finished output must contain both marker strings, each exactly once.

Important:
- Follow the structure described in the guiding brief precisely, other than the two omissions above.
- The marker text must appear exactly as given, alone on its own line, with no heading or other content around it.
- Reference specific policies from the policy context provided — use the exact policy reference numbers and names. Do not cite policies not in the list provided.
- Extract specific detail from the briefing notes — site characteristics, proposal details, technical information, and the planning case.
- Do not invent facts. Every statement must be grounded in the material provided.
- Write in formal planning language appropriate for submission to a local planning authority.
- This document is client-facing: do not reference the briefing notes or internal documents in your output — present all content as established fact.
- Do not number paragraphs (no 1.1, 2.3 etc.).
- Before you finish, check your own output for a "Planning Policy" or "Planning Assessment" heading, or for policy-by-policy assessment prose. If you find any, remove it and replace it with the correct marker — this rule overrides the guiding brief's structure.

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ul>/<li> for bullet points
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- Do not include a document title — start directly with the first section heading
- No markdown characters (**, *, #, ---) and no em dashes (—)$topprompt$
WHERE slug = 'planning_statement_v3';
