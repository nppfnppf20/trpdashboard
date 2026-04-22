/**
 * Appeal Routes
 * Living argument document + document upload/review workflow.
 */

import express from 'express';
import multer from 'multer';
import {
  getKeyIssues,
  updateKeyIssueSummary,
  getIssueNotes,
  upsertIssueNote,
  analyseDocument,
  getArgument,
  saveArgument,
  generateArgument,
  getDocuments,
  uploadDocument,
  updateDocumentStatus,
  getPromptTemplate,
  savePromptTemplate,
  deletePromptTemplate,
  getDraftTypes,
  getDraft,
  saveDraft,
  generateDraft,
  getSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections
} from '../controllers/appeal.controller.js';

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

// Argument document
router.get('/projects/:projectId/argument', getArgument);
router.put('/projects/:projectId/argument', saveArgument);
router.post('/projects/:projectId/generate', generateArgument);

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

// Documents
router.get('/projects/:projectId/documents', getDocuments);
router.post('/projects/:projectId/documents', upload.single('file'), uploadDocument);
router.put('/documents/:docId/status', updateDocumentStatus);

export default router;
