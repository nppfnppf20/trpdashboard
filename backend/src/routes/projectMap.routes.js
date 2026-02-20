/**
 * Project Map Routes
 * Routes for project map data layers
 */

import express from 'express';
import {
  getRenewables,
  getDataCentres,
  getProjects,
  getTRPCommercial,
  getTRPEnergy,
  getTRPResidential,
  updateRenewableDismissed,
  updateDataCentreDismissed,
  getContractsFinder,
  updateContractsFinderDismissed
} from '../controllers/projectMap.controller.js';

const router = express.Router();

// GET routes for data layers
router.get('/renewables', getRenewables);
router.get('/datacentres', getDataCentres);
router.get('/projects', getProjects);
router.get('/trp-commercial', getTRPCommercial);
router.get('/trp-energy', getTRPEnergy);
router.get('/trp-residential', getTRPResidential);

// PATCH routes for dismiss toggles
router.patch('/renewables/:id/dismiss', updateRenewableDismissed);
router.patch('/datacentres/:id/dismiss', updateDataCentreDismissed);
router.patch('/contracts-finder/:id/dismiss', updateContractsFinderDismissed);

// Contracts Finder
router.get('/contracts-finder', getContractsFinder);

export default router;

