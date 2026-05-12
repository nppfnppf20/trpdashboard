import express from 'express';
import {
  listTemplates,
  getTemplate,
  upsertTemplate,
  deleteTemplate
} from '../controllers/policyTemplates.controller.js';

const router = express.Router();

router.get('/', listTemplates);
router.get('/:id', getTemplate);
router.post('/', upsertTemplate);
router.delete('/:id', deleteTemplate);

export default router;
