/**
 * Analysis Versioning Controller
 * Handles HTTP requests for analysis versioning endpoints
 */

import {
  saveOriginalAnalysis,
  saveEditedAnalysis,
  getOriginalAnalysis,
  getEditedAnalysis,
  getChanges,
  getAnalysisByProjectId
} from '../services/analysisVersioning.service.js';

/**
 * POST /api/analysis/save-original
 * Save the original (automated) analysis when it first runs
 */
export async function saveOriginal(req, res) {
  try {
    const userId = req.user?.id || null;

    const result = await saveOriginalAnalysis({
      ...req.body,
      userId
    });

    console.log(`✅ Original analysis saved: ${result.id}`);

    res.json({
      success: true,
      originalId: result.id,
      message: 'Original analysis saved successfully'
    });

  } catch (error) {
    console.error('❌ Error saving original analysis:', error);
    res.status(500).json({
      error: 'Failed to save original analysis',
      details: error.message
    });
  }
}

/**
 * PUT /api/analysis/:originalId/save-edited
 * Save the edited version and record changes
 */
export async function saveEdited(req, res) {
  try {
    const { originalId } = req.params;
    const { analysisData, changes } = req.body;
    const userId = req.user?.id || null;

    if (!originalId) {
      return res.status(400).json({ error: 'originalId is required' });
    }

    const result = await saveEditedAnalysis(
      originalId,
      { ...analysisData, userId },
      changes
    );

    console.log(`✅ Edited analysis saved for original: ${originalId}`);

    res.json({
      success: true,
      editedId: result.id,
      changesRecorded: changes?.length || 0,
      message: 'Edited analysis saved successfully'
    });

  } catch (error) {
    console.error('❌ Error saving edited analysis:', error);
    res.status(500).json({
      error: 'Failed to save edited analysis',
      details: error.message
    });
  }
}

/**
 * GET /api/analysis/:originalId
 * Get original analysis by ID
 */
export async function getOriginal(req, res) {
  try {
    const { originalId } = req.params;

    if (!originalId) {
      return res.status(400).json({ error: 'originalId is required' });
    }

    const original = await getOriginalAnalysis(originalId);

    res.json({
      success: true,
      data: original
    });

  } catch (error) {
    console.error('❌ Error fetching original analysis:', error);
    res.status(500).json({
      error: 'Failed to fetch original analysis',
      details: error.message
    });
  }
}

/**
 * GET /api/analysis/:originalId/edited
 * Get edited analysis by original ID
 */
export async function getEdited(req, res) {
  try {
    const { originalId } = req.params;

    if (!originalId) {
      return res.status(400).json({ error: 'originalId is required' });
    }

    const edited = await getEditedAnalysis(originalId);

    res.json({
      success: true,
      data: edited,
      hasEdits: edited !== null
    });

  } catch (error) {
    console.error('❌ Error fetching edited analysis:', error);
    res.status(500).json({
      error: 'Failed to fetch edited analysis',
      details: error.message
    });
  }
}

/**
 * GET /api/analysis/:originalId/changes
 * Get change history for an analysis
 */
export async function getChangeHistory(req, res) {
  try {
    const { originalId } = req.params;

    if (!originalId) {
      return res.status(400).json({ error: 'originalId is required' });
    }

    const changes = await getChanges(originalId);

    res.json({
      success: true,
      data: changes,
      count: changes.length
    });

  } catch (error) {
    console.error('❌ Error fetching changes:', error);
    res.status(500).json({
      error: 'Failed to fetch changes',
      details: error.message
    });
  }
}

/**
 * GET /api/analysis/project/:projectId
 * Get the most recent analysis for a project
 */
export async function getByProject(req, res) {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const original = await getAnalysisByProjectId(projectId);

    if (!original) {
      return res.json({
        success: true,
        data: null,
        message: 'No analysis found for this project'
      });
    }

    // Also fetch edited version if it exists
    const edited = await getEditedAnalysis(original.id);

    res.json({
      success: true,
      data: {
        original,
        edited,
        hasEdits: edited !== null
      }
    });

  } catch (error) {
    console.error('❌ Error fetching analysis by project:', error);
    res.status(500).json({
      error: 'Failed to fetch analysis',
      details: error.message
    });
  }
}

/**
 * GET /api/analysis/:originalId/full
 * Get complete analysis with original, edited, and changes
 */
export async function getFullAnalysis(req, res) {
  try {
    const { originalId } = req.params;

    if (!originalId) {
      return res.status(400).json({ error: 'originalId is required' });
    }

    const [original, edited, changes] = await Promise.all([
      getOriginalAnalysis(originalId),
      getEditedAnalysis(originalId),
      getChanges(originalId)
    ]);

    res.json({
      success: true,
      data: {
        original,
        edited,
        changes,
        hasEdits: edited !== null,
        changeCount: changes.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching full analysis:', error);
    res.status(500).json({
      error: 'Failed to fetch full analysis',
      details: error.message
    });
  }
}
