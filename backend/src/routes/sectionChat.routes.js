import express from 'express';
import { createUpload } from '../middleware/upload.js';
import { sectionChat, parseSectionDoc } from '../controllers/sectionChat.controller.js';

const router = express.Router();

const upload = createUpload({ maxMB: 20 });

router.post('/projects/:projectId/section-chat', sectionChat);
router.post('/projects/:projectId/section-chat/parse-doc', upload.single('file'), parseSectionDoc);

export default router;
