/**
 * NPPF Policy Library Routes
 * Canonical, shared (not project-scoped) NPPF policy reference library —
 * maintained in the admin console, read by any authenticated user (the
 * project Policy tab's "import from NPPF" dropdown needs it), same access
 * pattern as /api/issue-types.
 */

import express from 'express';
import { createUpload } from '../middleware/upload.js';
import {
  listNppfPolicies,
  createNppfPolicy,
  updateNppfPolicy,
  deleteNppfPolicy,
  extractNppfPolicies,
} from '../controllers/nppfPolicies.controller.js';

const router = express.Router();

const upload = createUpload({ exts: ['pdf', 'docx', 'txt', 'md'] });

router.get('/', listNppfPolicies);
router.post('/', createNppfPolicy);
router.put('/:id', updateNppfPolicy);
router.delete('/:id', deleteNppfPolicy);
router.post('/extract', upload.single('file'), extractNppfPolicies);

export default router;
