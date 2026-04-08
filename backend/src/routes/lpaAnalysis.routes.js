/**
 * LPA Analysis Routes
 * Relevant policy CRUD + LPA decision document upload/analysis + synthesis
 */

import express from 'express';
import multer from 'multer';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  listLpaDocuments,
  uploadLpaDocument,
  deleteLpaDocument,
  getLpaAnalysis,
  triggerSynthesis
} from '../controllers/lpaAnalysis.controller.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (allowed.includes(file.mimetype) || ['pdf', 'txt', 'md', 'docx'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word (.docx), .txt and .md files are accepted'));
    }
  }
});

// Relevant policies
router.get('/projects/:projectId/policies', listPolicies);
router.post('/projects/:projectId/policies', createPolicy);
router.put('/policies/:policyId', updatePolicy);
router.delete('/policies/:policyId', deletePolicy);

// LPA decision documents
router.get('/projects/:projectId/lpa-documents', listLpaDocuments);
router.post('/projects/:projectId/lpa-documents', upload.single('file'), uploadLpaDocument);
router.delete('/projects/:projectId/lpa-documents/:docId', deleteLpaDocument);

// Analysis synthesis
router.get('/projects/:projectId/lpa-analysis', getLpaAnalysis);
router.post('/projects/:projectId/lpa-analysis/synthesise', triggerSynthesis);

export default router;
