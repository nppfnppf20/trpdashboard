import express from 'express';
import multer from 'multer';
import {
  listPolicyItems,
  uploadPolicyDocument,
  updatePolicyDocument,
  deletePolicyDocument,
  updatePolicyInsight,
  deletePolicyInsight,
} from '../controllers/policy.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/',                         listPolicyItems);
router.post('/upload',  upload.single('file'), uploadPolicyDocument);
router.patch('/documents/:id',          updatePolicyDocument);
router.delete('/documents/:id',         deletePolicyDocument);
router.patch('/insights/:id',           updatePolicyInsight);
router.delete('/insights/:id',          deletePolicyInsight);

export default router;
