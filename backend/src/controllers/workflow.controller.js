/**
 * Workflow Controller
 * Handles HTTP requests for the project stages board and notification centre
 */

import {
  getWorkflowNotifications,
  getProjectStageBoard,
  initializeProjectStageBoard,
  completeProjectStage,
  updateProjectStage,
  toggleProjectStageApplicability,
  getPriorStageEntries,
  reorderStageDefinitions,
  reorderIssueTracks,
  createProjectIssueTrack,
  updateProjectIssueTrack
} from '../services/workflow.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Notification Centre
// ─────────────────────────────────────────────────────────────────────────────

export async function getWorkflowNotificationsHandler(req, res) {
  try {
    const scope = req.query.scope === 'mine' ? 'mine' : 'team';
    const userName = req.query.userName || null;

    const filters = {
      projectId: req.query.projectId ? parseInt(req.query.projectId) : null,
      sourceType: req.query.sourceType || null,
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null
    };

    const items = await getWorkflowNotifications(scope, userName, filters);
    res.json({ items });
  } catch (error) {
    console.error('Error fetching workflow notifications:', error);
    res.status(500).json({ error: 'Failed to fetch workflow notifications' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Stage Board
// ─────────────────────────────────────────────────────────────────────────────

export async function getProjectStageBoardHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const board = await getProjectStageBoard(projectId);
    res.json(board);
  } catch (error) {
    console.error('Error fetching project stage board:', error);
    res.status(500).json({ error: 'Failed to fetch project stage board' });
  }
}

export async function initializeProjectStageBoardHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    await initializeProjectStageBoard(projectId);
    const board = await getProjectStageBoard(projectId);
    res.json(board);
  } catch (error) {
    console.error('Error initializing project stage board:', error);
    res.status(500).json({ error: 'Failed to initialize project stage board' });
  }
}

export async function completeProjectStageHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const stageInstanceId = parseInt(req.params.stageId);
    if (isNaN(projectId) || isNaN(stageInstanceId)) {
      return res.status(400).json({ error: 'Invalid project or stage ID' });
    }

    const { entries, completedBy } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries must be an array' });
    }

    await completeProjectStage(projectId, stageInstanceId, entries, completedBy || null);
    const board = await getProjectStageBoard(projectId);
    res.json(board);
  } catch (error) {
    console.error('Error completing project stage:', error);
    res.status(500).json({ error: 'Failed to complete project stage' });
  }
}

export async function updateProjectStageHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const stageInstanceId = parseInt(req.params.stageId);
    if (isNaN(projectId) || isNaN(stageInstanceId)) {
      return res.status(400).json({ error: 'Invalid project or stage ID' });
    }

    const updated = await updateProjectStage(projectId, stageInstanceId, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating project stage:', error);
    res.status(500).json({ error: 'Failed to update project stage' });
  }
}

export async function toggleProjectStageApplicabilityHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const stageInstanceId = parseInt(req.params.stageId);
    if (isNaN(projectId) || isNaN(stageInstanceId)) {
      return res.status(400).json({ error: 'Invalid project or stage ID' });
    }

    const result = await toggleProjectStageApplicability(projectId, stageInstanceId);
    res.json(result);
  } catch (error) {
    console.error('Error toggling stage applicability:', error);
    res.status(500).json({ error: 'Failed to toggle stage applicability' });
  }
}

export async function getPriorStageEntriesHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const stageInstanceId = parseInt(req.params.stageId);
    if (isNaN(projectId) || isNaN(stageInstanceId)) {
      return res.status(400).json({ error: 'Invalid project or stage ID' });
    }

    const entries = await getPriorStageEntries(projectId, stageInstanceId);
    res.json({ entries });
  } catch (error) {
    console.error('Error fetching prior stage entries:', error);
    res.status(500).json({ error: 'Failed to fetch prior stage entries' });
  }
}

export async function reorderStageDefinitionsHandler(req, res) {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.some(id => typeof id !== 'number')) {
      return res.status(400).json({ error: 'orderedIds must be an array of numbers' });
    }
    await reorderStageDefinitions(orderedIds);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error reordering stage definitions:', error);
    res.status(500).json({ error: 'Failed to reorder stages' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue Tracks
// ─────────────────────────────────────────────────────────────────────────────

export async function reorderIssueTracksHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.some(id => typeof id !== 'number')) {
      return res.status(400).json({ error: 'orderedIds must be an array of numbers' });
    }
    await reorderIssueTracks(projectId, orderedIds);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error reordering issue tracks:', error);
    res.status(500).json({ error: 'Failed to reorder issue tracks' });
  }
}

export async function createProjectIssueTrackHandler(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const { label, sortOrder } = req.body;
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'label is required' });
    }

    const track = await createProjectIssueTrack(projectId, { label: label.trim(), sortOrder });
    res.status(201).json(track);
  } catch (error) {
    console.error('Error creating issue track:', error);
    res.status(500).json({ error: 'Failed to create issue track' });
  }
}

export async function updateProjectIssueTrackHandler(req, res) {
  try {
    const issueTrackId = parseInt(req.params.issueId);
    if (isNaN(issueTrackId)) return res.status(400).json({ error: 'Invalid issue track ID' });

    const updated = await updateProjectIssueTrack(issueTrackId, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating issue track:', error);
    res.status(500).json({ error: 'Failed to update issue track' });
  }
}
