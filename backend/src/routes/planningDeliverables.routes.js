/**
 * Planning Deliverables Routes
 * API routes for managing planning document templates and deliverables
 */

import express from 'express';
import {
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  createDeliverable,
  getDeliverablesForProject,
  getDeliverableById,
  updateDeliverable,
  deleteDeliverable,
  getDeliverableAsHTML,
  updateDeliverableFromHTML
} from '../controllers/planningDeliverables.controller.js';

const router = express.Router();

// Template routes
router.get('/templates', getAllTemplates);
router.get('/templates/:id', getTemplateById);
router.put('/templates/:id', updateTemplate);

// Deliverable routes
router.post('/deliverables', createDeliverable);
router.get('/deliverables/project/:projectId', getDeliverablesForProject);
router.get('/deliverables/:id', getDeliverableById);
router.put('/deliverables/:id', updateDeliverable);
router.delete('/deliverables/:id', deleteDeliverable);

// HTML conversion routes (for rich text editor)
router.get('/deliverables/:id/html', getDeliverableAsHTML);
router.put('/deliverables/:id/html', updateDeliverableFromHTML);

export default router;

