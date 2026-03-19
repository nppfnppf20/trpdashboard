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
  saveStageEntryHandler,
  getCurrentStageEntriesHandler,
  reorderStageDefinitionsHandler,
  reorderIssueTracksHandler,
  createProjectIssueTrackHandler,
  updateProjectIssueTrackHandler,
  createProjectKeyIssueHandler
} from '../controllers/workflow.controller.js';
import {
  getRefusalReasonsHandler,
  createRefusalReasonHandler,
  updateRefusalReasonHandler,
  deleteRefusalReasonHandler,
  reorderRefusalReasonsHandler
} from '../controllers/refusalReasons.controller.js';

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
router.put('/projects/:projectId/stages/:stageId/entry', saveStageEntryHandler);
router.get('/projects/:projectId/stages/:stageId/entries', getCurrentStageEntriesHandler);

// Stage reorder
router.put('/stages/reorder', reorderStageDefinitionsHandler);

// Issue tracks
router.put('/projects/:projectId/issues/reorder', reorderIssueTracksHandler);
router.post('/projects/:projectId/issues', createProjectIssueTrackHandler);
router.put('/issues/:issueId', updateProjectIssueTrackHandler);

// Key issues
router.post('/projects/:projectId/key-issues', createProjectKeyIssueHandler);

// Refusal reasons (appeal projects)
router.get('/projects/:projectId/refusal-reasons', getRefusalReasonsHandler);
router.post('/projects/:projectId/refusal-reasons', createRefusalReasonHandler);
router.put('/projects/:projectId/refusal-reasons/:reasonId', updateRefusalReasonHandler);
router.delete('/projects/:projectId/refusal-reasons/:reasonId', deleteRefusalReasonHandler);
router.put('/projects/:projectId/refusal-reasons/reorder', reorderRefusalReasonsHandler);

export default router;
