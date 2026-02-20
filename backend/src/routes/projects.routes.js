/**
 * Projects Routes
 * CRUD routes for projects management
 */

import express from 'express';
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject
} from '../projectsApi.js';
import * as projectsController from '../controllers/projects.controller.js';

const router = express.Router();

// Project information routes (must be before /:id routes)
router.get('/:projectId/information', projectsController.getProjectInformation);
router.put('/:projectId/information', projectsController.updateProjectInformation);

// Core project routes
router.post('/', createProject);
router.get('/', getAllProjects);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;

