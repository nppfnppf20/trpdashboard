# Kirkby Moor Solar Farm — Test Seed Data

Project ID (integer): **49**  
Project UUID: **461ea1b7-245d-49e4-a8aa-eaa9bf00be29**

Stage instance IDs: Kick-off=154, HLPV=152, Stage 1 Review=153  
Issue track IDs: landscape=30, ag_land=31, ecology=32, heritage=33, flood=34, noise=35, glint_glare=36, highways=37

---

## Block 1 — Project ✅

```sql
INSERT INTO public.projects (
  project_id, project_name,
  local_planning_authority,
  project_lead, project_manager, project_director,
  address, area, client, client_spv_name,
  sectors, sub_sectors,
  project_type, development_type, development_description,
  designations_on_site, relevant_nearby_designations,
  status,
  lpa_reference, case_officer_name, case_officer_email, case_officer_phone_number,
  submission_date, validation_date, lpa_consultation_end_date, target_determination_date,
  heritage_risk, landscape_risk, ecology_risk, ag_land_risk, renewables_risk,
  heritage_rule_count, landscape_rule_count, ecology_rule_count, ag_land_rule_count, renewables_rule_count,
  comments
) VALUES (
  'TRP-SOL-001', 'Kirkby Moor Solar Farm',
  '["North Lincolnshire Council"]',
  'Josh Rogers', 'Sarah Delaney', 'Tom Ashby',
  'Land at Kirkby Moor Farm, Brigg Road, Kirkby Moor, Lincolnshire, DN20 9QR',
  '85ha',
  'Sunridge Energy Ltd', 'Sunridge (Kirkby Moor) Ltd',
  '["Renewables"]', '["Solar"]',
  'Solar', 'Solar',
  'Proposed ground-mounted solar PV farm comprising approximately 85 hectares of solar panels, BESS, two substation compounds, internal access tracks, and perimeter fencing on arable land near Kirkby Moor, Lincolnshire.',
  'Flood Zone 2 (partial, northern section)',
  'Scheduled Monument (Romano-British field system) approx 600m NW; Grade 3a/3b agricultural land',
  'Instructed',
  'PA/2026/0412', 'Helen Marsh', 'h.marsh@northlincs.gov.uk', '01724 297000',
  '2026-09-15', '2026-09-22', '2026-11-03', '2027-03-15',
  'medium_risk', 'high_risk', 'medium_high_risk', 'high_risk', 'low_risk',
  2, 4, 3, 3, 1,
  'LPA confirmed pre-app engagement preferred. Committee likely given local opposition. Client targeting Q1 2027 determination.'
) RETURNING id, unique_id;
```

---

## Block 2 — Project Information ✅

```sql
INSERT INTO admin_console.project_information (
  project_id, project_code, client_or_spv_name, detailed_description, proposed_use_duration,
  distribution_network, solar_export_capacity, pv_max_panel_height, fence_height,
  pv_clearance_from_ground, number_of_solar_panels, panel_tilt, panel_tilt_direction,
  bess_export_capacity, bess_containers, gwh_per_year, homes_powered, co2_offset, equivalent_cars,
  access_arrangements, access_contact, parking_details, atv_use,
  additional_notes, invoicing_details, sharepoint_link
) VALUES (
  '461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001',
  'Sunridge (Kirkby Moor) Ltd',
  'Ground-mounted solar PV farm on approximately 85ha of arable land. Bifacial mono-crystalline panels, two 66/132kV substations, BESS along the eastern boundary, 2.4m perimeter deer fencing, and internal haul roads. Grid connection to National Grid substation at Brigg via new underground cable.',
  40,
  'National Grid (Northern Lincolnshire)',
  49.9, 3.2, 2.4, 0.6,
  105000, 20, 'South',
  25, 8, 52, 18500, 24500, 4300,
  'Via farm track off B1399 (Brigg Road). Gate code provided by landowner on day of visit. Internal haul road passable in dry conditions; notify PM if visiting after prolonged rain.',
  'David Halston (landowner) – 07711 234567. 48hrs advance notice required.',
  'Limited roadside parking on B1399 verge. Carpool recommended.',
  NULL,
  'Landowner requests no visits before 7:30am. Dogs not permitted on site. Hi-vis and hard hat required in BESS compound area.',
  'Invoice to: Sunridge Energy Ltd, Finance Dept, 3rd Floor, 22 Canary Wharf, London E14 5AB. Obtain PO from Sarah Delaney before each invoice.',
  'https://sunridgeenergy.sharepoint.com/sites/kirkbymoor'
);
```

---

## Block 3 — Stage Instances ✅

```sql
INSERT INTO admin_console.project_stage_instances (
  project_id, stage_definition_id, is_applicable, is_complete,
  target_date, completed_at, completed_by, project_display_order
)
SELECT
  49, psd.id,
  TRUE,
  psd.display_order IN (1, 2, 3),
  CASE psd.display_order
    WHEN 1 THEN '2026-05-20'::DATE WHEN 2 THEN '2026-06-03'::DATE
    WHEN 3 THEN '2026-06-17'::DATE WHEN 4 THEN '2026-07-15'::DATE
    WHEN 5 THEN '2026-08-01'::DATE WHEN 6 THEN '2026-08-15'::DATE
    WHEN 7 THEN '2026-09-15'::DATE ELSE NULL END,
  CASE psd.display_order
    WHEN 1 THEN '2026-05-20 14:30+00'::TIMESTAMPTZ
    WHEN 2 THEN '2026-06-03 16:00+00'::TIMESTAMPTZ
    WHEN 3 THEN '2026-06-17 11:15+00'::TIMESTAMPTZ ELSE NULL END,
  CASE psd.display_order
    WHEN 1 THEN 'Josh Rogers' WHEN 2 THEN 'Josh Rogers'
    WHEN 3 THEN 'Sarah Delaney' ELSE NULL END,
  psd.display_order::FLOAT
FROM admin_console.project_stage_definitions psd
WHERE psd.project_type_filter IS NULL
RETURNING id, stage_definition_id;
```

---

## Block 4 — Issue Tracks ✅

```sql
INSERT INTO admin_console.project_issue_tracks
  (project_id, track_type, source_key, label, sort_order, is_key_issue, is_active, created_from_hlpv, last_known_risk_level, discipline)
VALUES
  (49, 'discipline', 'landscape',   'Landscape and Visual', 1, TRUE,  TRUE, FALSE, 'high_risk',        'Landscape and Visual'),
  (49, 'discipline', 'ag_land',     'Agricultural Land',    2, TRUE,  TRUE, FALSE, 'high_risk',        'Agricultural Land'),
  (49, 'discipline', 'ecology',     'Ecology',              3, FALSE, TRUE, FALSE, 'medium_high_risk', 'Ecology'),
  (49, 'discipline', 'heritage',    'Heritage',             4, FALSE, TRUE, FALSE, 'medium_risk',      'Heritage'),
  (49, 'discipline', 'flood',       'Flood and Drainage',   5, FALSE, TRUE, FALSE, 'medium_risk',      'Flood and Drainage'),
  (49, 'discipline', 'noise',       'Noise',                6, FALSE, TRUE, FALSE, 'medium_low_risk',  'Noise'),
  (49, 'discipline', 'glint_glare', 'Glint and Glare',      7, FALSE, TRUE, FALSE, 'medium_low_risk',  'Glint & Glare'),
  (49, 'discipline', 'highways',    'Transport',            8, FALSE, TRUE, FALSE, 'low_risk',         'Transport')
RETURNING id, source_key;
```

---

## Block 5 — Issue Stage Entries ✅

```sql
INSERT INTO admin_console.project_issue_stage_entries
  (project_stage_instance_id, issue_track_id, risk_level, summary, notes, updated_by, notes_llm_suggested)
VALUES
  (154, 30, 'high_risk',        'Open flat landscape, limited screening. Cumulative impact with consented scheme 2km SW.', 'LVIA, ZTV and photomontages from agreed viewpoints required.', 'Josh Rogers', FALSE),
  (154, 31, 'high_risk',        'Mixed Grade 3a/3b. LPA flagged ALC as material consideration.', 'Detailed ALC survey likely required.', 'Josh Rogers', FALSE),
  (154, 32, 'medium_high_risk', 'Barn owl foraging habitat potential. Water vole survey required along northern watercourse.', 'Extended Phase 1 required; Phase 2 surveys likely.', 'Josh Rogers', FALSE),
  (154, 33, 'medium_risk',      'Scheduled Monument (Romano-British) approx 600m NW. No listed buildings within 1km.', 'Heritage Impact Assessment required including setting assessment.', 'Josh Rogers', FALSE),
  (154, 34, 'medium_risk',      'Northern section within Flood Zone 2.', 'FRA required; drainage strategy to be agreed with LLFA.', 'Josh Rogers', FALSE),
  (154, 35, 'medium_low_risk',  'BESS inverters/transformers. Nearest receptor approx 250m.', 'BS 4142 noise assessment required.', 'Josh Rogers', FALSE),
  (154, 36, 'medium_low_risk',  'Two residential properties and minor road within glint corridor.', 'Glint and glare assessment required.', 'Josh Rogers', FALSE),
  (154, 37, 'low_risk',         'Access via B1399 farm track. No significant highway issues anticipated.', 'Transport statement required.', 'Josh Rogers', FALSE),

  (152, 30, 'high_risk',        'HLPV confirms high sensitivity. 7 LVIA viewpoints agreed with LPA at scoping.', 'Cumulative ZTV to include consented Sturton scheme.', 'Josh Rogers', FALSE),
  (152, 31, 'high_risk',        'Potential Grade 3a confirmed in western parcel. ALC survey commissioned.', 'Pickstock Consulting commissioned; results expected July 2026.', 'Josh Rogers', FALSE),
  (152, 32, 'medium_high_risk', 'Phase 1 complete. Barn owl surveys triggered (3 visits May-Aug). Water vole eDNA planned June.', 'Surveys on programme. No showstoppers at this stage.', 'Josh Rogers', FALSE),
  (152, 33, 'medium_risk',      'HIA scoping agreed with Historic England. Setting assessment to cover 1km radius.', 'No issues with SM itself; setting significance is key question.', 'Josh Rogers', FALSE),
  (152, 34, 'medium_risk',      'FRA scoping confirmed with EA. Sequential/exception tests not required.', 'Surface water drainage strategy in development; infiltration testing underway.', 'Josh Rogers', FALSE),
  (152, 35, 'medium_low_risk',  'Background noise monitoring ongoing at Bramble Cottage (250m). 4-week campaign.', 'No issues anticipated.', 'Josh Rogers', FALSE),
  (152, 36, 'medium_low_risk',  'Glint corridor confirmed: 2 residential receptors and 400m of B1399.', 'Assessment to confirm significance; mitigation planting likely.', 'Josh Rogers', FALSE),
  (152, 37, 'low_risk',         'Swept path confirms B1399 access suitable for construction traffic.', 'No off-site highway improvements required.', 'Josh Rogers', FALSE),

  (153, 30, 'high_risk',        'LVIA draft reviewed. Moderate Adverse on 3 northern viewpoints. LPA may require additional screening.', 'Client reviewing additional native hedge belt on southern boundary.', 'Sarah Delaney', FALSE),
  (153, 31, 'medium_high_risk', 'ALC results: western parcel Grade 3a (32ha), eastern Grade 3b/4. Significant but not showstopper.', 'Exception test not triggered. Policy justification to be drafted in Planning Statement.', 'Sarah Delaney', FALSE),
  (153, 32, 'medium_risk',      'Water vole confirmed. BNG: 27% uplift achievable. Barn owl final visit outstanding (August).', 'Water vole mitigation plan agreed in principle with NE.', 'Sarah Delaney', FALSE),
  (153, 33, 'medium_risk',      'HIA draft submitted. Historic England no objection in principle.', 'Monitoring condition expected. No significant issues.', 'Sarah Delaney', FALSE),
  (153, 34, 'medium_low_risk',  'FRA draft agreed with EA. Surface water via swales and retention basins.', 'FRA substantially agreed. Final version to be issued for submission.', 'Sarah Delaney', FALSE),
  (153, 35, 'medium_low_risk',  'BESS noise: 38dB(A) vs 34dB(A) background. Moderate adverse under BS 4142 without mitigation.', 'BESS acoustic enclosures to be specified. Updated assessment required post-enclosure spec.', 'Sarah Delaney', FALSE),
  (153, 36, 'low_risk',         'Glint 4 mins at sunrise in January at Bramble Cottage only. Negligible significance.', 'No mitigation required. Assessment complete.', 'Sarah Delaney', FALSE),
  (153, 37, 'low_risk',         'TA agreed with Highways Officer. No off-site works required. CTMP to be conditioned.', 'No transport objections anticipated.', 'Sarah Delaney', FALSE);
```

---

## Block 6 — Issue Notes ✅

```sql
INSERT INTO planning_applications.issue_notes
  (project_id, track_id, policy_national, policy_local, argument_for, argument_against)
VALUES
(49, 30,
 '<p>NPPF Para 165 requires plans to maximise renewable energy potential while addressing adverse impacts including cumulative landscape and visual impacts. NPPG (Ref 5-013-20150327) states the visual impact of a well-planned solar farm can be properly addressed if planned sensitively.</p>',
 '<p>Policy LP17 (North Lincolnshire Local Plan): Development must not cause unacceptable harm to landscape character. Policy LP3 requires cumulative assessment with other consented renewable schemes.</p>',
 '<p>The LVIA demonstrates Moderate Adverse residual effects on 3 of 7 agreed viewpoints, reducing to Minor Adverse by year 5 with proposed native hedge belt. The site lies within the Trent Vale landscape character area, assessed as low sensitivity to solar at this scale. Cumulative ZTV confirms limited overlap with the Sturton scheme due to topographic separation.</p>',
 '<p>LPA landscape officer raised concerns about the 3 northern viewpoints and visual relationship with Kirton village. Additional planting or reduced panel height in the northern parcel may be required.</p>'
),
(49, 31,
 '<p>NPPF Para 187(b) recognises benefits of best and most versatile (BMV) agricultural land. Footnote 65 states poorer quality land should be preferred. WMS (May 2024) on solar and food security directs solar to lower grade land and requires justification for BMV use.</p>',
 '<p>Policy LP7 (North Lincolnshire Local Plan): Development on BMV land only permitted where overriding need demonstrated and no suitable lower-grade alternatives available.</p>',
 '<p>ALC confirms 32ha Grade 3a (western parcel) and 53ha Grade 3b/4. The majority of the site (62%) is not BMV. Infrastructure is concentrated in non-BMV areas. Site selection assessment will demonstrate no suitable lower-grade alternatives within the required grid connection distance.</p>',
 '<p>32ha of Grade 3a land present. The WMS (May 2024) will attract significant weight. LPA policy requires demonstration of no suitable alternatives.</p>'
),
(49, 32,
 '<p>NPPF Chapter 15, Para 193: significant harm to biodiversity cannot be permitted unless avoided, mitigated or compensated. Environment Act 2021 mandates 10% mandatory Biodiversity Net Gain.</p>',
 '<p>Policy LP14 (North Lincolnshire Local Plan): Development must not have unacceptable adverse effect on protected species or habitats. Where unavoidable harm occurs, compensatory habitat creation must exceed habitat lost.</p>',
 '<p>BNG calculation demonstrates 27% net gain, exceeding the 10% statutory requirement. Water vole mitigation strategy agreed in principle with Natural England. New habitats include 12ha species-rich grassland, 3.2km native hedgerow, and 5.5ha wildflower margin under the arrays.</p>',
 '<p>Water vole is a protected species requiring an EPS mitigation licence from Natural England before construction. Licence application adds programme risk.</p>'
),
(49, 33,
 '<p>NPPF Para 195 requires applicants to describe significance of heritage assets including setting contribution. For Scheduled Monuments, substantial harm is unlikely to be acceptable (Para 206).</p>',
 '<p>Policy LP15 (North Lincolnshire Local Plan): Development causing harm to a designated heritage asset or its setting will not be permitted unless harm is necessary to achieve substantial public benefits outweighing the harm.</p>',
 '<p>HIA demonstrates minor adverse effect on Scheduled Monument setting. The asset itself will not be disturbed. Visual connection filtered by intervening topography and hedgerows. Historic England raised no objection in principle at pre-application stage.</p>',
 '<p>Scheduled Monument carries the highest level of protection. LPA conservation officer may apply significant weight to heritage concerns.</p>'
),
(49, 34,
 '<p>NPPF Para 181 and Footnote 63 require FRA for all sites greater than 1ha in Flood Zone 1. Sequential and Exception Tests apply in higher flood zones.</p>',
 '<p>Policy LP6 (North Lincolnshire Local Plan): Development in Flood Zone 2 must pass the Sequential Test and demonstrate the development is safe for its lifetime.</p>',
 '<p>Only 4ha of the site falls within Flood Zone 2, proposed for low-vulnerability use. Sequential Test passed. Exception Test not required. EA confirmed no objection to drainage strategy. Surface water managed via swales at restricted greenfield rate.</p>',
 '<p>EA will require drainage strategy as a pre-commencement condition. Safe access and egress in flood events must be demonstrated.</p>'
),
(49, 35,
 '<p>NPPF Para 198 requires development appropriate for its location taking into account noise effects on health and living conditions. BS 4142:2014+A1:2019 provides the assessment methodology.</p>',
 '<p>Policy LP20 (North Lincolnshire Local Plan): Development must not cause noise levels resulting in significant adverse effects on amenity of nearby residents.</p>',
 '<p>BESS inverter noise at Bramble Cottage (250m): 38dB(A) vs 34dB(A) background (+4dB — moderate adverse without mitigation). BESS acoustic enclosures will achieve -4dB rating level difference (low risk). Updated assessment with enclosure specification in preparation.</p>',
 '<p>Current BS 4142 assessment shows moderate adverse effect without mitigation. Updated assessment with enclosure spec required before submission.</p>'
),
(49, 36,
 '<p>No specific NPPF policy on glint and glare. General amenity policies apply (NPPF Para 135). Natural England guidance advises assessment where panels visible from sensitive receptors.</p>',
 '<p>Policy LP20 (North Lincolnshire Local Plan): Development must not cause visual intrusion or amenity impacts unacceptable to nearby occupiers.</p>',
 '<p>SGHAT methodology confirms glint at Bramble Cottage for approximately 4 minutes at sunrise in January only — negligible significance. No glint effects at other receptors. Road users on B1399 unaffected. No mitigation required.</p>',
 '<p>No significant issues identified. Assessment complete.</p>'
),
(49, 37,
 '<p>NPPF Section 9 promotes sustainable transport. Development only refused on transport grounds where impacts are severe (Para 115).</p>',
 '<p>Policy LP22 (North Lincolnshire Local Plan): Development must not cause unacceptable impacts on highway safety or the operation of the highway network.</p>',
 '<p>Transport Statement confirms max 12 HGV movements per day during peak construction via B1399. Swept path confirms access suitability. Highways Officer confirmed no off-site improvements required. CTMP to be secured by condition.</p>',
 '<p>No transport objections anticipated. TA agreed with Highways Officer.</p>'
);
```

---

## Block 7 — Briefing Transcript ✅

```sql
INSERT INTO planning_applications.document_summaries
  (project_id, title, document_ref, file_name, doc_type, summary_html)
VALUES (
  49,
  'Project Briefing – Kirkby Moor Solar Farm',
  'TRP-SOL-001-BRIEF-001',
  'kirkby_moor_briefing_12may2026.docx',
  'briefing_transcript',
  '<h2>Project Briefing – Kirkby Moor Solar Farm, Lincolnshire</h2>
<p>Meeting held 12 May 2026. Attendees: Josh Rogers (TRP), Sarah Delaney (Client – Sunridge Energy Ltd), Tom Ashby (Project Manager).</p>
<h3>Project Overview</h3>
<p>The project involves a proposed ground-mounted solar photovoltaic (PV) farm on approximately 85 hectares of arable land near the village of Kirkby Moor, Lincolnshire. The site is in agricultural use (Grade 3a/3b mix) and is bounded to the north by a minor watercourse and to the east by a public right of way. The proposed development includes PV panels, a battery energy storage system (BESS), two substation compounds, internal access tracks, and perimeter fencing.</p>
<h3>Key Concerns Raised</h3>
<ul>
  <li><strong>Landscape and Visual Impact:</strong> The site sits within a flat, open agricultural landscape with limited screening. The LPA has raised concerns about cumulative impact with a consented solar scheme approximately 2km to the south-west. A full LVIA will be required, including a ZTV and photomontages from agreed viewpoints.</li>
  <li><strong>Agricultural Land Classification:</strong> Desk study suggests a mix of Grade 3a and 3b land. LPA indicated this is a material consideration.</li>
  <li><strong>Heritage:</strong> There is a Scheduled Monument approximately 600m to the north-west (Romano-British field system). A Heritage Impact Assessment will be required.</li>
  <li><strong>Ecology:</strong> Preliminary ecological assessment identified potential barn owl foraging habitat. Water vole survey required along the northern watercourse.</li>
  <li><strong>Flood and Drainage:</strong> Part of the site falls within Flood Zone 2. A Flood Risk Assessment will be required.</li>
  <li><strong>Glint and Glare:</strong> Two properties and a minor road within the potential glint corridor.</li>
  <li><strong>Noise:</strong> BESS transformers and inverters are a concern for a residential receptor approximately 250m from the nearest BESS unit. BS 4142 assessment required.</li>
</ul>
<h3>Programme</h3>
<p>Target submission Q1 2027. Client wants draft reports for internal review by end of October 2026. Site visits to be coordinated for early June 2026 to allow summer ecology surveys to proceed on programme.</p>
<h3>Access</h3>
<p>Access via a farm track off the B1399. Landowner (Mr David Halston, contact via client) will provide access on pre-arranged dates. 48hrs advance notice required. ATVs not available.</p>
<h3>Other Notes</h3>
<p>Client SPV is Sunridge (Kirkby Moor) Ltd. Invoicing to Sunridge Energy Ltd, Finance Department. SharePoint folder to be shared by client within the week.</p>'
);
```

---

## Block 8 — Document Log ✅

```sql
INSERT INTO planning_applications.document_log (project_id, title, code, document_summary, argument_points, item_type)
VALUES
  (49, 'Design and Access Statement', 'DAS-001',
   'Sets out the design evolution, layout rationale, access strategy, and construction methodology.',
   '[{"point":"Site layout designed to avoid the FZ2 area and minimise Grade 3a land affected."},{"point":"Panel height and spacing allows continued grazing under arrays."}]',
   'document'),
  (49, 'Landscape and Visual Impact Assessment', 'LVIA-001',
   'Full LVIA including ZTV, photomontages from 7 agreed viewpoints, and cumulative assessment.',
   '[{"point":"Residual effects Moderate Adverse on 3 northern viewpoints, reducing to Minor Adverse by year 5 with planting."},{"point":"Cumulative ZTV confirms limited overlap with Sturton scheme."}]',
   'document'),
  (49, 'Agricultural Land Classification Survey Report', 'ALC-001',
   'Detailed ALC survey confirming Grade 3a (32ha, western parcel) and Grade 3b/4 (53ha).',
   '[{"point":"62% of site is not BMV land."},{"point":"Infrastructure concentrated in non-BMV areas."}]',
   'document');
```

---

## Block 9 — Surveyor Organisations ✅

IDs:
- Heritage: `a8c53ea6-904d-408e-b202-6ce2c94b96f6`
- Landscape: `744acf07-ab97-45e1-9e7b-abf63042be87`
- Ecology: `587da500-09b9-4f7d-ab84-e5d109f7d6a5`
- Agricultural Land: `f631cd6d-1c83-4663-8732-84a29474fa5c`
- Flood and Drainage: `eeb12c81-41b6-4eca-bfb0-d99cb16cf56e`
- Noise: `ea0de91e-1b7d-45f2-b41f-d62db8fcc2e3`
- Glint & Glare: `c350238e-daa8-46d5-8d05-d14bdd30143f`
- Transport: `50fcc76a-ef31-4e5f-8a5a-78a6e0211120`

```sql
INSERT INTO admin_console.surveyor_organisations (id, organisation, discipline, location, approval_status, small_business, notes)
VALUES (gen_random_uuid(), 'Cavendish Heritage Consultants', 'Heritage', 'Lincoln, East Midlands', 'approved', NULL, 'Specialist in Romano-British heritage. Strong track record with Historic England on solar projects.')
RETURNING id, organisation;

INSERT INTO admin_console.surveyor_organisations (id, organisation, discipline, location, approval_status, small_business, notes)
VALUES (gen_random_uuid(), 'Trent Landscape Partnership', 'Landscape and Visual', 'Nottingham, East Midlands', 'approved', NULL, 'Extensive LVIA experience for solar in the Trent Vale character area.')
RETURNING id, organisation;

INSERT INTO admin_console.surveyor_organisations (id, organisation, discipline, location, approval_status, small_business, notes)
VALUES (gen_random_uuid(), 'Green Arc Ecology', 'Ecology', 'Grimsby, Lincolnshire', 'approved', NULL, 'Licensed for barn owl, water vole and GCN. Good local contacts with NE regional team.')
RETURNING id, organisation;

INSERT INTO admin_console.surveyor_organisations (id, organisation, discipline, location, approval_status, small_business, notes)
VALUES (gen_random_uuid(), 'Pickstock Agricultural Consultants', 'Agricultural Land', 'Grantham, Lincolnshire', 'approved', NULL, 'Specialist ALC surveyors. Efficient and reliable.')
RETURNING id, organisation;

INSERT INTO admin_console.surveyor_organisations (id, organisation, discipline, location, approval_status, small_business, notes)
VALUES (gen_random_uuid(), 'Drainflow Consulting Engineers', 'Flood and Drainage', 'Hull, Yorkshire', 'approved', NULL, 'Hydrological engineers specialising in FRAs for low-lying Lincolnshire/Yorkshire sites.')
RETURNING id, organisation;

INSERT INTO admin_console.surveyor_organisations (id, organisation, discipline, location, approval_status, small_business, notes)
VALUES (gen_random_uuid(), 'Acoustica Solutions Ltd', 'Noise', 'Sheffield, Yorkshire', 'approved', NULL, 'BESS-specific noise experience. BS 4142 and ETSU specialists.')
RETURNING id, organisation;

INSERT INTO admin_console.surveyor_organisations (id, organisation, discipline, location, approval_status, small_business, notes)
VALUES (gen_random_uuid(), 'SolarGlare Assessors Ltd', 'Glint & Glare', 'Leeds, Yorkshire', 'approved', NULL, 'Specialist solar glint/glare. SGHAT methodology. Rapid turnaround.')
RETURNING id, organisation;

INSERT INTO admin_console.surveyor_organisations (id, organisation, discipline, location, approval_status, small_business, notes)
VALUES (gen_random_uuid(), 'Meridian Transport Planning', 'Transport', 'Lincoln, East Midlands', 'approved', NULL, 'Strong relationship with North Lincolnshire Highways.')
RETURNING id, organisation;
```

---

## Block 10 — Contacts ✅

IDs:
- Dr Rachel Moorfield (Heritage): `8ed5edd6-e1dd-47f8-aa8f-cf13708baa4a`
- Ben Halliwell (Landscape): `f50adb1e-a959-4fdd-be68-2b35bf0ec758`
- Lisa Carver (Ecology): `71040e60-efac-49f7-bc0d-21a32c57d53e`
- James Pickstock (ALC): `9772658a-d758-4551-856b-33641ee7408a`
- Dr Fiona Hartley (Flood): `b26ead22-b5b6-4f64-a5e9-315c83d61bc9`
- Marcus Webb (Noise): `60fb7e2e-d020-4cb1-816b-9ac5ee4ef7d7`
- Claire Doughty (Glint): `d74203a1-5442-4bca-b3bb-18ae9cd74574`
- Neil Thwaites (Transport): `27cb894c-f1cd-46d4-9bdc-65c72508509f`

```sql
INSERT INTO admin_console.contacts (id, name, email, phone_number, organisation_id, organisation_type, is_primary)
VALUES (gen_random_uuid(), 'Dr Rachel Moorfield', 'r.moorfield@cavendishheritage.co.uk', '01522 887100', 'a8c53ea6-904d-408e-b202-6ce2c94b96f6', 'surveyor', TRUE);
INSERT INTO admin_console.contacts (id, name, email, phone_number, organisation_id, organisation_type, is_primary)
VALUES (gen_random_uuid(), 'Ben Halliwell', 'b.halliwell@trentlandscape.co.uk', '0115 9412200', '744acf07-ab97-45e1-9e7b-abf63042be87', 'surveyor', TRUE);
INSERT INTO admin_console.contacts (id, name, email, phone_number, organisation_id, organisation_type, is_primary)
VALUES (gen_random_uuid(), 'Lisa Carver', 'l.carver@greenarcecology.co.uk', '01472 365100', '587da500-09b9-4f7d-ab84-e5d109f7d6a5', 'surveyor', TRUE);
INSERT INTO admin_console.contacts (id, name, email, phone_number, organisation_id, organisation_type, is_primary)
VALUES (gen_random_uuid(), 'James Pickstock', 'j.pickstock@pickstockalc.co.uk', '01476 223400', 'f631cd6d-1c83-4663-8732-84a29474fa5c', 'surveyor', TRUE);
INSERT INTO admin_console.contacts (id, name, email, phone_number, organisation_id, organisation_type, is_primary)
VALUES (gen_random_uuid(), 'Dr Fiona Hartley', 'f.hartley@drainflow.co.uk', '01482 776600', 'eeb12c81-41b6-4eca-bfb0-d99cb16cf56e', 'surveyor', TRUE);
INSERT INTO admin_console.contacts (id, name, email, phone_number, organisation_id, organisation_type, is_primary)
VALUES (gen_random_uuid(), 'Marcus Webb', 'm.webb@acousticasolutions.co.uk', '0114 3218800', 'ea0de91e-1b7d-45f2-b41f-d62db8fcc2e3', 'surveyor', TRUE);
INSERT INTO admin_console.contacts (id, name, email, phone_number, organisation_id, organisation_type, is_primary)
VALUES (gen_random_uuid(), 'Claire Doughty', 'c.doughty@solarglare.co.uk', '0113 2309900', 'c350238e-daa8-46d5-8d05-d14bdd30143f', 'surveyor', TRUE);
INSERT INTO admin_console.contacts (id, name, email, phone_number, organisation_id, organisation_type, is_primary)
VALUES (gen_random_uuid(), 'Neil Thwaites', 'n.thwaites@meridiantransport.co.uk', '01522 546700', '50fcc76a-ef31-4e5f-8a5a-78a6e0211120', 'surveyor', TRUE);
```

---

## Block 11 — Quotes ✅

IDs:
- Heritage: `662eaada-da80-4464-93a4-591581960c56`
- Landscape and Visual: `f4dab370-ad9c-4b76-ba3c-033680b2972c`
- Ecology: `5bbac585-7d59-4cfe-885a-eb2923620a81`
- Agricultural Land: `c72b19ae-205b-43c4-b45c-ce56cbe97346`
- Flood and Drainage: `6d49b7e8-34fb-423c-8682-51673f81b941`
- Noise: `f04ca91c-ab73-4990-bee8-d95fb29f1316`
- Glint & Glare: `923dd02f-fd4c-44b4-a509-05f2b29ade0a`
- Transport: `ad6f4e76-0e34-4de9-96d2-2a0a46a41602`

```sql
INSERT INTO admin_console.quotes
  (project_id, project_code, surveyor_organisation_id, contact_id, discipline, total, quote_notes, date, instruction_status, work_status, status, site_visit_date, report_draft_date, operational_notes, quality, responsiveness, delivered_on_time, overall_review, review_notes, review_date)
VALUES ('461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'a8c53ea6-904d-408e-b202-6ce2c94b96f6', '8ed5edd6-e1dd-47f8-aa8f-cf13708baa4a', 'Heritage', 4850.00,
  'Fixed fee. Includes 1 round of revisions.', '2026-05-20', 'instructed', NULL, 'active', '2026-06-10', '2026-08-28',
  'Rachel completed site visit 10 June. Draft HIA received 28 Aug on programme. Historic England confirmed no objection.',
  4, 5, 1, 4, 'Good quality work, responsive throughout. Minor delay on final but manageable.', NOW());

INSERT INTO admin_console.quotes
  (project_id, project_code, surveyor_organisation_id, contact_id, discipline, total, quote_notes, date, instruction_status, work_status, status, site_visit_date, report_draft_date, operational_notes)
VALUES ('461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', '744acf07-ab97-45e1-9e7b-abf63042be87', 'f50adb1e-a959-4fdd-be68-2b35bf0ec758', 'Landscape and Visual', 12400.00,
  'Fixed fee includes ZTV, 7 photomontages, and cumulative assessment. Travel expenses capped at £500.', '2026-05-20', 'instructed', NULL, 'active', '2026-06-05', '2026-10-15',
  'Ben conducting viewpoint assessment w/c 5 June. Wireframes expected end of July. Final LVIA due mid-October.');

INSERT INTO admin_console.quotes
  (project_id, project_code, surveyor_organisation_id, contact_id, discipline, total, quote_notes, date, instruction_status, work_status, status, site_visit_date, report_draft_date, operational_notes)
VALUES ('461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', '587da500-09b9-4f7d-ab84-e5d109f7d6a5', '71040e60-efac-49f7-bc0d-21a32c57d53e', 'Ecology', 9200.00,
  'Includes Extended Phase 1, barn owl (3 visits), water vole eDNA, and BNG calculation.', '2026-05-20', 'instructed', NULL, 'active', '2026-06-03', '2026-09-30',
  'Lisa on site 3 June for Phase 1 walkover. Barn owl visit 1 of 3 complete. Water vole eDNA survey booked 14 June.');

INSERT INTO admin_console.quotes
  (project_id, project_code, surveyor_organisation_id, contact_id, discipline, total, quote_notes, date, instruction_status, work_status, status, site_visit_date, report_draft_date, operational_notes, quality, responsiveness, delivered_on_time, overall_review, review_notes, review_date)
VALUES ('461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'f631cd6d-1c83-4663-8732-84a29474fa5c', '9772658a-d758-4551-856b-33641ee7408a', 'Agricultural Land', 3600.00,
  'Fixed fee includes soil sampling (50 cores), lab analysis, and ALC report.', '2026-05-20', 'instructed', NULL, 'active', '2026-06-08', '2026-07-25',
  'James completed soil sampling 8 June. ALC report received 24 July ahead of schedule.',
  5, 5, 1, 5, 'Excellent. Ahead of schedule and thorough report. Highly recommended.', NOW());

INSERT INTO admin_console.quotes
  (project_id, project_code, surveyor_organisation_id, contact_id, discipline, total, quote_notes, date, instruction_status, work_status, status, site_visit_date, report_draft_date, operational_notes)
VALUES ('461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'eeb12c81-41b6-4eca-bfb0-d99cb16cf56e', 'b26ead22-b5b6-4f64-a5e9-315c83d61bc9', 'Flood and Drainage', 5500.00,
  'Includes FRA, sequential test, drainage strategy, and infiltration testing.', '2026-05-20', 'instructed', NULL, 'active', '2026-06-12', '2026-09-30',
  'Fiona on site 12 June for infiltration testing. FRA draft expected end of September.');

INSERT INTO admin_console.quotes
  (project_id, project_code, surveyor_organisation_id, contact_id, discipline, total, quote_notes, date, instruction_status, work_status, status, site_visit_date, report_draft_date, operational_notes)
VALUES ('461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'ea0de91e-1b7d-45f2-b41f-d62db8fcc2e3', '60fb7e2e-d020-4cb1-816b-9ac5ee4ef7d7', 'Noise', 4200.00,
  'Includes 4-week background monitoring, BS 4142 assessment, and updated assessment post-enclosure spec.', '2026-05-20', 'instructed', NULL, 'active', '2026-05-28', '2026-10-01',
  'Monitoring equipment installed at Bramble Cottage 28 May. 4-week campaign complete. Draft due Oct.');

INSERT INTO admin_console.quotes
  (project_id, project_code, surveyor_organisation_id, contact_id, discipline, total, quote_notes, date, instruction_status, work_status, status, report_draft_date, operational_notes, quality, responsiveness, delivered_on_time, overall_review, review_notes, review_date)
VALUES ('461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'c350238e-daa8-46d5-8d05-d14bdd30143f', 'd74203a1-5442-4bca-b3bb-18ae9cd74574', 'Glint & Glare', 1800.00,
  'Fixed fee SGHAT assessment. Desk-based only.', '2026-05-20', 'instructed', NULL, 'active', '2026-08-01',
  'Desk-based assessment. Report received 31 July. No mitigation required.',
  5, 5, 1, 5, 'Fast turnaround, clear report, no issues.', NOW());

INSERT INTO admin_console.quotes
  (project_id, project_code, surveyor_organisation_id, contact_id, discipline, total, quote_notes, date, instruction_status, work_status, status, site_visit_date, report_draft_date, operational_notes, quality, responsiveness, delivered_on_time, overall_review, review_notes, review_date)
VALUES ('461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', '50fcc76a-ef31-4e5f-8a5a-78a6e0211120', '27cb894c-f1cd-46d4-9bdc-65c72508509f', 'Transport', 3200.00,
  'Fixed fee. Includes swept path analysis and TA.', '2026-05-20', 'instructed', NULL, 'active', '2026-06-04', '2026-08-15',
  'Neil attended site 4 June. TA agreed with Highways Officer. No off-site improvements required.',
  4, 4, 1, 4, 'Solid work. Good relationship with LHA. Report clear and well-structured.', NOW());
```

---

## Block 12 — Quote Line Items ✅

```sql
INSERT INTO admin_console.quote_line_items (id, quote_id, item, description, cost, is_instructed) VALUES
  (gen_random_uuid(), '662eaada-da80-4464-93a4-591581960c56', 'Desk-based Assessment', 'Archive research, NHLE search, and desk-based heritage assessment', 1800.00, TRUE),
  (gen_random_uuid(), '662eaada-da80-4464-93a4-591581960c56', 'Site Visit', 'Half-day site visit and field survey', 450.00, TRUE),
  (gen_random_uuid(), '662eaada-da80-4464-93a4-591581960c56', 'Heritage Impact Assessment', 'HIA report including setting assessment and photomontage review', 2600.00, TRUE),
  (gen_random_uuid(), 'f4dab370-ad9c-4b76-ba3c-033680b2972c', 'Desk Study & Scoping', 'Landscape character and baseline desk study', 1500.00, TRUE),
  (gen_random_uuid(), 'f4dab370-ad9c-4b76-ba3c-033680b2972c', 'Site Survey', '2 field survey visits and viewpoint photography', 1800.00, TRUE),
  (gen_random_uuid(), 'f4dab370-ad9c-4b76-ba3c-033680b2972c', 'ZTV Production', 'Bare earth and vegetated ZTV (2km and 5km)', 2200.00, TRUE),
  (gen_random_uuid(), 'f4dab370-ad9c-4b76-ba3c-033680b2972c', 'Photomontages', '7 photomontages from agreed viewpoints including wirelines', 4500.00, TRUE),
  (gen_random_uuid(), 'f4dab370-ad9c-4b76-ba3c-033680b2972c', 'LVIA Report', 'Full LVIA report including cumulative assessment', 2400.00, TRUE),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'Extended Phase 1', 'Extended Phase 1 habitat survey and walkover', 2200.00, TRUE),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'Barn Owl Survey', '3-visit barn owl survey (May, June, August)', 2400.00, TRUE),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'Water Vole eDNA', 'Water vole eDNA survey along northern watercourse', 1800.00, TRUE),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'BNG Calculation', 'Biodiversity Net Gain calculation and habitat management plan', 2800.00, TRUE),
  (gen_random_uuid(), 'c72b19ae-205b-43c4-b45c-ce56cbe97346', 'Site Visit & Sampling', 'Site visit, 50 soil core samples, and dispatch to lab', 2200.00, TRUE),
  (gen_random_uuid(), 'c72b19ae-205b-43c4-b45c-ce56cbe97346', 'ALC Report', 'Agricultural Land Classification report with lab results', 1400.00, TRUE),
  (gen_random_uuid(), '6d49b7e8-34fb-423c-8682-51673f81b941', 'Infiltration Testing', 'On-site infiltration testing and permeability data', 900.00, TRUE),
  (gen_random_uuid(), '6d49b7e8-34fb-423c-8682-51673f81b941', 'Flood Risk Assessment', 'FRA including sequential test and climate change allowances', 3000.00, TRUE),
  (gen_random_uuid(), '6d49b7e8-34fb-423c-8682-51673f81b941', 'Drainage Strategy', 'Surface water drainage strategy including swale design', 1600.00, TRUE),
  (gen_random_uuid(), 'f04ca91c-ab73-4990-bee8-d95fb29f1316', 'Background Monitoring', '4-week noise monitoring campaign at Bramble Cottage', 1400.00, TRUE),
  (gen_random_uuid(), 'f04ca91c-ab73-4990-bee8-d95fb29f1316', 'BS 4142 Assessment', 'BS 4142 noise impact assessment for BESS operation', 1800.00, TRUE),
  (gen_random_uuid(), 'f04ca91c-ab73-4990-bee8-d95fb29f1316', 'Updated Assessment', 'Updated assessment following BESS enclosure specification', 1000.00, TRUE),
  (gen_random_uuid(), '923dd02f-fd4c-44b4-a509-05f2b29ade0a', 'SGHAT Assessment', 'Glint and glare assessment using SGHAT methodology for all receptors', 1800.00, TRUE),
  (gen_random_uuid(), 'ad6f4e76-0e34-4de9-96d2-2a0a46a41602', 'Swept Path Analysis', 'AutoTRACK swept path analysis for HGV access at B1399', 800.00, TRUE),
  (gen_random_uuid(), 'ad6f4e76-0e34-4de9-96d2-2a0a46a41602', 'Transport Statement', 'Full transport statement agreed with North Lincolnshire Highways', 2400.00, TRUE);
```

---

## Block 13 — Quote Key Dates ✅

```sql
INSERT INTO admin_console.quote_key_dates (id, quote_id, title, date, colour) VALUES
  (gen_random_uuid(), 'f4dab370-ad9c-4b76-ba3c-033680b2972c', 'Viewpoint Photography',  '2026-06-05', '#4A90D9'),
  (gen_random_uuid(), 'f4dab370-ad9c-4b76-ba3c-033680b2972c', 'Wireframes to Client',   '2026-07-31', '#F5A623'),
  (gen_random_uuid(), 'f4dab370-ad9c-4b76-ba3c-033680b2972c', 'Draft LVIA to TRP',      '2026-10-15', '#7ED321'),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'Phase 1 Walkover',       '2026-06-03', '#4A90D9'),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'Water Vole eDNA Survey', '2026-06-14', '#4A90D9'),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'Barn Owl Visit 2',       '2026-07-10', '#F5A623'),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'Barn Owl Visit 3',       '2026-08-14', '#F5A623'),
  (gen_random_uuid(), '5bbac585-7d59-4cfe-885a-eb2923620a81', 'Ecology Draft to TRP',   '2026-09-30', '#7ED321'),
  (gen_random_uuid(), 'f04ca91c-ab73-4990-bee8-d95fb29f1316', 'Monitoring Collected',   '2026-06-25', '#4A90D9'),
  (gen_random_uuid(), 'f04ca91c-ab73-4990-bee8-d95fb29f1316', 'Draft Assessment to TRP','2026-10-01', '#7ED321'),
  (gen_random_uuid(), '6d49b7e8-34fb-423c-8682-51673f81b941', 'Draft FRA to TRP',       '2026-09-30', '#7ED321');
```

---

## Block 14 — Programme Events ✅

```sql
INSERT INTO admin_console.programme_events (id, project_id, project_code, title, date, colour) VALUES
  (gen_random_uuid(), '461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'Kick-off Meeting',              '2026-05-12', '#4A90D9'),
  (gen_random_uuid(), '461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'Ecology Site Visits Start',     '2026-06-03', '#7ED321'),
  (gen_random_uuid(), '461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'Draft Reports Deadline',        '2026-10-15', '#F5A623'),
  (gen_random_uuid(), '461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'Application Submission Target', '2027-01-15', '#D0021B'),
  (gen_random_uuid(), '461ea1b7-245d-49e4-a8aa-eaa9bf00be29', 'TRP-SOL-001', 'Target Determination Date',     '2027-03-15', '#9B59B6');
```

---

## Block 15 — Sent Quote Request ✅

sent_quote_request id: **19**

```sql
INSERT INTO admin_console.sent_quote_requests
  (project_id, template_id, sent_date, email_content, notes)
VALUES (
  '461ea1b7-245d-49e4-a8aa-eaa9bf00be29',
  (SELECT id FROM admin_console.quote_request_templates WHERE discipline IS NULL LIMIT 1),
  '2026-05-19 09:00:00',
  '<p>Dear Surveyor,</p><p>We are writing to request a quote for the Kirkby Moor Solar Farm project (TRP-SOL-001), North Lincolnshire. The site is approximately 85ha of arable land. Please see the attached project brief for full details. We require quotes for: Heritage, Landscape and Visual, Ecology, Agricultural Land, Flood and Drainage, Noise, Glint and Glare, and Transport.</p><p>Regards,<br>Josh Rogers<br>Third Revolution Projects</p>',
  'Initial round of quote requests sent to all 8 disciplines on project instruction.'
) RETURNING id;

INSERT INTO admin_console.quote_request_recipients (sent_request_id, surveyor_organisation_id, contact_id) VALUES
  (19, 'a8c53ea6-904d-408e-b202-6ce2c94b96f6', '8ed5edd6-e1dd-47f8-aa8f-cf13708baa4a'),
  (19, '744acf07-ab97-45e1-9e7b-abf63042be87', 'f50adb1e-a959-4fdd-be68-2b35bf0ec758'),
  (19, '587da500-09b9-4f7d-ab84-e5d109f7d6a5', '71040e60-efac-49f7-bc0d-21a32c57d53e'),
  (19, 'f631cd6d-1c83-4663-8732-84a29474fa5c', '9772658a-d758-4551-856b-33641ee7408a'),
  (19, 'eeb12c81-41b6-4eca-bfb0-d99cb16cf56e', 'b26ead22-b5b6-4f64-a5e9-315c83d61bc9'),
  (19, 'ea0de91e-1b7d-45f2-b41f-d62db8fcc2e3', '60fb7e2e-d020-4cb1-816b-9ac5ee4ef7d7'),
  (19, 'c350238e-daa8-46d5-8d05-d14bdd30143f', 'd74203a1-5442-4bca-b3bb-18ae9cd74574'),
  (19, '50fcc76a-ef31-4e5f-8a5a-78a6e0211120', '27cb894c-f1cd-46d4-9bdc-65c72508509f');
```
