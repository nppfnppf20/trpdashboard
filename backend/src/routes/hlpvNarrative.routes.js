/**
 * HLPV Narrative Routes
 */

import express from 'express';
import { generateNarrative } from '../controllers/hlpvNarrative.controller.js';

const router = express.Router();

router.post('/generate-narrative', generateNarrative);

export default router;
