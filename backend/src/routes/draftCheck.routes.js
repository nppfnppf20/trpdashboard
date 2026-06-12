import express from 'express';
import {
  checkBriefCoverage,
  checkConsistency,
  checkGrammar,
} from '../controllers/draftCheck.controller.js';

const router = express.Router();

router.post('/projects/:projectId/brief', checkBriefCoverage);
router.post('/projects/:projectId/consistency', checkConsistency);
router.post('/projects/:projectId/grammar', checkGrammar);

export default router;
