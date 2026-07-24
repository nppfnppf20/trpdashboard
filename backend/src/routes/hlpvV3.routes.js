/**
 * HLPV v3 Routes
 */

import express from 'express';
import { generateHlpvV3 } from '../controllers/hlpvV3.controller.js';

const router = express.Router();

router.post('/projects/:projectId/generate', generateHlpvV3);

export default router;
