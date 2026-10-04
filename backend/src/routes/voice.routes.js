import express from 'express';
import { createUpload } from '../middleware/upload.js';
import { transcribe } from '../controllers/voice.controller.js';

const router = express.Router();

// Recorded dictation clips are short — cap well under Whisper's 25MB limit.
const upload = createUpload({ kind: 'audio', maxMB: 20 });

router.post('/transcribe', upload.single('audio'), transcribe);

export default router;
