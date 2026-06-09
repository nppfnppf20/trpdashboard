/**
 * HLPV Narrative Routes
 */

import express from 'express';
import { generateNarrative, listProjectSessions, getFormattedSessionData } from '../controllers/hlpvNarrative.controller.js';

const router = express.Router();

router.post('/generate-narrative', generateNarrative);
router.get('/project/:projectId/sessions', listProjectSessions);
router.get('/sessions/:sessionId/formatted-data', getFormattedSessionData);

export default router;
