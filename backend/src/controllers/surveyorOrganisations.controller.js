/**
 * Surveyor Organisations Controller
 * Handles HTTP requests for surveyor organisation endpoints
 */

import * as surveyorOrganisationsService from '../services/surveyorOrganisations.service.js';

/**
 * GET /api/admin-console/surveyor-organisations
 * Get all surveyor organisations with contacts and ratings
 */
export async function getAllSurveyorOrganisations(req, res) {
  try {
    const surveyors = await surveyorOrganisationsService.getAllSurveyorOrganisations();
    res.json(surveyors);
  } catch (error) {
    console.error('Error fetching surveyor organisations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch surveyor organisations',
      details: error.message 
    });
  }
}

/**
 * GET /api/admin-console/surveyor-organisations/:id
 * Get single surveyor organisation by ID
 */
export async function getSurveyorOrganisationById(req, res) {
  try {
    const { id } = req.params;
    const surveyor = await surveyorOrganisationsService.getSurveyorOrganisationById(id);

    if (!surveyor) {
      return res.status(404).json({ error: 'Surveyor organisation not found' });
    }

    res.json(surveyor);
  } catch (error) {
    console.error('Error fetching surveyor organisation:', error);
    res.status(500).json({
      error: 'Failed to fetch surveyor organisation',
      details: error.message
    });
  }
}

/**
 * POST /api/admin-console/surveyor-organisations/refresh-ratings
 * Refresh ratings for all surveyor organisations
 */
export async function refreshAllRatings(req, res) {
  try {
    await surveyorOrganisationsService.refreshAllSurveyorRatings();
    res.json({ success: true, message: 'All surveyor ratings refreshed' });
  } catch (error) {
    console.error('Error refreshing surveyor ratings:', error);
    res.status(500).json({
      error: 'Failed to refresh surveyor ratings',
      details: error.message
    });
  }
}

