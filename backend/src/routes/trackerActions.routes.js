import express from 'express';
import {
  getTrackerActions,
  getStagedActions,
  confirmStagedActions,
  dismissStagedActions,
  createTrackerAction,
  updateTrackerAction,
  deleteTrackerAction,
  intakeText,
  saveIntakeUpdates,
  addActionUpdate,
  deleteActionUpdate
} from '../controllers/trackerActions.controller.js';

const router = express.Router();

router.get('/projects/:projectId', getTrackerActions);
router.get('/projects/:projectId/staged', getStagedActions);
router.post('/projects/:projectId/confirm', confirmStagedActions);
router.post('/projects/:projectId/dismiss', dismissStagedActions);
router.post('/projects/:projectId/actions', createTrackerAction);
router.post('/projects/:projectId/intake', intakeText);
router.post('/projects/:projectId/intake/save', saveIntakeUpdates);
router.put('/actions/:actionId', updateTrackerAction);
router.delete('/actions/:actionId', deleteTrackerAction);
router.post('/actions/:actionId/updates', addActionUpdate);
router.delete('/updates/:updateId', deleteActionUpdate);

export default router;
