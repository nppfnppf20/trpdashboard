import express from 'express';
import {
  getActionsForProject,
  createActions,
  suggestActions,
  updateAction,
  deleteAction,
} from '../controllers/quoteActions.controller.js';

const router = express.Router();

router.get('/projects/:projectId', getActionsForProject);
router.post('/projects/:projectId/actions', createActions);
router.post('/projects/:projectId/actions/suggest', suggestActions);
router.put('/actions/:actionId', updateAction);
router.delete('/actions/:actionId', deleteAction);

export default router;
