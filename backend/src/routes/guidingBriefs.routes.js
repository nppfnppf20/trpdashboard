import express from 'express';
import {
  listGuidingBriefs,
  createGuidingBrief,
  updateGuidingBrief,
  deleteGuidingBrief,
  reviewDraft,
} from '../controllers/guidingBriefs.controller.js';

const router = express.Router();

router.get('/', listGuidingBriefs);
router.post('/', createGuidingBrief);
router.post('/review', reviewDraft);
router.patch('/:id', updateGuidingBrief);
router.delete('/:id', deleteGuidingBrief);

export default router;
