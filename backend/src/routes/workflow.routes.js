/**
 * Workflow Routes
 * Routes for the project stages board and notification centre
 */

import express from 'express';
import {
  getWorkflowNotificationsHandler,
  getProjectStageBoardHandler,
  initializeProjectStageBoardHandler,
  completeProjectStageHandler,
  updateProjectStageHandler,
  toggleProjectStageApplicabilityHandler,
  getPriorStageEntriesHandler,
  reorderStageDefinitionsHandler,
  reorderIssueTracksHandler,
  createProjectIssueTrackHandler,
  updateProjectIssueTrackHandler
} from '../controllers/workflow.controller.js';

const router = express.Router();

// Notification centre
router.get('/notifications', getWorkflowNotificationsHandler);

// Project stage board
router.get('/projects/:projectId/stages', getProjectStageBoardHandler);
router.post('/projects/:projectId/stages/initialize', initializeProjectStageBoardHandler);
router.put('/projects/:projectId/stages/:stageId/complete', completeProjectStageHandler);
router.put('/projects/:projectId/stages/:stageId', updateProjectStageHandler);
router.put('/projects/:projectId/stages/:stageId/applicability', toggleProjectStageApplicabilityHandler);
router.get('/projects/:projectId/stages/:stageId/prior-entries', getPriorStageEntriesHandler);

// Stage reorder
router.put('/stages/reorder', reorderStageDefinitionsHandler);

// Issue tracks
router.put('/projects/:projectId/issues/reorder', reorderIssueTracksHandler);
router.post('/projects/:projectId/issues', createProjectIssueTrackHandler);
router.put('/issues/:issueId', updateProjectIssueTrackHandler);

export default router;
