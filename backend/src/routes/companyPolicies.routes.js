/**
 * Company Policy Library Routes
 * Internal company policy documents — global (not project-scoped). Upload, list,
 * edit metadata, version, download the original, delete. Indexing/search/chat
 * arrive in later phases (docs/plans/POLICY_RAG_IMPLEMENTATION_PLAN.md).
 *
 * Mounted under /api, so authenticate + requireAdmin already apply (see routes/index.js).
 */

import express from 'express';
import { createUpload } from '../middleware/upload.js';
import {
  listCompanyPolicies,
  uploadCompanyPolicy,
  updateCompanyPolicy,
  reindexCompanyPolicy,
  askCompanyPolicies,
  listCompanyPolicyFolders,
  createCompanyPolicyFolder,
  updateCompanyPolicyFolder,
  deleteCompanyPolicyFolder,
  getCompanyPolicyContent,
  getCompanyPolicyFileUrl,
  deleteCompanyPolicy,
} from '../controllers/companyPolicies.controller.js';

const router = express.Router();

// Images are accepted too, but only as display-only documents (shown as uploaded, never indexed)
const upload = createUpload({ maxMB: 25, exts: ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'gif'] });

router.get('/folders', listCompanyPolicyFolders);
router.post('/folders', createCompanyPolicyFolder);
router.put('/folders/:id', updateCompanyPolicyFolder);
router.delete('/folders/:id', deleteCompanyPolicyFolder);

router.get('/', listCompanyPolicies);
router.post('/ask', askCompanyPolicies);
router.post('/', upload.single('file'), uploadCompanyPolicy);
router.put('/:id', updateCompanyPolicy);
router.post('/:id/reindex', reindexCompanyPolicy);
router.get('/:id/content', getCompanyPolicyContent);
router.get('/:id/file-url', getCompanyPolicyFileUrl);
router.delete('/:id', deleteCompanyPolicy);

export default router;
