import express from 'express';
import {
  listDraftingIssues,
  createDraftingIssue,
  updateDraftingIssue,
  setDraftingIssueType,
  deleteDraftingIssue,
  reorderDraftingIssues,
  importFromKeyIssues,
  getDraftingIssuePolicyRelevance,
  toggleDraftingIssuePolicy,
} from '../controllers/draftingIssues.controller.js';

const router = express.Router();

router.get('/projects/:projectId', listDraftingIssues);
router.post('/projects/:projectId', createDraftingIssue);
router.put('/projects/:projectId/reorder', reorderDraftingIssues);
router.post('/projects/:projectId/import-from-key-issues', importFromKeyIssues);
router.get('/projects/:projectId/policy-relevance', getDraftingIssuePolicyRelevance);

router.put('/:id', updateDraftingIssue);
router.put('/:id/issue-type', setDraftingIssueType);
router.delete('/:id', deleteDraftingIssue);

router.post('/:draftingIssueId/policies/:policyId/toggle', toggleDraftingIssuePolicy);

export default router;
