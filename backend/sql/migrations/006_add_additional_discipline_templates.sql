-- Migration: Add Additional Discipline Templates and Update Existing Ones
-- Purpose: Add templates for new disciplines and update existing templates with discipline-specific sections
-- Date: 2026-01-13

-- Update existing Heritage template with additional sections
UPDATE admin_console.quote_request_templates
SET template_content = '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Heritage</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

<h3>Project Details</h3>
<ul>
  <li><strong>Project Name:</strong> [PROJECT_NAME]</li>
  <li><strong>Project Code:</strong> [PROJECT_CODE]</li>
  <li><strong>Location:</strong> [ADDRESS]</li>
  <li><strong>Site Area:</strong> [AREA]</li>
  <li><strong>Client:</strong> [CLIENT_NAME]</li>
  <li><strong>Sector:</strong> [SECTOR]</li>
  <li><strong>Project Type:</strong> [PROJECT_TYPE]</li>
</ul>

<h3>Scope of Work</h3>
<p>Please provide a fee quote for the following heritage assessment services:</p>
<ul>
  <li>Desk-based heritage assessment</li>
  <li>Site walkover survey</li>
  <li>Assessment of designated heritage assets (Listed Buildings, Scheduled Monuments, Conservation Areas, Registered Parks & Gardens)</li>
  <li>Assessment of non-designated heritage assets</li>
  <li>Impact assessment and recommendations</li>
  <li>Report preparation</li>
</ul>

<h3>Additional Requirements</h3>
<p>Please also confirm fees and timescales for the following:</p>
<ul>
  <li>Site visit and early advice on suitability of draft layout and relationship with any sensitive receptors. Site visit, survey and early advice on design iterations.</li>
  <li>To advise whether you recommend pre-application discussions with Historic England, the Local Authority Conservation Officer or other relevant statutory consultees.</li>
  <li>Concluding heritage report based on final layout.</li>
  <li>Requirement to advise on multiple design iterations.</li>
  <li>Heritage mitigation and enhancement measures.</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Assessment to be undertaken in accordance with current heritage planning policy and guidance</li>
  <li>Report format suitable for submission with planning applications</li>
  <li>Please indicate any additional services available (e.g., archaeological evaluation, watching brief)</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Estimated timeframes for each stage</li>
  <li>Details of key personnel and their qualifications</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>'
WHERE discipline = 'Heritage';

-- Update existing Landscape template to Landscape and Visual
UPDATE admin_console.quote_request_templates
SET
  template_name = 'Initial Quote Request - Landscape and Visual',
  discipline = 'Landscape and Visual',
  description = 'Standard quote request for landscape and visual impact assessments',
  subject_line = 'Quote Request: Landscape and Visual Impact Assessment - [PROJECT_NAME]',
  template_content = '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Landscape and Visual Impact Assessment</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

<h3>Project Details</h3>
<ul>
  <li><strong>Project Name:</strong> [PROJECT_NAME]</li>
  <li><strong>Project Code:</strong> [PROJECT_CODE]</li>
  <li><strong>Location:</strong> [ADDRESS]</li>
  <li><strong>Site Area:</strong> [AREA]</li>
  <li><strong>Client:</strong> [CLIENT_NAME]</li>
  <li><strong>Sector:</strong> [SECTOR]</li>
  <li><strong>Project Type:</strong> [PROJECT_TYPE]</li>
</ul>

<h3>Scope of Work</h3>
<p>Please provide a fee quote for the following LVIA services:</p>
<ul>
  <li>Baseline landscape character assessment</li>
  <li>Baseline visual assessment including viewpoint selection</li>
  <li>Assessment of landscape designations (AONB, National Parks, Green Belt, etc.)</li>
  <li>Landscape and visual impact assessment</li>
  <li>Viewpoint photography and wireline/photomontage visualisations</li>
  <li>Assessment of cumulative effects</li>
  <li>Landscape mitigation strategy</li>
  <li>LVIA report suitable for planning submission</li>
</ul>

<h3>Additional Requirements</h3>
<p>Please also confirm fees and timescales for the following:</p>
<ul>
  <li>Site visit and early advice on draft proposed layout, to minimise the risk of significant harm to receptors and visibility from properties/PRoW. Site visit and sketch mark up likely the appropriate means to doing this.</li>
  <li>To advise whether you recommend pre-application discussions with a landscape Officer and other statutory bodies.</li>
  <li>Concluding report based on final layout.</li>
  <li>Requirement to advise on multiple design iterations.</li>
  <li>Organise photomontages- including a quote and timescales for you/your contact for Type 3 and Type 4 images. We would like to agree with you which viewpoints we should use for the photo montages.</li>
  <li>To advise on obtaining Winter/summer views.</li>
  <li>Landscape Mitigations and enhancements plan- please quote to prepare this and separately mark-up proposals.</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Assessment to follow GLVIA3 methodology</li>
  <li>Survey work to be undertaken during leaf-on and leaf-off seasons (if appropriate)</li>
  <li>Visualisations to be prepared in accordance with current best practice guidance</li>
  <li>Report suitable for submission with planning applications</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Number and locations of viewpoints included in base fee</li>
  <li>Costs for additional viewpoints/visualisations</li>
  <li>Programme and key milestones</li>
  <li>Details of key personnel and qualifications</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>'
WHERE discipline = 'Landscape';

-- Insert Flood and Drainage template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Flood and Drainage',
    'Flood and Drainage',
    'Standard quote request for flood risk assessment and drainage strategy',
    'Quote Request: Flood and Drainage Services - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Flood and Drainage</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

<h3>Project Details</h3>
<ul>
  <li><strong>Project Name:</strong> [PROJECT_NAME]</li>
  <li><strong>Project Code:</strong> [PROJECT_CODE]</li>
  <li><strong>Location:</strong> [ADDRESS]</li>
  <li><strong>Site Area:</strong> [AREA]</li>
  <li><strong>Client:</strong> [CLIENT_NAME]</li>
  <li><strong>Sector:</strong> [SECTOR]</li>
  <li><strong>Project Type:</strong> [PROJECT_TYPE]</li>
</ul>

<h3>Scope of Work</h3>
<p>Please provide a fee quote for the following:</p>
<ul>
  <li>Flood Risk Assessment (FRA)</li>
  <li>High level drainage strategy</li>
  <li>Assessment of flood zones and sources of flooding</li>
  <li>Surface water management strategy</li>
  <li>Sustainable drainage systems (SuDS) proposals</li>
  <li>Report preparation suitable for planning submission</li>
</ul>

<h3>Additional Requirements</h3>
<p>Please also confirm fees and timescales for the following:</p>
<ul>
  <li>FRA with high level drainage strategy. Please indicate as soon as possible if you consider there to be any layout or critical design constraints.</li>
  <li>Recommend pre-application discussions with the LLFA, EA or LPA.</li>
  <li>[Provide Topo or if topo not available, seek clarification as to whether they can work with Lidar]</li>
  <li>To advise on whether you consider infiltration testing required.</li>
  <li>To advise whether a flood warning and evacuation plan required.</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Assessment to comply with National Planning Policy Framework and local planning policy</li>
  <li>Compliance with relevant technical standards and guidance</li>
  <li>Report suitable for submission with planning applications</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Estimated timeframes for each stage</li>
  <li>Details of key personnel and qualifications</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>',
    TRUE
  );

-- Insert Transport template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Transport',
    'Transport',
    'Standard quote request for transport assessment and highway works',
    'Quote Request: Transport Services - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Transport</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

<h3>Project Details</h3>
<ul>
  <li><strong>Project Name:</strong> [PROJECT_NAME]</li>
  <li><strong>Project Code:</strong> [PROJECT_CODE]</li>
  <li><strong>Location:</strong> [ADDRESS]</li>
  <li><strong>Site Area:</strong> [AREA]</li>
  <li><strong>Client:</strong> [CLIENT_NAME]</li>
  <li><strong>Sector:</strong> [SECTOR]</li>
  <li><strong>Project Type:</strong> [PROJECT_TYPE]</li>
</ul>

<h3>Scope of Work</h3>
<p>Please provide a fee quote for the following:</p>
<ul>
  <li>Transport Assessment or Transport Statement</li>
  <li>Access appraisal and design</li>
  <li>Construction Traffic Management Plan</li>
  <li>Highway visibility splays assessment</li>
  <li>Travel Plan (if required)</li>
  <li>Report preparation suitable for planning submission</li>
</ul>

<h3>Additional Requirements</h3>
<p>Please also confirm fees and timescales for the following:</p>
<ul>
  <li>Site visit and early advice on suitability of proposed access point and internal road configuration. Site visit and sketch mark up likely the appropriate means to doing this.</li>
  <li>Early advice on requirement to remove any sections of hedgerow or trees.</li>
  <li>Early advice on acceptability of proposed construction compound location.</li>
  <li>To advise on what access route would need to be included with topographical survey.</li>
  <li>To advise whether you recommend pre-application discussions with Highways Officer.</li>
  <li>Concluding report based on final layout.</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Assessment to comply with relevant highway standards and guidance</li>
  <li>Liaison with Local Highway Authority as required</li>
  <li>Report suitable for submission with planning applications</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Estimated timeframes for each stage</li>
  <li>Details of key personnel and qualifications</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>',
    TRUE
  );

-- Insert Arboriculture template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Arboriculture',
    'Arboriculture',
    'Standard quote request for tree surveys and arboricultural impact assessments',
    'Quote Request: Arboriculture Services - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Arboriculture</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

<h3>Project Details</h3>
<ul>
  <li><strong>Project Name:</strong> [PROJECT_NAME]</li>
  <li><strong>Project Code:</strong> [PROJECT_CODE]</li>
  <li><strong>Location:</strong> [ADDRESS]</li>
  <li><strong>Site Area:</strong> [AREA]</li>
  <li><strong>Client:</strong> [CLIENT_NAME]</li>
  <li><strong>Sector:</strong> [SECTOR]</li>
  <li><strong>Project Type:</strong> [PROJECT_TYPE]</li>
</ul>

<h3>Scope of Work</h3>
<p>Please provide a fee quote for the following:</p>
<ul>
  <li>BS5837 tree survey</li>
  <li>Tree Constraints Plan</li>
  <li>Arboricultural Impact Assessment (AIA)</li>
  <li>Tree Protection Plan</li>
  <li>Arboricultural Method Statement</li>
  <li>Report preparation suitable for planning submission</li>
</ul>

<h3>Additional Requirements</h3>
<p>Please also confirm fees and timescales for the following:</p>
<ul>
  <li>Site visit and early advice on suitability of draft layout. Early sketch markup likely the appropriate means to doing this.</li>
  <li>Tree survey is the priority in case it influences layout, so please confirm timescales.</li>
  <li>To advise whether you recommend pre-application discussions with Council Officers.</li>
  <li>Concluding AIA report based on final layout.</li>
  <li>To advise on new tree planting and soft landscaping scheme which may be required to make a scheme acceptable.</li>
  <li>Please confirm whether topo will be required.</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Survey to be undertaken in accordance with BS5837:2012</li>
  <li>Assessment of impact on trees from development</li>
  <li>Report suitable for submission with planning applications</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Estimated timeframes for each stage</li>
  <li>Details of key personnel and qualifications</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>',
    TRUE
  );

-- Insert Noise template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Noise',
    'Noise',
    'Standard quote request for noise impact assessments',
    'Quote Request: Noise Assessment Services - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Noise Assessment</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

<h3>Project Details</h3>
<ul>
  <li><strong>Project Name:</strong> [PROJECT_NAME]</li>
  <li><strong>Project Code:</strong> [PROJECT_CODE]</li>
  <li><strong>Location:</strong> [ADDRESS]</li>
  <li><strong>Site Area:</strong> [AREA]</li>
  <li><strong>Client:</strong> [CLIENT_NAME]</li>
  <li><strong>Sector:</strong> [SECTOR]</li>
  <li><strong>Project Type:</strong> [PROJECT_TYPE]</li>
</ul>

<h3>Scope of Work</h3>
<p>Please provide a fee quote for the following:</p>
<ul>
  <li>Baseline noise survey</li>
  <li>Noise Impact Assessment (NIA)</li>
  <li>Assessment of operational noise</li>
  <li>Assessment of construction noise (if required)</li>
  <li>Noise mitigation recommendations</li>
  <li>Report preparation suitable for planning submission</li>
</ul>

<h3>Additional Requirements</h3>
<p>Please also confirm fees and timescales for the following:</p>
<ul>
  <li>Site visit and early advice on suitability of draft layout and relationship with any sensitive receptors.</li>
  <li>Seek agreement that they will discuss the proposals with Environmental Health to confirm scope and any acceptability/any noise target levels.</li>
  <li>Requirement to advise on multiple design iterations.</li>
  <li>Final NIA based on final layout.</li>
  <li>Please confirm any details you will require to inform your assessment at an early stage (i.e. inverter locations, product spec)</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Assessment to comply with relevant British Standards and guidance</li>
  <li>Liaison with Environmental Health Officer as required</li>
  <li>Report suitable for submission with planning applications</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Estimated timeframes for each stage</li>
  <li>Details of key personnel and qualifications</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>',
    TRUE
  );

-- Insert Glint & Glare template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Glint & Glare',
    'Glint & Glare',
    'Standard quote request for glint and glare assessments',
    'Quote Request: Glint & Glare Assessment Services - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Glint & Glare Assessment</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

<h3>Project Details</h3>
<ul>
  <li><strong>Project Name:</strong> [PROJECT_NAME]</li>
  <li><strong>Project Code:</strong> [PROJECT_CODE]</li>
  <li><strong>Location:</strong> [ADDRESS]</li>
  <li><strong>Site Area:</strong> [AREA]</li>
  <li><strong>Client:</strong> [CLIENT_NAME]</li>
  <li><strong>Sector:</strong> [SECTOR]</li>
  <li><strong>Project Type:</strong> [PROJECT_TYPE]</li>
</ul>

<h3>Scope of Work</h3>
<p>Please provide a fee quote for the following:</p>
<ul>
  <li>Glint and glare assessment for solar PV development</li>
  <li>Assessment of impact on nearby receptors (residential properties, roads, railways, airports)</li>
  <li>Computer modelling of potential glint and glare effects</li>
  <li>Mitigation recommendations</li>
  <li>Report preparation suitable for planning submission</li>
</ul>

<h3>Additional Requirements</h3>
<p>Please also confirm fees and timescales for the following:</p>
<ul>
  <li>Site visit and early advice on suitability of draft layout and relationship with any sensitive receptors. Early sketch markup likely the appropriate means to doing this.</li>
  <li>Early guidance on what mitigation measures may be required to make proposals acceptable. If additional landscaping required, this will need to be communicated with other surveyors for inclusion in their plans.</li>
  <li>Requirement to advise on multiple design iterations.</li>
  <li>Final Glint and glare assessment based on final layout.</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Assessment to use industry-standard software (e.g. GlintAnalyze, ForgeSolar)</li>
  <li>Compliance with relevant guidance and standards</li>
  <li>Report suitable for submission with planning applications</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Estimated timeframes for each stage</li>
  <li>Details of key personnel and qualifications</li>
  <li>Software/methodology to be used</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>',
    TRUE
  );
