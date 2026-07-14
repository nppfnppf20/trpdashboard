import express from 'express';
import { getSources, chat } from '../controllers/projectChat.controller.js';

const router = express.Router();

router.get('/:projectId/sources', getSources);
router.post('/:projectId/chat', chat);

export default router;
