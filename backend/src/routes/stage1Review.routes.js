/**
 * Stage 1 Review Routes
 */

import express from 'express';
import { generateStage1Review, getStage1Context } from '../controllers/stage1Review.controller.js';

const router = express.Router();

router.post('/projects/:projectId/generate', generateStage1Review);
router.get('/projects/:projectId/context', getStage1Context);

export default router;
