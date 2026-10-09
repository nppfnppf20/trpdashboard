/**
 * PlanIt Routes
 * Keyword suggestion (LLM) and planning application search (PlanIt proxy)
 */

import express from 'express';
import { generateSearch, searchPlanit, triageSchemes, getSavedSchemes, saveSchemes, removeSavedScheme } from '../controllers/planit.controller.js';
import { analysisLimiter } from '../middleware/rateLimiter.js';
import { createUpload } from '../middleware/upload.js';
import { listDocuments, getDocumentText, uploadDocument, setDocumentType, deleteDocument, chatDocuments, lensDocuments } from '../controllers/similarSchemeDocs.controller.js';

const router = express.Router();
const upload = createUpload({ exts: ['pdf', 'docx', 'txt', 'md'] });

// Draft keywords, LPA and the "what we're looking for" description from the project and chosen sources
router.post('/projects/:projectId/generate', analysisLimiter, generateSearch);

// Search PlanIt API — proxied through backend to avoid CORS
router.get('/projects/:projectId/search', searchPlanit);

// Keyword + filter search for a wide pool, then LLM triage against the user's brief
router.post('/projects/:projectId/triage', analysisLimiter, triageSchemes);

// Saved schemes for the project
router.get('/projects/:projectId/saved', getSavedSchemes);
router.post('/projects/:projectId/saved', saveSchemes);
router.delete('/projects/:projectId/saved', removeSavedScheme);

// Documents uploaded against saved schemes, and chat over the ticked schemes' documents
router.get('/projects/:projectId/saved/documents', listDocuments);
router.post('/projects/:projectId/saved/documents', analysisLimiter, upload.single('file'), uploadDocument);
router.get('/projects/:projectId/saved/documents/:docId/text', getDocumentText);
router.patch('/projects/:projectId/saved/documents/:docId', setDocumentType);
router.delete('/projects/:projectId/saved/documents/:docId', deleteDocument);
router.post('/projects/:projectId/saved/chat', analysisLimiter, chatDocuments);
router.post('/projects/:projectId/saved/lens', analysisLimiter, lensDocuments);

export default router;
