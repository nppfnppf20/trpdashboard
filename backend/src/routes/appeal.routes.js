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
  suggestArgument,
  getSuggestTemplate,
  saveSuggestTemplate,
  deleteSuggestTemplate,
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
  createDocumentLogEntry,
  deleteDocumentLogEntry,
  updateDocumentLogEntry,
  getBriefingNotes,
  uploadBriefingNote,
  draftArgumentsFromBriefing,
  draftArgumentsFromIssueNotes,
  draftKeySummariesFromBriefing,
  evolveArgument,
  chatArgument,
  incorporateDocumentIntoTdraft,
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

// Prompt template (extract-points)
router.get('/projects/:projectId/prompt-template', getPromptTemplate);
router.put('/projects/:projectId/prompt-template', savePromptTemplate);
router.delete('/projects/:projectId/prompt-template', deletePromptTemplate);

// Argument suggestion + prompt template
router.post('/projects/:projectId/suggest-argument', upload.single('file'), suggestArgument);
router.get('/projects/:projectId/suggest-template', getSuggestTemplate);
router.put('/projects/:projectId/suggest-template', saveSuggestTemplate);
router.delete('/projects/:projectId/suggest-template', deleteSuggestTemplate);

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
router.post('/projects/:projectId/drafts/:typeId/sections/:sectionId/generate', generateSection);
router.post('/projects/:projectId/drafts/:typeId/incorporate', incorporateDocumentIntoTdraft);

// Briefing notes
router.get('/projects/:projectId/briefing-notes', getBriefingNotes);
router.post('/projects/:projectId/briefing-notes', upload.single('file'), uploadBriefingNote);
router.post('/projects/:projectId/draft-arguments-from-briefing', draftArgumentsFromBriefing);
router.post('/projects/:projectId/draft-arguments-from-issue-notes', draftArgumentsFromIssueNotes);
router.post('/projects/:projectId/draft-key-summaries-from-briefing', draftKeySummariesFromBriefing);
router.post('/projects/:projectId/evolve-argument', evolveArgument);
router.post('/projects/:projectId/chat-argument', chatArgument);

// Document log
router.get('/projects/:projectId/document-log', getDocumentLog);
router.post('/projects/:projectId/document-log', createDocumentLogEntry);
router.patch('/document-log/:entryId', updateDocumentLogEntry);
router.delete('/document-log/:entryId', deleteDocumentLogEntry);

// Documents
router.get('/projects/:projectId/documents', getDocuments);
router.post('/projects/:projectId/documents', upload.single('file'), uploadDocument);
router.put('/documents/:docId/status', updateDocumentStatus);

export default router;
