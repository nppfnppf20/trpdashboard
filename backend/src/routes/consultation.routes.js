import express from 'express';
import multer from 'multer';
import {
  processConsultation,
  getConsultationData,
  createResponse,
  updateResponse,
  deleteResponse,
  markExported,
  markIssuedToClient,
} from '../controllers/consultation.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/projects/:projectId/process', upload.single('file'), processConsultation);
router.get('/projects/:projectId', getConsultationData);
router.post('/projects/:projectId/responses', createResponse);
router.post('/projects/:projectId/export', markExported);
router.post('/projects/:projectId/issue-to-client', markIssuedToClient);
router.put('/responses/:responseId', updateResponse);
router.delete('/responses/:responseId', deleteResponse);

export default router;
