import express from 'express';
import { saveSession, listProjectSessions, getSession } from '../controllers/socioeconomicsSession.controller.js';

const router = express.Router();

router.post('/sessions', saveSession);
router.get('/project/:projectId/sessions', listProjectSessions);
router.get('/sessions/:sessionId', getSession);

export default router;
