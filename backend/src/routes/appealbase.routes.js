/**
 * Appealbase Routes
 * Planning appeal precedent search, proxied through the backend so the
 * Appealbase API key stays server-side.
 */

import express from 'express';
import { searchAppeals, retrieveAppeal } from '../controllers/appealbase.controller.js';

const router = express.Router();

router.post('/search', searchAppeals);
router.post('/retrieve', retrieveAppeal);

export default router;
