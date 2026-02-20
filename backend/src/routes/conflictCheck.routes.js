/**
 * Conflict Check Routes
 * Routes for conflict checking endpoints
 */

import express from 'express';
import { validatePolygon } from '../middleware/validatePolygon.js';
import { 
  runConflictCheck, 
  getLatestConflictCheck, 
  getConflictCheckHistory,
  getConflictCheckById,
  deleteConflict
} from '../controllers/conflictCheck.controller.js';

const router = express.Router();

// POST /api/conflict-check - Run conflict check against all project map layers
router.post('/', validatePolygon, runConflictCheck);

// GET /api/conflict-check/project/:projectId/latest - Get latest conflict check for a project
router.get('/project/:projectId/latest', getLatestConflictCheck);

// GET /api/conflict-check/project/:projectId/history - Get conflict check history for a project
router.get('/project/:projectId/history', getConflictCheckHistory);

// GET /api/conflict-check/:checkId - Get a specific conflict check by ID
router.get('/:checkId', getConflictCheckById);

// DELETE /api/conflict-check/conflict/:conflictId - Delete a conflict permanently
router.delete('/conflict/:conflictId', deleteConflict);

export default router;

