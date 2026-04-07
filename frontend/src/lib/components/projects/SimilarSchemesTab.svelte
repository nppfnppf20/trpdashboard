<script>
  import { suggestKeywords, searchSimilarSchemes } from '$lib/api/planit.js';

  export let project;

  $: projectId = project?.id;

  // Suggestion state
  let suggestions = [];
  let lpa = '';
  let loadingSuggestions = false;
  let suggestionsError = null;
  let hasFetchedSuggestions = false;

  // Search state
  let keywords = '';
  let searching = false;
  let searchError = null;
  let results = [];
  let total = 0;
  let currentPage = 1;
  let hasMore = false;
  const PAGE_SIZE = 20;

  async function fetchSuggestions() {
    loadingSuggestions = true;
    suggestionsError = null;
    try {
      const data = await suggestKeywords(projectId);
      suggestions = data.suggestions || [];
      lpa = data.lpa || '';
      hasFetchedSuggestions = true;
    } catch (err) {
      suggestionsError = err.message;
    } finally {
      loadingSuggestions = false;
    }
  }

  function applySuggestion(suggestion) {
    keywords = suggestion.query;
  }

  async function search(page = 1) {
    if (!keywords.trim() || !lpa.trim()) return;
    searching = true;
    searchError = null;
    if (page === 1) results = [];
    try {
      const data = await searchSimilarSchemes(projectId, {
        keywords: keywords.trim(),
        lpa: lpa.trim(),
        page,
        pg_sz: PAGE_SIZE
      });
      results = page === 1 ? data.records : [...results, ...data.records];
      total = data.total;
      currentPage = page;
      hasMore = data.to < data.total - 1;
      if (data.lpa_used) lpa = data.lpa_used; // update to resolved name
    } catch (err) {
      searchError = err.message;
    } finally {
      searching = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') search(1);
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function decisionClass(decision) {
    if (!decision) return '';
    const d = decision.toLowerCase();
    if (d.includes('grant') || d.includes('approv') || d.includes('permit')) return 'decision-granted';
    if (d.includes('refus') || d.includes('reject') || d.includes('dismiss')) return 'decision-refused';
    return 'decision-other';
  }
</script>

<div class="similar-schemes-outer">
<div class="similar-schemes">

  <!-- LLM suggestion panel -->
  <div class="suggest-panel">
    <div class="suggest-header">
      <div>
        <div class="suggest-title"><i class="las la-robot"></i> AI Keyword Suggestions</div>
        <div class="suggest-sub">Claude reads this project's sector, HLPV findings, and designations to suggest search terms.</div>
      </div>
      <button class="btn-suggest" on:click={fetchSuggestions} disabled={loadingSuggestions}>
        {#if loadingSuggestions}
          <span class="spinner-sm"></span> Generating…
        {:else if hasFetchedSuggestions}
          <i class="las la-sync"></i> Regenerate
        {:else}
          <i class="las la-magic"></i> Generate suggestions
        {/if}
      </button>
    </div>

    {#if suggestionsError}
      <div class="error-banner"><i class="las la-exclamation-circle"></i> {suggestionsError}</div>
    {/if}

    {#if suggestions.length > 0}
      <div class="chips">
        {#each suggestions as s}
          <button
            class="chip"
            class:chip-active={keywords === s.query}
            on:click={() => applySuggestion(s)}
            title={s.query}
          >
            {s.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="divider"></div>

  <!-- Search bar -->
  <div class="search-row">
    <div class="search-inputs">
      <div class="input-group">
        <label>Keywords</label>
        <input
          type="text"
          bind:value={keywords}
          placeholder="e.g. solar farm SSSI"
          on:keydown={handleKeydown}
          class="text-input"
        />
      </div>
      <div class="input-group lpa-group">
        <label>LPA (PlanIt authority name)</label>
        <input
          type="text"
          bind:value={lpa}
          placeholder="e.g. South Holland"
          on:keydown={handleKeydown}
          class="text-input"
        />
      </div>
    </div>
    <button
      class="btn-search"
      on:click={() => search(1)}
      disabled={searching || !keywords.trim() || !lpa.trim()}
    >
      {#if searching && currentPage === 1}
        <span class="spinner-sm"></span> Searching…
      {:else}
        <i class="las la-search"></i> Search
      {/if}
    </button>
  </div>

  {#if searchError}
    <div class="error-banner"><i class="las la-exclamation-circle"></i> {searchError}</div>
  {/if}

  <!-- Results -->
  {#if results.length > 0}
    <div class="results-header">
      <span>{total.toLocaleString()} application{total !== 1 ? 's' : ''} found in <strong>{lpa}</strong></span>
      <span class="results-note">Showing {results.length} of {total.toLocaleString()}</span>
    </div>

    <div class="results-list">
      {#each results as r (r.name)}
        <div class="result-card">
          <div class="result-desc">{r.description || '(No description)'}</div>
          <div class="result-meta">
            <span class="meta-item"><i class="las la-map-marker"></i> {r.address || r.authority_name || '—'}</span>
            <span class="meta-item"><i class="las la-calendar"></i> Submitted {formatDate(r.start_date)}</span>
            {#if r.decided_date}
              <span class="meta-item"><i class="las la-gavel"></i> Decided {formatDate(r.decided_date)}</span>
            {/if}
            {#if r.decision}
              <span class="decision-badge {decisionClass(r.decision)}">{r.decision}</span>
            {:else if r.status}
              <span class="decision-badge decision-other">{r.status}</span>
            {/if}
          </div>
          {#if r.url}
            <a class="result-link" href={r.url} target="_blank" rel="noopener noreferrer">
              View on PlanIt <i class="las la-external-link-alt"></i>
            </a>
          {/if}
        </div>
      {/each}
    </div>

    {#if hasMore}
      <button
        class="btn-more"
        on:click={() => search(currentPage + 1)}
        disabled={searching}
      >
        {#if searching}
          <span class="spinner-sm spinner-dark"></span> Loading…
        {:else}
          Load more results
        {/if}
      </button>
    {/if}

  {:else if !searching && !searchError && (keywords || hasFetchedSuggestions)}
    {#if keywords && lpa}
      <div class="empty-state">
        <i class="las la-search"></i>
        <p>No results found. Try broader keywords or check the LPA name matches PlanIt exactly.</p>
      </div>
    {:else}
      <div class="empty-state">
        <i class="las la-lightbulb"></i>
        <p>Use the suggestions above or enter your own keywords, then click Search.</p>
      </div>
    {/if}
  {/if}

</div>
</div>

<style>
  .similar-schemes-outer { display: flex; flex-direction: column; flex: 1; overflow-y: auto; min-height: 0; height: 100%; }
  .similar-schemes { display: flex; flex-direction: column; gap: 0; padding: 1.25rem; }

  /* Suggest panel */
  .suggest-panel { display: flex; flex-direction: column; gap: 0.75rem; }
  .suggest-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .suggest-title { font-size: 0.9rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; }
  .suggest-sub { font-size: 0.78rem; color: #64748b; }

  .btn-suggest {
    display: flex; align-items: center; gap: 0.4rem; white-space: nowrap;
    padding: 0.5rem 1rem; background: #9333ea; color: white; border: none;
    border-radius: 7px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
    font-family: inherit; transition: background 0.15s; flex-shrink: 0;
  }
  .btn-suggest:hover:not(:disabled) { background: #7e22ce; }
  .btn-suggest:disabled { opacity: 0.6; cursor: not-allowed; }

  .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .chip {
    padding: 0.35rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 20px;
    background: white; font-size: 0.78rem; color: #475569; cursor: pointer;
    font-family: inherit; transition: all 0.15s;
  }
  .chip:hover { border-color: #9333ea; color: #7e22ce; background: #faf5ff; }
  .chip.chip-active { border-color: #9333ea; background: #f3e8ff; color: #7e22ce; font-weight: 600; }

  .divider { height: 1px; background: #e2e8f0; margin: 1.25rem 0; }

  /* Search bar */
  .search-row { display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap; }
  .search-inputs { display: flex; gap: 0.75rem; flex: 1; flex-wrap: wrap; }
  .input-group { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 180px; }
  .lpa-group { max-width: 260px; }
  .input-group label { font-size: 0.75rem; font-weight: 600; color: #475569; }
  .text-input {
    padding: 0.55rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: 0.875rem; font-family: inherit; color: #1e293b; outline: none;
    transition: border-color 0.15s;
  }
  .text-input:focus { border-color: #9333ea; }

  .btn-search {
    display: flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.25rem;
    background: #1e293b; color: white; border: none; border-radius: 6px;
    font-size: 0.875rem; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: background 0.15s; white-space: nowrap;
  }
  .btn-search:hover:not(:disabled) { background: #334155; }
  .btn-search:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Results */
  .results-header {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 0.8rem; color: #64748b; margin: 1rem 0 0.75rem;
  }
  .results-header strong { color: #1e293b; }
  .results-note { font-size: 0.72rem; }

  .results-list { display: flex; flex-direction: column; gap: 0.625rem; }

  .result-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.875rem 1rem;
    background: white; display: flex; flex-direction: column; gap: 0.5rem;
  }
  .result-desc { font-size: 0.875rem; color: #1e293b; line-height: 1.5; }

  .result-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
  .meta-item { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.3rem; }

  .decision-badge {
    font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem;
    border-radius: 20px; text-transform: uppercase; letter-spacing: 0.03em;
  }
  .decision-granted { background: #dcfce7; color: #15803d; }
  .decision-refused { background: #fee2e2; color: #b91c1c; }
  .decision-other   { background: #f1f5f9; color: #475569; }

  .result-link {
    font-size: 0.75rem; color: #9333ea; text-decoration: none; display: inline-flex;
    align-items: center; gap: 0.25rem; width: fit-content;
  }
  .result-link:hover { text-decoration: underline; }

  .btn-more {
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    margin: 1rem auto 0; padding: 0.6rem 1.5rem;
    border: 1px solid #e2e8f0; border-radius: 7px; background: white;
    font-size: 0.875rem; color: #475569; cursor: pointer; font-family: inherit;
    transition: all 0.15s;
  }
  .btn-more:hover:not(:disabled) { border-color: #9333ea; color: #7e22ce; }
  .btn-more:disabled { opacity: 0.5; cursor: not-allowed; }

  .empty-state {
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
    padding: 3rem; color: #94a3b8; text-align: center;
  }
  .empty-state i { font-size: 2rem; }
  .empty-state p { margin: 0; font-size: 0.875rem; max-width: 360px; line-height: 1.5; }

  .error-banner {
    display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.65rem 0.875rem;
    background: #fee2e2; color: #991b1b; border-radius: 6px; font-size: 0.8rem; margin-top: 0.5rem;
  }

  .spinner-sm {
    width: 0.85rem; height: 0.85rem; border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;
  }
  .spinner-sm.spinner-dark { border-color: rgba(0,0,0,0.15); border-top-color: #475569; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
