/**
 * Projects Service
 * Business logic for project information management
 */

import { pool } from '../db.js';

/**
 * Update or insert project information
 * @param {string} projectId - Project UUID
 * @param {Object} data - Project information fields
 * @returns {Promise<Object>} Updated project information
 */
export async function updateProjectInformation(projectId, data) {
  const {
    client_or_spv_name,
    detailed_description,
    proposed_use_duration,
    distribution_network,
    solar_export_capacity,
    pv_max_panel_height,
    fence_height,
    pv_clearance_from_ground,
    number_of_solar_panels,
    panel_tilt,
    panel_tilt_direction,
    bess_export_capacity,
    bess_containers,
    gwh_per_year,
    homes_powered,
    co2_offset,
    equivalent_cars,
    access_arrangements,
    access_contact,
    parking_details,
    atv_use,
    additional_notes,
    invoicing_details,
    sharepoint_link
  } = data;

  // First check if project exists
  const projectCheck = await pool.query(
    'SELECT unique_id FROM projects WHERE unique_id = $1',
    [projectId]
  );

  if (projectCheck.rows.length === 0) {
    throw new Error('Project not found');
  }

  // Use UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
  const result = await pool.query(
    `INSERT INTO admin_console.project_information (
      project_id,
      client_or_spv_name,
      detailed_description,
      proposed_use_duration,
      distribution_network,
      solar_export_capacity,
      pv_max_panel_height,
      fence_height,
      pv_clearance_from_ground,
      number_of_solar_panels,
      panel_tilt,
      panel_tilt_direction,
      bess_export_capacity,
      bess_containers,
      gwh_per_year,
      homes_powered,
      co2_offset,
      equivalent_cars,
      access_arrangements,
      access_contact,
      parking_details,
      atv_use,
      additional_notes,
      invoicing_details,
      sharepoint_link
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    ON CONFLICT (project_id) 
    DO UPDATE SET
      client_or_spv_name = COALESCE($2, project_information.client_or_spv_name),
      detailed_description = COALESCE($3, project_information.detailed_description),
      proposed_use_duration = COALESCE($4, project_information.proposed_use_duration),
      distribution_network = COALESCE($5, project_information.distribution_network),
      solar_export_capacity = COALESCE($6, project_information.solar_export_capacity),
      pv_max_panel_height = COALESCE($7, project_information.pv_max_panel_height),
      fence_height = COALESCE($8, project_information.fence_height),
      pv_clearance_from_ground = COALESCE($9, project_information.pv_clearance_from_ground),
      number_of_solar_panels = COALESCE($10, project_information.number_of_solar_panels),
      panel_tilt = COALESCE($11, project_information.panel_tilt),
      panel_tilt_direction = COALESCE($12, project_information.panel_tilt_direction),
      bess_export_capacity = COALESCE($13, project_information.bess_export_capacity),
      bess_containers = COALESCE($14, project_information.bess_containers),
      gwh_per_year = COALESCE($15, project_information.gwh_per_year),
      homes_powered = COALESCE($16, project_information.homes_powered),
      co2_offset = COALESCE($17, project_information.co2_offset),
      equivalent_cars = COALESCE($18, project_information.equivalent_cars),
      access_arrangements = COALESCE($19, project_information.access_arrangements),
      access_contact = COALESCE($20, project_information.access_contact),
      parking_details = COALESCE($21, project_information.parking_details),
      atv_use = COALESCE($22, project_information.atv_use),
      additional_notes = COALESCE($23, project_information.additional_notes),
      invoicing_details = COALESCE($24, project_information.invoicing_details),
      sharepoint_link = COALESCE($25, project_information.sharepoint_link),
      updated_at = NOW()
    RETURNING *`,
    [
      projectId,
      client_or_spv_name,
      detailed_description,
      proposed_use_duration,
      distribution_network,
      solar_export_capacity,
      pv_max_panel_height,
      fence_height,
      pv_clearance_from_ground,
      number_of_solar_panels,
      panel_tilt,
      panel_tilt_direction,
      bess_export_capacity,
      bess_containers,
      gwh_per_year,
      homes_powered,
      co2_offset,
      equivalent_cars,
      access_arrangements,
      access_contact,
      parking_details,
      atv_use,
      additional_notes,
      invoicing_details,
      sharepoint_link
    ]
  );

  return result.rows[0];
}

/**
 * Get project information by project ID
 * @param {string} projectId - Project UUID
 * @returns {Promise<Object|null>} Project information or null
 */
export async function getProjectInformation(projectId) {
  const result = await pool.query(
    'SELECT * FROM admin_console.project_information WHERE project_id = $1',
    [projectId]
  );

  return result.rows[0] || null;
}
