import { pool } from '../db.js';
import { LLM_PROCESS_REGISTRY, getProcessByKey } from '../services/llmProcessRegistry.js';

/**
 * GET /api/admin-console/llm-settings
 * Every known LLM process, merged with its stored provider setting
 * (defaults to 'anthropic' if never set).
 */
export async function listLlmSettings(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT process_key, provider FROM admin_console.llm_process_settings`
    );
    const byKey = Object.fromEntries(rows.map(r => [r.process_key, r.provider]));
    const result = LLM_PROCESS_REGISTRY.map(p => ({
      ...p,
      provider: byKey[p.key] || 'anthropic',
    }));
    res.json(result);
  } catch (err) {
    console.error('llmSettings.list error:', err);
    res.status(500).json({ error: 'Failed to fetch LLM settings' });
  }
}

/**
 * PUT /api/admin-console/llm-settings/:key
 * Upsert the default provider for a process.
 */
export async function updateLlmSetting(req, res) {
  const { key } = req.params;
  const { provider } = req.body;

  if (!getProcessByKey(key)) {
    return res.status(404).json({ error: `Unknown process key: ${key}` });
  }
  if (provider !== 'anthropic' && provider !== 'openai') {
    return res.status(400).json({ error: 'provider must be "anthropic" or "openai"' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_console.llm_process_settings (process_key, provider, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (process_key) DO UPDATE SET provider = $2, updated_at = NOW()
       RETURNING process_key, provider`,
      [key, provider]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('llmSettings.update error:', err);
    res.status(500).json({ error: 'Failed to update LLM setting' });
  }
}
