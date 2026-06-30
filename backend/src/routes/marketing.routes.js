/**
 * Marketing Routes
 */

import express from 'express';
import { getDraftTypes, getDraft, saveDraft, generateDraft } from '../controllers/marketing.controller.js';

const router = express.Router();

router.get('/draft-types', getDraftTypes);
router.get('/drafts/:typeId', getDraft);
router.put('/drafts/:typeId', saveDraft);
router.post('/drafts/:typeId/generate', generateDraft);

export default router;
