/**
 * Routes Index
 * Aggregates all route modules
 */

import express from 'express';
import analysisRoutes from './analysis.routes.js';
import analysisVersioningRoutes from './analysisVersioning.routes.js';
import analysisSessionRoutes from './analysisSession.routes.js';
import projectMapRoutes from './projectMap.routes.js';
import repdRoutes from './repd.routes.js';
import sitesRoutes from './sites.routes.js';
import projectsRoutes from './projects.routes.js';
import conflictCheckRoutes from './conflictCheck.routes.js';
import planningDeliverablesRoutes from './planningDeliverables.routes.js';
import surveyorOrganisationsRoutes from './surveyorOrganisations.routes.js';
import clientOrganisationsRoutes from './clientOrganisations.routes.js';
import quotesRoutes from './quotes.routes.js';
import quoteRequestsRoutes from './quoteRequests.routes.js';
import lookupsRoutes from './lookups.routes.js';
import workflowRoutes from './workflow.routes.js';
import ingestionRoutes from './ingestion.routes.js';
import planitRoutes from './planit.routes.js';
import lpaAnalysisRoutes from './lpaAnalysis.routes.js';
import appealRoutes from './appeal.routes.js';
import planningApplicationRoutes from './planningApplication.routes.js';
import hlpvNarrativeRoutes from './hlpvNarrative.routes.js';
import policyTemplatesRoutes from './policyTemplates.routes.js';
import policyContextTemplatesRoutes from './policyContextTemplates.routes.js';
import issueTypesRoutes from './issueTypes.routes.js';
import guidingBriefsRoutes from './guidingBriefs.routes.js';
import meetingNotesRoutes from './meetingNotes.routes.js';
import emailDigestRoutes from './emailDigest.routes.js';
import scraperFiltersRoutes from './scraperFilters.routes.js';
import stage1ReviewRoutes from './stage1Review.routes.js';
import planningHistoryRoutes from './planningHistory.routes.js';
import policyDocumentsRoutes from './policyDocuments.routes.js';
import sectionChatRoutes from './sectionChat.routes.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { analysisLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply authentication to all /api/* and /analyze/* routes
router.use('/api', authenticate);
router.use('/analyze', authenticate);

// Analysis endpoints with stricter rate limiting (POST /analyze/*)
// Apply analysis-specific rate limit on top of general API limit
router.use('/analyze', analysisLimiter, analysisRoutes);

// Project map data endpoints (GET /api/projectmap/*)
router.use('/api/projectmap', projectMapRoutes);
router.use('/api/projectmap', repdRoutes);

// Projects CRUD (GET/POST/PUT/DELETE /api/projects/*)
router.use('/api/projects', projectsRoutes);

// Analysis versioning (original, edited, changes) - legacy
router.use('/api/analysis', analysisVersioningRoutes);

// Analysis sessions (normalized tables)
router.use('/api/session', analysisSessionRoutes);

// Planning deliverables (GET/POST/PUT/DELETE /api/planning/*)
router.use('/api/planning', planningDeliverablesRoutes);

// Conflict check endpoint (POST /api/conflict-check)
router.use('/api/conflict-check', conflictCheckRoutes);

// Site and TRP report endpoints (POST /save-site, /save-trp-edits)
// Apply authentication directly since these are at root level
router.use('/save-site', authenticate);
router.use('/save-trp-edits', authenticate);
router.use('/', sitesRoutes);

// Admin Console — restricted to admin role
router.use('/api/admin-console', requireAdmin);

// Admin Console - Surveyor Management (GET /api/admin-console/*)
router.use('/api/admin-console/surveyor-organisations', surveyorOrganisationsRoutes);
router.use('/api/admin-console/client-organisations', clientOrganisationsRoutes);
router.use('/api/admin-console/quotes', quotesRoutes);
router.use('/api/admin-console/quote-requests', quoteRequestsRoutes);
router.use('/api/admin-console/workflow', workflowRoutes);

// Lookups - dropdown options (GET /api/lookups/*)
router.use('/api/lookups', lookupsRoutes);

// Issue tracker — document ingestion + topic timeline (GET/POST /api/ingestion/*)
router.use('/api/ingestion', ingestionRoutes);

// PlanIt — similar schemes search + LLM keyword suggestions
router.use('/api/planit', planitRoutes);

// LPA Analysis — relevant policies + LPA decision document analysis
router.use('/api/lpa', lpaAnalysisRoutes);

// Appeal drafting tool — argument document + document review
router.use('/api/appeal', appealRoutes);

// Planning application tool
router.use('/api/planning-application', planningApplicationRoutes);

// HLPV narrative generation
router.use('/api/hlpv', hlpvNarrativeRoutes);

// Policy template library (admin only — requireAdmin already applied above for /api/admin-console)
router.use('/api/admin-console/policy-templates', policyTemplatesRoutes);
router.use('/api/admin-console/planning-templates', policyContextTemplatesRoutes);
router.use('/api/issue-types', issueTypesRoutes);
router.use('/api/guiding-briefs', guidingBriefsRoutes);
router.use('/api/meeting-notes', meetingNotesRoutes);
router.use('/api/admin-console/email', emailDigestRoutes);
router.use('/api/scraper-filters', scraperFiltersRoutes);
router.use('/api/stage1-review', stage1ReviewRoutes);
router.use('/api/planning-application', sectionChatRoutes);
router.use('/api/lpa', planningHistoryRoutes);
router.use('/api/lpa', policyDocumentsRoutes);

export default router;

