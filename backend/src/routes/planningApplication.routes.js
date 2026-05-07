/**
 * Planning Application Routes
 */

import express from 'express';
import multer from 'multer';
import {
  getPolicyTrackRelevance,
  togglePolicyTrack,
  getKeyIssues,
  updateKeyIssueSummary,
  getIssueNotes,
  upsertIssueNote,
  analyseDocument,
  getPromptTemplate,
  savePromptTemplate,
  deletePromptTemplate,
  getDraftTypes,
  getDraft,
  saveDraft,
  generateDraft,
  generateSection,
  getSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  getDocumentLog,
  createDocumentLogEntry
} from '../controllers/planningApplication.controller.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (allowed.includes(file.mimetype) || ['pdf', 'txt', 'md'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, .txt, and .md files are accepted'));
    }
  }
});

// Policy-track relevance
router.get('/projects/:projectId/policy-tracks', getPolicyTrackRelevance);
router.put('/policy-tracks/:policyId/tracks/:trackId', togglePolicyTrack);

// Key issues
router.get('/projects/:projectId/key-issues', getKeyIssues);
router.patch('/key-issues/:trackId/summary', updateKeyIssueSummary);

// Issue notes
router.get('/projects/:projectId/issue-notes', getIssueNotes);
router.put('/projects/:projectId/issue-notes/:trackId', upsertIssueNote);

// Document analysis
router.post('/projects/:projectId/analyse', upload.single('file'), analyseDocument);

// Prompt template
router.get('/projects/:projectId/prompt-template', getPromptTemplate);
router.put('/projects/:projectId/prompt-template', savePromptTemplate);
router.delete('/projects/:projectId/prompt-template', deletePromptTemplate);

// Draft documents
router.get('/draft-types', getDraftTypes);
router.get('/draft-types/:typeId/sections', getSections);
router.post('/draft-types/:typeId/sections', createSection);
router.patch('/sections/:sectionId', updateSection);
router.delete('/sections/:sectionId', deleteSection);
router.put('/draft-types/:typeId/sections/reorder', reorderSections);
router.get('/projects/:projectId/drafts/:typeId', getDraft);
router.put('/projects/:projectId/drafts/:typeId', saveDraft);
router.post('/projects/:projectId/drafts/:typeId/generate', generateDraft);
router.post('/projects/:projectId/drafts/:typeId/sections/:sectionId/generate', generateSection);

// Document log
router.get('/projects/:projectId/document-log', getDocumentLog);
router.post('/projects/:projectId/document-log', createDocumentLogEntry);

export default router;
