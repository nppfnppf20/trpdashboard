/**
 * Appeal Precedent routes (all under /api/appeal-precedent, authenticated by the /api guard in routes/index.js).
 * Runs are in memory only and tied to the user who started them.
 */

import express from 'express';
import { sources, suggest, create, status, cancel, chat } from '../controllers/appealPrecedent.controller.js';
import { analysisLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/projects/:projectId/sources', sources);
router.post('/projects/:projectId/suggest', analysisLimiter, suggest);
router.post('/runs', analysisLimiter, create);
router.get('/runs/:runId', status);
router.post('/runs/:runId/cancel', cancel);
router.post('/runs/:runId/chat', analysisLimiter, chat);

export default router;
