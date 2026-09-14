<script>
  import { searchAppeals, retrieveAppeal } from '$lib/api/appealbase.js';

  const DECISION_OPTIONS = ['Allowed', 'Dismissed'];
  const PROCEDURE_OPTIONS = ['Written', 'Hearing', 'Inquiry'];
  const DATE_PRESETS = [
    { value: '', label: 'Any time' },
    { value: 'last_7_days', label: 'Last 7 days' },
    { value: 'last_30_days', label: 'Last 30 days' },
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'this_year', label: 'This year' },
    { value: 'last_year', label: 'Last year' },
    { value: 'last_12_months', label: 'Last 12 months' },
    { value: 'custom', label: 'Custom range' }
  ];

  let query = '';
  let useOperators = false;
  let exactMatch = false;
  let mainIssuesOnly = false;
  let lpa = '';
  let decision = '';
  let appealType = '';
  let developmentType = '';
  let procedure = '';
  let inspector = '';
  let datePreset = '';
  let dateFrom = '';
  let dateTo = '';
  let sortBy = 'relevance';

  const pageSize = 20;
  let page = 1;
  let totalPages = 0;
  let totalCount = 0;

  let results = [];
  let loading = false;
  let hasSearched = false;
  let error = '';
  let apiKeyMissing = false;

  // reference -> { loading, text } for lazily-fetched full decision text
  let fullTextByRef = {};

  function buildSearchBody(targetPage) {
    const body = {
      query: query.trim() || undefined,
      query_mode: useOperators ? 'websearch' : 'simple',
      exact_match: exactMatch || undefined,
      main_issues_only: mainIssuesOnly || undefined,
      lpa: lpa.trim() || undefined,
      decision: decision || undefined,
      appeal_type: appealType.trim() || undefined,
      development_type: developmentType.trim() || undefined,
      procedure: procedure || undefined,
      inspector: inspector.trim() || undefined,
      sort_by: sortBy !== 'relevance' ? sortBy : undefined,
      date_preset: datePreset && datePreset !== 'custom' ? datePreset : undefined,
      date_from: datePreset === 'custom' && dateFrom ? dateFrom : undefined,
      date_to: datePreset === 'custom' && dateTo ? dateTo : undefined,
      page: targetPage,
      pageSize
    };
    return body;
  }

  function hasAnyCriteria() {
    return !!(query.trim() || lpa.trim() || decision || appealType.trim() ||
      developmentType.trim() || procedure || inspector.trim() || datePreset);
  }

  async function doSearch(targetPage = 1) {
    if (!hasAnyCriteria()) {
      error = 'Enter a search term or set at least one filter';
      return;
    }
    loading = true;
    error = '';
    apiKeyMissing = false;
    hasSearched = true;
    fullTextByRef = {};
    try {
      const data = await searchAppeals(buildSearchBody(targetPage));
      results = data.results || [];
      totalCount = data.totalCount ?? 0;
      totalPages = data.totalPages ?? 0;
      page = data.page ?? targetPage;
    } catch (e) {
      results = [];
      if (e.message?.includes('API key not configured')) apiKeyMissing = true;
      error = e.message || 'Search failed';
    } finally {
      loading = false;
    }
  }

  function changePage(delta) {
    const next = page + delta;
    if (next < 1 || (totalPages && next > totalPages)) return;
    doSearch(next);
  }

  async function toggleFullText(reference) {
    if (fullTextByRef[reference]) {
      // Collapse
      const { [reference]: _omit, ...rest } = fullTextByRef;
      fullTextByRef = rest;
      return;
    }
    fullTextByRef = { ...fullTextByRef, [reference]: { loading: true, text: '' } };
    try {
      const data = await retrieveAppeal(reference);
      fullTextByRef = { ...fullTextByRef, [reference]: { loading: false, text: data.appeal?.full_text || '(no text available)' } };
    } catch (e) {
      fullTextByRef = { ...fullTextByRef, [reference]: { loading: false, text: '', error: e.message } };
    }
  }

  function cleanSnippet(s) {
    return (s || '').replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
  }

  function formatDate(d) {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  }
</script>

<div class="appeal-search-page">
<div class="page-content">
  <header class="page-header">
    <h1 class="page-title">Appeal Precedent Search <span class="beta-tag">Beta</span></h1>
    <p class="page-subtitle">
      Search decided planning appeals: full-text search across decision letters,
      plus filters for LPA, outcome, development type and date.
    </p>
  </header>

  <div class="card search-card">
    <div class="search-row">
      <input
        class="form-input query-input"
        type="text"
        placeholder="Search decision text, e.g. green belt, heritage setting, daylight..."
        bind:value={query}
        on:keydown={(e) => e.key === 'Enter' && doSearch(1)}
      />
      <button class="btn btn-primary" on:click={() => doSearch(1)} disabled={loading}>
        <i class="las la-search"></i>
        {loading ? 'Searching…' : 'Search'}
      </button>
    </div>

    <div class="option-row">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={useOperators} />
        Use search operators (OR, "quotes", -exclude)
      </label>
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={exactMatch} />
        Exact word match
      </label>
      <label class="checkbox-label" title="Beta: searches only the inspector's extracted Main Issues section rather than the whole decision letter">
        <input type="checkbox" bind:checked={mainIssuesOnly} />
        Main issues only <span class="inline-beta">beta</span>
      </label>
    </div>

    <div class="filters-grid">
      <div>
        <label class="form-label" for="f-lpa">Local Planning Authority</label>
        <input id="f-lpa" class="form-input" type="text" placeholder="e.g. Bromley" bind:value={lpa} />
      </div>
      <div>
        <label class="form-label" for="f-decision">Decision</label>
        <select id="f-decision" class="form-input" bind:value={decision}>
          <option value="">Any</option>
          {#each DECISION_OPTIONS as opt}<option value={opt}>{opt}</option>{/each}
        </select>
      </div>
      <div>
        <label class="form-label" for="f-appeal-type">Appeal Type</label>
        <input id="f-appeal-type" class="form-input" type="text" placeholder="e.g. Householder" bind:value={appealType} />
      </div>
      <div>
        <label class="form-label" for="f-dev-type">Development Type</label>
        <input id="f-dev-type" class="form-input" type="text" placeholder="e.g. Major dwellings" bind:value={developmentType} />
      </div>
      <div>
        <label class="form-label" for="f-procedure">Procedure</label>
        <select id="f-procedure" class="form-input" bind:value={procedure}>
          <option value="">Any</option>
          {#each PROCEDURE_OPTIONS as opt}<option value={opt}>{opt}</option>{/each}
        </select>
      </div>
      <div>
        <label class="form-label" for="f-inspector">Inspector</label>
        <input id="f-inspector" class="form-input" type="text" placeholder="e.g. Hartley D" bind:value={inspector} />
      </div>
      <div>
        <label class="form-label" for="f-date-preset">Decision date</label>
        <select id="f-date-preset" class="form-input" bind:value={datePreset}>
          {#each DATE_PRESETS as opt}<option value={opt.value}>{opt.label}</option>{/each}
        </select>
      </div>
      {#if datePreset === 'custom'}
        <div>
          <label class="form-label" for="f-date-from">From</label>
          <input id="f-date-from" class="form-input" type="date" bind:value={dateFrom} />
        </div>
        <div>
          <label class="form-label" for="f-date-to">To</label>
          <input id="f-date-to" class="form-input" type="date" bind:value={dateTo} />
        </div>
      {/if}
      <div>
        <label class="form-label" for="f-sort">Sort by</label>
        <select id="f-sort" class="form-input" bind:value={sortBy}>
          <option value="relevance">Relevance</option>
          <option value="date_newest">Date (newest first)</option>
          <option value="date_oldest">Date (oldest first)</option>
        </select>
      </div>
    </div>
  </div>

  {#if error}
    <div class="banner banner-error">
      <i class="las la-exclamation-circle"></i>
      {#if apiKeyMissing}
        This search isn't connected yet, an API key needs to be added to the backend environment
        before this page can search.
      {:else}
        {error}
      {/if}
    </div>
  {/if}

  {#if hasSearched && !loading && !error}
    <div class="results-meta">
      {totalCount.toLocaleString()} decision{totalCount === 1 ? '' : 's'} found
      {#if totalPages > 1}&middot; page {page} of {totalPages}{/if}
    </div>
  {/if}

  <div class="results-list">
    {#each results as r (r.reference)}
      <div class="card result-card">
        <div class="result-header">
          <div class="result-title">
            <span class="badge {r.decision === 'Allowed' ? 'badge-success' : r.decision === 'Dismissed' ? 'badge-danger' : 'badge-neutral'}">{r.decision || 'Unknown'}</span>
            <span class="result-address">{r.site_address}</span>
          </div>
          <div class="result-date">{formatDate(r.decision_date)}</div>
        </div>

        <div class="result-meta">
          <span>{r.lpa_name}</span>
          {#if r.appeal_type}<span>&middot; {r.appeal_type}</span>{/if}
          {#if r.development_type}<span>&middot; {r.development_type}</span>{/if}
          {#if r.procedure}<span>&middot; {r.procedure}</span>{/if}
          {#if r.inspector_name}<span>&middot; Inspector: {r.inspector_name}</span>{/if}
          <span>&middot; Ref: {r.reference}</span>
        </div>

        {#if r.snippets?.length}
          <div class="why-found">
            <div class="why-found-label">Why this was found:</div>
            {#each r.snippets.slice(0, 3) as snippet}
              <p class="snippet">&hellip;{cleanSnippet(snippet)}&hellip;</p>
            {/each}
          </div>
        {:else if r.summary}
          <p class="snippet">{cleanSnippet(r.summary).slice(0, 300)}&hellip;</p>
        {:else if r.full_text_unavailable_note}
          <p class="unavailable-note">{r.full_text_unavailable_note}</p>
        {/if}

        <div class="result-actions">
          <button class="btn btn-secondary btn-sm" on:click={() => toggleFullText(r.reference)}>
            <i class="las la-file-alt"></i>
            {fullTextByRef[r.reference] ? 'Hide full text' : 'View full text'}
          </button>
          {#if r.pins_url}
            <a class="btn btn-secondary btn-sm" href={r.pins_url} target="_blank" rel="noopener noreferrer">
              <i class="las la-external-link-alt"></i> View on PINS
            </a>
          {/if}
        </div>

        {#if fullTextByRef[r.reference]}
          <div class="full-text-panel">
            {#if fullTextByRef[r.reference].loading}
              <div class="loading-text">Loading full decision text&hellip;</div>
            {:else if fullTextByRef[r.reference].error}
              <div class="loading-text error">{fullTextByRef[r.reference].error}</div>
            {:else}
              <pre class="full-text">{fullTextByRef[r.reference].text}</pre>
            {/if}
          </div>
        {/if}
      </div>
    {/each}

    {#if hasSearched && !loading && !results.length && !error}
      <div class="empty-state">
        <i class="las la-search"></i>
        <div>No decisions found. Try broadening your search or clearing a filter.</div>
      </div>
    {/if}

    {#if !hasSearched && !loading}
      <div class="empty-state">
        <i class="las la-gavel"></i>
        <div>Search decided planning appeals by topic, keyword, LPA, outcome or date.</div>
      </div>
    {/if}
  </div>

  {#if totalPages > 1}
    <div class="pagination">
      <button class="btn btn-secondary btn-sm" on:click={() => changePage(-1)} disabled={page <= 1 || loading}>
        <i class="las la-angle-left"></i> Previous
      </button>
      <span class="pagination-info">Page {page} of {totalPages}</span>
      <button class="btn btn-secondary btn-sm" on:click={() => changePage(1)} disabled={page >= totalPages || loading}>
        Next <i class="las la-angle-right"></i>
      </button>
    </div>
  {/if}
</div>
</div>

<div class="construction-overlay">
  <div class="construction-card">
    <i class="las la-tools"></i>
    <h2>Under Construction</h2>
    <p>This page isn't live yet, check back soon.</p>
  </div>
</div>

<style>
  .appeal-search-page {
    position: relative;
    background: var(--color-slate-50);
    min-height: 100%;
  }

  .page-content {
    padding: 1.5rem 2rem 3rem;
    filter: grayscale(1);
    opacity: 0.45;
    pointer-events: none;
    user-select: none;
  }

  .construction-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .construction-card {
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: 2rem 2.5rem;
    text-align: center;
    max-width: 360px;
  }

  .construction-card i {
    font-size: 2rem;
    color: var(--color-amber-600);
    margin-bottom: 0.75rem;
    display: block;
  }

  .construction-card h2 {
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--color-slate-900);
    margin: 0 0 0.5rem;
  }

  .construction-card p {
    font-size: 0.84375rem;
    color: var(--color-slate-500);
    margin: 0;
    line-height: 1.5;
  }

  .page-header {
    margin-bottom: 1.25rem;
  }

  .page-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900);
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .page-subtitle {
    margin-top: 0.375rem;
    font-size: 0.84375rem;
    color: var(--color-slate-500);
    max-width: 680px;
  }

  .beta-tag {
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-amber-800);
    background: var(--color-amber-100);
    border-radius: 4px;
    padding: 3px 6px;
    text-transform: uppercase;
    vertical-align: middle;
  }

  .inline-beta {
    font-size: 0.5625rem;
    font-weight: 700;
    color: var(--color-amber-800);
    background: var(--color-amber-100);
    border-radius: 3px;
    padding: 1px 4px;
    text-transform: uppercase;
    margin-left: 0.25rem;
  }

  .search-card {
    margin-bottom: 1rem;
    padding: 1.25rem;
  }

  .search-row {
    display: flex;
    gap: 0.625rem;
  }

  .query-input {
    flex: 1;
  }

  .option-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    margin-top: 0.875rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    font-size: 0.8125rem;
    color: var(--color-slate-600);
    cursor: pointer;
  }

  .filters-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.875rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-slate-200);
  }

  @media (max-width: 900px) {
    .filters-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 500px) {
    .filters-grid { grid-template-columns: 1fr; }
    .search-row { flex-direction: column; }
  }

  .banner {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
    margin-bottom: 1rem;
  }

  .banner-error {
    background: var(--color-red-50);
    color: var(--color-red-800);
    border: 1px solid var(--color-red-200);
  }

  .banner-error code {
    background: var(--color-red-100);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .results-meta {
    font-size: 0.78125rem;
    color: var(--color-slate-500);
    margin-bottom: 0.75rem;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .result-card {
    padding: 1rem 1.125rem;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .result-title {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .result-address {
    font-weight: 600;
    font-size: 0.90625rem;
    color: var(--color-slate-800);
  }

  .result-date {
    font-size: 0.78125rem;
    color: var(--color-slate-500);
    white-space: nowrap;
  }

  .result-meta {
    margin-top: 0.375rem;
    font-size: 0.78125rem;
    color: var(--color-slate-500);
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .why-found {
    margin-top: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-slate-50);
    border-radius: var(--radius-md);
  }

  .why-found-label {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-slate-400);
    margin-bottom: 0.375rem;
  }

  .snippet {
    font-size: 0.8125rem;
    color: var(--color-slate-600);
    line-height: 1.5;
    margin: 0 0 0.375rem;
  }

  .snippet:last-child {
    margin-bottom: 0;
  }

  .unavailable-note {
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-slate-400);
    font-style: italic;
  }

  .result-actions {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .full-text-panel {
    margin-top: 0.75rem;
    border-top: 1px solid var(--color-slate-200);
    padding-top: 0.75rem;
    max-height: 420px;
    overflow-y: auto;
  }

  .full-text {
    font-family: inherit;
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--color-slate-700);
    white-space: pre-wrap;
    margin: 0;
  }

  .loading-text {
    font-size: 0.8125rem;
    color: var(--color-slate-400);
  }

  .loading-text.error {
    color: var(--color-red-600);
  }

  .empty-state {
    padding: 3rem 1.5rem;
    text-align: center;
    color: var(--color-slate-400);
    font-size: 0.84375rem;
  }

  .empty-state i {
    font-size: 1.75rem;
    margin-bottom: 0.625rem;
    display: block;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1.25rem;
  }

  .pagination-info {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
  }
</style>
