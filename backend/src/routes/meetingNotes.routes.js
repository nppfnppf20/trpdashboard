import express from 'express';
import multer from 'multer';
import {
  processMeetingNote,
  getMeetingNotes,
  getMeetingTranscript,
  updateMeetingSummary,
  updateMeetingNote,
  deleteMeetingNote,
  getMeetingActions,
  createMeetingAction,
  updateMeetingAction,
  deleteMeetingAction
} from '../controllers/meetingNotes.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// More-specific routes first to avoid param shadowing
router.post('/projects/:projectId/process', upload.single('file'), processMeetingNote);
router.get('/projects/:projectId/actions', getMeetingActions);
router.post('/projects/:projectId/actions', createMeetingAction);
router.get('/projects/:projectId', getMeetingNotes);
router.put('/actions/:actionId', updateMeetingAction);
router.delete('/actions/:actionId', deleteMeetingAction);
router.get('/:meetingId/transcript', getMeetingTranscript);
router.patch('/:meetingId/summary', updateMeetingSummary);
router.patch('/:meetingId', updateMeetingNote);
router.delete('/:meetingId', deleteMeetingNote);

export default router;
