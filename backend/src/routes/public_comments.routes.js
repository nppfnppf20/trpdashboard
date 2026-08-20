import express from 'express';
import multer from 'multer';
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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/projects/:projectId/split', upload.single('file'), splitCommentBlock);
router.post('/projects/:projectId/process', upload.single('file'), processComment);
router.get('/projects/:projectId', getCommentsData);
router.post('/projects/:projectId/comments', createComment);
router.post('/projects/:projectId/analyse', runAnalysis);
router.put('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

export default router;
