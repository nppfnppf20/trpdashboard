import express from 'express';
import { createUpload } from '../middleware/upload.js';
import {
  processComment,
  splitCommentBlock,
  getCommentsData,
  createComment,
  updateComment,
  deleteComment,
  runAnalysis,
} from '../controllers/public_comments.controller.js';

const router = express.Router();
const upload = createUpload({ maxMB: 50, exts: ['pdf', 'docx', 'doc', 'txt', 'md'] });

router.post('/projects/:projectId/split', upload.single('file'), splitCommentBlock);
router.post('/projects/:projectId/process', upload.single('file'), processComment);
router.get('/projects/:projectId', getCommentsData);
router.post('/projects/:projectId/comments', createComment);
router.post('/projects/:projectId/analyse', runAnalysis);
router.put('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

export default router;
