/**
 * Guards for URLs that come from data (database rows, scraped feeds, user input)
 * before they are placed in an href or window.location.
 *
 * `javascript:` and `data:` URLs run code when clicked, and Svelte does not
 * block them in `href={...}`.
 */

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Returns the URL unchanged if it is http(s) or mailto, otherwise '#'.
 * Relative URLs (e.g. '/projects/1') are allowed.
 *
 * @param {string | null | undefined} url
 * @returns {string}
 */
export function safeUrl(url) {
  if (!url) return '#';
  const value = String(url).trim();

  // Relative URL: no scheme present
  if (/^(\/|\.\/|\.\.\/|\?|#)/.test(value)) return value;

  try {
    const parsed = new URL(value);
    return SAFE_PROTOCOLS.includes(parsed.protocol) ? value : '#';
  } catch {
    // Scheme-less text like "www.example.com" — treat as https
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(value)) return `https://${value}`;
    return '#';
  }
}
