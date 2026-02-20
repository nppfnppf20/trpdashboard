/**
 * Quotes Routes
 * Defines endpoints for quote management
 */

import express from 'express';
import * as quotesController from '../controllers/quotes.controller.js';

const router = express.Router();

// GET /api/admin-console/quotes/projects/with-stats - Get projects with statistics (MUST be before /:id)
router.get('/projects/with-stats', quotesController.getProjectsWithStats);

// GET /api/admin-console/quotes/projects/:projectId/quote-key-dates - Get quote key dates
router.get('/projects/:projectId/quote-key-dates', quotesController.getQuoteKeyDates);

// GET /api/admin-console/quotes/projects/:projectId/programme-events - Get programme events
router.get('/projects/:projectId/programme-events', quotesController.getProgrammeEvents);

// POST /api/admin-console/quotes/projects/:projectId/programme-events - Create programme event
router.post('/projects/:projectId/programme-events', quotesController.createProgrammeEvent);

// PUT /api/admin-console/quotes/programme-events/:id - Update programme event
router.put('/programme-events/:id', quotesController.updateProgrammeEvent);

// DELETE /api/admin-console/quotes/programme-events/:id - Delete programme event
router.delete('/programme-events/:id', quotesController.deleteProgrammeEvent);

// PUT /api/admin-console/quotes/key-dates/:id - Update quote key date
router.put('/key-dates/:id', quotesController.updateQuoteKeyDate);

// DELETE /api/admin-console/quotes/key-dates/:id - Delete quote key date
router.delete('/key-dates/:id', quotesController.deleteQuoteKeyDate);

// GET /api/admin-console/quotes - Get quotes with optional filters
router.get('/', quotesController.getQuotes);

// POST /api/admin-console/quotes - Create new quote
router.post('/', quotesController.createQuote);

// POST /api/admin-console/quotes/:quoteId/key-dates - Create quote key date
router.post('/:quoteId/key-dates', quotesController.createQuoteKeyDate);

// PATCH /api/admin-console/quotes/:id/instruction-status - Update instruction status
router.patch('/:id/instruction-status', quotesController.updateInstructionStatus);

// PATCH /api/admin-console/quotes/:id/notes - Update quote notes
router.patch('/:id/notes', quotesController.updateQuoteNotes);

// PATCH /api/admin-console/quotes/:id/work-status - Update work status
router.patch('/:id/work-status', quotesController.updateWorkStatus);

// PATCH /api/admin-console/quotes/:id/dependencies - Update dependencies
router.patch('/:id/dependencies', quotesController.updateDependencies);

// PATCH /api/admin-console/quotes/:id/operational-notes - Update operational notes
router.patch('/:id/operational-notes', quotesController.updateOperationalNotes);

// PATCH /api/admin-console/quotes/:id/review - Update review
router.patch('/:id/review', quotesController.updateQuoteReview);

// DELETE /api/admin-console/quotes/:id - Delete quote
router.delete('/:id', quotesController.deleteQuote);

// PUT /api/admin-console/quotes/:id - Update quote
router.put('/:id', quotesController.updateQuote);

// GET /api/admin-console/quotes/:id - Get single quote (MUST be last)
router.get('/:id', quotesController.getQuoteById);

export default router;

