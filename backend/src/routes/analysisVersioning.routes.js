/**
 * Analysis Versioning Routes
 * Routes for analysis versioning (original, edited, changes)
 */

import express from 'express';
import {
  saveOriginal,
  saveEdited,
  getOriginal,
  getEdited,
  getChangeHistory,
  getByProject,
  getFullAnalysis
} from '../controllers/analysisVersioning.controller.js';

const router = express.Router();

// Save original analysis (when analysis first runs)
router.post('/save-original', saveOriginal);

// Save edited analysis with changes
router.put('/:originalId/save-edited', saveEdited);

// Get original analysis
router.get('/:originalId', getOriginal);

// Get edited analysis
router.get('/:originalId/edited', getEdited);

// Get change history
router.get('/:originalId/changes', getChangeHistory);

// Get full analysis (original + edited + changes)
router.get('/:originalId/full', getFullAnalysis);

// Get analysis by project ID
router.get('/project/:projectId', getByProject);

export default router;
