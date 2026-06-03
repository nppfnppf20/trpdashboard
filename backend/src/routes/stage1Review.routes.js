/**
 * Stage 1 Review Routes
 */

import express from 'express';
import { generateStage1Review } from '../controllers/stage1Review.controller.js';

const router = express.Router();

router.post('/projects/:projectId/generate', generateStage1Review);

export default router;
