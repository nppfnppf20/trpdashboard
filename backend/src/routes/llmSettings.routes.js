import express from 'express';
import { listLlmSettings, updateLlmSetting } from '../controllers/llmSettings.controller.js';

const router = express.Router();

router.get('/', listLlmSettings);
router.put('/:key', updateLlmSetting);

export default router;
