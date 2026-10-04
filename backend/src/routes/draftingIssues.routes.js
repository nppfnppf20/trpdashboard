import express from 'express';
import { createUpload } from '../middleware/upload.js';
import {
  listDraftingIssues,
  createDraftingIssue,
  updateDraftingIssue,
  setDraftingIssueType,
  deleteDraftingIssue,
  reorderDraftingIssues,
  draftIssuesFromBriefing,
  draftIssuesFromTracker,
  getDraftingIssuePolicyRelevance,
  toggleDraftingIssuePolicy,
  getDraftingIssuePlanRelevance,
  toggleDraftingIssuePlan,
  summarizeSpecialistReport,
} from '../controllers/draftingIssues.controller.js';

const router = express.Router();
const upload = createUpload({ maxMB: 50 });

router.get('/projects/:projectId', listDraftingIssues);
router.post('/projects/:projectId', createDraftingIssue);
router.put('/projects/:projectId/reorder', reorderDraftingIssues);
router.post('/projects/:projectId/draft-from-briefing', draftIssuesFromBriefing);
router.post('/projects/:projectId/draft-from-tracker', draftIssuesFromTracker);
router.get('/projects/:projectId/policy-relevance', getDraftingIssuePolicyRelevance);
router.get('/projects/:projectId/plan-relevance', getDraftingIssuePlanRelevance);

router.put('/:id', updateDraftingIssue);
router.put('/:id/issue-type', setDraftingIssueType);
router.delete('/:id', deleteDraftingIssue);
router.post('/:id/specialist-report/summarize', upload.single('file'), summarizeSpecialistReport);

router.post('/:draftingIssueId/policies/:policyId/toggle', toggleDraftingIssuePolicy);
router.post('/:draftingIssueId/plans/:planId/toggle', toggleDraftingIssuePlan);

export default router;
