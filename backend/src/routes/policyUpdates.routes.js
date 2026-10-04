import express from 'express';
import { createUpload } from '../middleware/upload.js';
import {
  listPolicyItems,
  uploadPolicyDocument,
  updatePolicyDocument,
  deletePolicyDocument,
  updatePolicyInsight,
  deletePolicyInsight,
} from '../controllers/policy.controller.js';

const router = express.Router();
const upload = createUpload({ maxMB: 50 });

router.get('/',                         listPolicyItems);
router.post('/upload',  upload.single('file'), uploadPolicyDocument);
router.patch('/documents/:id',          updatePolicyDocument);
router.delete('/documents/:id',         deletePolicyDocument);
router.patch('/insights/:id',           updatePolicyInsight);
router.delete('/insights/:id',          deletePolicyInsight);

export default router;
