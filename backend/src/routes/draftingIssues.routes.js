import express from 'express';
import {
  listDraftingIssues,
  createDraftingIssue,
  updateDraftingIssue,
  setDraftingIssueType,
  deleteDraftingIssue,
  reorderDraftingIssues,
  importFromKeyIssues,
  draftIssuesFromBriefing,
  getDraftingIssuePolicyRelevance,
  toggleDraftingIssuePolicy,
  getDraftingIssueSnippetRelevance,
  toggleDraftingIssueSnippet,
} from '../controllers/draftingIssues.controller.js';

const router = express.Router();

router.get('/projects/:projectId', listDraftingIssues);
router.post('/projects/:projectId', createDraftingIssue);
router.put('/projects/:projectId/reorder', reorderDraftingIssues);
router.post('/projects/:projectId/import-from-key-issues', importFromKeyIssues);
router.post('/projects/:projectId/draft-from-briefing', draftIssuesFromBriefing);
router.get('/projects/:projectId/policy-relevance', getDraftingIssuePolicyRelevance);
router.get('/projects/:projectId/snippet-relevance', getDraftingIssueSnippetRelevance);

router.put('/:id', updateDraftingIssue);
router.put('/:id/issue-type', setDraftingIssueType);
router.delete('/:id', deleteDraftingIssue);

router.post('/:draftingIssueId/policies/:policyId/toggle', toggleDraftingIssuePolicy);
router.post('/:draftingIssueId/snippets/:issueTypeId/toggle', toggleDraftingIssueSnippet);

export default router;
