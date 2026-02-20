/**
 * Conflict Check Controller
 * Handles HTTP requests for conflict checking endpoints
 */

import { conflictCheckService } from '../services/conflictCheck.service.js';
import { conflictCheckPersistenceService } from '../services/conflictCheckPersistence.service.js';

export async function runConflictCheck(req, res) {
  try {
    const { polygon, excludeProjectId, projectId, saveResults = true } = req.body;

    console.log('🔍 Running conflict check...');
    console.log('Polygon received:', JSON.stringify(polygon));
    console.log('Excluding project ID:', excludeProjectId);
    console.log('Save results:', saveResults);

    const results = await conflictCheckService.runConflictCheck(polygon, excludeProjectId);

    console.log(`✅ Conflict check complete: ${results.summary.total} conflicts found in ${results.metadata.queryTime}`);

    // Save results to database if projectId is provided and saveResults is true
    if (projectId && saveResults) {
      try {
        const savedCheck = await conflictCheckPersistenceService.saveConflictCheck(projectId, results);
        results.savedCheckId = savedCheck.id;
        console.log(`💾 Saved conflict check with ID: ${savedCheck.id}`);
      } catch (saveError) {
        console.error('❌ Error saving conflict check:', saveError);
        // Don't fail the request if saving fails, just log it
        results.saveError = 'Failed to save results';
      }
    }

    res.json(results);
  } catch (error) {
    console.error('❌ Error running conflict check:', {
      message: error?.message,
      detail: error?.detail,
      hint: error?.hint,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Failed to run conflict check', details: error.message });
  }
}

export async function getLatestConflictCheck(req, res) {
  try {
    const { projectId } = req.params;

    console.log(`📋 Fetching latest conflict check for project ${projectId}`);

    const conflictCheck = await conflictCheckPersistenceService.getLatestConflictCheck(projectId);

    if (!conflictCheck) {
      return res.status(404).json({ error: 'No conflict check found for this project' });
    }

    res.json(conflictCheck);
  } catch (error) {
    console.error('❌ Error fetching conflict check:', error);
    res.status(500).json({ error: 'Failed to fetch conflict check', details: error.message });
  }
}

export async function getConflictCheckHistory(req, res) {
  try {
    const { projectId } = req.params;

    console.log(`📜 Fetching conflict check history for project ${projectId}`);

    const history = await conflictCheckPersistenceService.getConflictCheckHistory(projectId);

    res.json(history);
  } catch (error) {
    console.error('❌ Error fetching conflict check history:', error);
    res.status(500).json({ error: 'Failed to fetch conflict check history', details: error.message });
  }
}

export async function getConflictCheckById(req, res) {
  try {
    const { checkId } = req.params;

    console.log(`📋 Fetching conflict check ${checkId}`);

    const conflictCheck = await conflictCheckPersistenceService.getConflictCheckById(checkId);

    if (!conflictCheck) {
      return res.status(404).json({ error: 'Conflict check not found' });
    }

    res.json(conflictCheck);
  } catch (error) {
    console.error('❌ Error fetching conflict check:', error);
    res.status(500).json({ error: 'Failed to fetch conflict check', details: error.message });
  }
}

export async function deleteConflict(req, res) {
  try {
    const { conflictId } = req.params;

    if (!conflictId) {
      return res.status(400).json({ error: 'conflictId is required' });
    }

    const result = await conflictCheckPersistenceService.deleteConflict(conflictId);

    console.log(`✅ Deleted conflict ${conflictId}`);

    res.json({ success: true, deleted: result });
  } catch (error) {
    console.error('❌ Error deleting conflict:', error);
    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'Failed to delete conflict' });
  }
}

