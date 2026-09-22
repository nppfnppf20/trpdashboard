/**
 * NPPF Policy Library Routes
 * Canonical, shared (not project-scoped) NPPF policy reference library —
 * maintained in the admin console, read by any authenticated user (the
 * project Policy tab's "import from NPPF" dropdown needs it), same access
 * pattern as /api/issue-types.
 */

import express from 'express';
import multer from 'multer';
import {
  listNppfPolicies,
  createNppfPolicy,
  updateNppfPolicy,
  deleteNppfPolicy,
  extractNppfPolicies,
} from '../controllers/nppfPolicies.controller.js';

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

router.get('/', listNppfPolicies);
router.post('/', createNppfPolicy);
router.put('/:id', updateNppfPolicy);
router.delete('/:id', deleteNppfPolicy);
router.post('/extract', upload.single('file'), extractNppfPolicies);

export default router;
