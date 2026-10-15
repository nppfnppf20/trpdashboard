import express from 'express';
import { createUpload } from '../middleware/upload.js';
import { analysisLimiter } from '../middleware/rateLimiter.js';
import {
  getWorkbook,
  updateGateQuestion,
  createItem,
  updateItem,
  deleteItem,
  addProgress,
  updateProgress,
  deleteProgress,
  listNotes,
  getNote,
  createNote,
  deleteNote,
  suggestAdvancement,
  applyAdvancement,
} from '../controllers/workbook.controller.js';

const router = express.Router();
const upload = createUpload({ exts: ['pdf', 'docx', 'txt', 'md'] });

// Whole workbook for a project: gate questions, items (with their progress log)
router.get('/projects/:projectId', getWorkbook);
router.put('/gate-questions/:id', updateGateQuestion);

router.post('/projects/:projectId/items', createItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

router.post('/items/:id/progress', addProgress);
router.put('/progress/:id', updateProgress);
router.delete('/progress/:id', deleteProgress);

// The workbook's own meeting notes
router.get('/projects/:projectId/notes', listNotes);
router.post('/projects/:projectId/notes', upload.single('file'), createNote);
router.get('/notes/:id', getNote);
router.delete('/notes/:id', deleteNote);

// Add advancement: draft proposals from a note, then apply the ticked ones
router.post('/projects/:projectId/advancements/suggest', analysisLimiter, suggestAdvancement);
router.post('/projects/:projectId/advancements/apply', applyAdvancement);

export default router;
