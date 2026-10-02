/**
 * Appealbase Service
 * Thin client for the hosted Appealbase MCP server (JSON-RPC over HTTP, Bearer API key).
 *
 * Every tools/call counts against the monthly quota (500 on the current tier), so each call is
 * counted in-process and appended to logs/appealbase-calls.log. Callers should pass a per-run
 * budget via createClient({ budget }) so a run cannot overspend.
 *
 * Licence: cite each decision's Appealbase url; do not persist full decision text or embeddings.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const ENDPOINT = 'https://www.appealbase.com/api/mcp';
const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../logs/appealbase-cache');
const LOG_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../logs/appealbase-calls.log');

function logCall(entry) {
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // logging is best-effort
  }
}

/**
 * @param {{ budget?: number, maxRetries?: number, cache?: boolean }} opts
 *   cache: DEV ONLY. Reads/writes raw responses under logs/appealbase-cache (gitignored) so repeated
 *   identical calls cost no quota. Do not enable in production; the licence forbids retaining the dataset.
 */
export function createClient({ budget = 25, maxRetries = 2, cache = false, cacheOnly = false } = {}) {
  if (cacheOnly) cache = true; // cacheOnly: a cache miss throws instead of spending a call
  const key = process.env.APPEALBASE_API_KEY;
  if (!key) throw new Error('APPEALBASE_API_KEY is not set');

  let calls = 0;

  async function callTool(name, args) {
    const cacheFile = path.join(CACHE_DIR, crypto.createHash('sha1').update(name + JSON.stringify(args)).digest('hex') + '.json');
    if (cache && fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cacheOnly) throw new Error(`Appealbase cache miss for ${name} (cacheOnly, no call made)`);
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (calls >= budget) throw new Error(`Appealbase call budget (${budget}) exhausted`);
      calls++;
      const started = Date.now();
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: calls, method: 'tools/call', params: { name, arguments: args } }),
      });
      const json = await res.json();
      const text = json.result?.content?.[0]?.text;
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: true, message: text || JSON.stringify(json.error || json) };
      }
      logCall({ tool: name, args, ms: Date.now() - started, ok: !payload.error, attempt });
      if (!payload.error) {
        if (cache) {
          fs.mkdirSync(CACHE_DIR, { recursive: true });
          fs.writeFileSync(cacheFile, JSON.stringify(payload));
        }
        return payload;
      }
      if (!payload.retryable || attempt === maxRetries) {
        throw new Error(`Appealbase ${name} failed: ${payload.message}`);
      }
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }

  return {
    searchAppeals: args => callTool('search_appeals', args),
    getAppealFullText: (reference, opts = {}) => callTool('get_appeal_full_text', { reference, ...opts }),
    /** All chunks of one decision (1 call per chunk at the 100k maximum chunk size). */
    async getAppealFullTextAll(reference) {
      let text = '';
      let appeal;
      for (let chunk = 0; ; chunk++) {
        const r = await callTool('get_appeal_full_text', { reference, chunk_size: 100000, chunk_index: chunk });
        appeal ??= r.appeal;
        // Unchunked decisions return `full_text`; chunked ones return `full_text_chunk`.
        text += r.full_text_chunk ?? r.full_text ?? '';
        if (!r.is_chunked || chunk + 1 >= r.total_chunks) return { appeal, text };
      }
    },
    get callsUsed() {
      return calls;
    },
    get callsRemaining() {
      return budget - calls;
    },
  };
}
