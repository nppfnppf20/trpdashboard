/**
 * Analysis Session Controller
 * Handles HTTP requests for normalized analysis data
 */

import {
  createAnalysisSession,
  getSessionByProjectId,
  getFullSessionData,
  getReconstructedAnalysisData,
  saveEdit,
  logChange,
  getChangeLog
} from '../services/analysisSession.service.js';

/**
 * POST /api/session/create
 * Create a new analysis session with all data
 */
export async function createSession(req, res) {
  try {
    const userId = req.user?.id || null;

    const session = await createAnalysisSession({
      ...req.body,
      userId
    });

    console.log(`✅ Analysis session created: ${session.id}`);

    res.json({
      success: true,
      sessionId: session.id,
      message: 'Analysis session created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating analysis session:', error);
    res.status(500).json({
      error: 'Failed to create analysis session',
      details: error.message
    });
  }
}

/**
 * GET /api/session/project/:projectId
 * Get the most recent session for a project
 */
export async function getByProject(req, res) {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const session = await getSessionByProjectId(projectId);

    if (!session) {
      return res.json({
        success: true,
        data: null,
        message: 'No analysis session found for this project'
      });
    }

    // Get full reconstructed data
    const analysisData = await getReconstructedAnalysisData(session.id);

    res.json({
      success: true,
      data: analysisData
    });

  } catch (error) {
    console.error('❌ Error fetching session by project:', error);
    res.status(500).json({
      error: 'Failed to fetch analysis session',
      details: error.message
    });
  }
}

/**
 * GET /api/session/:sessionId
 * Get full session data by ID
 */
export async function getSession(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const analysisData = await getReconstructedAnalysisData(sessionId);

    res.json({
      success: true,
      data: analysisData
    });

  } catch (error) {
    console.error('❌ Error fetching session:', error);
    res.status(500).json({
      error: 'Failed to fetch analysis session',
      details: error.message
    });
  }
}

/**
 * GET /api/session/:sessionId/raw
 * Get raw normalized data (for debugging/admin)
 */
export async function getSessionRaw(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const fullData = await getFullSessionData(sessionId);

    res.json({
      success: true,
      data: fullData
    });

  } catch (error) {
    console.error('❌ Error fetching raw session data:', error);
    res.status(500).json({
      error: 'Failed to fetch session data',
      details: error.message
    });
  }
}

/**
 * PUT /api/session/:sessionId/edit
 * Save edits to a discipline
 */
export async function saveSessionEdit(req, res) {
  try {
    const { sessionId } = req.params;
    const { discipline, editedRisk, editedRecommendations, changes } = req.body;
    const userId = req.user?.id || null;

    if (!sessionId || !discipline) {
      return res.status(400).json({ error: 'sessionId and discipline are required' });
    }

    // Save the edit
    const edit = await saveEdit(sessionId, discipline, editedRisk, editedRecommendations, userId);

    // Log changes if provided
    if (changes && Array.isArray(changes)) {
      for (const change of changes) {
        await logChange(
          sessionId,
          change.discipline || discipline,
          change.fieldPath,
          change.oldValue,
          change.newValue,
          change.reason,
          userId
        );
      }
    }

    console.log(`✅ Edit saved for session ${sessionId}, discipline ${discipline}`);

    res.json({
      success: true,
      editId: edit.id,
      changesLogged: changes?.length || 0,
      message: 'Edit saved successfully'
    });

  } catch (error) {
    console.error('❌ Error saving edit:', error);
    res.status(500).json({
      error: 'Failed to save edit',
      details: error.message
    });
  }
}

/**
 * GET /api/session/:sessionId/changes
 * Get change log for a session
 */
export async function getSessionChanges(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const changes = await getChangeLog(sessionId);

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
