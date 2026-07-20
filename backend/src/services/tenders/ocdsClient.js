/**
 * Shared OCDS release-package client factory. Find a Tender and Contracts Finder
 * both expose the same UK government OCDS API shape (limit/cursor/updatedFrom/
 * updatedTo/stages params, links.next pagination, 429/503 with Retry-After) —
 * this is the one place that behaviour lives.
 */

const MAX_RETRIES = 5;
const DEFAULT_RETRY_AFTER_SECONDS = 30;
const MAX_RETRY_AFTER_SECONDS = 120;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** These APIs require YYYY-MM-DDTHH:MM:SS — no milliseconds or offset. */
function formatOcdsDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d.toISOString().slice(0, 19);
}

/**
 * @param {string} baseUrl - the ocdsReleasePackages / OCDS search endpoint
 * @param {string} label - short tag for log lines, e.g. 'FTS' or 'Contracts Finder'
 */
export function createOcdsClient(baseUrl, label) {
  async function fetchPage(url) {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 429 || response.status === 503) {
        if (attempt >= MAX_RETRIES) {
          throw new Error(`${label} rate-limited (${response.status}) after ${MAX_RETRIES} attempts`);
        }
        const retryAfter = Math.min(
          parseInt(response.headers.get('retry-after'), 10) || DEFAULT_RETRY_AFTER_SECONDS,
          MAX_RETRY_AFTER_SECONDS
        );
        console.warn(`[tenders] ${label} ${response.status}, retrying in ${retryAfter}s (attempt ${attempt})`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`${label} request failed (${response.status}): ${body.slice(0, 300)}`);
      }

      return response.json();
    }
  }

  /**
   * Yields { releases, pageNumber } per page of results, following links.next
   * until exhausted or maxPages is hit.
   */
  async function* fetchReleases({ updatedFrom, updatedTo, stages, maxPages = 200 } = {}) {
    const params = new URLSearchParams({ limit: '100' });
    if (updatedFrom) params.set('updatedFrom', formatOcdsDate(updatedFrom));
    if (updatedTo) params.set('updatedTo', formatOcdsDate(updatedTo));
    if (stages) params.set('stages', stages);

    let url = `${baseUrl}?${params}`;
    let pageNumber = 0;

    while (url && pageNumber < maxPages) {
      const data = await fetchPage(url);
      pageNumber += 1;
      yield { releases: data.releases || [], pageNumber };
      url = data.links?.next || null;
    }

    if (url) {
      console.warn(`[tenders] ${label} pagination stopped at maxPages=${maxPages}; window not fully consumed`);
    }
  }

  return { fetchReleases };
}
