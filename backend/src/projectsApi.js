import { pool } from './db.js';

/**
 * Projects API endpoints
 */

// CREATE new project
async function createProject(req, res) {
  const {
    project_id,
    project_name,
    local_planning_authority, // Array of strings
    project_type,
    project_lead,
    project_manager,
    project_director,
    project_lead_user_id,
    project_manager_user_id,
    project_director_user_id,
    address,
    polygon_geojson,
    area,
    client,
    client_spv_name,
    sectors,     // Array of strings
    sub_sectors, // Array of strings
    development_types, // Array of strings
    designations_on_site,
    relevant_nearby_designations,
    status
  } = req.body;

  try {
    // Validate required fields
    if (!project_id || !project_name) {
      return res.status(400).json({
        error: 'project_id and project_name are required'
      });
    }

    // Check if project_id already exists
    const existingProject = await pool.query(
      'SELECT id FROM projects WHERE project_id = $1',
      [project_id]
    );

    if (existingProject.rows.length > 0) {
      return res.status(400).json({
        error: 'A project with this project_id already exists'
      });
    }

    // Convert LPA array to JSONB
    const lpaJson = local_planning_authority ? JSON.stringify(local_planning_authority) : null;

    // development_type (singular, legacy) is kept in sync with the first
    // selected development_types entry — see migration 146 for why.
    const primaryDevType = development_types?.length ? development_types[0] : null;

    // Insert into projects table
    const result = await pool.query(
      `INSERT INTO projects
       (project_id, project_name, project_type, local_planning_authority, project_lead,
        project_manager, project_director, address, polygon_geojson, area,
        client, client_spv_name, sectors, sub_sectors, development_types, development_type,
        designations_on_site, relevant_nearby_designations, status,
        project_lead_user_id, project_manager_user_id, project_director_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [
        project_id,
        project_name,
        project_type || null,
        lpaJson,
        project_lead || null,
        project_manager || null,
        project_director || null,
        address || null,
        polygon_geojson || null,
        area || null,
        client || null,
        client_spv_name || null,
        sectors ? JSON.stringify(sectors) : '[]',
        sub_sectors ? JSON.stringify(sub_sectors) : '[]',
        development_types ? JSON.stringify(development_types) : '[]',
        primaryDevType,
        designations_on_site || null,
        relevant_nearby_designations || null,
        status || null,
        project_lead_user_id || null,
        project_manager_user_id || null,
        project_director_user_id || null
      ]
    );

    res.json({ success: true, project: result.rows[0] });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project', details: error.message });
  }
}

// GET all projects
async function getAllProjects(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, unique_id, project_id, project_name, local_planning_authority,
              project_lead, project_manager, project_director,
              project_lead_user_id, project_manager_user_id, project_director_user_id,
              address, area,
              client, client_spv_name, sectors, sub_sectors,
              designations_on_site, relevant_nearby_designations, status,
              case_officer_name, case_officer_email, case_officer_phone_number,
              lpa_reference, submission_date, validation_date,
              lpa_consultation_end_date, committee_date, target_determination_date,
              determined_date, expiry_of_1st_stat_period_date, eot_date,
              six_months_appeal_window_date, comments, development_type, development_types,
              about_applicant, created_at, updated_at
       FROM projects
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

// GET single project (includes geometry and project_information)
async function getProjectById(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        p.*,
        pi.client_or_spv_name,
        pi.detailed_description,
        pi.proposed_use_duration,
        pi.distribution_network,
        pi.solar_export_capacity,
        pi.pv_max_panel_height,
        pi.fence_height,
        pi.pv_clearance_from_ground,
        pi.number_of_solar_panels,
        pi.panel_tilt,
        pi.panel_tilt_direction,
        pi.bess_export_capacity,
        pi.bess_containers,
        pi.gwh_per_year,
        pi.homes_powered,
        pi.co2_offset,
        pi.equivalent_cars,
        pi.access_arrangements,
        pi.access_contact,
        pi.parking_details,
        pi.atv_use,
        pi.additional_notes,
        pi.invoicing_details,
        pi.sharepoint_link
      FROM projects p
      LEFT JOIN admin_console.project_information pi ON pi.project_id = p.unique_id
      WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
}

// UPDATE project
async function updateProject(req, res) {
  const { id } = req.params;
  const {
    project_id,
    project_name,
    project_type,
    local_planning_authority,
    project_lead,
    project_manager,
    project_director,
    project_lead_user_id,
    project_manager_user_id,
    project_director_user_id,
    address,
    polygon_geojson,
    area,
    client,
    client_spv_name,
    sectors,
    sub_sectors,
    development_types,
    designations_on_site,
    relevant_nearby_designations,
    status,
    development_description,
    case_officer_name,
    case_officer_email,
    case_officer_phone_number,
    lpa_reference,
    submission_date,
    validation_date,
    lpa_consultation_end_date,
    committee_date,
    target_determination_date,
    determined_date,
    expiry_of_1st_stat_period_date,
    eot_date,
    six_months_appeal_window_date,
    comments,
    about_applicant
  } = req.body;

  try {
    const lpaJson = local_planning_authority ? JSON.stringify(local_planning_authority) : undefined;

    // development_type (singular, legacy) is kept in sync with the first
    // selected development_types entry whenever development_types is part
    // of this update — see migration 146 for why it's kept around at all.
    const primaryDevType = development_types !== undefined
      ? (development_types.length ? development_types[0] : null)
      : undefined;

    const result = await pool.query(
      `UPDATE projects
       SET project_id = COALESCE($1, project_id),
           project_name = COALESCE($2, project_name),
           local_planning_authority = COALESCE($3, local_planning_authority),
           project_lead = COALESCE($4, project_lead),
           project_manager = COALESCE($5, project_manager),
           project_director = COALESCE($6, project_director),
           address = COALESCE($7, address),
           polygon_geojson = COALESCE($8, polygon_geojson),
           area = COALESCE($9, area),
           client = COALESCE($10, client),
           client_spv_name = COALESCE($11, client_spv_name),
           sectors = COALESCE($12, sectors),
           sub_sectors = COALESCE($13, sub_sectors),
           development_types = COALESCE($14, development_types),
           development_type = COALESCE($15, development_type),
           designations_on_site = COALESCE($16, designations_on_site),
           relevant_nearby_designations = COALESCE($17, relevant_nearby_designations),
           status = COALESCE($18, status),
           development_description = $19,
           case_officer_name = $20,
           case_officer_email = $21,
           case_officer_phone_number = $22,
           lpa_reference = $23,
           submission_date = $24,
           validation_date = $25,
           lpa_consultation_end_date = $26,
           committee_date = $27,
           target_determination_date = $28,
           determined_date = $29,
           expiry_of_1st_stat_period_date = $30,
           eot_date = $31,
           six_months_appeal_window_date = $32,
           comments = $33,
           about_applicant = $34,
           project_type = COALESCE($36, project_type),
           project_lead_user_id = $37,
           project_manager_user_id = $38,
           project_director_user_id = $39
       WHERE id = $35
       RETURNING *`,
      [
        project_id, project_name, lpaJson, project_lead, project_manager,
        project_director, address, polygon_geojson, area, client,
        client_spv_name,
        sectors ? JSON.stringify(sectors) : null,
        sub_sectors ? JSON.stringify(sub_sectors) : null,
        development_types !== undefined ? JSON.stringify(development_types) : null,
        primaryDevType,
        designations_on_site,
        relevant_nearby_designations, status,
        development_description || null,
        case_officer_name || null,
        case_officer_email || null,
        case_officer_phone_number || null,
        lpa_reference || null,
        submission_date || null,
        validation_date || null,
        lpa_consultation_end_date || null,
        committee_date || null,
        target_determination_date || null,
        determined_date || null,
        expiry_of_1st_stat_period_date || null,
        eot_date || null,
        six_months_appeal_window_date || null,
        comments || null,
        about_applicant || null,
        id,
        project_type || null,
        project_lead_user_id || null,
        project_manager_user_id || null,
        project_director_user_id || null
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, project: result.rows[0] });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
}

// Whitelist of the project's fixed milestone date fields that can be marked
// resolved — maps the field key (as used by the frontend/Key Dates widget)
// to its companion `_resolved` column, so the column name is never built
// from request input.
const MILESTONE_RESOLVED_COLUMNS = {
  submission_date: 'submission_date_resolved',
  validation_date: 'validation_date_resolved',
  lpa_consultation_end_date: 'lpa_consultation_end_date_resolved',
  committee_date: 'committee_date_resolved',
  target_determination_date: 'target_determination_date_resolved',
  determined_date: 'determined_date_resolved',
  expiry_of_1st_stat_period_date: 'expiry_of_1st_stat_period_date_resolved',
  eot_date: 'eot_date_resolved',
  six_months_appeal_window_date: 'six_months_appeal_window_date_resolved',
};

// PATCH project milestone resolved flag
async function updateMilestoneResolved(req, res) {
  const { id } = req.params;
  const { field, is_resolved } = req.body;

  const column = MILESTONE_RESOLVED_COLUMNS[field];
  if (!column) {
    return res.status(400).json({ error: 'Unknown milestone date field' });
  }

  try {
    const result = await pool.query(
      `UPDATE projects SET ${column} = $1 WHERE id = $2 RETURNING id, ${column}`,
      [!!is_resolved, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating milestone resolved flag:', error);
    res.status(500).json({ error: 'Failed to update milestone date' });
  }
}

// DELETE project
async function deleteProject(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM projects WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
}

export {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  updateMilestoneResolved,
  deleteProject
};
