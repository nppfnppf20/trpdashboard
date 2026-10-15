import express from 'express';
import {
  getPlanningStagesOverview,
  getPlanningStages,
  updatePlanningStage,
  completeAndStartNext,
  setPlanningStagesApplicable,
} from '../controllers/planningStages.controller.js';

const router = express.Router();

// Every project's stage statuses in one call, for the global projects table
router.get('/overview', getPlanningStagesOverview);

// All seven stages for a project, plus whether the strip is shown for it
router.get('/projects/:projectId', getPlanningStages);
router.put('/projects/:projectId/applicable', setPlanningStagesApplicable);
router.put('/projects/:projectId/stages/:key', updatePlanningStage);
router.post('/projects/:projectId/stages/:key/complete-and-next', completeAndStartNext);

export default router;
