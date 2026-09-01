import express from 'express';
import multer from 'multer';
import {
  listDraftingIssues,
  createDraftingIssue,
  updateDraftingIssue,
  setDraftingIssueType,
  deleteDraftingIssue,
  reorderDraftingIssues,
  draftIssuesFromBriefing,
  getDraftingIssuePolicyRelevance,
  toggleDraftingIssuePolicy,
  getDraftingIssueSnippetRelevance,
  toggleDraftingIssueSnippet,
  summarizeSpecialistReport,
} from '../controllers/draftingIssues.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/projects/:projectId', listDraftingIssues);
router.post('/projects/:projectId', createDraftingIssue);
router.put('/projects/:projectId/reorder', reorderDraftingIssues);
router.post('/projects/:projectId/draft-from-briefing', draftIssuesFromBriefing);
router.get('/projects/:projectId/policy-relevance', getDraftingIssuePolicyRelevance);
router.get('/projects/:projectId/snippet-relevance', getDraftingIssueSnippetRelevance);

router.put('/:id', updateDraftingIssue);
router.put('/:id/issue-type', setDraftingIssueType);
router.delete('/:id', deleteDraftingIssue);
router.post('/:id/specialist-report/summarize', upload.single('file'), summarizeSpecialistReport);

router.post('/:draftingIssueId/policies/:policyId/toggle', toggleDraftingIssuePolicy);
router.post('/:draftingIssueId/snippets/:issueTypeId/:field/toggle', toggleDraftingIssueSnippet);

export default router;
