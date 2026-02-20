/**
 * Client Organisations Routes
 * Defines endpoints for client organisation management
 */

import express from 'express';
import * as clientOrganisationsController from '../controllers/clientOrganisations.controller.js';

const router = express.Router();

// GET /api/admin-console/client-organisations - Get all client organisations
router.get('/', clientOrganisationsController.getAllClientOrganisations);

// POST /api/admin-console/client-organisations - Create client organisation
router.post('/', clientOrganisationsController.createClientOrganisation);

// GET /api/admin-console/client-organisations/:id - Get single client organisation
router.get('/:id', clientOrganisationsController.getClientOrganisationById);

// GET /api/admin-console/client-organisations/:id/contacts-count - Get contacts count for delete confirmation
router.get('/:id/contacts-count', clientOrganisationsController.getContactsCount);

// PUT /api/admin-console/client-organisations/:id - Update client organisation
router.put('/:id', clientOrganisationsController.updateClientOrganisation);

// DELETE /api/admin-console/client-organisations/:id - Delete client organisation
router.delete('/:id', clientOrganisationsController.deleteClientOrganisation);

export default router;
