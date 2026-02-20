/**
 * Client Organisations Controller
 * Handles HTTP requests for client organisation endpoints
 */

import * as clientOrganisationsService from '../services/clientOrganisations.service.js';

/**
 * GET /api/admin-console/client-organisations
 * Get all client organisations with contacts
 */
export async function getAllClientOrganisations(req, res) {
  try {
    const clients = await clientOrganisationsService.getAllClientOrganisations();
    res.json(clients);
  } catch (error) {
    console.error('Error fetching client organisations:', error);
    res.status(500).json({
      error: 'Failed to fetch client organisations',
      details: error.message
    });
  }
}

/**
 * GET /api/admin-console/client-organisations/:id
 * Get single client organisation by ID
 */
export async function getClientOrganisationById(req, res) {
  try {
    const { id } = req.params;
    const client = await clientOrganisationsService.getClientOrganisationById(id);

    if (!client) {
      return res.status(404).json({ error: 'Client organisation not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error fetching client organisation:', error);
    res.status(500).json({
      error: 'Failed to fetch client organisation',
      details: error.message
    });
  }
}

/**
 * POST /api/admin-console/client-organisations
 * Create a new client organisation
 */
export async function createClientOrganisation(req, res) {
  try {
    const { organisation_name, contacts } = req.body;

    if (!organisation_name || !organisation_name.trim()) {
      return res.status(400).json({ error: 'Organisation name is required' });
    }

    const client = await clientOrganisationsService.createClientOrganisation({
      organisation_name: organisation_name.trim(),
      contacts: contacts || []
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client organisation:', error);
    res.status(500).json({
      error: 'Failed to create client organisation',
      details: error.message
    });
  }
}

/**
 * PUT /api/admin-console/client-organisations/:id
 * Update a client organisation
 */
export async function updateClientOrganisation(req, res) {
  try {
    const { id } = req.params;
    const { organisation_name, contacts } = req.body;

    if (!organisation_name || !organisation_name.trim()) {
      return res.status(400).json({ error: 'Organisation name is required' });
    }

    // Check if organisation exists
    const existing = await clientOrganisationsService.getClientOrganisationById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Client organisation not found' });
    }

    const client = await clientOrganisationsService.updateClientOrganisation(id, {
      organisation_name: organisation_name.trim(),
      contacts: contacts || []
    });

    res.json(client);
  } catch (error) {
    console.error('Error updating client organisation:', error);
    res.status(500).json({
      error: 'Failed to update client organisation',
      details: error.message
    });
  }
}

/**
 * DELETE /api/admin-console/client-organisations/:id
 * Delete a client organisation and all its contacts
 */
export async function deleteClientOrganisation(req, res) {
  try {
    const { id } = req.params;

    // Check if organisation exists
    const existing = await clientOrganisationsService.getClientOrganisationById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Client organisation not found' });
    }

    const result = await clientOrganisationsService.deleteClientOrganisation(id);

    res.json({
      success: true,
      message: `Deleted organisation and ${result.contactsDeleted} contact(s)`
    });
  } catch (error) {
    console.error('Error deleting client organisation:', error);
    res.status(500).json({
      error: 'Failed to delete client organisation',
      details: error.message
    });
  }
}

/**
 * GET /api/admin-console/client-organisations/:id/contacts-count
 * Get count of contacts for delete confirmation
 */
export async function getContactsCount(req, res) {
  try {
    const { id } = req.params;
    const count = await clientOrganisationsService.getContactsCount(id);
    res.json({ count });
  } catch (error) {
    console.error('Error getting contacts count:', error);
    res.status(500).json({
      error: 'Failed to get contacts count',
      details: error.message
    });
  }
}
