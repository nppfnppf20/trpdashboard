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
    project_lead,
    project_manager,
    project_director,
    address,
    polygon_geojson,
    area,
    client,
    client_spv_name,
    sector,
    sub_sector,
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

    // Insert into projects table
    const result = await pool.query(
      `INSERT INTO projects
       (project_id, project_name, local_planning_authority, project_lead,
        project_manager, project_director, address, polygon_geojson, area,
        client, client_spv_name, sector, sub_sector,
        designations_on_site, relevant_nearby_designations, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        project_id,
        project_name,
        lpaJson,
        project_lead || null,
        project_manager || null,
        project_director || null,
        address || null,
        polygon_geojson || null,
        area || null,
        client || null,
        client_spv_name || null,
        sector || null,
        sub_sector || null,
        designations_on_site || null,
        relevant_nearby_designations || null,
        status || null
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
              project_lead, project_manager, project_director, address, area,
              client, client_spv_name, sector, sub_sector,
              designations_on_site, relevant_nearby_designations, status,
              case_officer_name, case_officer_email, case_officer_phone_number,
              lpa_reference, submission_date, validation_date,
              lpa_consultation_end_date, committee_date, target_determination_date,
              determined_date, expiry_of_1st_stat_period_date, eot_date,
              six_months_appeal_window_date, comments,
              created_at, updated_at
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
    local_planning_authority,
    project_lead,
    project_manager,
    project_director,
    address,
    polygon_geojson,
    area,
    client,
    client_spv_name,
    sector,
    sub_sector,
    designations_on_site,
    relevant_nearby_designations,
    status,
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
    comments
  } = req.body;

  try {
    const lpaJson = local_planning_authority ? JSON.stringify(local_planning_authority) : undefined;

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
           sector = COALESCE($12, sector),
           sub_sector = COALESCE($13, sub_sector),
           designations_on_site = COALESCE($14, designations_on_site),
           relevant_nearby_designations = COALESCE($15, relevant_nearby_designations),
           status = COALESCE($16, status),
           case_officer_name = $17,
           case_officer_email = $18,
           case_officer_phone_number = $19,
           lpa_reference = $20,
           submission_date = $21,
           validation_date = $22,
           lpa_consultation_end_date = $23,
           committee_date = $24,
           target_determination_date = $25,
           determined_date = $26,
           expiry_of_1st_stat_period_date = $27,
           eot_date = $28,
           six_months_appeal_window_date = $29,
           comments = $30
       WHERE id = $31
       RETURNING *`,
      [
        project_id, project_name, lpaJson, project_lead, project_manager,
        project_director, address, polygon_geojson, area, client,
        client_spv_name, sector, sub_sector, designations_on_site,
        relevant_nearby_designations, status,
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
        id
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
  deleteProject
};
