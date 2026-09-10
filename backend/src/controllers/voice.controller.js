import { transcribeAudio } from '../services/voice.service.js';

export async function transcribe(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    const text = await transcribeAudio(req.file.buffer, req.file.mimetype);
    res.json({ text });
  } catch (err) {
    console.error('transcribe failed:', err);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}
