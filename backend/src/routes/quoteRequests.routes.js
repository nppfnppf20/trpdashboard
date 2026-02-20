import express from 'express';
import * as quoteRequestsController from '../controllers/quoteRequests.controller.js';

const router = express.Router();

// Template routes
router.get('/templates', quoteRequestsController.getTemplates);
router.get('/templates/:id', quoteRequestsController.getTemplateById);
router.put('/templates/:id', quoteRequestsController.updateTemplate);
router.post('/templates/:id/merge', quoteRequestsController.mergeTemplate);

// Sent request routes
router.get('/projects/:projectId/sent-requests', quoteRequestsController.getSentRequestsForProject);
router.post('/projects/:projectId/sent-requests', quoteRequestsController.createSentRequest);
router.get('/sent-requests/:id', quoteRequestsController.getSentRequestById);
router.delete('/sent-requests/:id', quoteRequestsController.deleteSentRequest);

export default router;
