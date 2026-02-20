/**
 * REPD Routes
 * Routes for REPD (Renewable Energy Planning Database) endpoints
 */

import express from 'express';
import { getREPDSolar, getREPDWind, getREPDBattery } from '../controllers/repd.controller.js';

const router = express.Router();

router.get('/repd-solar', getREPDSolar);
router.get('/repd-wind', getREPDWind);
router.get('/repd-battery', getREPDBattery);

export default router;

