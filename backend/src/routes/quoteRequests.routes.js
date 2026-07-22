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

// Email sending
router.post('/projects/:projectId/send-briefings', quoteRequestsController.sendBriefingEmails);

// LLM-assisted briefing routes
router.post('/projects/:projectId/analyse-disciplines', quoteRequestsController.analyseDisciplines);
router.post('/projects/:projectId/suggest-email-edits', quoteRequestsController.suggestEmailEditsForDiscipline);
router.get('/projects/:projectId/briefing-sources', quoteRequestsController.listBriefingSources);
router.get('/surveyors', quoteRequestsController.getSurveyorsForDiscipline);

export default router;
