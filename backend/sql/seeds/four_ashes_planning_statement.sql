-- ─── Four Ashes Solar Farm — Planning Statement seed data ────────────────────
-- Run in Supabase SQL editor. Safe to re-run (deletes and re-inserts per-type rows).

DO $$
DECLARE
  p_id INTEGER;
BEGIN
  SELECT id INTO p_id
  FROM public.projects
  WHERE project_name ILIKE '%four ashes%'
  LIMIT 1;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Project "Four Ashes" not found — check project_name in the projects table';
  END IF;

  RAISE NOTICE 'Seeding project id: %', p_id;

  -- ── 1. Update core project fields ─────────────────────────────────────────

  UPDATE public.projects SET
    client                   = 'Sunfield Energy Ltd',
    local_planning_authority = '["South Staffordshire Council"]'::jsonb,
    address                  = 'Land at Four Ashes Farm, Wolverhampton Road, Four Ashes, Staffordshire, WV10 7BZ',
    development_description  = 'Installation of a ground-mounted solar photovoltaic (PV) energy generating facility with a generating capacity of up to 49.9MW, together with associated infrastructure including inverter/transformer units, perimeter fencing, CCTV, access tracks, a substation building, grid connection works, and associated landscaping and ecological enhancement works, for an operational period of 35 years.'
  WHERE id = p_id;

  -- ── 2. Document summaries ──────────────────────────────────────────────────

  DELETE FROM planning_applications.document_summaries
  WHERE project_id = p_id
    AND doc_type IN ('about_applicant','proposed_development','site_surroundings','pre_app');

  INSERT INTO planning_applications.document_summaries
    (project_id, title, doc_type, summary_html)
  VALUES

  -- About the Applicant
  (p_id, 'About Sunfield Energy Ltd', 'about_applicant',
  '<p>Sunfield Energy Ltd is a leading UK renewable energy developer specialising in the delivery of large-scale ground-mounted solar photovoltaic projects. Established in 2012, Sunfield has developed and constructed over 400MW of solar capacity across England and Wales, with a further 600MW pipeline at various stages of development.</p>
<p>The company is committed to delivering clean, affordable energy that contributes to the UK''s legally binding net zero targets. Sunfield works in close partnership with local communities, landowners and public bodies to ensure its projects deliver lasting social, environmental and economic benefits to the areas in which they operate.</p>
<p>Sunfield has an established track record of securing planning permission for solar developments across a range of landscapes and planning policy environments, and brings a rigorous approach to environmental assessment, stakeholder engagement and design quality.</p>'),

  -- Proposed Development
  (p_id, 'Proposed Development Description', 'proposed_development',
  '<p>The proposed development comprises a ground-mounted solar photovoltaic (PV) energy generating facility with an installed capacity of up to 49.9MW, to be located on approximately 95 hectares of agricultural land at Four Ashes Farm, South Staffordshire.</p>
<h3>Main Components</h3>
<ul>
<li>Solar PV panels mounted on driven steel posts at a fixed tilt angle of approximately 20–25 degrees, arranged in rows across the site</li>
<li>Inverter and transformer units located at intervals throughout the array</li>
<li>A single substation building containing grid connection and protection equipment</li>
<li>Underground cabling connecting the arrays to the substation</li>
<li>Grid connection works connecting the substation to the local distribution network</li>
<li>A 2.4 metre high perimeter security fence with CCTV cameras at regular intervals</li>
<li>Access tracks of compacted stone to allow maintenance vehicles to reach all parts of the site</li>
<li>A temporary construction compound during the construction period of approximately 9–12 months</li>
</ul>
<h3>Key Figures</h3>
<ul>
<li>Installed capacity: up to 49.9MW</li>
<li>Site area: approximately 95 hectares (array footprint approximately 65 hectares)</li>
<li>Operational period: 35 years, after which all infrastructure will be removed and the land restored to agricultural use</li>
<li>Annual electricity generation: approximately 47,000MWh, sufficient to power approximately 17,000 homes</li>
<li>Carbon savings: approximately 12,000 tonnes of CO2 per annum</li>
</ul>
<h3>Landscaping and Ecology</h3>
<p>The scheme includes a comprehensive landscaping strategy including native hedgerow planting along all boundaries, a 5–10 metre wide grassland buffer between the fence and site boundary, and wildflower seeding under and between the solar arrays. A Biodiversity Net Gain assessment demonstrates a minimum 15% uplift in biodiversity units compared to the baseline.</p>'),

  -- Site and Surroundings
  (p_id, 'Site and Surroundings Assessment', 'site_surroundings',
  '<h3>Site Description and Key Characteristics</h3>
<p>The application site comprises approximately 95 hectares of arable agricultural land at Four Ashes Farm, located to the south of the village of Four Ashes in South Staffordshire. The site is broadly flat with a gentle fall from north to south. The land is currently in active arable cultivation, predominantly grade 3b agricultural land use.</p>
<h3>Surrounding Context and Land Uses</h3>
<p>The site is bounded to the north by Wolverhampton Road (A449), beyond which lies the settlement of Four Ashes with residential properties and a small industrial estate. To the east the site is bounded by Watling Street (A5), a major arterial road. To the south and west the land transitions to open agricultural fields. The wider area is characterised by a mix of agricultural land, scattered farmsteads and semi-rural residential properties.</p>
<h3>Planning Constraints and Designations</h3>
<ul>
<li>The site does not fall within the Green Belt</li>
<li>No part of the site falls within a designated landscape area (AONB, National Park)</li>
<li>No listed buildings are located within the site; the nearest listed building is Four Ashes Hall, approximately 400 metres to the north-west</li>
<li>The site does not overlap with any statutory ecological designations; the nearest SSSI is Belvide Reservoir, approximately 2.5km to the south-west</li>
<li>The site falls within Flood Zone 1 (lowest risk) throughout</li>
</ul>
<h3>Access and Infrastructure</h3>
<p>The site is accessed via an existing farm access off Wolverhampton Road. The A449 and A5 provide good connectivity to the strategic road network. The site is within an area of high voltage grid infrastructure, with a suitable grid connection point identified approximately 1.2km from the site boundary.</p>'),

  -- Pre-application
  (p_id, 'Pre-Application Response Summary', 'pre_app',
  '<h3>Overview of Pre-Application Engagement</h3>
<p>Pre-application discussions were held with South Staffordshire Council between July and October 2024 (LPA Pre-Application Reference: PA/2024/0142). The discussions were attended by the applicant''s planning consultant and the Council''s case officer, with input from the Council''s ecology, landscape and highways officers.</p>
<h3>Key Issues Raised</h3>
<ul>
<li><strong>Landscape and visual impact:</strong> The Council''s landscape officer raised the importance of robust perimeter landscaping to screen views from Wolverhampton Road and from Four Ashes Hall. Officers requested a Landscape and Visual Impact Assessment (LVIA) as part of the application.</li>
<li><strong>Heritage:</strong> The proximity of Four Ashes Hall (Grade II listed) was identified as a key consideration. Officers requested a Heritage Impact Assessment addressing both direct and setting impacts.</li>
<li><strong>Ecology:</strong> The Council''s ecologist noted the potential for the site to support protected species including great crested newts and breeding birds. Phase 1 and Phase 2 ecological surveys were requested.</li>
<li><strong>Highways:</strong> The construction traffic management plan was identified as a key document, with concerns raised about HGV movements on Wolverhampton Road during construction.</li>
</ul>
<h3>Aspects Not Objected To</h3>
<p>Officers confirmed no in-principle objection to the proposed use of the land for solar energy generation, noting South Staffordshire Council''s Climate Emergency Declaration and the support for renewable energy in the adopted Local Plan. The proposed 35-year operational period was noted as consistent with similar consented schemes in the district.</p>
<h3>How Issues Have Been Addressed</h3>
<p>The application has been prepared to directly address the issues raised in pre-application discussions. A full LVIA, Heritage Impact Assessment, Ecological Impact Assessment and Construction Traffic Management Plan are submitted with this application. The scheme design has been refined to incorporate enhanced perimeter planting and to increase the setback from the northern boundary, reducing the potential for visual impact from Wolverhampton Road.</p>');

  -- ── 3. Planning history ────────────────────────────────────────────────────

  DELETE FROM planning_applications.planning_history WHERE project_id = p_id;

  INSERT INTO planning_applications.planning_history
    (project_id, app_reference, description, decision, decision_date, implemented, notes, sort_order)
  VALUES
  (p_id, NULL,
   'The application site has no relevant planning history. The land has been in continuous arable agricultural use.',
   NULL, NULL, NULL, NULL, 0),

  (p_id, '19/00734/FUL',
   'Change of use of agricultural land to solar farm (49.9MW) with associated infrastructure — land at Calf Heath, South Staffordshire (nearby comparable scheme).',
   'Approved', '2020-03-12', TRUE,
   'Consented under Policy EV12 of the South Staffordshire Core Strategy. Inspector found no unacceptable landscape or heritage harm subject to landscaping conditions. Relevant as a material comparable decision in the same LPA district.',
   1);

  -- ── 4. Policies ───────────────────────────────────────────────────────────

  DELETE FROM public.project_policies WHERE project_id = p_id;

  INSERT INTO public.project_policies
    (project_id, policy_reference, policy_name, policy_type, policy_text, relevant_supporting_text, is_key_policy)
  VALUES

  -- National
  (p_id, 'NPPF Paras 157–165', 'Supporting the Transition to a Low Carbon Future', 'national',
   'The planning system should support the transition to a low carbon future in a changing climate, taking full account of flood risk and coastal change. It should help to shape places in ways that contribute to radical reductions in greenhouse gas emissions, minimise vulnerability and improve resilience; encourage the reuse of existing resources; and support renewable and low carbon energy and associated infrastructure.',
   'Paragraph 161 states that when determining planning applications for renewable and low carbon development, local planning authorities should not require applicants to demonstrate the overall need for renewable or low carbon energy, and should approve the application if its impacts are (or can be made) acceptable.',
   TRUE),

  (p_id, 'NPPF Para 174', 'Conserving and Enhancing the Natural Environment', 'national',
   'Planning policies and decisions should contribute to and enhance the natural and local environment by protecting and enhancing valued landscapes, sites of biodiversity or geological value and soils; recognising the intrinsic character and beauty of the countryside.',
   'Relevant to the assessment of landscape and visual impact. The site is not within a nationally designated landscape.',
   FALSE),

  (p_id, 'NPPF Paras 195–202', 'Conserving and Enhancing the Historic Environment', 'national',
   'When considering the impact of a proposed development on the significance of a designated heritage asset, great weight should be given to the asset''s conservation. The more important the asset, the greater the weight should be. Significance can be harmed or lost through alteration or destruction of the heritage asset or development within its setting.',
   'Para 208 is engaged where less than substantial harm to a designated heritage asset is identified — harm must be weighed against public benefits of the proposal.',
   TRUE),

  -- Local
  (p_id, 'Policy EV12', 'Renewable and Low Carbon Energy', 'local',
   'Proposals for renewable and low carbon energy development will be permitted where: (a) the proposal does not have an unacceptable impact on the landscape character and visual amenity of the area; (b) the proposal does not have an unacceptable impact on biodiversity, ecology and nature conservation interests; (c) the proposal does not have an unacceptable impact on heritage assets and their settings; (d) the proposal does not have an unacceptable impact on residential amenity.',
   'South Staffordshire Core Strategy 2012 (as amended). This is the primary local policy against which the application will be assessed. The Council declared a Climate Emergency in 2019.',
   TRUE),

  (p_id, 'Policy NB1', 'Protecting and Enhancing Biodiversity and Geological Conservation', 'local',
   'Development proposals will be expected to conserve and enhance biodiversity. Development that would have an adverse effect on a Site of Special Scientific Interest (SSSI) or ancient woodland will not be permitted. All new development should seek to maintain, enhance or create biodiversity features.',
   'Relevant to the ecological assessment of the scheme. The Ecological Impact Assessment demonstrates no adverse effect on Belvide Reservoir SSSI.',
   FALSE),

  (p_id, 'Policy EQ4', 'Protecting and Enhancing Landscape Character', 'local',
   'Development proposals should conserve or enhance the landscape character and scenic quality of the area. Development that would have an unacceptable adverse effect on the landscape character of the area, including on the setting of settlements, will not be permitted.',
   'Relevant to the LVIA. The scheme has been designed to minimise landscape and visual impact through generous perimeter planting.',
   FALSE),

  (p_id, 'Policy HE1', 'Protecting the Historic Environment', 'local',
   'The Council will require all development to preserve or enhance the character and appearance of the historic environment, including designated and non-designated heritage assets and their settings.',
   'Relevant to the assessment of impact on Four Ashes Hall (Grade II listed building). The Heritage Impact Assessment concludes less than substantial harm.',
   FALSE);

  RAISE NOTICE 'Seed complete for project id: %', p_id;

END $$;
