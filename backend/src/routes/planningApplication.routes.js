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
  createDocumentLogEntry,
  deleteDocumentLogEntry,
  updateDocumentLogEntry,
  getArgumentPoints,
  createArgumentPoint,
  getDocumentSummaries,
  generateDocumentSummary,
  saveDocumentSummary,
  replaceDocumentSummary,
  deleteDocumentSummary,
  suggestDocumentUpdates,
  getSectionPrompt,
  resetSectionPrompt,
  getAssessmentIssues,
  generateAssessmentIssue,
  draftArgumentsFromBriefing,
  draftArgumentsFromIssueNotes,
  draftKeySummariesFromBriefing,
  getBriefingNotes,
  uploadBriefingNote,
  evolveArgument,
  getDocTypePrompt,
  saveDocTypePrompt,
  deleteDocTypePrompt,
  suggestArgument,
  getSuggestTemplate,
  saveSuggestTemplate,
  deleteSuggestTemplate,
  getProjectCompleteness,
  populateFromBriefing,
  paScopeIncorporation,
  paIncorporateTargeted,
  paDraftContext,
  getActionPrompt,
  saveActionPrompt,
  resetActionPrompt,
  hasPaIssueNotes,
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
router.get('/sections/:sectionId/prompt', getSectionPrompt);
router.delete('/sections/:sectionId/prompt', resetSectionPrompt);
router.put('/draft-types/:typeId/sections/reorder', reorderSections);
router.get('/projects/:projectId/has-pa-notes', hasPaIssueNotes);
router.get('/projects/:projectId/drafts/:typeId', getDraft);
router.put('/projects/:projectId/drafts/:typeId', saveDraft);
router.post('/projects/:projectId/drafts/:typeId/generate', generateDraft);
router.post('/projects/:projectId/drafts/:typeId/sections/:sectionId/generate', generateSection);
router.get('/projects/:projectId/assessment-issues', getAssessmentIssues);
router.get('/projects/:projectId/briefing-notes', getBriefingNotes);
router.post('/projects/:projectId/briefing-notes', upload.single('file'), uploadBriefingNote);
router.post('/projects/:projectId/draft-arguments-from-briefing', draftArgumentsFromBriefing);
router.post('/projects/:projectId/draft-arguments-from-issue-notes', draftArgumentsFromIssueNotes);
router.post('/projects/:projectId/draft-key-summaries-from-briefing', draftKeySummariesFromBriefing);
router.post('/projects/:projectId/evolve-argument', evolveArgument);
router.post('/projects/:projectId/drafts/:typeId/sections/:sectionId/issues/:trackId/generate', generateAssessmentIssue);
router.get('/projects/:projectId/drafts/:typeId/context', paDraftContext);
router.post('/projects/:projectId/drafts/:typeId/scope-incorporation', upload.single('file'), paScopeIncorporation);
router.post('/projects/:projectId/drafts/:typeId/incorporate', upload.single('file'), paIncorporateTargeted);

// Document log
router.get('/projects/:projectId/document-log', getDocumentLog);
router.post('/projects/:projectId/document-log', createDocumentLogEntry);
router.patch('/document-log/:entryId', updateDocumentLogEntry);
router.delete('/document-log/:entryId', deleteDocumentLogEntry);

// Argument points
router.get('/projects/:projectId/argument-points', getArgumentPoints);
router.post('/projects/:projectId/argument-points', createArgumentPoint);

// Document summaries
router.get('/projects/:projectId/document-summaries', getDocumentSummaries);
router.post('/projects/:projectId/document-summaries/generate', upload.single('file'), generateDocumentSummary);
router.post('/projects/:projectId/document-summaries/suggest', suggestDocumentUpdates);
router.put('/projects/:projectId/document-summaries/by-type', replaceDocumentSummary);
router.post('/projects/:projectId/document-summaries', saveDocumentSummary);
router.delete('/document-summaries/:summaryId', deleteDocumentSummary);

// Doc type prompts
router.get('/doc-type-prompts/:docType', getDocTypePrompt);
router.put('/doc-type-prompts/:docType', saveDocTypePrompt);
router.delete('/doc-type-prompts/:docType', deleteDocTypePrompt);

// Project completeness + briefing population
router.get('/projects/:projectId/completeness', getProjectCompleteness);
router.post('/projects/:projectId/populate-from-briefing', populateFromBriefing);

// Argument suggestion (prose chat flow)
router.post('/projects/:projectId/suggest-argument', upload.single('file'), suggestArgument);
router.get('/projects/:projectId/suggest-template', getSuggestTemplate);
router.put('/projects/:projectId/suggest-template', saveSuggestTemplate);
router.delete('/projects/:projectId/suggest-template', deleteSuggestTemplate);

// Action prompts (global — no project scoping)
router.get('/action-prompts/:key', getActionPrompt);
router.put('/action-prompts/:key', saveActionPrompt);
router.post('/action-prompts/:key/reset', resetActionPrompt);

export default router;
