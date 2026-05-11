-- ─── Four Ashes Solar Farm — Document Log seed data ────────────────────────
DO $$
DECLARE
  p_id INTEGER;
BEGIN
  SELECT id INTO p_id
  FROM public.projects
  WHERE project_name ILIKE '%four ashes%'
  LIMIT 1;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Project "Four Ashes" not found';
  END IF;

  DELETE FROM planning_applications.document_log WHERE project_id = p_id;

  -- Documents
  INSERT INTO planning_applications.document_log (project_id, title, code, item_type, prepared_by, document_summary, argument_points)
  VALUES
    (p_id, 'Planning, Design and Access Statement', 'CD/1.1', 'document', 'Third Revolution Projects Ltd', NULL, '[]'),
    (p_id, 'Landscape and Visual Impact Assessment', 'CD/2.1', 'document', 'Greenscape Consultants Ltd', NULL, '[]'),
    (p_id, 'Heritage Impact Assessment', 'CD/3.1', 'document', 'Heritage Planning Associates', NULL, '[]'),
    (p_id, 'Ecological Impact Assessment', 'CD/4.1', 'document', 'EcoSurvey Ltd', NULL, '[]'),
    (p_id, 'Biodiversity Net Gain Assessment', 'CD/4.2', 'document', 'EcoSurvey Ltd', NULL, '[]'),
    (p_id, 'Transport Assessment and Construction Traffic Management Plan', 'CD/5.1', 'document', 'Transport Planning Associates', NULL, '[]'),
    (p_id, 'Flood Risk Assessment', 'CD/6.1', 'document', 'Third Revolution Projects Ltd', NULL, '[]'),
    (p_id, 'Glint and Glare Assessment', 'CD/7.1', 'document', 'Third Revolution Projects Ltd', NULL, '[]'),
    (p_id, 'Agricultural Land Classification Report', 'CD/8.1', 'document', 'Rural Land Surveys Ltd', NULL, '[]'),
    (p_id, 'Statement of Community Involvement', 'CD/9.1', 'document', 'Third Revolution Projects Ltd', NULL, '[]');

  -- Drawings
  INSERT INTO planning_applications.document_log (project_id, title, code, item_type, prepared_by, document_summary, argument_points)
  VALUES
    (p_id, 'Location Plan', 'DWG/01', 'drawing', 'Third Revolution Projects Ltd', NULL, '[]'),
    (p_id, 'Site Layout Plan', 'DWG/02', 'drawing', 'Third Revolution Projects Ltd', NULL, '[]'),
    (p_id, 'Proposed Panel Layout', 'DWG/03', 'drawing', 'Third Revolution Projects Ltd', NULL, '[]'),
    (p_id, 'Substation Elevations and Floor Plan', 'DWG/04', 'drawing', 'Third Revolution Projects Ltd', NULL, '[]'),
    (p_id, 'Fencing and Access Details', 'DWG/05', 'drawing', 'Third Revolution Projects Ltd', NULL, '[]'),
    (p_id, 'Landscape Masterplan', 'DWG/06', 'drawing', 'Greenscape Consultants Ltd', NULL, '[]'),
    (p_id, 'Photomontage — View from Wolverhampton Road', 'DWG/07', 'drawing', 'Greenscape Consultants Ltd', NULL, '[]'),
    (p_id, 'Photomontage — View from Four Ashes Hall', 'DWG/08', 'drawing', 'Greenscape Consultants Ltd', NULL, '[]');

  RAISE NOTICE 'Document log seeded for project id: %', p_id;
END $$;
