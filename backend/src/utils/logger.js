/**
 * Minimal file-backed logger — no new dependencies.
 *
 * Writes every entry to backend/logs/app.log as one JSON object per line
 * (so it survives terminal restarts/scrollback and can be grepped after the
 * fact), while only echoing 'warn'/'error' entries to the console so normal
 * operation doesn't add extra noise on top of existing console.log calls.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB — rotate rather than grow unbounded

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  console.error('logger: failed to create log directory', err.message);
}

function rotateIfNeeded() {
  try {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size > MAX_LOG_SIZE) {
      fs.renameSync(LOG_FILE, LOG_FILE.replace(/\.log$/, `.${Date.now()}.log`));
    }
  } catch {
    // file doesn't exist yet — nothing to rotate
  }
}

export function log(level, message, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, message, ...meta };

  if (level === 'error') console.error(message, meta);
  else if (level === 'warn') console.warn(message, meta);

  try {
    rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('logger: failed to write log file', err.message);
  }
}

export const LOG_FILE_PATH = LOG_FILE;
