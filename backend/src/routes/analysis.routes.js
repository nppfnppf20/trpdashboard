/**
 * Analysis Routes
 * Routes for spatial analysis endpoints
 */

import express from 'express';
import { validatePolygon } from '../middleware/validatePolygon.js';
import {
  analyze,
  analyzeHeritage,
  analyzeListedBuildings,
  analyzeConservationAreas,
  analyzeScheduledMonuments,
  analyzeLandscape,
  analyzeAgLand,
  analyzeRenewables,
  analyzeEcology,
  analyzeTrees,
  analyzeSocioeconomics,
  analyzeAirfields
} from '../controllers/analysis.controller.js';

const router = express.Router();

// All analysis routes require a polygon in the request body
router.post('/', validatePolygon, analyze);
router.post('/heritage', validatePolygon, analyzeHeritage);
router.post('/listed-buildings', validatePolygon, analyzeListedBuildings);
router.post('/conservation-areas', validatePolygon, analyzeConservationAreas);
router.post('/scheduled-monuments', validatePolygon, analyzeScheduledMonuments);
router.post('/landscape', validatePolygon, analyzeLandscape);
router.post('/ag-land', validatePolygon, analyzeAgLand);
router.post('/renewables', validatePolygon, analyzeRenewables);
router.post('/ecology', validatePolygon, analyzeEcology);
router.post('/trees', validatePolygon, analyzeTrees);
router.post('/socioeconomics', validatePolygon, analyzeSocioeconomics);
router.post('/airfields', validatePolygon, analyzeAirfields);

export default router;

