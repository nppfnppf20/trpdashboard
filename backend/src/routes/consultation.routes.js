import express from 'express';
import multer from 'multer';
import {
  processConsultation,
  getConsultationData,
  createResponse,
  updateResponse,
  deleteResponse,
  createAdvancements,
  suggestAdvancements,
  updateAdvancement,
  deleteAdvancement,
  markExported,
  markIssuedToClient,
  emailConsultant,
  summarise,
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
router.post('/responses/:responseId/email-consultant', emailConsultant);
router.post('/projects/:projectId/summarise', summarise);
router.post('/projects/:projectId/advancements', createAdvancements);
router.post('/projects/:projectId/advancements/suggest', suggestAdvancements);
router.put('/advancements/:advancementId', updateAdvancement);
router.delete('/advancements/:advancementId', deleteAdvancement);

export default router;
