-- Stage 1 Planning Appraisal template (table-format deliverable)
INSERT INTO planning_deliverables.planning_templates
  (template_name, template_type, description, template_content, created_by)
VALUES (
  'Stage 1 Planning Appraisal',
  'stage1_review',
  'Stage 1 planning appraisal table covering site details, planning policy, site context, planning discussion, and application considerations',
  '{
    "sections": [
      {
        "id": "title",
        "type": "heading",
        "level": 1,
        "content": "{{project_name}}"
      },
      {
        "id": "subtitle",
        "type": "paragraph",
        "content": "Stage 1 Planning Appraisal"
      },
      {
        "id": "date",
        "type": "paragraph",
        "content": "{{current_date}}"
      },
      {
        "id": "appraisal_table",
        "type": "table",
        "rows": [
          { "type": "header", "content": "Site Details" },
          { "type": "data", "label": "Site address", "content": "{{address}}" },
          { "type": "data", "label": "Proposal", "content": "{{sub_sector}}" },
          { "type": "data", "label": "Local planning authority", "content": "{{local_planning_authority}}" },
          { "type": "header", "content": "Planning policy" },
          { "type": "data", "label": "Development plan", "content": "" },
          { "type": "data", "label": "Neighbourhood plan", "content": "" },
          { "type": "data", "label": "Key local policy", "content": "" },
          { "type": "data", "label": "Supplementary guidance", "content": "" },
          { "type": "header", "content": "Site context" },
          { "type": "data", "label": "Site description", "content": "" },
          { "type": "data", "label": "Planning history", "content": "" },
          { "type": "header", "content": "Planning discussion" },
          { "type": "data", "label": "Benefits of proposal", "content": "" },
          { "type": "data", "label": "Landscape and visual effects", "content": "" },
          { "type": "data", "label": "Ecology", "content": "" },
          { "type": "data", "label": "Trees", "content": "" },
          { "type": "data", "label": "Site Access", "content": "" },
          { "type": "data", "label": "Heritage and archaeology", "content": "" },
          { "type": "data", "label": "Agricultural land grade and use", "content": "" },
          { "type": "data", "label": "Flood risk and drainage", "content": "" },
          { "type": "data", "label": "Noise", "content": "" },
          { "type": "data", "label": "Glint and glare", "content": "" },
          { "type": "data", "label": "Battery safety fire management plan", "content": "" },
          { "type": "header", "content": "Planning application considerations" },
          { "type": "data", "label": "Public consultation", "content": "" },
          { "type": "data", "label": "Scope of supporting information", "content": "" },
          { "type": "data", "label": "Summary and recommendation", "content": "" }
        ]
      }
    ]
  }',
  'System'
)
ON CONFLICT DO NOTHING;
