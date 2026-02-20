/**
 * Surveyor Organisations Routes
 * Defines endpoints for surveyor organisation management
 */

import express from 'express';
import * as surveyorOrganisationsController from '../controllers/surveyorOrganisations.controller.js';

const router = express.Router();

// GET /api/admin-console/surveyor-organisations - Get all surveyor organisations
router.get('/', surveyorOrganisationsController.getAllSurveyorOrganisations);

// POST /api/admin-console/surveyor-organisations/refresh-ratings - Refresh all ratings
router.post('/refresh-ratings', surveyorOrganisationsController.refreshAllRatings);

// GET /api/admin-console/surveyor-organisations/:id - Get single surveyor organisation
router.get('/:id', surveyorOrganisationsController.getSurveyorOrganisationById);

export default router;

