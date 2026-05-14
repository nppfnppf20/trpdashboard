import express from 'express';
import {
  listPolicyContextTemplates,
  updatePolicyContextTemplate
} from '../controllers/policyContextTemplates.controller.js';

const router = express.Router();

router.get('/', listPolicyContextTemplates);
router.put('/:devType', updatePolicyContextTemplate);

export default router;
