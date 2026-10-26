/**
 * Reads one string field out of a JSON object that is still being written, e.g. while a
 * streamed LLM answer is half-way through: partialJsonString('{"intro":"<p>Hi', 'intro') === '<p>Hi'.
 * Returns whatever of the string has arrived so far, or '' if the key has not started yet.
 * Only meant for flat top-level string fields.
 */
export function partialJsonString(raw, key) {
  const match = new RegExp(`"${key}"\\s*:\\s*"`).exec(raw);
  if (!match) return '';

  const escapes = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '/': '/', '"': '"', '\\': '\\' };
  let out = '';
  for (let i = match.index + match[0].length; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') break; // end of the string
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break; // escape not finished arriving yet
    if (next === 'u') {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      out += escapes[next] ?? next;
      i += 1;
    }
  }
  return out;
}
