import express from 'express';
import {
  getProgressData,
  createIssue,
  updateIssue,
  deleteIssue,
  createSubIssue,
  updateSubIssue,
  deleteSubIssue,
  createActions,
  suggestActions,
  updateAction,
  deleteAction,
  listMeetingNotesForPicker,
  draftFromMeetingNotes,
  commitDraftedActions,
  markExported,
  markIssuedToClient,
} from '../controllers/progressTracker.controller.js';

const router = express.Router();

router.get('/projects/:projectId', getProgressData);
router.post('/projects/:projectId/issues', createIssue);
router.post('/projects/:projectId/export', markExported);
router.post('/projects/:projectId/issue-to-client', markIssuedToClient);
router.put('/issues/:issueId', updateIssue);
router.delete('/issues/:issueId', deleteIssue);
router.post('/issues/:issueId/sub-issues', createSubIssue);
router.put('/sub-issues/:subIssueId', updateSubIssue);
router.delete('/sub-issues/:subIssueId', deleteSubIssue);
router.post('/projects/:projectId/actions', createActions);
router.post('/projects/:projectId/actions/suggest', suggestActions);
router.put('/actions/:actionId', updateAction);
router.delete('/actions/:actionId', deleteAction);
router.get('/projects/:projectId/meeting-notes', listMeetingNotesForPicker);
router.post('/projects/:projectId/actions/draft-from-meeting-notes', draftFromMeetingNotes);
router.post('/projects/:projectId/actions/commit-drafted', commitDraftedActions);

export default router;
