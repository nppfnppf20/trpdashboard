-- Insert Planning, Design and Access Statement - Solar Farm Template
INSERT INTO planning_deliverables.planning_templates (template_name, template_type, description, template_content, created_by) VALUES
(
  'Planning, Design and Access Statement - Solar Farm',
  'planning_statement_solar',
  'Comprehensive Planning, Design and Access Statement template for solar farm developments with detailed technical and policy sections',
  '{
    "sections": [
      {
        "id": "title",
        "type": "heading",
        "level": 1,
        "content": "«Project_name_name_only__eg_dont_inc» Solar Farm"
      },
      {
        "id": "location",
        "type": "heading",
        "level": 2,
        "content": "«Site_address_including_postcode»"
      },
      {
        "id": "subtitle",
        "type": "heading",
        "level": 2,
        "content": "Planning, Design and Access Statement"
      },
      {
        "id": "applicant",
        "type": "paragraph",
        "content": "Applicant: «Client_or_SPV_name_»"
      },
      {
        "id": "date",
        "type": "paragraph",
        "content": "Date"
      },
      {
        "id": "exec_summary_heading",
        "type": "heading",
        "level": 2,
        "content": "1.0 Executive Summary"
      },
      {
        "id": "exec_summary_intro",
        "type": "paragraph",
        "content": "This Statement is submitted in support of a planning application to «Local_planning_authority». The application is made by «Client_or_SPV_name_»"
      },
      {
        "id": "exec_summary_description",
        "type": "paragraph",
        "content": "The application is for: \"«Detailed_Description_of_Development_»\""
      },
      {
        "id": "exec_summary_address",
        "type": "paragraph",
        "content": "The site address is «Site_address_including_postcode». This includes land for landscaping and biodiversity measures."
      },
      {
        "id": "exec_summary_generation",
        "type": "paragraph",
        "content": "The total generation is approximately «GWh_per_year» Gigawatt hours (GWh) of clean renewable energy each year. This will be enough to power in excess of «Homes_powered_per_year» homes and offset over «Tonnes_of_CO2_offset_per_year_» tonnes of CO2 per year."
      },
      {
        "id": "exec_summary_conclusion",
        "type": "paragraph",
        "content": "This Statement sets out the planning justification for the scheme, concluding that the proposal is in accordance with the renewable energy policies of «Local_planning_authority»s Local Plan and the National Planning Policy Framework (NPPF). The other material planning benefits of the proposal, which should be weighed in support of the proposal in the planning balance, are also set out in the statement."
      },
      {
        "id": "intro_heading",
        "type": "heading",
        "level": 2,
        "content": "2.0 Introduction"
      },
      {
        "id": "intro_text",
        "type": "paragraph",
        "content": "This Planning, Design & Access Statement (PDAS) has been prepared by Third Revolution Projects Ltd on behalf of «Client_or_SPV_name_» (the applicant). It accompanies an application to «Local_planning_authority» for full planning permission for: \"«Detailed_Description_of_Development_»\""
      },
      {
        "id": "intro_capacity",
        "type": "paragraph",
        "content": "The proposed solar farm will have a capacity of «Approximate__export_capacity_MW»MW using solar panels fixed to the ground via metal piles and supporting infrastructure."
      },
      {
        "id": "intro_location",
        "type": "paragraph",
        "content": "The application site is located at «Site_address_including_postcode» as shown on the Location Plan Drawing (xx) illustrated in Figure 1 below."
      },
      {
        "id": "intro_generation",
        "type": "paragraph",
        "content": "The scheme will enable the generation of approximately «GWh_per_year» GWh (Gigawatt hours) of clean renewable energy each year. This is enough to power the equivalent of «Homes_powered_per_year» homes per year."
      },
      {
        "id": "intro_agriculture",
        "type": "paragraph",
        "content": "The site has been designed to enable continued agriculture in the form of grazing of small livestock, such as sheep, while will also considerably enhancing biodiversity by switching from intensive farming to meadow and grazing land. This also allows the soil to rest for the lifespan of the development improving its quality for future farming."
      },
      {
        "id": "intro_duration",
        "type": "paragraph",
        "content": "The scheme will be operational for up to «Proposed_use_duration_years» years and so the application is for «Proposed_use_duration_years» years plus up to 1 additional year each for construction and decommissioning; totalling «Use_duration__1_year_construction_and_1» years. Once decommissioned, the solar panels and associated infrastructure will be completely removed, and the land returned to its former use. The landscape and biodiversity enhancements introduced through this proposal can remain and will be compatible with continued agricultural use."
      },
      {
        "id": "about_applicant_heading",
        "type": "heading",
        "level": 3,
        "content": "2.1 About «Client_or_SPV_name_»"
      },
      {
        "id": "about_applicant_text",
        "type": "paragraph",
        "content": "[Insert summary about the applicant]"
      },
      {
        "id": "document_scope_heading",
        "type": "heading",
        "level": 3,
        "content": "2.2 Document scope and application documents"
      },
      {
        "id": "document_scope_text",
        "type": "paragraph",
        "content": "The PDAS provides a description of the development and an assessment of its compliance with national planning policy, local planning policies and other material considerations, including the surrounding context in which it sits."
      },
      {
        "id": "document_scope_list",
        "type": "paragraph",
        "content": "The following documents have been submitted as part of this application: [Insert document list]"
      },
      {
        "id": "document_scope_drawings",
        "type": "paragraph",
        "content": "The following drawings have been submitted with this application: [Insert drawing list]"
      },
      {
        "id": "site_surroundings_heading",
        "type": "heading",
        "level": 2,
        "content": "3.0 Site Surroundings and Planning History"
      },
      {
        "id": "site_surroundings_sub_heading",
        "type": "heading",
        "level": 3,
        "content": "3.1 Site and surroundings"
      },
      {
        "id": "site_surroundings_text",
        "type": "paragraph",
        "content": "[Insert summary of site and surroundings]"
      },
      {
        "id": "planning_history_heading",
        "type": "heading",
        "level": 3,
        "content": "3.2 Planning history"
      },
      {
        "id": "planning_history_text",
        "type": "paragraph",
        "content": "[Insert planning history details and table]"
      },
      {
        "id": "proposed_dev_heading",
        "type": "heading",
        "level": 2,
        "content": "4.0 The Proposed Development"
      },
      {
        "id": "proposed_dev_intro",
        "type": "paragraph",
        "content": "The proposed development is for the installation and operation of a ground-mounted solar farm of «Approximate__export_capacity_MW»MW (using the Combined Inverter Capacity Method) that will generate and deliver electrical power to the local distribution network."
      },
      {
        "id": "proposed_dev_agriculture",
        "type": "paragraph",
        "content": "The site will be designed to enable continued agricultural use in the form of grazing of animals such as sheep. The existing agricultural use is thus not being lost either permanently or temporarily."
      },
      {
        "id": "proposed_dev_duration",
        "type": "paragraph",
        "content": "The scheme will be operational for up to «Proposed_use_duration_years» years and, therefore, the application is for «Proposed_use_duration_years» years plus up to 1 additional year each for construction and decommissioning, totalling «Use_duration__1_year_construction_and_1» years. The applicant seeks a three-year period by which to commence the development i.e. start the installation works. Once decommissioned, the development will be completely removed and returned to its current use. A construction and decommissioning plan can be prepared via a planning condition, should this be required."
      },
      {
        "id": "capacity_heading",
        "type": "heading",
        "level": 3,
        "content": "4.1 Calculating capacity"
      },
      {
        "id": "capacity_text",
        "type": "paragraph",
        "content": "The following clarification takes account of National Policy Statement EN-3 and the Burnhope solar farm judgement (ref. DM/22/01769/FPA & DM/23/03147/NMA), both relating to how the capacity of a solar farm should be expressed. The solar site capacity is «Approximate__export_capacity_MW»MW. The site contains a total of xx solar inverter cabins, which are used for converting the DC electricity produced by the solar panels into AC power for export to the grid. There are different types of solar inverters of different capacities, which have an aggregate AC rating of «Approximate__export_capacity_MW»MW."
      },
      {
        "id": "solar_arrays_heading",
        "type": "heading",
        "level": 3,
        "content": "4.2 Solar arrays"
      },
      {
        "id": "solar_arrays_text",
        "type": "paragraph",
        "content": "A solar farm consists of solar PV panels organised into arrays alongside ancillary infrastructure. Most of the site will remain open as grassed spacing between rows and field margins. The solar panels will be mounted on galvanised metal frames set into the ground by either direct or screw piling. In order to achieve optimum solar gain, the panels will be oriented in east-west rows with panels facing towards the south. The height of the solar arrays will be approximately «PV_max_panel_height_m» metres from ground level to the top of the back of the panel frame. The lowest edge of the panels will be raised above ground by around xx metres to allow grazing of small livestock underneath and around the frames."
      },
      {
        "id": "inverters_heading",
        "type": "heading",
        "level": 3,
        "content": "4.3 Inverters"
      },
      {
        "id": "inverters_text",
        "type": "paragraph",
        "content": "The development includes solar inverters, which will convert the direct current (DC) electricity output from the solar arrays into usable alternating current (AC) power for the electricity distribution network. There will be approximately [XX] inverter cabins in total, though this may change during detailed design once the choice of equipment is confirmed."
      },
      {
        "id": "substation_heading",
        "type": "heading",
        "level": 3,
        "content": "4.4 Substation and grid connection"
      },
      {
        "id": "substation_text",
        "type": "paragraph",
        "content": "[Insert substation and grid connection details]"
      },
      {
        "id": "fencing_heading",
        "type": "heading",
        "level": 3,
        "content": "4.5 Fencing, security and screening"
      },
      {
        "id": "fencing_text",
        "type": "paragraph",
        "content": "An approximately [XX]m post and wire deer fence will be installed around the development site with small mammal gates and vehicle entrance gates to allow vehicle and pedestrian access (not public access). This will act as the only security fencing within the site. Appropriate safety signage will be displayed on the fencing and gates. Infra-red and/or thermal imaging CCTV cameras will be installed at the fence line to provide security coverage to the site. These cameras will monitor the interior of the site and the gap between the perimeter hedges and fence line. They will not point outside of the site or into any neighbouring properties. No external lighting will be required other than temporarily during construction."
      },
      {
        "id": "utilities_heading",
        "type": "heading",
        "level": 3,
        "content": "4.6 Existing utilities"
      },
      {
        "id": "utilities_text",
        "type": "paragraph",
        "content": "Prior to construction, the presence of any existing utilities or underground cables will be assessed and precautions taken to protect them. Such measures may include temporary goal posts, physical barriers and markings on ground. On-site cabling will be ducted underground at a typical depth of 1 metre."
      },
      {
        "id": "construction_compound_heading",
        "type": "heading",
        "level": 3,
        "content": "4.7 Construction compound"
      },
      {
        "id": "construction_compound_text",
        "type": "paragraph",
        "content": "A temporary construction compound may be created during the construction period to accommodate portacabin-type buildings in addition to providing an area for material storage and construction vehicles to turn around. There will be no need to remove trees or hedgerows and the compound will be entirely removed at the end of the construction phase. As this will be a temporary facility, it does not form part of the planning application."
      },
      {
        "id": "construction_heading",
        "type": "heading",
        "level": 3,
        "content": "4.8 Construction"
      },
      {
        "id": "construction_text",
        "type": "paragraph",
        "content": "The total construction period will be approximately [XX] months including any pre-preparation of the site, fencing, assembly and erection of the photovoltaic arrays, installation of the inverters and grid connection."
      },
      {
        "id": "access_heading",
        "type": "heading",
        "level": 3,
        "content": "4.9 Access"
      },
      {
        "id": "access_text",
        "type": "paragraph",
        "content": "[Insert access details]"
      },
      {
        "id": "landscaping_heading",
        "type": "heading",
        "level": 3,
        "content": "4.10 Landscaping"
      },
      {
        "id": "landscaping_text",
        "type": "paragraph",
        "content": "The application includes additional landscaping and biodiversity measures. These have been formulated together with landscape consultants and ecologists who have been working on the scheme."
      },
      {
        "id": "background_heading",
        "type": "heading",
        "level": 2,
        "content": "5.0 Background to the Proposals"
      },
      {
        "id": "preapp_heading",
        "type": "heading",
        "level": 3,
        "content": "5.1 Pre-application discussions"
      },
      {
        "id": "preapp_text",
        "type": "paragraph",
        "content": "[Insert pre-application discussion details]"
      },
      {
        "id": "eia_heading",
        "type": "heading",
        "level": 3,
        "content": "5.2 Environmental Impact Assessment"
      },
      {
        "id": "eia_text",
        "type": "paragraph",
        "content": "[Insert EIA details]"
      },
      {
        "id": "policy_heading",
        "type": "heading",
        "level": 2,
        "content": "6.0 Planning Policy"
      },
      {
        "id": "policy_intro",
        "type": "paragraph",
        "content": "This section identifies relevant national and development plan policy. The proposed development is assessed against these policies in the subsequent sections."
      },
      {
        "id": "local_policy_heading",
        "type": "heading",
        "level": 3,
        "content": "6.1 Local Planning Policy"
      },
      {
        "id": "local_policy_text",
        "type": "paragraph",
        "content": "Section 38 (6) of the Planning and Compulsory Purchase Act 2004, states that: If regard is to be had to the development plan for the purpose of any determination to be made under the planning acts the determination must be made in accordance with the development plan unless material considerations indicate otherwise. The current Development Plan comprises: [List]"
      },
      {
        "id": "national_policy_heading",
        "type": "heading",
        "level": 3,
        "content": "6.2 National Planning Policy"
      },
      {
        "id": "nppf_heading",
        "type": "heading",
        "level": 3,
        "content": "6.2.1 National Planning Policy Framework"
      },
      {
        "id": "nppf_text",
        "type": "paragraph",
        "content": "The NPPF, updated December 2024, sets out the national planning policies which apply to this proposal. Paragraph 7 states the purpose of the planning system is to contribute to the achievement of sustainable development, which comprises interdependent environmental, economic and social objectives. Paragraph 161 highlights the importance of the role of the planning system in the transition to a low carbon future. Paragraph 168 states that when determining planning applications for renewable energy developments, local planning authorities should not require applicants to demonstrate the overall need for renewable energy, and recognise that even small-scale projects provide a valuable contribution to cutting greenhouse gas emissions."
      },
      {
        "id": "assessment_heading",
        "type": "heading",
        "level": 2,
        "content": "7.0 Planning Assessment"
      },
      {
        "id": "principle_heading",
        "type": "heading",
        "level": 3,
        "content": "7.1 Principle of development"
      },
      {
        "id": "climate_heading",
        "type": "heading",
        "level": 3,
        "content": "7.1.1 Climate change and renewable energy"
      },
      {
        "id": "climate_text",
        "type": "paragraph",
        "content": "In the 21st Century, climate change is a recognised phenomenon of international and global significance. The proposed development will generate approximately «GWh_per_year»GWh of renewable electricity every year, which is enough to power the equivalent of «Homes_powered_per_year» homes in the local area (average yearly power consumption in a UK home of 3.1MWh). The equivalent saving of carbon emission is estimated at «Tonnes_of_CO2_offset_per_year_» tonnes of CO2 every year, thereby making a very significant contribution to climate change targets. It therefore accords with local plan policy xx, the recent WMS and the relevant provisions of the NPPF in this regard."
      },
      {
        "id": "landscape_heading",
        "type": "heading",
        "level": 3,
        "content": "7.2 Landscape and visual effects"
      },
      {
        "id": "landscape_text",
        "type": "paragraph",
        "content": "[Insert landscape and visual effects assessment]"
      },
      {
        "id": "agricultural_heading",
        "type": "heading",
        "level": 3,
        "content": "7.3 Use of agricultural land and food security"
      },
      {
        "id": "agricultural_text",
        "type": "paragraph",
        "content": "[Insert agricultural land assessment]"
      },
      {
        "id": "heritage_heading",
        "type": "heading",
        "level": 3,
        "content": "7.4 Heritage and archaeology"
      },
      {
        "id": "heritage_text",
        "type": "paragraph",
        "content": "[Insert heritage and archaeology assessment]"
      },
      {
        "id": "transport_heading",
        "type": "heading",
        "level": 3,
        "content": "7.5 Transport and access"
      },
      {
        "id": "transport_text",
        "type": "paragraph",
        "content": "[Insert transport and access assessment]"
      },
      {
        "id": "ecology_heading",
        "type": "heading",
        "level": 3,
        "content": "7.6 Ecology"
      },
      {
        "id": "ecology_text",
        "type": "paragraph",
        "content": "[Insert ecology assessment]"
      },
      {
        "id": "design_heading",
        "type": "heading",
        "level": 2,
        "content": "8.0 Design and Access Statement"
      },
      {
        "id": "design_intro",
        "type": "paragraph",
        "content": "This section sets out the steps taken to appraise the context of the site and its surroundings and how the design of the development takes that context into account."
      },
      {
        "id": "design_principles_heading",
        "type": "heading",
        "level": 3,
        "content": "8.1 Design principles, layout, scale and appearance"
      },
      {
        "id": "design_principles_text",
        "type": "paragraph",
        "content": "Principles of good design were applied to the schemes location, layout, scale and appearance to ensure design excellence in accordance with the NPPF and the suite of relevant policies in the Development Plan."
      },
      {
        "id": "conclusion_heading",
        "type": "heading",
        "level": 2,
        "content": "9.0 Conclusion and Planning Balance"
      },
      {
        "id": "conclusion_intro",
        "type": "paragraph",
        "content": "This Planning, Design & Access Statement has been prepared by Third Revolution Projects on behalf of the applicant to accompany a full planning application submitted to «LPA_abbreviation» for the following proposed development: \"«Detailed_Description_of_Development_»\""
      },
      {
        "id": "conclusion_capacity",
        "type": "paragraph",
        "content": "The proposed solar farm will have the generation capacity of approximately «Approximate__export_capacity_MW»MW. This translates into generation of approximately «GWh_per_year» Gigawatt hours (GWh) of clean renewable energy each year, which will be supplied to nearby homes and businesses via a connection to the local electricity grid."
      },
      {
        "id": "conclusion_benefits",
        "type": "paragraph",
        "content": "The scheme would result in generous public benefits which include: Generating enough secure, available and affordable renewable energy to power around «Homes_powered_per_year» homes, thereby supporting the transition to a zero carbon energy system. Contributing to achieving net zero by increasing the generation of renewable energy in accordance with national and local policy. By offsetting «Tonnes_of_CO2_offset_per_year_» tonnes of CO2 every year. Planting of new native trees around the solar farm to deliver biodiversity net gain. Maintains the sites agricultural use while also generating energy and preserving the land for the long term once the development is removed. Economic benefits in the form of farm diversification and providing infrastructure to support the growth and adaptation of businesses."
      },
      {
        "id": "conclusion_final",
        "type": "paragraph",
        "content": "The proposals accord with key NPPF and local plan policies and any adverse impacts can be made acceptable through the mitigation measures included within this application. Therefore, in accordance with paragraphs 11 and 168 of the NPPF, and local policies, we request that planning permission is granted."
      }
    ],
    "placeholders": [
      "Project_name_name_only__eg_dont_inc",
      "Site_address_including_postcode",
      "Client_or_SPV_name_",
      "Local_planning_authority",
      "Detailed_Description_of_Development_",
      "GWh_per_year",
      "Homes_powered_per_year",
      "Tonnes_of_CO2_offset_per_year_",
      "Approximate__export_capacity_MW",
      "Proposed_use_duration_years",
      "Use_duration__1_year_construction_and_1",
      "PV_max_panel_height_m",
      "LPA_abbreviation"
    ]
  }',
  'System'
);

