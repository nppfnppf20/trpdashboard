/**
 * Ingestion Routes
 * Document upload, topic management, review/confirm flow, and timeline
 * for the issue_tracker feature.
 */

import express from 'express';
import multer from 'multer';
import {
  getTopics,
  createTopic,
  updateTopic,
  getDocuments,
  uploadDocument,
  getDraft,
  confirmDocument,
  getBackfillPreview,
  acceptSuggestedTopic,
  getTimeline
} from '../controllers/ingestion.controller.js';

const router = express.Router();

// Store file in memory so we can pass the buffer straight to pdf-parse.
// Limit to 20MB — large PDFs over this should be split before upload.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    // multer can report text/plain for .md files — also check extension
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(file.mimetype) || ['pdf', 'txt', 'md'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, .txt, and .md files are accepted'));
    }
  }
});

// Topics
router.get('/projects/:projectId/topics', getTopics);
router.post('/projects/:projectId/topics', createTopic);
router.put('/topics/:topicId', updateTopic);

// Documents
router.get('/projects/:projectId/documents', getDocuments);
router.post('/projects/:projectId/documents', upload.single('file'), uploadDocument);

// Review / confirm (preset stage flow)
router.get('/documents/:documentId/draft', getDraft);
router.post('/documents/:documentId/confirm', confirmDocument);

// Backfill
router.get('/projects/:projectId/backfill-preview', getBackfillPreview);
router.post('/projects/:projectId/topics/accept-suggested', acceptSuggestedTopic);

// Timeline
router.get('/projects/:projectId/timeline', getTimeline);

export default router;
