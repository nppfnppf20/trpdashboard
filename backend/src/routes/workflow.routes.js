/**
 * Workflow Routes
 * Routes for the project stages board and notification centre
 */

import express from 'express';
import multer from 'multer';
import { analyseStageDocument, checkDocumentSizeHandler } from '../controllers/stageAnalysis.controller.js';
import {
  getWorkflowNotificationsHandler,
  getProjectStageBoardHandler,
  initializeProjectStageBoardHandler,
  completeProjectStageHandler,
  updateProjectStageHandler,
  toggleProjectStageApplicabilityHandler,
  getPriorStageEntriesHandler,
  saveStageEntryHandler,
  getCurrentStageEntriesHandler,
  reorderStageDefinitionsHandler,
  reorderIssueTracksHandler,
  createProjectIssueTrackHandler,
  updateProjectIssueTrackHandler,
  createProjectKeyIssueHandler,
  createCustomProjectStageHandler,
  reorderProjectStagesHandler
} from '../controllers/workflow.controller.js';
import {
  getRefusalReasonsHandler,
  createRefusalReasonHandler,
  updateRefusalReasonHandler,
  deleteRefusalReasonHandler,
  reorderRefusalReasonsHandler
} from '../controllers/refusalReasons.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    ['pdf', 'docx', 'txt', 'md'].includes(ext) ? cb(null, true) : cb(new Error('Only PDF, Word (.docx), .txt, and .md files are accepted'));
  }
});

const router = express.Router();

// Notification centre
router.get('/notifications', getWorkflowNotificationsHandler);

// Project stage board — literal paths first, param routes after
router.get('/projects/:projectId/stages', getProjectStageBoardHandler);
router.post('/projects/:projectId/stages/initialize', initializeProjectStageBoardHandler);
router.post('/projects/:projectId/stages/custom', createCustomProjectStageHandler);
router.put('/projects/:projectId/stages/reorder', reorderProjectStagesHandler);
router.put('/projects/:projectId/stages/:stageId/complete', completeProjectStageHandler);
router.put('/projects/:projectId/stages/:stageId/applicability', toggleProjectStageApplicabilityHandler);
router.put('/projects/:projectId/stages/:stageId/entry', saveStageEntryHandler);
router.put('/projects/:projectId/stages/:stageId', updateProjectStageHandler);
router.get('/projects/:projectId/stages/:stageId/prior-entries', getPriorStageEntriesHandler);
router.get('/projects/:projectId/stages/:stageId/entries', getCurrentStageEntriesHandler);

// Stage reorder (global definitions)
router.put('/stages/reorder', reorderStageDefinitionsHandler);

// Issue tracks
router.put('/projects/:projectId/issues/reorder', reorderIssueTracksHandler);
router.post('/projects/:projectId/issues', createProjectIssueTrackHandler);
router.put('/issues/:issueId', updateProjectIssueTrackHandler);

// Key issues
router.post('/projects/:projectId/key-issues', createProjectKeyIssueHandler);

// Lightweight document size check — parses file, returns truncation warning if needed, no LLM calls
router.post(
  '/check-document-size',
  (req, res, next) => {
    upload.single('file')(req, res, err => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  checkDocumentSizeHandler
);

// LLM stage document analysis — returns suggested notes per issue, does not write to DB
// Timeout extended to 5 minutes — sequential Haiku chunk calls + Sonnet synthesis can take 2-3 min
router.post(
  '/projects/:projectId/stages/:stageInstanceId/analyse',
  (req, res, next) => { req.setTimeout(300_000); next(); },
  (req, res, next) => {
    upload.single('file')(req, res, err => {
      if (err) {
        console.error('[analyse] multer error:', err.code, err.message);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'document_too_large', message: 'File exceeds the 20MB limit. Please upload a smaller file or paste the text directly.' });
        }
        return res.status(400).json({ error: err.message });
      }
      console.log('[analyse] multer ok — file:', req.file?.originalname ?? 'none', '| pasted_text length:', req.body?.pasted_text?.length ?? 0);
      next();
    });
  },
  analyseStageDocument
);

// Refusal reasons (appeal projects)
router.get('/projects/:projectId/refusal-reasons', getRefusalReasonsHandler);
router.post('/projects/:projectId/refusal-reasons', createRefusalReasonHandler);
router.put('/projects/:projectId/refusal-reasons/:reasonId', updateRefusalReasonHandler);
router.delete('/projects/:projectId/refusal-reasons/:reasonId', deleteRefusalReasonHandler);
router.put('/projects/:projectId/refusal-reasons/reorder', reorderRefusalReasonsHandler);

export default router;
