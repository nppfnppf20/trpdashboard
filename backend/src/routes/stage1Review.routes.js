/**
 * Stage 1 Review Routes
 */

import express from 'express';
import multer from 'multer';
import { generateStage1Review, getStage1Context, getStage1StartingDocs, upsertStage1StartingDoc, deleteStage1StartingDoc } from '../controllers/stage1Review.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/projects/:projectId/generate', generateStage1Review);
router.get('/projects/:projectId/context', getStage1Context);

router.get('/projects/:projectId/starting-docs', getStage1StartingDocs);
router.put('/projects/:projectId/starting-docs/:slotSlug', upload.single('file'), upsertStage1StartingDoc);
router.delete('/projects/:projectId/starting-docs/:slotSlug', deleteStage1StartingDoc);

export default router;
