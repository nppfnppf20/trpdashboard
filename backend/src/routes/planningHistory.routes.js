import express from 'express';
import {
  listPlanningHistory,
  createPlanningHistory,
  updatePlanningHistory,
  deletePlanningHistory
} from '../controllers/planningHistory.controller.js';

const router = express.Router();

router.get('/projects/:projectId/planning-history', listPlanningHistory);
router.post('/projects/:projectId/planning-history', createPlanningHistory);
router.put('/planning-history/:id', updatePlanningHistory);
router.delete('/planning-history/:id', deletePlanningHistory);

export default router;
