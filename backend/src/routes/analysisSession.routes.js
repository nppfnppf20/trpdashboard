/**
 * Analysis Session Routes
 * API endpoints for normalized analysis data
 */

import { Router } from 'express';
import {
  createSession,
  getByProject,
  getSession,
  getSessionRaw,
  saveSessionEdit,
  getSessionChanges
} from '../controllers/analysisSession.controller.js';

const router = Router();

// Create new analysis session
router.post('/create', createSession);

// Get session by project ID
router.get('/project/:projectId', getByProject);

// Get session by ID (reconstructed for frontend)
router.get('/:sessionId', getSession);

// Get raw normalized data (for debugging)
router.get('/:sessionId/raw', getSessionRaw);

// Save edit to a discipline
router.put('/:sessionId/edit', saveSessionEdit);

// Get change log
router.get('/:sessionId/changes', getSessionChanges);

export default router;
