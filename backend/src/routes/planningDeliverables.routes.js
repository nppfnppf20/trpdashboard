/**
 * Planning Deliverables Routes
 * API routes for managing planning document templates and deliverables
 */

import express from 'express';
import { createUpload } from '../middleware/upload.js';
import {
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  generateDeliverableByType,
  createDeliverable,
  createCustomDeliverable,
  getDeliverablesForProject,
  getDeliverableById,
  updateDeliverable,
  deleteDeliverable,
  getDeliverableAsHTML,
  updateDeliverableFromHTML,
  incorporateDeliverableTargeted
} from '../controllers/planningDeliverables.controller.js';

const router = express.Router();

const upload = createUpload({ exts: ['pdf', 'txt', 'md'], fieldSizeMB: 10 });

// Template routes
router.get('/templates', getAllTemplates);
router.get('/templates/:id', getTemplateById);
router.put('/templates/:id', updateTemplate);

// Deliverable routes
router.post('/deliverables/generate-by-type', generateDeliverableByType);
router.post('/deliverables/custom', createCustomDeliverable);
router.post('/deliverables', createDeliverable);
router.get('/deliverables/project/:projectId', getDeliverablesForProject);
router.get('/deliverables/:id', getDeliverableById);
router.put('/deliverables/:id', updateDeliverable);
router.delete('/deliverables/:id', deleteDeliverable);

// HTML conversion routes (for rich text editor)
router.get('/deliverables/:id/html', getDeliverableAsHTML);
router.put('/deliverables/:id/html', updateDeliverableFromHTML);

// AI-edit a highlighted (or the whole) set of paragraphs
router.post('/deliverables/:id/incorporate-targeted', upload.single('file'), incorporateDeliverableTargeted);

export default router;

