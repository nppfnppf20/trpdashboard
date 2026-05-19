import express from 'express';
import { sendWeeklyDigest } from '../controllers/emailDigest.controller.js';

const router = express.Router();

router.post('/send-weekly-digest', sendWeeklyDigest);

export default router;
