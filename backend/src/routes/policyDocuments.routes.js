import express from 'express';
import {
  listPolicyDocuments,
  createPolicyDocument,
  updatePolicyDocument,
  deletePolicyDocument
} from '../controllers/policyDocuments.controller.js';

const router = express.Router();

router.get('/projects/:projectId/policy-documents', listPolicyDocuments);
router.post('/projects/:projectId/policy-documents', createPolicyDocument);
router.put('/policy-documents/:id', updatePolicyDocument);
router.delete('/policy-documents/:id', deletePolicyDocument);

export default router;
