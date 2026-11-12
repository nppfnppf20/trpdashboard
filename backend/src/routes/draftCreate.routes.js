import express from 'express';
import { generateCustomDraft, createChat } from '../controllers/draftCreate.controller.js';

const router = express.Router();

router.post('/generate', generateCustomDraft);
router.post('/projects/:projectId/chat', createChat);

export default router;
