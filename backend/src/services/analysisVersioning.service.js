/**
 * Analysis Versioning Service
 * Handles saving original analyses, edited versions, and tracking changes
 */

import { supabaseAdmin as supabase } from '../supabase.js';

/**
 * Save the original analysis (immutable, called when analysis first runs)
 * @param {Object} data - The analysis data to save
 * @returns {Promise<Object>} The saved original analysis record
 */
export async function saveOriginalAnalysis(data) {
  const {
    projectId,
    siteName,
    polygonGeojson,
    heritageData,
    landscapeData,
    renewablesData,
    ecologyData,
    agLandData,
    treesData,
    airfieldsData,
    floodData,
    aviationData,
    highwaysData,
    amenityData,
    userId
  } = data;

  const { data: result, error } = await supabase
    .from('analysis_original')
    .insert({
      project_id: projectId || null,
      site_name: siteName,
      polygon_geojson: JSON.stringify(polygonGeojson),
      heritage_data: heritageData || null,
      landscape_data: landscapeData || null,
      renewables_data: renewablesData || null,
      ecology_data: ecologyData || null,
      ag_land_data: agLandData || null,
      trees_data: treesData || null,
      airfields_data: airfieldsData || null,
      flood_data: floodData || null,
      aviation_data: aviationData || null,
      highways_data: highwaysData || null,
      amenity_data: amenityData || null,
      created_by: userId || null
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving original analysis:', error);
    throw new Error(`Failed to save original analysis: ${error.message}`);
  }

  return result;
}

/**
 * Save or update the edited analysis
 * @param {string} originalId - The ID of the original analysis
 * @param {Object} data - The edited analysis data
 * @param {Array} changes - Array of field-level changes with reasons
 * @returns {Promise<Object>} The saved/updated edited analysis record
 */
export async function saveEditedAnalysis(originalId, data, changes = []) {
  const {
    heritageData,
    landscapeData,
    renewablesData,
    ecologyData,
    agLandData,
    treesData,
    airfieldsData,
    floodData,
    aviationData,
    highwaysData,
    amenityData,
    userId
  } = data;

  // Upsert the edited analysis (insert or update if exists)
  const { data: result, error } = await supabase
    .from('analysis_edited')
    .upsert({
      original_id: originalId,
      heritage_data: heritageData || null,
      landscape_data: landscapeData || null,
      renewables_data: renewablesData || null,
      ecology_data: ecologyData || null,
      ag_land_data: agLandData || null,
      trees_data: treesData || null,
      airfields_data: airfieldsData || null,
      flood_data: floodData || null,
      aviation_data: aviationData || null,
      highways_data: highwaysData || null,
      amenity_data: amenityData || null,
      updated_by: userId || null
    }, {
      onConflict: 'original_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving edited analysis:', error);
    throw new Error(`Failed to save edited analysis: ${error.message}`);
  }

  // Record changes if any
  if (changes && changes.length > 0) {
    await recordChanges(originalId, changes, userId);
  }

  return result;
}

/**
 * Record field-level changes to the audit log
 * @param {string} originalId - The ID of the original analysis
 * @param {Array} changes - Array of changes to record
 * @param {string} userId - The user making the changes
 */
export async function recordChanges(originalId, changes, userId = null) {
  const changeRecords = changes.map(change => ({
    original_id: originalId,
    discipline: change.discipline,
    field_path: change.fieldPath,
    old_value: change.oldValue,
    new_value: change.newValue,
    reason: change.reason || null,
    changed_by: userId
  }));

  const { error } = await supabase
    .from('analysis_changes')
    .insert(changeRecords);

  if (error) {
    console.error('Error recording changes:', error);
    throw new Error(`Failed to record changes: ${error.message}`);
  }
}

/**
 * Get the original analysis by ID
 * @param {string} originalId - The ID of the original analysis
 * @returns {Promise<Object>} The original analysis record
 */
export async function getOriginalAnalysis(originalId) {
  const { data, error } = await supabase
    .from('analysis_original')
    .select('*')
    .eq('id', originalId)
    .single();

  if (error) {
    console.error('Error fetching original analysis:', error);
    throw new Error(`Failed to fetch original analysis: ${error.message}`);
  }

  return data;
}

/**
 * Get the edited analysis by original ID
 * @param {string} originalId - The ID of the original analysis
 * @returns {Promise<Object|null>} The edited analysis record or null
 */
export async function getEditedAnalysis(originalId) {
  const { data, error } = await supabase
    .from('analysis_edited')
    .select('*')
    .eq('original_id', originalId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching edited analysis:', error);
    throw new Error(`Failed to fetch edited analysis: ${error.message}`);
  }

  return data || null;
}

/**
 * Get all changes for an analysis
 * @param {string} originalId - The ID of the original analysis
 * @returns {Promise<Array>} Array of change records
 */
export async function getChanges(originalId) {
  const { data, error } = await supabase
    .from('analysis_changes')
    .select('*')
    .eq('original_id', originalId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('Error fetching changes:', error);
    throw new Error(`Failed to fetch changes: ${error.message}`);
  }

  return data || [];
}

/**
 * Get analysis by project ID (most recent)
 * @param {string} projectId - The project ID
 * @returns {Promise<Object|null>} The most recent original analysis for the project
 */
export async function getAnalysisByProjectId(projectId) {
  const { data, error } = await supabase
    .from('analysis_original')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching analysis by project:', error);
    throw new Error(`Failed to fetch analysis: ${error.message}`);
  }

  return data || null;
}
