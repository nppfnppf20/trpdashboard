import express from 'express';
import { getLlmStatus } from '../controllers/llmStatus.controller.js';

const router = express.Router();

router.get('/', getLlmStatus);

export default router;
