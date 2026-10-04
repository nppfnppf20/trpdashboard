import express from 'express';
import { createUpload } from '../middleware/upload.js';
import {
  processMeetingNote,
  saveVerbatimMeetingNote,
  processMultiProjectMeetingNote,
  processInternalMeetingNote,
  getMeetingNotes,
  getAllMeetingNotes,
  getMeetingTranscript,
  getMeetingNoteActions,
  updateMeetingSummary,
  updateMeetingNote,
  deleteMeetingNote,
  getMeetingActions,
  createMeetingAction,
  createStandaloneAction,
  updateMeetingAction,
  deleteMeetingAction,
  saveExtractedInsights,
} from '../controllers/meetingNotes.controller.js';

const router = express.Router();
const upload = createUpload({ maxMB: 50 });

// Literal-segment routes first to avoid param shadowing
router.get('/', getAllMeetingNotes);
router.post('/internal/process', upload.single('file'), processInternalMeetingNote);
router.post('/multi-project/process', upload.single('file'), processMultiProjectMeetingNote);
router.post('/:transcriptId/insights', saveExtractedInsights);
router.post('/actions', createStandaloneAction);
router.post('/projects/:projectId/process', upload.single('file'), processMeetingNote);
router.post('/projects/:projectId/save-verbatim', upload.single('file'), saveVerbatimMeetingNote);
router.get('/projects/:projectId/actions', getMeetingActions);
router.post('/projects/:projectId/actions', createMeetingAction);
router.get('/projects/:projectId', getMeetingNotes);
router.put('/actions/:actionId', updateMeetingAction);
router.delete('/actions/:actionId', deleteMeetingAction);
router.get('/:meetingId/transcript', getMeetingTranscript);
router.get('/:meetingId/actions', getMeetingNoteActions);
router.patch('/:meetingId/summary', updateMeetingSummary);
router.patch('/:meetingId', updateMeetingNote);
router.delete('/:meetingId', deleteMeetingNote);

export default router;
