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
  applyDraftReview,
  findMissedForDraft,
  getDraftingIssuePolicyRelevance,
  toggleDraftingIssuePolicy,
  getDraftingIssuePlanRelevance,
  toggleDraftingIssuePlan,
  summarizeSpecialistReport,
  getNotesLogSummary,
  listNotesLog,
  consolidateNotesLog,
  applyConsolidatedNotes,
} from '../controllers/draftingIssues.controller.js';

const router = express.Router();
const upload = createUpload({ maxMB: 50 });

router.get('/projects/:projectId', listDraftingIssues);
router.post('/projects/:projectId', createDraftingIssue);
router.put('/projects/:projectId/reorder', reorderDraftingIssues);
router.post('/projects/:projectId/draft-from-briefing', draftIssuesFromBriefing);
router.post('/projects/:projectId/draft-from-tracker', draftIssuesFromTracker);
router.post('/projects/:projectId/draft-apply', applyDraftReview);
router.post('/projects/:projectId/draft-missed', findMissedForDraft);
router.get('/projects/:projectId/policy-relevance', getDraftingIssuePolicyRelevance);
router.get('/projects/:projectId/plan-relevance', getDraftingIssuePlanRelevance);

router.get('/projects/:projectId/notes-log-summary', getNotesLogSummary);

router.get('/:id/notes-log', listNotesLog);
router.post('/:id/notes-log/consolidate', consolidateNotesLog);
router.post('/:id/notes-log/apply', applyConsolidatedNotes);

router.put('/:id', updateDraftingIssue);
router.put('/:id/issue-type', setDraftingIssueType);
router.delete('/:id', deleteDraftingIssue);
router.post('/:id/specialist-report/summarize', upload.single('file'), summarizeSpecialistReport);

router.post('/:draftingIssueId/policies/:policyId/toggle', toggleDraftingIssuePolicy);
router.post('/:draftingIssueId/plans/:planId/toggle', toggleDraftingIssuePlan);

export default router;
