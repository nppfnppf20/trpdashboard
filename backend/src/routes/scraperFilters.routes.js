import express from 'express';
import { getFilterPrompts, updateFilterPrompt, applyFilter } from '../controllers/scraperFilters.controller.js';

const router = express.Router();

router.get('/', getFilterPrompts);
router.put('/:category', updateFilterPrompt);
router.post('/:category/apply', applyFilter);

export default router;
