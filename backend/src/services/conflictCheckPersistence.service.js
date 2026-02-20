/**
 * Conflict Check Persistence Service
 * Handles saving and retrieving conflict check results from the database
 */

import { pool } from '../db.js';

export const conflictCheckPersistenceService = {
  /**
   * Save conflict check results to the database
   * @param {number} projectId - The project ID
   * @param {Object} results - The conflict check results object
   * @returns {Object} The saved conflict check record
   */
  async saveConflictCheck(projectId, results) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert conflict check metadata
      const checkQuery = `
        INSERT INTO conflict.conflict_checks (
          project_id,
          checked_at,
          total_conflicts
        ) VALUES ($1, $2, $3)
        RETURNING id, checked_at, total_conflicts
      `;

      const checkResult = await client.query(checkQuery, [
        projectId,
        new Date(results.metadata.checkedAt),
        results.summary.total
      ]);

      const conflictCheckId = checkResult.rows[0].id;

      // Insert individual conflicts
      if (results.summary.total > 0) {
        const allConflicts = [
          ...results.conflicts.intersecting,
          ...results.conflicts.within_100m,
          ...results.conflicts.within_250m,
          ...results.conflicts.within_500m,
          ...results.conflicts.within_1km,
          ...results.conflicts.within_3km,
          ...results.conflicts.within_5km
        ];

        for (const conflict of allConflicts) {
          const conflictSourceId = String(
            conflict.id || 
            conflict.ref_id || 
            conflict.uid || 
            conflict.project_id || 
            'unknown'
          );
          
          await client.query(`
            INSERT INTO conflict.conflicts (
              conflict_check_id,
              project_id,
              conflict_layer,
              conflict_source_id,
              layer_group,
              layer_name,
              distance_meters,
              distance_category,
              conflict_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            conflictCheckId,
            projectId,
            conflict.layer,
            conflictSourceId,
            conflict.layerGroup,
            conflict.layerName,
            conflict.distance,
            conflict.distance_category,
            JSON.stringify(conflict)
          ]);
        }
      }

      // Update projects table with latest conflict check reference
      await client.query(`
        UPDATE public.projects 
        SET latest_conflict_check_id = $1 
        WHERE id = $2
      `, [conflictCheckId, projectId]);

      await client.query('COMMIT');

      console.log(`✅ Saved conflict check ${conflictCheckId} for project ${projectId} with ${results.summary.total} conflicts`);

      return checkResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error saving conflict check:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get the latest conflict check for a project
   * @param {number} projectId - The project ID
   * @returns {Object|null} The latest conflict check results or null
   */
  async getLatestConflictCheck(projectId) {
    // Get the latest check metadata
    const checkQuery = `
      SELECT 
        id,
        project_id,
        checked_at,
        total_conflicts,
        created_at
      FROM conflict.conflict_checks
      WHERE project_id = $1
      ORDER BY checked_at DESC
      LIMIT 1
    `;

    const checkResult = await pool.query(checkQuery, [projectId]);
    
    if (checkResult.rows.length === 0) {
      return null;
    }

    const check = checkResult.rows[0];

    // Get all conflicts for this check
    const conflictsQuery = `
      SELECT 
        id,
        conflict_layer,
        conflict_source_id,
        layer_group,
        layer_name,
        distance_meters,
        distance_category,
        conflict_data
      FROM conflict.conflicts
      WHERE conflict_check_id = $1
      ORDER BY distance_meters
    `;

    const conflictsResult = await pool.query(conflictsQuery, [check.id]);

    // Reconstruct the results object
    const conflicts = conflictsResult.rows.map(row => ({
      ...row.conflict_data,
      conflictId: row.id // Add the database ID for delete functionality
    }));

    // Group by distance category
    const groupedConflicts = {
      intersecting: conflicts.filter(c => c.distance_category === 'intersecting'),
      within_100m: conflicts.filter(c => c.distance_category === 'within_100m'),
      within_250m: conflicts.filter(c => c.distance_category === 'within_250m'),
      within_500m: conflicts.filter(c => c.distance_category === 'within_500m'),
      within_1km: conflicts.filter(c => c.distance_category === 'within_1km'),
      within_3km: conflicts.filter(c => c.distance_category === 'within_3km'),
      within_5km: conflicts.filter(c => c.distance_category === 'within_5km')
    };

    // Calculate summary
    const summary = {
      total: conflicts.length,
      intersecting: groupedConflicts.intersecting.length,
      within_100m: groupedConflicts.within_100m.length,
      within_250m: groupedConflicts.within_250m.length,
      within_500m: groupedConflicts.within_500m.length,
      within_1km: groupedConflicts.within_1km.length,
      within_3km: groupedConflicts.within_3km.length,
      within_5km: groupedConflicts.within_5km.length
    };

    return {
      id: check.id,
      project_id: check.project_id,
      checked_at: check.checked_at,
      total_conflicts: check.total_conflicts,
      created_at: check.created_at,
      results: {
        summary,
        conflicts: groupedConflicts,
        metadata: {
          checkedAt: check.checked_at,
          layersChecked: 9,
          queryTime: 'N/A'
        }
      }
    };
  },

  /**
   * Get all conflict checks for a project (history)
   * @param {number} projectId - The project ID
   * @returns {Array} Array of conflict check records
   */
  async getConflictCheckHistory(projectId) {
    const query = `
      SELECT 
        id,
        project_id,
        checked_at,
        total_conflicts,
        created_at
      FROM conflict.conflict_checks
      WHERE project_id = $1
      ORDER BY checked_at DESC
    `;

    const result = await pool.query(query, [projectId]);
    return result.rows;
  },

  /**
   * Get a specific conflict check by ID
   * @param {number} conflictCheckId - The conflict check ID
   * @returns {Object|null} The conflict check results or null
   */
  async getConflictCheckById(conflictCheckId) {
    const checkQuery = `
      SELECT 
        id,
        project_id,
        checked_at,
        total_conflicts,
        created_at
      FROM conflict.conflict_checks
      WHERE id = $1
    `;

    const checkResult = await pool.query(checkQuery, [conflictCheckId]);
    
    if (checkResult.rows.length === 0) {
      return null;
    }

    const check = checkResult.rows[0];

    // Get all conflicts for this check
    const conflictsQuery = `
      SELECT 
        id,
        conflict_layer,
        conflict_source_id,
        layer_group,
        layer_name,
        distance_meters,
        distance_category,
        conflict_data
      FROM conflict.conflicts
      WHERE conflict_check_id = $1
      ORDER BY distance_meters
    `;

    const conflictsResult = await pool.query(conflictsQuery, [check.id]);

    // Reconstruct the results object
    const conflicts = conflictsResult.rows.map(row => ({
      ...row.conflict_data,
      conflictId: row.id
    }));

    // Group by distance category
    const groupedConflicts = {
      intersecting: conflicts.filter(c => c.distance_category === 'intersecting'),
      within_100m: conflicts.filter(c => c.distance_category === 'within_100m'),
      within_250m: conflicts.filter(c => c.distance_category === 'within_250m'),
      within_500m: conflicts.filter(c => c.distance_category === 'within_500m'),
      within_1km: conflicts.filter(c => c.distance_category === 'within_1km'),
      within_3km: conflicts.filter(c => c.distance_category === 'within_3km'),
      within_5km: conflicts.filter(c => c.distance_category === 'within_5km')
    };

    // Calculate summary
    const summary = {
      total: conflicts.length,
      intersecting: groupedConflicts.intersecting.length,
      within_100m: groupedConflicts.within_100m.length,
      within_250m: groupedConflicts.within_250m.length,
      within_500m: groupedConflicts.within_500m.length,
      within_1km: groupedConflicts.within_1km.length,
      within_3km: groupedConflicts.within_3km.length,
      within_5km: groupedConflicts.within_5km.length
    };

    return {
      id: check.id,
      project_id: check.project_id,
      checked_at: check.checked_at,
      total_conflicts: check.total_conflicts,
      created_at: check.created_at,
      results: {
        summary,
        conflicts: groupedConflicts,
        metadata: {
          checkedAt: check.checked_at,
          layersChecked: 9,
          queryTime: 'N/A'
        }
      }
    };
  },

  /**
   * Delete a conflict check
   * @param {number} conflictCheckId - The conflict check ID
   */
  async deleteConflictCheck(conflictCheckId) {
    const query = `
      DELETE FROM conflict.conflict_checks
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [conflictCheckId]);
    return result.rows.length > 0;
  },

  /**
   * Delete a conflict permanently
   * @param {number} conflictId - The conflict ID from conflict.conflicts table
   */
  async deleteConflict(conflictId) {
    const query = `
      DELETE FROM conflict.conflicts
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [conflictId]);
    
    if (result.rows.length === 0) {
      const error = new Error('Conflict not found');
      error.status = 404;
      throw error;
    }

    return true;
  }
};
