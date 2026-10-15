import express from 'express';
import {
  getPlanningStages,
  updatePlanningStage,
  completeAndStartNext,
  setPlanningStagesApplicable,
} from '../controllers/planningStages.controller.js';

const router = express.Router();

// All seven stages for a project, plus whether the strip is shown for it
router.get('/projects/:projectId', getPlanningStages);
router.put('/projects/:projectId/applicable', setPlanningStagesApplicable);
router.put('/projects/:projectId/stages/:key', updatePlanningStage);
router.post('/projects/:projectId/stages/:key/complete-and-next', completeAndStartNext);

export default router;
