import express from 'express';
import { generateCustomDraft } from '../controllers/draftCreate.controller.js';

const router = express.Router();

router.post('/generate', generateCustomDraft);

export default router;
