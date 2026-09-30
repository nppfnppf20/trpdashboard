import express from 'express';
import { listTemplates, generateSlideshow } from '../controllers/slideshow.controller.js';

const router = express.Router();

router.get('/templates', listTemplates);
router.post('/:projectId/generate', generateSlideshow);

export default router;
