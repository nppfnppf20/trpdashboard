/**
 * Appeal Routes
 *
 * Backs the PA workspace's appeal-tool draft types (Statement of Case, SoCG,
 * etc.) — draft-type/section CRUD, PA-notes generation, incorporation, and
 * starting docs. The standalone /appeal workspace and its legacy generation
 * pipeline were retired.
 */

import express from 'express';
import multer from 'multer';
import {
  getDraftTypes,
  getDraft,
  saveDraft,
  getSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  scopeIncorporation,
  incorporateTargeted,
  getDraftContext,
  generateDraftFromPaNotes,
  generateSectionFromPaNotes,
  getAppealTypePrompt,
  saveAppealTypePrompt,
  resetAppealTypePrompt,
  getStartingDocs,
  upsertStartingDoc,
  deleteStartingDoc,
  getBriefingNotes,
  uploadBriefingNote,
} from '../controllers/appeal.controller.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (allowed.includes(file.mimetype) || ['pdf', 'txt', 'md'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, .txt, and .md files are accepted'));
    }
  }
});

// Draft documents
router.get('/draft-types', getDraftTypes);
router.get('/draft-types/:typeId/prompt', getAppealTypePrompt);
router.put('/draft-types/:typeId/prompt', saveAppealTypePrompt);
router.delete('/draft-types/:typeId/prompt', resetAppealTypePrompt);
router.get('/draft-types/:typeId/sections', getSections);
router.post('/draft-types/:typeId/sections', createSection);
router.patch('/sections/:sectionId', updateSection);
router.delete('/sections/:sectionId', deleteSection);
router.put('/draft-types/:typeId/sections/reorder', reorderSections);
router.get('/projects/:projectId/drafts/:typeId', getDraft);
router.get('/projects/:projectId/drafts/:typeId/context', getDraftContext);
router.put('/projects/:projectId/drafts/:typeId', saveDraft);
router.post('/projects/:projectId/drafts/:typeId/generate-from-pa', generateDraftFromPaNotes);
router.post('/projects/:projectId/drafts/:typeId/sections/:sectionId/generate-from-pa', generateSectionFromPaNotes);
router.post('/projects/:projectId/drafts/:typeId/scope-incorporation', upload.single('file'), scopeIncorporation);
router.post('/projects/:projectId/drafts/:typeId/incorporate-targeted', upload.single('file'), incorporateTargeted);

// Briefing notes
router.get('/projects/:projectId/briefing-notes', getBriefingNotes);
router.post('/projects/:projectId/briefing-notes', upload.single('file'), uploadBriefingNote);

// Starting documents (PA workspace appeal draft types)
router.get('/projects/:projectId/starting-docs/:typeId', getStartingDocs);
router.put('/projects/:projectId/starting-docs/:typeId/:slotSlug', upload.single('file'), upsertStartingDoc);
router.delete('/projects/:projectId/starting-docs/:typeId/:slotSlug', deleteStartingDoc);

export default router;
