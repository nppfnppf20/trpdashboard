import express from 'express';
import * as crossProjectChatController from '../controllers/crossProjectChat.controller.js';

const router = express.Router();

router.post('/sources', crossProjectChatController.getSources);
router.post('/chat', crossProjectChatController.chat);

export default router;
