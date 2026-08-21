Yes, this second example is really helpful because it shows which early sections are **generic across planning statements** and which bits are **project-specific imports**.

The generic first-section structure should probably be:

1. **Executive Summary**
2. **Introduction**
   2.1 About the Applicant
   2.2 About the Local Planning Authority
   2.3 Document Scope and Application Documents
3. **Site Surroundings and Planning History**
   3.1 Site and Surroundings
   3.2 Planning History
4. **The Proposed Development**
5. **Background to the Proposals**
   5.1 Pre-Application Discussions
   5.2 Environmental Impact Assessment / Screening / Scoping, where relevant
   5.3 Other Background Inputs, where relevant
6. **Statement of Community Involvement**, where relevant
7. **Planning Policy Context**
8. **Planning Assessment**
9. **Conclusion and Planning Balance**

For your web app, I would treat **Executive Summary** and **Conclusion** as sections that are generated later, once the rest of the statement exists.

---

## Prompt 1: Executive Summary

Write the Executive Summary for a Planning Statement.

This section should be generated after the rest of the Planning Statement has been prepared, because it must summarise the key points from the full document rather than introduce new information.

Use the completed Planning Statement sections and the project data provided to produce a concise executive summary.

Include:
the applicant name
the local planning authority
the site address
the formal description of development
the main components of the proposed development
the key development figures such as number of homes floorspace megawatts capacity operational period or other relevant metrics
the main planning policy position
the key planning benefits
any important planning constraints or issues
a clear summary of why planning permission should be granted

The tone should be professional concise and suitable for the opening section of a submitted Planning Statement.

Do not introduce new facts that are not contained in the project information or later sections of the statement.

---

## Prompt 2: Introduction

Write the Introduction section of a Planning Statement.

The introduction should explain who has prepared the statement who it is prepared on behalf of what application it supports and what development is proposed.

Include:
the name of the planning consultant or author
the applicant name
the local planning authority
the type of planning application
the formal description of development
the site address
a short summary of the proposed development
any key project figures that help the reader understand the proposal
the purpose of the Planning Statement

The introduction should be factual and clear. It should not repeat the full planning assessment or conclusion.

Use a professional planning consultancy style.

---

## Prompt 3: About the Applicant

This one should be a **verbatim import**, not AI-generated, if you already have standard applicant text.

Insert the approved About the Applicant text exactly as provided.

Do not rewrite summarise shorten expand or alter the wording.

If no approved applicant text is provided insert the placeholder:

[About the Applicant text to be inserted]

---

## Prompt 4: About the Local Planning Authority

This appears in the solar example but not the Crown & Sceptre example. I would make it optional.

Write an optional About the Local Planning Authority subsection.

Use this section only where information about the local planning authority is relevant to the planning case.

Summarise the local planning authority context in a short factual paragraph. This may include:
the local authority name
relevant corporate commitments
climate emergency declarations
housing delivery context
local plan status
strategic planning objectives
other authority-specific context relevant to the proposal

Only include information that is directly relevant to the planning application.

Do not make unsupported claims about the Council. If no relevant information is provided omit this subsection.

---

## Prompt 5: Document Scope and Application Documents

This is a core reusable section. It can import the document log from your planning application tool.

Write the Document Scope and Application Documents subsection.

Start by explaining the purpose and scope of the Planning Statement. State that the document describes the proposed development and assesses it against the development plan national planning policy and other material considerations.

Where relevant state that the document also incorporates or is supported by other statement functions such as a Design and Access Statement Energy Statement or Statement of Community Involvement.

Then create a structured list of application documents using the document log provided.

Separate the list into:
application forms and certificates
planning and design documents
technical reports
drawings and plans
appendices if relevant

For each document include the document title and consultant or author where available.

Do not invent documents or consultant names. If information is missing use [insert document] or [insert consultant].

---

## Prompt 6: Site Surroundings and Planning History Section Intro

Write a short introductory paragraph for the Site Surroundings and Planning History section.

Explain that the section describes the application site its surrounding context relevant planning designations and the site planning history.

The paragraph should be brief and should introduce the factual site context before the planning assessment later in the statement.

Do not assess the planning merits of the proposal in this section.

---

## Prompt 7: Site and Surroundings

This is generic but filled with project-specific data.

Write the Site and Surroundings subsection of a Planning Statement.

Describe the application site and its context using the site information provided.

Include where available:
site address
site area
existing land use
existing buildings structures or landscape features
surrounding land uses
nearby roads railways watercourses or access routes
nearby settlements centres or neighbourhoods
public transport or accessibility context
landscape townscape or rural character
nearby residential commercial community agricultural or infrastructure uses
relevant physical constraints
planning designations affecting the site
nearby heritage ecological flood risk transport or environmental designations

The writing should be factual objective and concise. It should help the reader understand the site and its context before the assessment section.

Do not make unsupported planning arguments. Save detailed planning judgement for the Planning Assessment section.

---

## Prompt 8: Planning History

Write the Planning History subsection.

Use the planning history information provided to summarise relevant previous applications decisions screening opinions enforcement notices appeals or nearby comparable decisions.

Where the site has relevant planning history include:
application reference
description of development
decision
decision date
whether the permission was implemented if known
why the history is relevant to the current application

Where the site has no relevant planning history state this clearly.

Where nearby or comparable planning decisions are relevant summarise them separately and explain why they are material.

Use a factual tone. Do not overstate the importance of previous decisions unless the project information explains why they are relevant.

---

## Prompt 9: The Proposed Development

This section is generic but must adapt heavily depending on development type.

Write The Proposed Development section of a Planning Statement.

Describe what is being applied for in clear factual terms.

Start with the formal description of development.

Then describe the main components of the proposal. Adapt the subsections to the development type.

For residential or mixed use schemes this may include:
demolition
refurbishment
new buildings
proposed uses
housing units or rooms
commercial or community floorspace
access
parking and cycle parking
servicing and refuse
landscaping
energy and sustainability
amenity space

For renewable energy schemes this may include:
solar arrays or energy infrastructure
capacity
operational period
inverters transformers substations and grid connection
fencing gates and security
construction period
construction compound
access
landscaping biodiversity and decommissioning

Explain the proposal clearly but do not undertake the detailed policy assessment in this section.

Use the technical information provided. Do not invent specifications dimensions capacity figures or operational details.

---

## Prompt 10: Background to the Proposals

This section is for imported or summarised project history.

Write the Background to the Proposals section.

This section should explain the relevant background to the planning application before the policy assessment.

Include only the background matters that are relevant to the project. These may include:
pre-application discussions
design evolution
Environmental Impact Assessment screening or scoping
consultation with statutory consultees
technical survey work
site selection process
previous scheme iterations
community engagement
stakeholder feedback

Explain how the proposal has evolved in response to this background where evidence is provided.

Use a factual and balanced tone. Do not overstate agreement with the local planning authority or consultees unless written evidence confirms this.

---

## Prompt 11: Pre-Application Discussions

Write the Pre-Application Discussions subsection.

Summarise the pre-application engagement undertaken with the local planning authority and any other relevant consultees.

Include:
date of request or meetings where known
local planning authority reference where known
who was involved
the main issues raised
the applicant response
how the scheme evolved following the advice

If the local planning authority raised concerns explain those concerns fairly and state where they are addressed in the Planning Statement or supporting technical reports.

Do not suggest that officers supported the proposal unless this is confirmed in the project information.

---

## Prompt 12: Environmental Impact Assessment

This is optional and should only appear if relevant.

Write the Environmental Impact Assessment subsection.

Use this section where an EIA screening opinion scoping opinion or Environmental Statement is relevant.

Explain:
the relevant EIA regulations
whether the development falls within Schedule 1 or Schedule 2
why screening or scoping was undertaken
the local planning authority reference if available
the date of the screening or scoping opinion
whether an Environmental Statement is required
any key conclusions from the screening or scoping process

Use only the information provided. Do not provide legal interpretation beyond the information available.

If EIA is not relevant omit this subsection.

---

## Prompt 13: Statement of Community Involvement

In the Crown example this was inside the Executive Summary/pre-app section. In the solar example it is its own section. So I would make it modular.

Write the Statement of Community Involvement section.

Summarise the public consultation and stakeholder engagement undertaken before submission.

Include:
the purpose of consultation
who was consulted
consultation dates
consultation methods such as letters leaflets website meetings exhibitions presentations or feedback forms
number of residents or stakeholders contacted where known
number of attendees or responses where known
main themes raised in feedback
how the applicant responded to the feedback
how the scheme changed or how concerns are addressed in the application documents

Use subheadings where helpful such as Consultation Overview Consultation Feedback and Summary.

Be balanced. Include both support and objections where provided. Do not claim that feedback was supportive unless the evidence supports this.

---

## Prompt 14: Planning Policy Context

Write the Planning Policy Context section.

Identify the relevant development plan and other material planning considerations.

Start by referring to Section 38 six of the Planning and Compulsory Purchase Act 2004 and explain that applications must be determined in accordance with the development plan unless material considerations indicate otherwise.

Then identify:
the adopted local plan
the London Plan if relevant
neighbourhood plan if relevant
national planning policy
national planning practice guidance
supplementary planning documents
other national regional or local guidance
emerging policy where relevant

Describe the policies in a structured way but do not undertake the detailed assessment in this section.

The detailed assessment should be reserved for the Planning Assessment section.

---

## Prompt 15: Local Planning Policy

Write the Local Planning Policy subsection.

Identify the adopted local plan and list the most relevant policies for the proposed development.

Group policies by topic where helpful.

For each key policy provide a short explanation of why it is relevant to the application.

Do not quote long sections of policy unless the wording is essential to the planning case.

Do not assess compliance in detail in this section. Save that for the Planning Assessment section.

---

## Prompt 16: National Planning Policy

Write the National Planning Policy subsection.

Summarise the relevant parts of the National Planning Policy Framework and Planning Practice Guidance.

Focus only on the national policy themes relevant to the proposal.

These may include:
sustainable development
housing delivery
renewable energy
Green Belt
design
heritage
transport
flood risk
biodiversity
climate change
rural economy
amenity

Use paragraph references where provided.

Avoid excessive quotation. Use short quotations only where the exact policy wording is important.

---

## Prompt 17: Other Policy and Guidance

Write the Other Policy and Guidance subsection.

Identify any other relevant policy guidance or material considerations.

This may include:
national policy statements
written ministerial statements
supplementary planning documents
London Plan Guidance
design guides
validation requirements
technical guidance
appeal decisions or case law where provided
emerging policy documents

Explain briefly why each document or consideration is relevant.

Do not introduce case law appeal decisions or policy documents unless they are provided in the project information.

---

# Key Generic vs Project-Specific Logic

The **generic parts** are:

* the section order
* the role of each section
* the statutory wording around Section 38 six
* the idea that Executive Summary and Conclusion are generated last
* the document scope logic
* the structure of site description planning history proposed development background policy assessment and balance

The **project-specific parts** are:

* applicant identity and boilerplate
* local authority context
* site description
* planning designations
* planning history
* development type
* technical documents
* pre-application feedback
* consultation feedback
* EIA position
* policy list
* planning issues
* planning benefits and harms

So your web app should not have one fixed Planning Statement prompt. It should have **section prompts** that pull from project fields and imported documents.
