/**
 * Quotes Controller
 * Handles HTTP requests for quote endpoints
 */

import * as quotesService from '../services/quotes.service.js';

/**
 * GET /api/admin-console/quotes
 * Get quotes with optional filters
 * Query params: projectId, instructionStatus, workStatus
 */
export async function getQuotes(req, res) {
  try {
    const filters = {
      projectId: req.query.projectId,
      instructionStatus: req.query.instructionStatus,
      workStatus: req.query.workStatus
    };
    
    // Remove undefined filters
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );
    
    const quotes = await quotesService.getQuotes(filters);
    res.json(quotes);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch quotes',
      details: error.message 
    });
  }
}

/**
 * GET /api/admin-console/quotes/:id
 * Get single quote by ID
 */
export async function getQuoteById(req, res) {
  try {
    const { id } = req.params;
    const quote = await quotesService.getQuoteById(id);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ 
      error: 'Failed to fetch quote',
      details: error.message 
    });
  }
}

/**
 * GET /api/admin-console/projects-with-stats
 * Get all projects with aggregated quote statistics
 */
export async function getProjectsWithStats(req, res) {
  try {
    const projects = await quotesService.getProjectsWithStats();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects with stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch projects with stats',
      details: error.message 
    });
  }
}

/**
 * GET /api/admin-console/projects/:projectId/quote-key-dates
 * Get quote key dates for a project
 */
export async function getQuoteKeyDates(req, res) {
  try {
    const { projectId } = req.params;
    const keyDates = await quotesService.getQuoteKeyDates(projectId);
    res.json(keyDates);
  } catch (error) {
    console.error('Error fetching quote key dates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch quote key dates',
      details: error.message 
    });
  }
}

/**
 * GET /api/admin-console/projects/:projectId/programme-events
 * Get programme events for a project
 */
export async function getProgrammeEvents(req, res) {
  try {
    const { projectId } = req.params;
    const events = await quotesService.getProgrammeEvents(projectId);
    res.json(events);
  } catch (error) {
    console.error('Error fetching programme events:', error);
    res.status(500).json({
      error: 'Failed to fetch programme events',
      details: error.message
    });
  }
}

/**
 * POST /api/admin-console/quotes/projects/:projectId/programme-events
 * Create a programme event
 */
export async function createProgrammeEvent(req, res) {
  try {
    const { projectId } = req.params;
    const { title, date, colour } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'title and date are required' });
    }

    const event = await quotesService.createProgrammeEvent({
      project_id: projectId,
      title,
      date,
      colour
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating programme event:', error);
    res.status(500).json({
      error: 'Failed to create programme event',
      details: error.message
    });
  }
}

/**
 * PUT /api/admin-console/quotes/programme-events/:id
 * Update a programme event
 */
export async function updateProgrammeEvent(req, res) {
  try {
    const { id } = req.params;
    const { title, date, colour } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'title and date are required' });
    }

    const event = await quotesService.updateProgrammeEvent(id, { title, date, colour });

    if (!event) {
      return res.status(404).json({ error: 'Programme event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error updating programme event:', error);
    res.status(500).json({
      error: 'Failed to update programme event',
      details: error.message
    });
  }
}

/**
 * DELETE /api/admin-console/quotes/programme-events/:id
 * Delete a programme event
 */
export async function deleteProgrammeEvent(req, res) {
  try {
    const { id } = req.params;

    const result = await quotesService.deleteProgrammeEvent(id);

    if (!result) {
      return res.status(404).json({ error: 'Programme event not found' });
    }

    res.json({ success: true, message: 'Programme event deleted', id: result.id });
  } catch (error) {
    console.error('Error deleting programme event:', error);
    res.status(500).json({
      error: 'Failed to delete programme event',
      details: error.message
    });
  }
}

/**
 * POST /api/admin-console/quotes/:quoteId/key-dates
 * Create a quote key date
 */
export async function createQuoteKeyDate(req, res) {
  try {
    const { quoteId } = req.params;
    const { title, date, colour } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'title and date are required' });
    }

    const keyDate = await quotesService.createQuoteKeyDate({
      quote_id: quoteId,
      title,
      date,
      colour
    });

    res.status(201).json(keyDate);
  } catch (error) {
    console.error('Error creating quote key date:', error);
    res.status(500).json({
      error: 'Failed to create quote key date',
      details: error.message
    });
  }
}

/**
 * PUT /api/admin-console/quotes/key-dates/:id
 * Update a quote key date
 */
export async function updateQuoteKeyDate(req, res) {
  try {
    const { id } = req.params;
    const { title, date, colour } = req.body;

    console.log('updateQuoteKeyDate controller called');
    console.log('ID from params:', id);
    console.log('Body:', { title, date, colour });

    if (!title || !date) {
      return res.status(400).json({ error: 'title and date are required' });
    }

    const keyDate = await quotesService.updateQuoteKeyDate(id, { title, date, colour });

    console.log('Result from service:', keyDate);

    if (!keyDate) {
      console.log('No keyDate returned - sending 404');
      return res.status(404).json({ error: 'Quote key date not found' });
    }

    res.json(keyDate);
  } catch (error) {
    console.error('Error updating quote key date:', error);
    res.status(500).json({
      error: 'Failed to update quote key date',
      details: error.message
    });
  }
}

/**
 * DELETE /api/admin-console/quotes/key-dates/:id
 * Delete a quote key date
 */
export async function deleteQuoteKeyDate(req, res) {
  try {
    const { id } = req.params;

    const result = await quotesService.deleteQuoteKeyDate(id);

    if (!result) {
      return res.status(404).json({ error: 'Quote key date not found' });
    }

    res.json({ success: true, message: 'Quote key date deleted', id: result.id });
  } catch (error) {
    console.error('Error deleting quote key date:', error);
    res.status(500).json({
      error: 'Failed to delete quote key date',
      details: error.message
    });
  }
}

/**
 * POST /api/admin-console/quotes
 * Create a new quote with line items
 */
export async function createQuote(req, res) {
  try {
    const quoteData = req.body;

    console.log('createQuote controller - received data:', JSON.stringify(quoteData, null, 2));

    // Validate required fields
    if (!quoteData.project_id || !quoteData.surveyor_organisation_id || !quoteData.discipline) {
      return res.status(400).json({
        error: 'Missing required fields: project_id, surveyor_organisation_id, discipline'
      });
    }

    const quote = await quotesService.createQuote(quoteData);
    res.status(201).json(quote);
  } catch (error) {
    console.error('Error creating quote:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to create quote',
      details: error.message
    });
  }
}

/**
 * PATCH /api/admin-console/quotes/:id/instruction-status
 * Update quote instruction status
 */
export async function updateInstructionStatus(req, res) {
  try {
    const { id } = req.params;
    const { instruction_status, selectedLineItems } = req.body;
    
    if (!instruction_status) {
      return res.status(400).json({ error: 'instruction_status is required' });
    }
    
    const quote = await quotesService.updateQuoteInstructionStatus(
      id, 
      instruction_status, 
      selectedLineItems
    );
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    res.json(quote);
  } catch (error) {
    console.error('Error updating instruction status:', error);
    res.status(500).json({ 
      error: 'Failed to update instruction status',
      details: error.message 
    });
  }
}

/**
 * PATCH /api/admin-console/quotes/:id/notes
 * Update quote notes
 */
export async function updateQuoteNotes(req, res) {
  try {
    const { id } = req.params;
    const { quote_notes } = req.body;

    const quote = await quotesService.updateQuoteNotes(id, quote_notes);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error updating quote notes:', error);
    res.status(500).json({
      error: 'Failed to update quote notes',
      details: error.message
    });
  }
}

/**
 * PATCH /api/admin-console/quotes/:id/work-status
 * Update quote work status
 */
export async function updateWorkStatus(req, res) {
  try {
    const { id } = req.params;
    const { work_status } = req.body;

    if (!work_status) {
      return res.status(400).json({ error: 'work_status is required' });
    }

    const quote = await quotesService.updateQuoteWorkStatus(id, work_status);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error updating work status:', error);
    res.status(500).json({
      error: 'Failed to update work status',
      details: error.message
    });
  }
}

/**
 * PATCH /api/admin-console/quotes/:id/dependencies
 * Update quote dependencies
 */
export async function updateDependencies(req, res) {
  try {
    const { id } = req.params;
    const { dependencies } = req.body;

    const quote = await quotesService.updateQuoteDependencies(id, dependencies);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error updating dependencies:', error);
    res.status(500).json({
      error: 'Failed to update dependencies',
      details: error.message
    });
  }
}

/**
 * PATCH /api/admin-console/quotes/:id/operational-notes
 * Update quote operational notes
 */
export async function updateOperationalNotes(req, res) {
  try {
    const { id } = req.params;
    const { operational_notes } = req.body;

    const quote = await quotesService.updateQuoteOperationalNotes(id, operational_notes);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error updating operational notes:', error);
    res.status(500).json({
      error: 'Failed to update operational notes',
      details: error.message
    });
  }
}

/**
 * PATCH /api/admin-console/quotes/:id/review
 * Update quote review
 */
export async function updateQuoteReview(req, res) {
  try {
    const { id } = req.params;
    const { quality, responsiveness, delivered_on_time, overall_review, review_notes } = req.body;

    console.log('updateQuoteReview controller - id:', id, 'body:', req.body);

    const quote = await quotesService.updateQuoteReview(id, {
      quality,
      responsiveness,
      delivered_on_time,
      overall_review,
      review_notes
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error updating quote review:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to update quote review',
      details: error.message
    });
  }
}

/**
 * DELETE /api/admin-console/quotes/:id
 * Delete a quote
 */
export async function deleteQuote(req, res) {
  try {
    const { id } = req.params;

    const result = await quotesService.deleteQuote(id);

    if (!result) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json({
      success: true,
      message: 'Quote deleted successfully',
      id: result.id
    });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({
      error: 'Failed to delete quote',
      details: error.message
    });
  }
}

/**
 * PUT /api/admin-console/quotes/:id
 * Update a quote with line items
 */
export async function updateQuote(req, res) {
  try {
    const { id } = req.params;
    const quoteData = req.body;

    // Validate required fields
    if (!quoteData.surveyor_organisation_id || !quoteData.discipline) {
      return res.status(400).json({
        error: 'Missing required fields: surveyor_organisation_id, discipline'
      });
    }

    const quote = await quotesService.updateQuote(id, quoteData);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error updating quote:', error);
    res.status(500).json({
      error: 'Failed to update quote',
      details: error.message
    });
  }
}
