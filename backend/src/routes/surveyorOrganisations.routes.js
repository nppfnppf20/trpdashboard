/**
 * Surveyor Organisations Routes
 * Defines endpoints for surveyor organisation management
 */

import express from 'express';
import * as surveyorOrganisationsController from '../controllers/surveyorOrganisations.controller.js';

const router = express.Router();

// GET /api/admin-console/surveyor-organisations
router.get('/', surveyorOrganisationsController.getAllSurveyorOrganisations);

// POST /api/admin-console/surveyor-organisations
router.post('/', surveyorOrganisationsController.createSurveyorOrganisation);

// POST /api/admin-console/surveyor-organisations/refresh-ratings
router.post('/refresh-ratings', surveyorOrganisationsController.refreshAllRatings);

// GET /api/admin-console/surveyor-organisations/:id
router.get('/:id', surveyorOrganisationsController.getSurveyorOrganisationById);

// PUT /api/admin-console/surveyor-organisations/:id
router.put('/:id', surveyorOrganisationsController.updateSurveyorOrganisation);

// DELETE /api/admin-console/surveyor-organisations/:id
router.delete('/:id', surveyorOrganisationsController.deleteSurveyorOrganisation);

export default router;

