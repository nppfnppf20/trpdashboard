import express from 'express';
import multer from 'multer';
import { sectionChat, parseSectionDoc } from '../controllers/sectionChat.controller.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/projects/:projectId/section-chat', sectionChat);
router.post('/projects/:projectId/section-chat/parse-doc', upload.single('file'), parseSectionDoc);

export default router;
