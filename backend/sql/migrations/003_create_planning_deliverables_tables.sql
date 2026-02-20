-- Create planning_deliverables schema
CREATE SCHEMA IF NOT EXISTS planning_deliverables;

-- Create planning templates table
CREATE TABLE IF NOT EXISTS planning_deliverables.planning_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL,
  template_type VARCHAR(100) NOT NULL,
  description TEXT,
  template_content JSONB NOT NULL,
  version VARCHAR(50) DEFAULT '1.0',
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create planning deliverables table
CREATE TABLE IF NOT EXISTS planning_deliverables.planning_deliverables (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL REFERENCES planning_deliverables.planning_templates(id),
  deliverable_name VARCHAR(255) NOT NULL,
  deliverable_type VARCHAR(100) NOT NULL,
  content JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  version VARCHAR(50) DEFAULT '1.0',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_planning_templates_type ON planning_deliverables.planning_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_planning_templates_active ON planning_deliverables.planning_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_planning_deliverables_project ON planning_deliverables.planning_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_planning_deliverables_template ON planning_deliverables.planning_deliverables(template_id);
CREATE INDEX IF NOT EXISTS idx_planning_deliverables_status ON planning_deliverables.planning_deliverables(status);

-- Auto-update timestamp triggers
DROP TRIGGER IF EXISTS update_planning_templates_updated_at ON planning_deliverables.planning_templates;
CREATE TRIGGER update_planning_templates_updated_at
  BEFORE UPDATE ON planning_deliverables.planning_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_planning_deliverables_updated_at ON planning_deliverables.planning_deliverables;
CREATE TRIGGER update_planning_deliverables_updated_at
  BEFORE UPDATE ON planning_deliverables.planning_deliverables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON SCHEMA planning_deliverables IS 'Schema for planning deliverables feature - templates and generated documents';
COMMENT ON TABLE planning_deliverables.planning_templates IS 'Stores reusable planning document templates with merge field placeholders';
COMMENT ON TABLE planning_deliverables.planning_deliverables IS 'Stores generated planning documents for specific projects';
COMMENT ON COLUMN planning_deliverables.planning_templates.template_content IS 'JSONB structure containing template sections and placeholders like {{project_name}}';
COMMENT ON COLUMN planning_deliverables.planning_deliverables.content IS 'JSONB structure containing the merged and potentially edited document content';

-- Insert sample templates
INSERT INTO planning_deliverables.planning_templates (template_name, template_type, description, template_content, created_by) VALUES
(
  'Screening Opinion Request',
  'screening_opinion',
  'Standard template for EIA Screening Opinion requests to the Local Planning Authority',
  '{
    "sections": [
      {
        "id": "header",
        "type": "heading",
        "level": 1,
        "content": "Request for Screening Opinion - {{project_name}}"
      },
      {
        "id": "date",
        "type": "paragraph",
        "content": "Date: {{current_date}}"
      },
      {
        "id": "intro",
        "type": "heading",
        "level": 2,
        "content": "Introduction"
      },
      {
        "id": "intro_text",
        "type": "paragraph",
        "content": "This request is submitted on behalf of {{client}} in accordance with Regulation 6 of the Town and Country Planning (Environmental Impact Assessment) Regulations 2017. We are seeking a formal Screening Opinion to determine whether the proposed development requires an Environmental Impact Assessment (EIA)."
      },
      {
        "id": "site_location",
        "type": "heading",
        "level": 2,
        "content": "Site Location and Description"
      },
      {
        "id": "site_details",
        "type": "paragraph",
        "content": "The proposed development site is located at {{address}}. The site has an approximate area of {{area}} and falls within the administrative boundary of {{local_planning_authority}}."
      },
      {
        "id": "proposal",
        "type": "heading",
        "level": 2,
        "content": "Proposed Development"
      },
      {
        "id": "proposal_text",
        "type": "paragraph",
        "content": "The proposal consists of a {{project_type}} development within the {{sector}} sector. The project is identified as {{project_id}} and is being managed by {{project_manager}}."
      },
      {
        "id": "designations",
        "type": "heading",
        "level": 2,
        "content": "Site Designations"
      },
      {
        "id": "designations_on_site",
        "type": "paragraph",
        "content": "Designations on site: {{designations_on_site}}"
      },
      {
        "id": "designations_nearby",
        "type": "paragraph",
        "content": "Relevant nearby designations: {{relevant_nearby_designations}}"
      },
      {
        "id": "conclusion",
        "type": "heading",
        "level": 2,
        "content": "Conclusion"
      },
      {
        "id": "conclusion_text",
        "type": "paragraph",
        "content": "We respectfully request that {{local_planning_authority}} provide a Screening Opinion on whether the proposed development requires an EIA under the 2017 Regulations."
      }
    ],
    "placeholders": [
      "project_name",
      "current_date",
      "client",
      "address",
      "area",
      "local_planning_authority",
      "project_type",
      "sector",
      "project_id",
      "project_manager",
      "designations_on_site",
      "relevant_nearby_designations"
    ]
  }',
  'System'
),
(
  'Scoping Opinion Request',
  'scoping_opinion',
  'Standard template for EIA Scoping Opinion requests',
  '{
    "sections": [
      {
        "id": "header",
        "type": "heading",
        "level": 1,
        "content": "Request for Scoping Opinion - {{project_name}}"
      },
      {
        "id": "date",
        "type": "paragraph",
        "content": "Date: {{current_date}}"
      },
      {
        "id": "intro",
        "type": "heading",
        "level": 2,
        "content": "Introduction"
      },
      {
        "id": "intro_text",
        "type": "paragraph",
        "content": "This Scoping Report is submitted on behalf of {{client}} in accordance with Regulation 15 of the Town and Country Planning (Environmental Impact Assessment) Regulations 2017. We are requesting a formal Scoping Opinion from {{local_planning_authority}} to agree the scope and methodology of the Environmental Impact Assessment for the proposed development."
      },
      {
        "id": "site_location",
        "type": "heading",
        "level": 2,
        "content": "The Site"
      },
      {
        "id": "site_details",
        "type": "paragraph",
        "content": "The site is located at {{address}}, covering approximately {{area}}. The site falls within the jurisdiction of {{local_planning_authority}}."
      },
      {
        "id": "development",
        "type": "heading",
        "level": 2,
        "content": "The Proposed Development"
      },
      {
        "id": "development_text",
        "type": "paragraph",
        "content": "The proposed development comprises a {{project_type}} scheme within the {{sector}} sector. Project reference: {{project_id}}."
      },
      {
        "id": "eia_topics",
        "type": "heading",
        "level": 2,
        "content": "Proposed EIA Topics"
      },
      {
        "id": "topics_intro",
        "type": "paragraph",
        "content": "Based on our initial assessment, we propose that the Environmental Statement should address the following topic areas:"
      },
      {
        "id": "topics_list",
        "type": "list",
        "items": [
          "Ecology and Nature Conservation",
          "Landscape and Visual Impact",
          "Cultural Heritage",
          "Agricultural Land Quality",
          "Transport and Access",
          "Noise and Vibration",
          "Socio-economics"
        ]
      },
      {
        "id": "request",
        "type": "heading",
        "level": 2,
        "content": "Request for Opinion"
      },
      {
        "id": "request_text",
        "type": "paragraph",
        "content": "We respectfully request that {{local_planning_authority}} provides a formal Scoping Opinion confirming the topics to be assessed and the methodologies to be adopted in the Environmental Impact Assessment."
      }
    ],
    "placeholders": [
      "project_name",
      "current_date",
      "client",
      "local_planning_authority",
      "address",
      "area",
      "project_type",
      "sector",
      "project_id"
    ]
  }',
  'System'
),
(
  'Planning Statement',
  'planning_statement',
  'Basic template for planning statement documents',
  '{
    "sections": [
      {
        "id": "header",
        "type": "heading",
        "level": 1,
        "content": "Planning Statement - {{project_name}}"
      },
      {
        "id": "project_ref",
        "type": "paragraph",
        "content": "Project Reference: {{project_id}}"
      },
      {
        "id": "date",
        "type": "paragraph",
        "content": "Date: {{current_date}}"
      },
      {
        "id": "exec_summary",
        "type": "heading",
        "level": 2,
        "content": "Executive Summary"
      },
      {
        "id": "exec_text",
        "type": "paragraph",
        "content": "This Planning Statement has been prepared on behalf of {{client}} in support of a planning application for {{project_type}} development at {{address}}."
      },
      {
        "id": "site_context",
        "type": "heading",
        "level": 2,
        "content": "Site and Context"
      },
      {
        "id": "site_text",
        "type": "paragraph",
        "content": "The application site extends to approximately {{area}} and is located within the administrative area of {{local_planning_authority}}. The site address is {{address}}."
      },
      {
        "id": "proposal_heading",
        "type": "heading",
        "level": 2,
        "content": "The Proposal"
      },
      {
        "id": "proposal_text",
        "type": "paragraph",
        "content": "The application seeks planning permission for a {{project_type}} development as part of the {{sector}} sector. The project is being led by {{project_lead}} and managed by {{project_manager}}."
      },
      {
        "id": "constraints",
        "type": "heading",
        "level": 2,
        "content": "Site Constraints and Opportunities"
      },
      {
        "id": "constraints_on_site",
        "type": "paragraph",
        "content": "On-site designations: {{designations_on_site}}"
      },
      {
        "id": "constraints_nearby",
        "type": "paragraph",
        "content": "Nearby considerations: {{relevant_nearby_designations}}"
      },
      {
        "id": "planning_policy",
        "type": "heading",
        "level": 2,
        "content": "Planning Policy Context"
      },
      {
        "id": "policy_text",
        "type": "paragraph",
        "content": "This section should detail relevant national, regional, and local planning policies."
      },
      {
        "id": "conclusion",
        "type": "heading",
        "level": 2,
        "content": "Conclusion"
      },
      {
        "id": "conclusion_text",
        "type": "paragraph",
        "content": "This Planning Statement demonstrates that the proposed development complies with relevant planning policy and should be supported."
      }
    ],
    "placeholders": [
      "project_name",
      "project_id",
      "current_date",
      "client",
      "project_type",
      "address",
      "area",
      "local_planning_authority",
      "project_lead",
      "project_manager",
      "designations_on_site",
      "relevant_nearby_designations"
    ]
  }',
  'System'
),
(
  'Certificate B Notice Letter',
  'certificate_b_notice',
  'Certificate of Ownership - Certificate B: Notice under Article 13 for planning applications',
  '{
    "sections": [
      {
        "id": "header",
        "type": "paragraph",
        "content": "Dear Sir/Madam,"
      },
      {
        "id": "subject",
        "type": "paragraph",
        "content": "Town and Country Planning (Development Management Procedure) (England) Order 2015: Certificate of Ownership – Certificate B: Notice under Article 13 of Application for Planning: «Site_address_including_postcode»"
      },
      {
        "id": "intro",
        "type": "paragraph",
        "content": "I am writing to you on behalf of «Client_or_SPV_name_» to inform you that a planning application has been submitted to «Local_planning_authority» for a proposed development located on «Site_address_including_postcode»."
      },
      {
        "id": "purpose",
        "type": "paragraph",
        "content": "This is a submission for the above mentioned site and seeks permission for the following:"
      },
      {
        "id": "description",
        "type": "paragraph",
        "content": "\"«Detailed_Description_of_Development_»\""
      },
      {
        "id": "notice",
        "type": "paragraph",
        "content": "Please find enclosed a Notice No 1 Notification which is required to be sent to you as part of the Town and Country Planning Development Management Procedure Order 2015 on the basis that we understand you have ownership interest in the land."
      },
      {
        "id": "consultation",
        "type": "paragraph",
        "content": "We trust that the enclosed information provides you with sufficient details regarding the nature of the application and you may be formally consulted by «Local_planning_authority» as part of the planning process."
      },
      {
        "id": "contact",
        "type": "paragraph",
        "content": "Should you require further information, please do not hesitate to contact us or the council on the contact details provided."
      },
      {
        "id": "closing",
        "type": "paragraph",
        "content": "Yours sincerely"
      },
      {
        "id": "signature",
        "type": "paragraph",
        "content": "[signature]"
      }
    ],
    "placeholders": [
      "Site_address_including_postcode",
      "Client_or_SPV_name_",
      "Local_planning_authority",
      "Detailed_Description_of_Development_"
    ]
  }',
  'System'
);

