import express from 'express';
import {
  listDocumentTypes,
  listDevelopmentTypes,
  listGuidingBriefs,
  createGuidingBrief,
  updateGuidingBrief,
  deleteGuidingBrief,
  reviewDraft,
} from '../controllers/guidingBriefs.controller.js';

const router = express.Router();

router.get('/doc-types', listDocumentTypes);
router.get('/development-types', listDevelopmentTypes);
router.get('/', listGuidingBriefs);
router.post('/', createGuidingBrief);
router.post('/review', reviewDraft);
router.patch('/:id', updateGuidingBrief);
router.delete('/:id', deleteGuidingBrief);

export default router;
