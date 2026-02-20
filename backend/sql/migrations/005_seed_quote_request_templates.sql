-- Migration: Seed Quote Request Templates
-- Purpose: Insert initial quote request email templates for different disciplines
-- Date: 2026-01-13

-- Heritage Quote Request Template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Heritage',
    'Heritage',
    'Standard quote request for heritage surveys and assessments',
    'Quote Request: Heritage Services - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

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

<p>Best regards</p>',
    TRUE
  );

-- Ecology Quote Request Template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Ecology',
    'Ecology',
    'Standard quote request for ecological surveys and assessments',
    'Quote Request: Ecology Services - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Ecology</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

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
<p>Please provide a fee quote for the following ecological services:</p>
<ul>
  <li>Preliminary Ecological Appraisal (PEA)</li>
  <li>Desk study including statutory and non-statutory designated sites</li>
  <li>Extended Phase 1 habitat survey</li>
  <li>Protected species surveys (as appropriate based on PEA findings)</li>
  <li>Biodiversity Net Gain assessment</li>
  <li>Ecological Impact Assessment</li>
  <li>Report preparation suitable for planning submission</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Surveys to be undertaken during appropriate seasons</li>
  <li>Assessment to comply with current ecological planning policy and guidance</li>
  <li>Consideration of protected species licensing requirements</li>
  <li>BNG calculations using latest Defra metrics</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs for each survey type</li>
  <li>Survey timing windows and programme</li>
  <li>Details of survey methodologies</li>
  <li>Qualifications of surveyors</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>',
    TRUE
  );

-- Landscape Quote Request Template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Landscape',
    'Landscape',
    'Standard quote request for landscape and visual impact assessments',
    'Quote Request: Landscape & Visual Impact Assessment - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

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

<p>Best regards</p>',
    TRUE
  );

-- Agricultural Land Classification Quote Request Template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'Initial Quote Request - Agricultural Land',
    'Agricultural Land',
    'Standard quote request for agricultural land classification surveys',
    'Quote Request: Agricultural Land Classification - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>Agricultural Land Classification</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

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
<p>Please provide a fee quote for the following ALC services:</p>
<ul>
  <li>Desk study of existing ALC data and soils information</li>
  <li>Detailed field survey in accordance with Natural England guidelines</li>
  <li>Soil sampling and analysis (physical and chemical properties)</li>
  <li>ALC grading of land within the site</li>
  <li>Assessment against relevant planning policy</li>
  <li>ALC report with plan suitable for planning submission</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>Survey to be undertaken in accordance with Natural England Technical Information Note TIN049</li>
  <li>Field survey during appropriate season (soil moisture conditions permitting)</li>
  <li>Mapping to be provided in GIS format</li>
  <li>Report suitable for submission with planning applications</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Number and density of survey points</li>
  <li>Details of soil analysis parameters</li>
  <li>Estimated timeframes for fieldwork and reporting</li>
  <li>Qualifications of surveyors</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>',
    TRUE
  );

-- Generic Quote Request Template
INSERT INTO admin_console.quote_request_templates
  (template_name, discipline, description, subject_line, template_content, is_active)
VALUES
  (
    'General Quote Request',
    NULL,
    'Generic quote request template for any discipline',
    'Quote Request: [DISCIPLINE] Services - [PROJECT_NAME]',
    '<p>Dear [SURVEYOR_NAME],</p>

<p>We are seeking a fee quote for <strong>[DISCIPLINE]</strong> services for the <strong>[PROJECT_NAME]</strong> project.</p>

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
<p>Please provide a fee quote for the following services:</p>
<ul>
  <li>[Add scope items]</li>
</ul>

<h3>Key Requirements</h3>
<ul>
  <li>[Add key requirements]</li>
</ul>

<p>Please provide your quote by <strong>[DATE]</strong>, including:</p>
<ul>
  <li>Breakdown of costs by work element</li>
  <li>Estimated timeframes</li>
  <li>Details of key personnel and qualifications</li>
  <li>Any assumptions or exclusions</li>
</ul>

<p>If you require any additional information or would like to discuss the project, please do not hesitate to contact us.</p>

<p>Best regards</p>',
    TRUE
  );

-- Comment on templates
COMMENT ON TABLE admin_console.quote_request_templates IS 'Seeded with initial templates for Heritage, Ecology, Landscape, Agricultural Land, and a generic template';
