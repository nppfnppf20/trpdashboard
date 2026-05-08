-- Seed generation prompts for all Planning Statement sections
-- Variables resolved at generation time:
--   {{PROJECT_NAME}}, {{APPLICANT_NAME}}, {{LPA_NAME}}, {{SITE_ADDRESS}},
--   {{DEVELOPMENT_DESCRIPTION}}, {{ABOUT_APPLICANT}}, {{DOCUMENT_LIST}},
--   {{SITE_SURROUNDINGS}}, {{PLANNING_HISTORY}}, {{PRE_APP_SUMMARY}},
--   {{EIA_SUMMARY}}, {{SCI_SUMMARY}}, {{LOCAL_POLICIES}}, {{NATIONAL_POLICIES}},
--   {{OTHER_POLICIES}}, {{FULL_STATEMENT}} (exec summary + conclusion only)

-- ── Executive Summary ─────────────────────────────────────────────────────────

UPDATE planning_applications.draft_sections
SET generation_prompt = $prompt$
You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority.

Write the Executive Summary for this Planning Statement. This section is generated after the rest of the statement has been prepared and must summarise the key points from the full document — do not introduce new information.

Project data:
- Project: {{PROJECT_NAME}}
- Applicant: {{APPLICANT_NAME}}
- Local Planning Authority: {{LPA_NAME}}
- Site Address: {{SITE_ADDRESS}}
- Description of Development: {{DEVELOPMENT_DESCRIPTION}}

Completed Planning Statement:
{{FULL_STATEMENT}}

The Executive Summary must include:
- The applicant name and the local planning authority
- The site address and the formal description of development
- The main components of the proposed development
- Key development figures (number of homes, floorspace, capacity, operational period, or other relevant metrics)
- The main planning policy position
- The key planning benefits
- Any important planning constraints or issues
- A clear statement of why planning permission should be granted

The tone should be professional, concise, and suitable for the opening section of a submitted Planning Statement. Do not introduce facts not contained in the project data or the completed statement.

Output clean HTML. Use <h2>Executive Summary</h2> as the section heading, then <p> for paragraphs and <ul>/<li> for lists only. No other tags or attributes.
$prompt$
WHERE slug = 'executive_summary'
  AND draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement');


-- ── Introduction (2.1 About Applicant · 2.2 About LPA · 2.3 Document Scope) ──

UPDATE planning_applications.draft_sections
SET generation_prompt = $prompt$
You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority.

Write the Introduction section of this Planning Statement. It must cover three subsections in order: About the Applicant, About the Local Planning Authority (if relevant), and Document Scope and Application Documents.

Project data:
- Project: {{PROJECT_NAME}}
- Applicant: {{APPLICANT_NAME}}
- Local Planning Authority: {{LPA_NAME}}
- Site Address: {{SITE_ADDRESS}}
- Description of Development: {{DEVELOPMENT_DESCRIPTION}}

---

SUBSECTION 2.1 — About the Applicant

The following text has been provided by the applicant. Insert it exactly as written. Do not rewrite, shorten, expand, or alter the wording in any way.

{{ABOUT_APPLICANT}}

If no About the Applicant text is provided, insert the placeholder: [About the Applicant text to be inserted]

---

SUBSECTION 2.2 — About the Local Planning Authority

Write a short optional subsection about the local planning authority only if the information provided is directly relevant to the planning case. This may include corporate commitments, climate emergency declarations, housing delivery context, local plan status, or strategic planning objectives. Do not make unsupported claims about the Council. If no relevant LPA context is provided, insert only: [Insert if relevant]

---

SUBSECTION 2.3 — Document Scope and Application Documents

Write an introductory paragraph explaining the purpose and scope of this Planning Statement. State that the document describes the proposed development and assesses it against the development plan, national planning policy, and other material considerations.

Then produce a structured list of application documents using the document log below. Separate the list into: Application Forms and Certificates, Planning and Design Documents, Technical Reports, Drawings and Plans, and Appendices (if relevant). For each document include the document title and consultant or author where available. Do not invent documents or consultant names — use [insert document] or [insert consultant] where information is missing.

Document log:
{{DOCUMENT_LIST}}

---

Output clean HTML. Use <h2>Introduction</h2> for the section heading, <h3> for each subsection (2.1 About the Applicant, 2.2 About the Local Planning Authority, 2.3 Document Scope and Application Documents), <p> for paragraphs, <ul>/<li> for lists. No other tags or attributes.
$prompt$
WHERE slug = 'introduction'
  AND draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement');


-- ── Site, Surroundings and Planning History (3.1 Site · 3.2 History) ─────────

UPDATE planning_applications.draft_sections
SET generation_prompt = $prompt$
You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority.

Write the Site, Surroundings and Planning History section. It must cover a short section introduction, then two subsections: Site and Surroundings, and Planning History.

Project data:
- Project: {{PROJECT_NAME}}
- Applicant: {{APPLICANT_NAME}}
- Local Planning Authority: {{LPA_NAME}}
- Site Address: {{SITE_ADDRESS}}
- Description of Development: {{DEVELOPMENT_DESCRIPTION}}

---

SECTION INTRODUCTION

Write a brief introductory paragraph explaining that this section describes the application site, its surrounding context, relevant planning designations, and the site's planning history. Keep it short — one or two sentences only.

---

SUBSECTION 3.1 — Site and Surroundings

Using the site and surroundings information provided below, write a factual description of the application site and its context.

Include where available: site address and area, existing land use, existing buildings, structures or landscape features, surrounding land uses, nearby roads, railways, watercourses or access routes, nearby settlements or centres, public transport context, landscape or townscape character, nearby residential, commercial, community, agricultural or infrastructure uses, relevant physical constraints, and planning designations affecting the site or nearby area.

Be factual, objective, and concise. Do not make planning arguments or judgements — save those for the Planning Assessment section.

Site and surroundings information:
{{SITE_SURROUNDINGS}}

If no site and surroundings information is provided, insert the placeholder: [Site and surroundings description to be inserted]

---

SUBSECTION 3.2 — Planning History

Using the planning history provided below, summarise relevant previous applications, decisions, screening opinions, enforcement notices, appeals, or nearby comparable decisions.

Where relevant planning history exists, include: application reference, description of development, decision, decision date, whether the permission was implemented (if known), and why the history is relevant to the current application. Where the site has no relevant planning history, state this clearly. Where nearby comparable decisions are relevant, summarise them separately and explain why they are material.

Use a factual tone. Do not overstate the importance of previous decisions.

Planning history:
{{PLANNING_HISTORY}}

If no planning history is provided, state that there is no relevant planning history for the site.

---

Output clean HTML. Use <h2>Site, Surroundings and Planning History</h2> for the section heading, <h3> for each subsection (3.1 Site and Surroundings, 3.2 Planning History), <p> for paragraphs, <ul>/<li> for lists. No other tags or attributes.
$prompt$
WHERE slug = 'site_surroundings'
  AND draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement');


-- ── Proposed Development ──────────────────────────────────────────────────────

UPDATE planning_applications.draft_sections
SET generation_prompt = $prompt$
You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority.

Write The Proposed Development section of this Planning Statement.

Project data:
- Project: {{PROJECT_NAME}}
- Applicant: {{APPLICANT_NAME}}
- Local Planning Authority: {{LPA_NAME}}
- Site Address: {{SITE_ADDRESS}}
- Description of Development: {{DEVELOPMENT_DESCRIPTION}}

Proposed development information:
{{PROPOSED_DEVELOPMENT}}

Start with the formal description of development, then describe the main components of the proposal clearly and factually. Adapt the content to the development type based on the information provided.

For residential or mixed-use schemes this may include: demolition, refurbishment, new buildings, proposed uses, housing units or rooms, commercial or community floorspace, access, parking and cycle parking, servicing and refuse, landscaping, energy and sustainability, and amenity space.

For renewable energy schemes this may include: solar arrays or energy infrastructure, capacity, operational period, inverters, transformers, substations and grid connection, fencing and security, construction period, construction compound, access, landscaping, biodiversity, and decommissioning.

Describe the proposal clearly but do not undertake the detailed policy assessment in this section — that is reserved for the Planning Assessment section. Do not invent specifications, dimensions, capacity figures, or operational details that are not provided.

If no proposed development information is provided, insert the placeholder: [Proposed development description to be inserted]

Output clean HTML. Use <h2>The Proposed Development</h2> as the section heading, <h3> for any subsection headings where helpful, <p> for paragraphs, <ul>/<li> for lists. No other tags or attributes.
$prompt$
WHERE slug = 'proposed_development'
  AND draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement');


-- ── Background to the Proposals (5.1 Pre-App · 5.2 EIA · 5.3 SCI/Other) ─────

UPDATE planning_applications.draft_sections
SET generation_prompt = $prompt$
You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority.

Write the Background to the Proposals section. It must cover a short section introduction then up to three subsections: Pre-Application Discussions, Environmental Impact Assessment (only if relevant), and Statement of Community Involvement (only if relevant).

Project data:
- Project: {{PROJECT_NAME}}
- Applicant: {{APPLICANT_NAME}}
- Local Planning Authority: {{LPA_NAME}}
- Site Address: {{SITE_ADDRESS}}
- Description of Development: {{DEVELOPMENT_DESCRIPTION}}

---

SECTION INTRODUCTION

Write a short introductory paragraph explaining the relevant background to the planning application before the policy assessment. State which background matters are addressed in this section.

---

SUBSECTION 5.1 — Pre-Application Discussions

Using the pre-application information provided, summarise the pre-application engagement undertaken with the local planning authority and any other relevant consultees. Include where known: date of request or meetings, LPA reference, who was involved, the main issues raised, the applicant's response, and how the scheme evolved following the advice. If the LPA raised concerns, explain them fairly and state where they are addressed in the Planning Statement or supporting reports. Do not suggest that officers supported the proposal unless this is confirmed in the information provided.

Pre-application summary:
{{PRE_APP_SUMMARY}}

If no pre-application information is provided, insert the placeholder: [Pre-application discussions to be inserted]

---

SUBSECTION 5.2 — Environmental Impact Assessment

Only include this subsection if EIA information is provided below. If no EIA information is provided, omit this subsection entirely.

Where relevant, explain: the applicable EIA regulations, whether the development falls within Schedule 1 or Schedule 2, why screening or scoping was undertaken, the LPA reference and date of the opinion, whether an Environmental Statement is required, and any key conclusions from the process.

EIA summary:
{{EIA_SUMMARY}}

---

SUBSECTION 5.3 — Statement of Community Involvement

Only include this subsection if community involvement information is provided below. If no SCI information is provided, omit this subsection entirely.

Where relevant, summarise: the purpose of consultation, who was consulted, consultation dates and methods, number of residents or stakeholders contacted, number of attendees or responses, main themes raised, how the applicant responded, and how the scheme changed or how concerns are addressed. Be balanced — include both support and objections where provided.

Community involvement summary:
{{SCI_SUMMARY}}

---

Output clean HTML. Use <h2>Background to the Proposals</h2> for the section heading, <h3> for each subsection heading, <p> for paragraphs, <ul>/<li> for lists. Omit any subsection entirely if its data is not provided. No other tags or attributes.
$prompt$
WHERE slug = 'background'
  AND draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement');


-- ── Planning Policy Context (Local · National · Other) ────────────────────────

UPDATE planning_applications.draft_sections
SET generation_prompt = $prompt$
You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority.

Write the Planning Policy Context section. It must cover a short section introduction, then three subsections: Local Planning Policy, National Planning Policy, and Other Policy and Guidance.

Project data:
- Project: {{PROJECT_NAME}}
- Applicant: {{APPLICANT_NAME}}
- Local Planning Authority: {{LPA_NAME}}
- Site Address: {{SITE_ADDRESS}}
- Description of Development: {{DEVELOPMENT_DESCRIPTION}}

---

SECTION INTRODUCTION

Write a short introductory paragraph referring to Section 38(6) of the Planning and Compulsory Purchase Act 2004 and explaining that applications must be determined in accordance with the development plan unless material considerations indicate otherwise. Identify the development plan documents that apply to this application.

---

SUBSECTION 7.1 — Local Planning Policy

Using the local policies provided, identify the adopted local plan and list the most relevant policies for the proposed development. Group policies by topic where helpful. For each key policy provide a short explanation of why it is relevant to the application. Do not quote long sections of policy unless the wording is essential to the planning case. Do not assess compliance in this section — save that for the Planning Assessment.

Local policies:
{{LOCAL_POLICIES}}

---

SUBSECTION 7.2 — National Planning Policy

Using the national policies provided, summarise the relevant parts of the National Planning Policy Framework and Planning Practice Guidance. Focus only on the national policy themes relevant to this proposal. These may include: sustainable development, housing delivery, renewable energy, Green Belt, design, heritage, transport, flood risk, biodiversity, climate change, rural economy, or amenity. Use paragraph references where provided. Avoid excessive quotation.

National policies:
{{NATIONAL_POLICIES}}

---

SUBSECTION 7.3 — Other Policy and Guidance

Only include this subsection if other policy or guidance is provided below. If nothing is provided, omit this subsection entirely.

Where relevant, identify other material considerations such as: national policy statements, written ministerial statements, supplementary planning documents, London Plan Guidance, design guides, appeal decisions, or emerging policy documents. Explain briefly why each is relevant. Do not introduce case law, appeal decisions, or policy documents not provided in the information below.

Other policies and guidance:
{{OTHER_POLICIES}}

---

Output clean HTML. Use <h2>Planning Policy Context</h2> for the section heading, <h3> for each subsection (7.1 Local Planning Policy, 7.2 National Planning Policy, 7.3 Other Policy and Guidance), <p> for paragraphs, <ul>/<li> for lists. Omit subsection 7.3 if no data is provided. No other tags or attributes.
$prompt$
WHERE slug = 'policy_context'
  AND draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement');


-- ── Conclusion and Planning Balance ──────────────────────────────────────────

UPDATE planning_applications.draft_sections
SET generation_prompt = $prompt$
You are a senior planning consultant writing a formal Planning Statement for submission to a local planning authority.

Write the Conclusion and Planning Balance section. This section is generated after the rest of the statement has been prepared and must draw together the key threads of the planning assessment — do not introduce new information.

Project data:
- Project: {{PROJECT_NAME}}
- Applicant: {{APPLICANT_NAME}}
- Local Planning Authority: {{LPA_NAME}}
- Site Address: {{SITE_ADDRESS}}
- Description of Development: {{DEVELOPMENT_DESCRIPTION}}

Completed Planning Statement:
{{FULL_STATEMENT}}

The Conclusion must:
- Summarise the proposal and its principal planning benefits
- Set out the planning balance having regard to the development plan and material considerations
- Address any constraints or issues identified in the Planning Assessment and explain how they are overcome or outweighed
- State clearly and confidently why planning permission should be granted

The conclusion should be concise and well-structured. It should not simply repeat the Planning Assessment but should draw it together into a coherent planning balance. Use a confident, professional tone appropriate for a submitted Planning Statement.

Output clean HTML. Use <h2>Conclusion and Planning Balance</h2> as the section heading, <p> for paragraphs, <ul>/<li> for lists only where appropriate. No other tags or attributes.
$prompt$
WHERE slug = 'conclusion'
  AND draft_type_id = (SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement');
