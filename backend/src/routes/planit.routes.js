/**
 * PlanIt Routes
 * Keyword suggestion (LLM) and planning application search (PlanIt proxy)
 */

import express from 'express';
import { suggestKeywords, searchPlanit } from '../controllers/planit.controller.js';

const router = express.Router();

// Generate LLM keyword suggestions from project HLPV context
router.post('/projects/:projectId/suggest-keywords', suggestKeywords);

// Search PlanIt API — proxied through backend to avoid CORS
router.get('/projects/:projectId/search', searchPlanit);

export default router;
