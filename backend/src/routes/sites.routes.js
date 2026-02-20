/**
 * Sites Routes
 * Routes for site analysis and TRP report endpoints
 */

import express from 'express';
import { saveSite, saveTRPEdits } from '../controllers/sites.controller.js';

const router = express.Router();

router.post('/save-site', saveSite);
router.post('/save-trp-edits', saveTRPEdits);

export default router;

