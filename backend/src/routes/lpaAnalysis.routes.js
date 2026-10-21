/**
 * LPA Analysis Routes
 * Relevant policy CRUD + LPA decision document upload/analysis + synthesis
 */

import express from 'express';
import { createUpload } from '../middleware/upload.js';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  updatePolicyAnnotatedText,
  deletePolicy,
  extractPolicies,
  extractPolicyWording,
  generatePlanRelevance,
  listNationalPolicyPrecedents,
  listLpaDocuments,
  uploadLpaDocument,
  deleteLpaDocument,
  getLpaAnalysis,
  saveBriefingNote,
  triggerSynthesis
} from '../controllers/lpaAnalysis.controller.js';
import { analysePlanDocument, extractPlanPolicies } from '../controllers/planPolicyPicker.controller.js';

const router = express.Router();

const upload = createUpload({ exts: ['pdf', 'docx', 'txt', 'md'] });
// Full development plans run to hundreds of pages.
const planUpload = createUpload({ exts: ['pdf', 'docx', 'txt', 'md'], maxMB: 60, fieldSizeMB: 25 });

// Relevant policies
router.get('/projects/:projectId/policies', listPolicies);
router.post('/projects/:projectId/policies', createPolicy);
router.put('/policies/:policyId', updatePolicy);
router.put('/policies/:policyId/annotated-text', updatePolicyAnnotatedText);
router.delete('/policies/:policyId', deletePolicy);
router.post('/projects/:projectId/policies/extract', upload.single('file'), extractPolicies);
router.post('/projects/:projectId/policies/extract-wording', upload.single('file'), extractPolicyWording);
router.post('/projects/:projectId/policies/plan-relevance', upload.single('file'), generatePlanRelevance);
router.post('/projects/:projectId/plan-picker/analyse', planUpload.single('file'), analysePlanDocument);
router.post('/projects/:projectId/plan-picker/extract', planUpload.single('file'), extractPlanPolicies);
router.get('/projects/:projectId/national-policy-precedents', listNationalPolicyPrecedents);

// LPA decision documents
router.get('/projects/:projectId/lpa-documents', listLpaDocuments);
router.post('/projects/:projectId/lpa-documents', upload.single('file'), uploadLpaDocument);
router.delete('/projects/:projectId/lpa-documents/:docId', deleteLpaDocument);

// Analysis synthesis
router.get('/projects/:projectId/lpa-analysis', getLpaAnalysis);
router.put('/projects/:projectId/lpa-analysis/briefing-note', saveBriefingNote);
router.post('/projects/:projectId/lpa-analysis/synthesise', triggerSynthesis);

export default router;
