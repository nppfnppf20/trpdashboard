import * as emailTonesService from '../services/emailTones.service.js';

export async function listTones(req, res) {
  try {
    const tones = await emailTonesService.listTones(req.user.id);
    res.json(tones);
  } catch (err) {
    console.error('emailTones.listTones error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function createTone(req, res) {
  const { label, sampleText, isDefault } = req.body;
  if (!label?.trim() || !sampleText?.trim()) {
    return res.status(400).json({ error: 'label and sampleText are required' });
  }
  try {
    const tone = await emailTonesService.createTone(req.user.id, { label: label.trim(), sampleText: sampleText.trim(), isDefault });
    res.status(201).json(tone);
  } catch (err) {
    console.error('emailTones.createTone error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function updateTone(req, res) {
  const { id } = req.params;
  const { label, sampleText, isDefault } = req.body;
  try {
    const tone = await emailTonesService.updateTone(req.user.id, id, {
      label: label?.trim(),
      sampleText: sampleText?.trim(),
      isDefault,
    });
    if (!tone) return res.status(404).json({ error: 'Tone not found' });
    res.json(tone);
  } catch (err) {
    console.error('emailTones.updateTone error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteTone(req, res) {
  const { id } = req.params;
  try {
    const deleted = await emailTonesService.deleteTone(req.user.id, id);
    if (!deleted) return res.status(404).json({ error: 'Tone not found' });
    res.status(204).end();
  } catch (err) {
    console.error('emailTones.deleteTone error:', err);
    res.status(500).json({ error: err.message });
  }
}
