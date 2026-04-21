/**
 * Appeal Routes
 * Living argument document + document upload/review workflow.
 */

import express from 'express';
import multer from 'multer';
import {
  getKeyIssues,
  getArgument,
  saveArgument,
  generateArgument,
  getDocuments,
  uploadDocument,
  updateDocumentStatus
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

// Key issues (read-only)
router.get('/projects/:projectId/key-issues', getKeyIssues);

// Argument document
router.get('/projects/:projectId/argument', getArgument);
router.put('/projects/:projectId/argument', saveArgument);
router.post('/projects/:projectId/generate', generateArgument);

// Documents
router.get('/projects/:projectId/documents', getDocuments);
router.post('/projects/:projectId/documents', upload.single('file'), uploadDocument);
router.put('/documents/:docId/status', updateDocumentStatus);

export default router;
