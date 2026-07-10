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
 * POST /api/admin-console/surveyor-organisations
 * Create a new surveyor organisation
 */
export async function createSurveyorOrganisation(req, res) {
  try {
    const { organisation, discipline, location, notes, approval_status, small_business, contacts } = req.body;

    if (!organisation?.trim()) {
      return res.status(400).json({ error: 'Organisation name is required' });
    }
    if (!discipline?.trim()) {
      return res.status(400).json({ error: 'Discipline is required' });
    }

    const surveyor = await surveyorOrganisationsService.createSurveyorOrganisation({
      organisation: organisation.trim(),
      discipline: discipline.trim(),
      location,
      notes,
      approval_status,
      small_business,
      contacts: contacts || []
    });
    res.status(201).json(surveyor);
  } catch (error) {
    console.error('Error creating surveyor organisation:', error);
    res.status(500).json({ error: 'Failed to create surveyor organisation', details: error.message });
  }
}

/**
 * PUT /api/admin-console/surveyor-organisations/:id
 * Update a surveyor organisation
 */
export async function updateSurveyorOrganisation(req, res) {
  try {
    const { id } = req.params;
    const { organisation, discipline, location, notes, approval_status, small_business, contacts } = req.body;

    if (!organisation?.trim()) {
      return res.status(400).json({ error: 'Organisation name is required' });
    }
    if (!discipline?.trim()) {
      return res.status(400).json({ error: 'Discipline is required' });
    }

    const surveyor = await surveyorOrganisationsService.updateSurveyorOrganisation(id, {
      organisation: organisation.trim(),
      discipline: discipline.trim(),
      location,
      notes,
      approval_status,
      small_business,
      contacts: contacts || []
    });

    if (!surveyor) {
      return res.status(404).json({ error: 'Surveyor organisation not found' });
    }

    res.json(surveyor);
  } catch (error) {
    console.error('Error updating surveyor organisation:', error);
    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update surveyor organisation', details: error.message });
  }
}

/**
 * DELETE /api/admin-console/surveyor-organisations/:id
 * Delete a surveyor organisation
 */
export async function deleteSurveyorOrganisation(req, res) {
  try {
    const { id } = req.params;
    await surveyorOrganisationsService.deleteSurveyorOrganisation(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting surveyor organisation:', error);
    res.status(500).json({ error: 'Failed to delete surveyor organisation', details: error.message });
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

