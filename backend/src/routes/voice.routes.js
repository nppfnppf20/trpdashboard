import express from 'express';
import multer from 'multer';
import { transcribe } from '../controllers/voice.controller.js';

const router = express.Router();

// Recorded dictation clips are short — cap well under Whisper's 25MB limit.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/transcribe', upload.single('audio'), transcribe);

export default router;
