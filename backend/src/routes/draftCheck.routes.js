import express from 'express';
import {
  checkBriefCoverage,
  checkConsistency,
  checkGrammar,
  checkPolicyReview,
} from '../controllers/draftCheck.controller.js';

const router = express.Router();

router.post('/projects/:projectId/brief', checkBriefCoverage);
router.post('/projects/:projectId/consistency', checkConsistency);
router.post('/projects/:projectId/grammar', checkGrammar);
router.post('/projects/:projectId/policy', checkPolicyReview);

export default router;
