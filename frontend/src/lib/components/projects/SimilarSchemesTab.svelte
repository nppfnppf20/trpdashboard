<script context="module">
  // Keeps each project's search state when you switch tabs and come back (memory only, lost on page reload).
  const sessions = new Map();
</script>

<script>
  import { onMount, onDestroy } from 'svelte';
  import { safeUrl } from '$lib/utils/safeUrl.js';
  import { generateSearchFromSources, searchSimilarSchemes, triageSimilarSchemes, getSavedSchemes, saveSchemes, removeSavedScheme } from '$lib/api/planit.js';
  import AppealSourcePicker from '$lib/components/appeal-precedent/AppealSourcePicker.svelte';
  import SchemesMap from '$lib/components/projects/SchemesMap.svelte';
  import SavedWorkspace from '$lib/components/similar-schemes/SavedWorkspace.svelte';

  export let project;

  $: projectId = project?.id;

  const STATES = ['Permitted', 'Conditions', 'Rejected', 'Undecided', 'Withdrawn', 'Referred', 'Unresolved', 'Other'];
  const TYPES = ['Full', 'Outline', 'Amendment', 'Conditions', 'Heritage', 'Trees', 'Advertising', 'Telecoms', 'Other'];
  const SIZES = ['Small', 'Medium', 'Large'];
  const PAGE_SIZE = 20;

  function threeYearsAgo() {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().slice(0, 10);
  }

  // Keywords are banked as terms and sent to PlanIt as: solar or "battery storage" or photovoltaic
  // (multi-word terms are quoted so PlanIt matches them as a phrase).
  const buildQuery = terms => terms.map(t => (/\s/.test(t) ? `"${t}"` : t)).join(' or ');

  // Break typed or suggested text into clean terms: split on commas and "or", drop quotes.
  function parseTerms(text) {
    return String(text ?? '')
      .split(/,|\s+or\s+/i)
      .map(t => t.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function freshSession() {
    return {
      lpa: '', generated: false,
      terms: [], termInput: '', brief: '', draftedFrom: '',
      appState: [...STATES], appType: ['Full', 'Outline'], appSize: [...SIZES], since: threeYearsAgo(),
      results: [], total: 0, currentPage: 1, hasMore: false, searchedFilters: null,
      ai: null, showExcluded: false,
      selected: [], saved: null, savedOpen: true, view: 'list', tab: 'search'
    };
  }

  function getSession(id) {
    if (!sessions.has(id)) sessions.set(id, freshSession());
    return sessions.get(id);
  }

  let s = getSession(project?.id);
  let lastProjectId = project?.id;
  $: if (project?.id !== lastProjectId) {
    lastProjectId = project?.id;
    s = getSession(project?.id);
    searchError = null;
    generateError = null;
    saveError = null;
    loadSaved();
  }

  // Transient UI state (not kept between visits)
  let searching = false;
  let aiSearching = false;
  let searchError = null;
  let pickerOpen = false;
  let generating = false;
  let generateError = null;
  let openReasons = new Set();
  let aiElapsed = 0;
  let aiTimer = null;

  let saveError = null;
  let saving = false;
  let justSaved = 0;

  onMount(loadSaved);
  onDestroy(() => clearInterval(aiTimer));

  // Saved schemes
  async function loadSaved() {
    const sess = s;
    if (sess.saved !== null) return;
    try {
      sess.saved = await getSavedSchemes(projectId);
    } catch (err) {
      saveError = err.message;
    } finally {
      if (sess === s) s = s;
    }
  }

  $: savedNames = new Set((s.saved ?? []).map(x => x.name));
  $: selectableShown = displayed.filter(r => !savedNames.has(r.name));

  // Dots for the map: what is on screen now, plus anything already saved (so saved sites always show).
  function coordsOf(r) {
    const lng = Number(r.location_x ?? r.location?.coordinates?.[0]);
    const lat = Number(r.location_y ?? r.location?.coordinates?.[1]);
    return r.location_x === null || r.location_y === null || !Number.isFinite(lng) || !Number.isFinite(lat) ? null : { lng, lat };
  }

  function buildMapSchemes(shown, savedList, selectedNames, savedSet) {
    const out = new Map();
    for (const r of shown) {
      const c = coordsOf(r);
      if (!c) continue;
      out.set(r.name, {
        name: r.name, ...c, description: r.description, address: r.address, state: r.app_state, date: r.start_date,
        reason: r.ai?.reason ?? '', url: r.url, dim: !!(r.ai && !r.ai.relevant),
        saved: savedSet.has(r.name), selected: selectedNames.includes(r.name)
      });
    }
    for (const r of savedList ?? []) {
      if (out.has(r.name)) continue;
      const c = coordsOf(r);
      if (!c) continue;
      out.set(r.name, {
        name: r.name, ...c, description: r.description, address: r.address, state: r.app_state, date: r.start_date,
        reason: r.reason ?? '', url: r.url, dim: false, saved: true, selected: false
      });
    }
    return [...out.values()];
  }

  $: mapSchemes = buildMapSchemes(displayed, s.saved, s.selected, savedNames);
  $: unplottable = displayed.filter(r => !coordsOf(r)).length;

  function setView(view) {
    s.view = view;
    s = s;
  }

  function toggleSelect(name) {
    s.selected = s.selected.includes(name) ? s.selected.filter(n => n !== name) : [...s.selected, name];
    s = s;
  }

  function selectAllShown() {
    s.selected = [...new Set([...s.selected, ...selectableShown.map(r => r.name)])];
    s = s;
  }

  function clearSelection() {
    s.selected = [];
    s = s;
  }

  async function saveSelected() {
    const chosen = [...s.results, ...(s.ai?.records ?? [])].filter(r => s.selected.includes(r.name));
    const unique = [...new Map(chosen.map(r => [r.name, r])).values()];
    if (!unique.length) return;
    saving = true;
    saveError = null;
    try {
      s.saved = await saveSchemes(projectId, unique);
      s.selected = [];
      justSaved = unique.length;
    } catch (err) {
      saveError = err.message;
    } finally {
      saving = false;
      s = s;
    }
  }

  async function removeSaved(name) {
    saveError = null;
    try {
      s.saved = await removeSavedScheme(projectId, name);
    } catch (err) {
      saveError = err.message;
    }
    s = s;
  }

  // Filters are sent as "no filter" when everything is ticked.
  function filterPayload() {
    return {
      appState: s.appState.length === STATES.length ? [] : s.appState,
      appType: s.appType.length === TYPES.length ? [] : s.appType,
      appSize: s.appSize.length === SIZES.length ? [] : s.appSize,
      since: s.since || ''
    };
  }

  function toggleIn(key, value) {
    s[key] = s[key].includes(value) ? s[key].filter(v => v !== value) : [...s[key], value];
    s = s;
  }

  // Bank whatever is typed in the keyword box as terms (skipping ones already banked).
  function addTerms(text = s.termInput) {
    const have = new Set(s.terms.map(t => t.toLowerCase()));
    for (const t of parseTerms(text)) {
      if (!have.has(t.toLowerCase())) {
        s.terms = [...s.terms, t];
        have.add(t.toLowerCase());
      }
    }
    s.termInput = '';
    s = s;
  }

  function removeTerm(term) {
    s.terms = s.terms.filter(t => t !== term);
    s = s;
  }

  function handleTermKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (s.termInput.trim()) addTerms();
      else search(1);
    } else if (e.key === ',') {
      e.preventDefault();
      addTerms();
    } else if (e.key === 'Backspace' && !s.termInput && s.terms.length) {
      s.terms = s.terms.slice(0, -1);
      s = s;
    }
  }

  // Text still sitting in the box when you search counts as a term too.
  $: pendingTerms = parseTerms(s.termInput);
  $: allTerms = [...s.terms, ...pendingTerms.filter(p => !s.terms.some(t => t.toLowerCase() === p.toLowerCase()))];
  $: keywordQuery = buildQuery(allTerms);

  $: noFilterSelected = !s.appState.length || !s.appType.length || !s.appSize.length;
  $: canSearch = allTerms.length > 0 && s.lpa.trim() && !noFilterSelected;

  // Fill the keywords, LPA and description from the project and whichever sources were ticked.
  async function generate(e) {
    pickerOpen = false;
    generating = true;
    generateError = null;
    try {
      const out = await generateSearchFromSources(projectId, e.detail);
      if (out.terms?.length) s.terms = out.terms;
      s.termInput = '';
      if (out.lpa) s.lpa = out.lpa;
      if (out.brief) s.brief = out.brief;
      s.ai = null;
      s.generated = true;
      const u = out.usedSources ?? {};
      const used = [u.trackers && `${u.trackers} tracker${u.trackers === 1 ? '' : 's'}`, u.meetings && `${u.meetings} meeting note${u.meetings === 1 ? '' : 's'}`, u.documents && `${u.documents} document${u.documents === 1 ? '' : 's'}`].filter(Boolean);
      s.draftedFrom = ['project details', ...used].join(', ');
    } catch (err) {
      generateError = err.message;
    } finally {
      generating = false;
      s = s;
    }
  }

  async function search(page = 1) {
    if (!canSearch) return;
    if (page === 1 && s.termInput.trim()) addTerms();
    const query = buildQuery(s.terms);
    searching = true;
    searchError = null;
    if (page === 1) {
      s.results = [];
      s.ai = null;
      justSaved = 0;
    }
    s = s;
    try {
      const filters = filterPayload();
      const data = await searchSimilarSchemes(projectId, {
        keywords: query,
        lpa: s.lpa.trim(),
        page,
        pg_sz: PAGE_SIZE,
        filters
      });
      s.results = page === 1 ? data.records : [...s.results, ...data.records];
      s.total = data.total;
      s.currentPage = page;
      s.hasMore = data.to < data.total - 1;
      s.searchedFilters = filters;
      if (data.lpa_used) s.lpa = data.lpa_used; // update to resolved name
    } catch (err) {
      searchError = err.message;
    } finally {
      searching = false;
      s = s;
    }
  }

  async function aiSearch() {
    if (!canSearch) return;
    if (!s.brief.trim()) {
      searchError = 'Describe what you are looking for first, so the AI knows what to keep.';
      return;
    }
    if (s.termInput.trim()) addTerms();
    aiSearching = true;
    searchError = null;
    aiElapsed = 0;
    clearInterval(aiTimer);
    aiTimer = setInterval(() => (aiElapsed += 1), 1000);
    try {
      const data = await triageSimilarSchemes(projectId, {
        keywords: buildQuery(s.terms),
        lpa: s.lpa.trim(),
        brief: s.brief.trim(),
        filters: filterPayload()
      });
      s.ai = {
        records: data.records,
        total: data.total,
        reviewed: data.reviewed,
        relevant: data.relevant,
        failedBatches: data.failedBatches
      };
      s.showExcluded = false;
      if (data.lpa_used) s.lpa = data.lpa_used;
    } catch (err) {
      searchError = err.message;
    } finally {
      clearInterval(aiTimer);
      aiSearching = false;
      s = s;
    }
  }

  function toggleReason(name) {
    const next = new Set(openReasons);
    next.has(name) ? next.delete(name) : next.add(name);
    openReasons = next;
  }

  function clearAi() {
    s.ai = null;
    s = s;
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') search(1);
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function decisionClass(state) {
    if (state === 'Permitted' || state === 'Conditions') return 'decision-granted';
    if (state === 'Rejected') return 'decision-refused';
    return 'decision-other';
  }

  $: aiShown = s.ai ? s.ai.records.filter(r => r.ai.relevant || s.showExcluded) : [];
  $: aiExcluded = s.ai ? s.ai.reviewed - s.ai.relevant : 0;
  $: displayed = s.ai ? aiShown : s.results;
</script>

<div class="similar-schemes-outer">
<div class="similar-schemes">

  <div class="view-tabs" role="tablist">
    <button role="tab" aria-selected={s.tab === 'search'} class:on={s.tab === 'search'} on:click={() => { s.tab = 'search'; s = s; }}>Search</button>
    <button role="tab" aria-selected={s.tab === 'saved'} class:on={s.tab === 'saved'} on:click={() => { s.tab = 'saved'; s = s; }}>
      <i class="las la-bookmark"></i> Saved schemes ({s.saved?.length ?? 0})
    </button>
  </div>

  {#if s.tab === 'saved'}
    {#if saveError}
      <div class="error-banner"><i class="las la-exclamation-circle"></i> {saveError}</div>
    {/if}
    <SavedWorkspace {project} saved={s.saved ?? []} on:removeScheme={e => removeSaved(e.detail)} />
  {:else}

  <!-- Generate the whole search from the project and chosen sources -->
  <div class="suggest-panel">
    <div class="suggest-header">
      <div>
        <div class="suggest-title">Generate the search with AI</div>
        <div class="suggest-sub">Pick meeting notes, documents or trackers. Claude reads them with the project details and fills in the keywords, the LPA and the description of what you are looking for. You can edit everything afterwards.</div>
        {#if s.draftedFrom}<div class="suggest-sub drafted">Generated from {s.draftedFrom}.</div>{/if}
      </div>
      <button class="btn-suggest" on:click={() => (pickerOpen = true)} disabled={generating}>
        {#if generating}
          <span class="spinner-sm"></span> Generating…
        {:else if s.generated}
          <i class="las la-sync"></i> Regenerate from sources
        {:else}
          <i class="las la-magic"></i> Generate from sources
        {/if}
      </button>
    </div>

    {#if generateError}
      <div class="error-banner"><i class="las la-exclamation-circle"></i> {generateError}</div>
    {/if}
  </div>

  <div class="divider"></div>

  <!-- Search bar -->
  <div class="search-row">
    <div class="search-inputs">
      <div class="input-group">
        <label for="ss-keywords">Keywords</label>
        <div class="term-box">
          {#each s.terms as term (term)}
            <span class="term">
              {term}
              <button class="term-x" on:click={() => removeTerm(term)} aria-label="Remove {term}"><i class="las la-times"></i></button>
            </span>
          {/each}
          <input
            id="ss-keywords"
            type="text"
            class="term-input"
            bind:value={s.termInput}
            placeholder={s.terms.length ? 'Add another…' : 'Type a word or phrase, then press Enter'}
            on:keydown={handleTermKeydown}
          />
          <button class="term-add" on:click={() => addTerms()} disabled={!s.termInput.trim()}>
            <i class="las la-plus"></i> Add
          </button>
        </div>
        <span class="term-hint">
          {#if allTerms.length > 1}
            Searches for any of these: <code>{keywordQuery}</code>
          {:else}
            Add several words or phrases and the search finds applications matching any of them.
          {/if}
        </span>
      </div>
      <div class="input-group lpa-group">
        <label for="ss-lpa">LPA (PlanIt authority name)</label>
        <input
          id="ss-lpa"
          type="text"
          bind:value={s.lpa}
          placeholder="e.g. South Holland"
          on:keydown={handleKeydown}
          class="text-input"
        />
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="filter-group">
      <span class="filter-label">Outcome</span>
      <div class="filter-chips">
        {#each STATES as st}
          <button class="fchip" class:fchip-on={s.appState.includes(st)} on:click={() => toggleIn('appState', st)}>{st}</button>
        {/each}
      </div>
    </div>
    <div class="filter-group">
      <span class="filter-label">Application type</span>
      <div class="filter-chips">
        {#each TYPES as t}
          <button class="fchip" class:fchip-on={s.appType.includes(t)} on:click={() => toggleIn('appType', t)}>{t}</button>
        {/each}
      </div>
    </div>
    <div class="filter-row">
      <div class="filter-group">
        <span class="filter-label">Size</span>
        <div class="filter-chips">
          {#each SIZES as z}
            <button class="fchip" class:fchip-on={s.appSize.includes(z)} on:click={() => toggleIn('appSize', z)}>{z}</button>
          {/each}
        </div>
      </div>
      <div class="filter-group">
        <label class="filter-label" for="ss-since">Submitted since</label>
        <input id="ss-since" type="date" class="text-input date-input" bind:value={s.since} />
      </div>
    </div>
    {#if noFilterSelected}
      <div class="hint-warn">Tick at least one option in each filter group.</div>
    {/if}
  </div>

  <!-- Brief for the AI -->
  <div class="brief-panel">
    <div>
      <div class="suggest-title">What we're looking for</div>
      <div class="suggest-sub">Describe the kind of scheme you want, broadly. The AI reads each application description and keeps the ones that match.</div>
    </div>
    <textarea
      class="text-input brief-input"
      rows="4"
      bind:value={s.brief}
      placeholder="e.g. Commercial ground-mounted solar, around 50MW or larger. Not domestic or rooftop."
    ></textarea>
  </div>

  <div class="action-row">
    <button class="btn-search" on:click={() => search(1)} disabled={searching || aiSearching || !canSearch}>
      {#if searching && s.currentPage === 1}
        <span class="spinner-sm"></span> Searching…
      {:else}
        <i class="las la-search"></i> Search
      {/if}
    </button>
    <button class="btn-ai" on:click={aiSearch} disabled={searching || aiSearching || !canSearch}>
      {#if aiSearching}
        <span class="spinner-sm"></span> Searching and reviewing… {aiElapsed}s
      {:else}
        <i class="las la-magic"></i> Search and filter with AI
      {/if}
    </button>
    <span class="action-note">Search shows the keyword results. The AI option also reads up to 500 of the newest matches against your description.</span>
  </div>

  {#if searchError}
    <div class="error-banner"><i class="las la-exclamation-circle"></i> {searchError}</div>
  {/if}

  {#if saveError}
    <div class="error-banner"><i class="las la-exclamation-circle"></i> {saveError}</div>
  {/if}
  {#if justSaved}
    <div class="saved-note">
      <i class="las la-bookmark"></i> Saved {justSaved} scheme{justSaved === 1 ? '' : 's'} to this project.
      <button class="link-btn" on:click={() => { s.tab = 'saved'; s = s; }}>Open Saved schemes to add documents</button>
    </div>
  {/if}

  <!-- Results -->
  {#if s.ai}
    <div class="results-header">
      <span>
        <strong>{s.ai.relevant.toLocaleString()}</strong> relevant of {s.ai.reviewed.toLocaleString()} reviewed
        {#if s.ai.total > s.ai.reviewed} (newest {s.ai.reviewed.toLocaleString()} of {s.ai.total.toLocaleString()} matches; narrow the filters to cover the rest){/if}
      </span>
      <span class="results-actions">
        {#if aiExcluded > 0}
          <button class="link-btn" on:click={() => { s.showExcluded = !s.showExcluded; s = s; }}>
            {s.showExcluded ? 'Hide' : 'Show'} {aiExcluded.toLocaleString()} excluded
          </button>
        {/if}
        <button class="link-btn" on:click={clearAi}>Back to keyword results</button>
      </span>
    </div>
    {#if s.ai.failedBatches > 0}
      <div class="error-banner"><i class="las la-exclamation-circle"></i> {s.ai.failedBatches} batch{s.ai.failedBatches === 1 ? '' : 'es'} could not be assessed and show as "Not assessed". Run the search again to retry.</div>
    {/if}
  {:else if s.results.length > 0}
    <div class="results-header">
      <span>{s.total.toLocaleString()} application{s.total !== 1 ? 's' : ''} found in <strong>{s.lpa}</strong></span>
      <span class="results-note">Showing {s.results.length} of {s.total.toLocaleString()}</span>
    </div>
  {/if}

  {#if displayed.length > 0}
    <div class="select-bar">
      <button class="btn-save" on:click={saveSelected} disabled={saving || !s.selected.length}>
        {#if saving}
          <span class="spinner-sm"></span> Saving…
        {:else}
          <i class="las la-bookmark"></i> Save {s.selected.length ? `${s.selected.length} selected` : 'selected'}
        {/if}
      </button>
      {#if selectableShown.length}
        <button class="link-btn" on:click={selectAllShown}>Select all shown</button>
      {/if}
      {#if s.selected.length}
        <button class="link-btn" on:click={clearSelection}>Clear selection</button>
      {/if}
      <div class="view-toggle" role="group" aria-label="Results view">
        <button class:active={s.view === 'list'} on:click={() => setView('list')}><i class="las la-list"></i> List</button>
        <button class:active={s.view === 'map'} on:click={() => setView('map')}><i class="las la-map-marked-alt"></i> Map</button>
      </div>
    </div>
    {#if s.view === 'map'}
      <SchemesMap schemes={mapSchemes} boundary={project?.polygon_geojson || null} on:toggle={e => toggleSelect(e.detail)} />
      <p class="map-note">
        {#if unplottable}{unplottable} result{unplottable === 1 ? ' has' : 's have'} no location and {unplottable === 1 ? "isn't" : "aren't"} on the map. {/if}
        {#if !project?.polygon_geojson}This project has no site boundary yet; draw one on the Site Boundary tab to see it here.{/if}
      </p>
    {:else}
    <div class="results-list">
      {#each displayed as r (r.name)}
        <div class="result-card" class:result-excluded={r.ai && !r.ai.relevant} class:result-selected={s.selected.includes(r.name)}>
          <div class="pick">
            {#if savedNames.has(r.name)}
              <span class="saved-tag" title="Saved to this project"><i class="las la-bookmark"></i></span>
            {:else}
              <input type="checkbox" checked={s.selected.includes(r.name)} on:change={() => toggleSelect(r.name)} aria-label="Select this scheme" />
            {/if}
          </div>
          <div class="card-body">
            <div class="result-desc">{r.description || '(No description)'}</div>
            {#if r.ai}
              <div class="why">
                <button class="why-btn" class:why-open={openReasons.has(r.name)} on:click={() => toggleReason(r.name)} aria-expanded={openReasons.has(r.name)}>
                  <i class="las {openReasons.has(r.name) ? 'la-angle-up' : 'la-angle-down'}"></i>
                  {r.ai.relevant ? 'Why relevant' : r.ai.score === null ? 'Not assessed' : 'Why excluded'}
                </button>
                {#if openReasons.has(r.name)}
                  <p class="why-text">{r.ai.reason}</p>
                {/if}
              </div>
            {/if}
            <div class="result-meta">
              <span class="meta-item"><i class="las la-map-marker"></i> {r.address || r.area_name || '-'}</span>
              <span class="meta-item"><i class="las la-calendar"></i> Submitted {formatDate(r.start_date)}</span>
              {#if r.decided_date}
                <span class="meta-item"><i class="las la-gavel"></i> Decided {formatDate(r.decided_date)}</span>
              {/if}
              {#if r.app_type || r.app_size}
                <span class="meta-item"><i class="las la-tag"></i> {[r.app_type, r.app_size].filter(Boolean).join(' · ')}</span>
              {/if}
              {#if r.app_state}
                <span class="decision-badge {decisionClass(r.app_state)}">{r.app_state}</span>
              {/if}
            </div>
            {#if r.url}
              <a class="result-link" href={safeUrl(r.url)} target="_blank" rel="noopener noreferrer">
                View on council site <i class="las la-external-link-alt"></i>
              </a>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    {/if}

    {#if !s.ai && s.hasMore}
      <button
        class="btn-more"
        on:click={() => search(s.currentPage + 1)}
        disabled={searching}
      >
        {#if searching}
          <span class="spinner-sm spinner-dark"></span> Loading…
        {:else}
          Load more results
        {/if}
      </button>
    {/if}

  {:else if s.ai}
    <div class="empty-state">
      <i class="las la-filter"></i>
      <p>Nothing in the {s.ai.reviewed.toLocaleString()} applications reviewed matched your description. Try broader keywords or filters, or show the excluded ones to see why.</p>
    </div>
  {:else if !searching && !aiSearching && !searchError && (allTerms.length || s.generated)}
    {#if allTerms.length && s.lpa}
      <div class="empty-state">
        <i class="las la-search"></i>
        <p>{s.searchedFilters ? 'No results found. Try broader keywords or filters, or check the LPA name matches PlanIt exactly.' : 'Press Search to run the keyword search.'}</p>
      </div>
    {:else}
      <div class="empty-state">
        <i class="las la-lightbulb"></i>
        <p>Generate the search from your project sources above, or add your own keywords and an LPA, then click Search.</p>
      </div>
    {/if}
  {/if}


  {/if}

</div>
</div>

<AppealSourcePicker
  {projectId}
  open={pickerOpen}
  title="Generate the search from your sources"
  note="Project details are always read. This replaces the keywords, LPA and description below with what Claude drafts from what you tick."
  buttonLabel="Generate search"
  on:close={() => (pickerOpen = false)}
  on:draft={generate}
/>

<style>
  .similar-schemes-outer { display: flex; flex-direction: column; flex: 1; overflow-y: auto; min-height: 0; height: 100%; }
  .similar-schemes { display: flex; flex-direction: column; gap: 0; padding: 1.25rem; }

  /* Suggest panel */
  .suggest-panel { display: flex; flex-direction: column; gap: 0.75rem; }
  .suggest-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .suggest-title { font-size: 0.9rem; font-weight: 600; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; }
  .suggest-sub { font-size: 0.78rem; color: var(--color-slate-500); }
  .suggest-sub.drafted { margin-top: 0.25rem; font-weight: 600; }

  .btn-suggest {
    display: flex; align-items: center; gap: 0.4rem; white-space: nowrap;
    padding: 0.5rem 1rem; background: var(--color-purple-600); color: var(--color-white); border: none;
    border-radius: 7px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
    font-family: inherit; transition: background 0.15s; flex-shrink: 0;
  }
  .btn-suggest:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-suggest:disabled { opacity: 0.6; cursor: not-allowed; }

  .divider { height: 1px; background: var(--color-slate-200); margin: 1.25rem 0; }

  /* Search bar */
  .search-row { display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap; }
  .search-inputs { display: flex; gap: 0.75rem; flex: 1; flex-wrap: wrap; }
  .input-group { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 180px; }
  .lpa-group { max-width: 260px; }
  .input-group label { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); }
  .text-input {
    padding: 0.55rem 0.75rem; border: 1px solid var(--color-slate-200); border-radius: 6px;
    font-size: 0.875rem; font-family: inherit; color: var(--color-slate-800); outline: none;
    transition: border-color 0.15s;
  }
  .text-input:focus { border-color: var(--color-purple-600); }

  /* Keyword terms */
  .term-box {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem;
    padding: 0.3rem 0.5rem; border: 1px solid var(--color-slate-200); border-radius: 6px;
    background: var(--color-white); transition: border-color 0.15s;
  }
  .term-box:focus-within { border-color: var(--color-purple-600); }
  .term {
    display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.3rem 0.2rem 0.65rem;
    border-radius: 20px; background: var(--color-violet-100); color: var(--color-purple-700);
    font-size: 0.8rem; font-weight: 600;
  }
  .term-x {
    display: inline-flex; align-items: center; justify-content: center; border: none; background: none;
    color: var(--color-purple-700); cursor: pointer; padding: 0.1rem; border-radius: 50%; font-size: 0.85rem;
  }
  .term-x:hover { background: var(--color-purple-50); }
  .term-input {
    flex: 1; min-width: 160px; border: none; outline: none; background: transparent;
    font-size: 0.875rem; font-family: inherit; color: var(--color-slate-800); padding: 0.25rem 0;
  }
  .term-add {
    display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.65rem;
    border: 1px solid var(--color-slate-200); border-radius: 6px; background: var(--color-white);
    font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); cursor: pointer; font-family: inherit;
  }
  .term-add:hover:not(:disabled) { border-color: var(--color-purple-600); color: var(--color-purple-700); }
  .term-add:disabled { opacity: 0.4; cursor: not-allowed; }
  .term-hint { font-size: 0.72rem; color: var(--color-slate-500); }
  .term-hint code { font-size: 0.72rem; color: var(--color-slate-700); }

  /* Filters */
  .filters { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
  .filter-row { display: flex; gap: 2rem; flex-wrap: wrap; align-items: flex-end; }
  .filter-group { display: flex; flex-direction: column; gap: 0.35rem; }
  .filter-label { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); }
  .filter-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .fchip {
    padding: 0.2rem 0.65rem; border: 1px solid var(--color-slate-200); border-radius: 20px;
    background: var(--color-white); font-size: 0.75rem; color: var(--color-slate-500); cursor: pointer;
    font-family: inherit; transition: all 0.15s;
  }
  .fchip:hover { border-color: var(--color-purple-600); }
  .fchip.fchip-on { border-color: var(--color-purple-600); background: var(--color-violet-100); color: var(--color-purple-700); font-weight: 600; }
  .date-input { padding: 0.3rem 0.6rem; font-size: 0.8rem; }
  .hint-warn { font-size: 0.75rem; color: var(--color-badge-warning-fg); }

  /* Brief */
  .brief-panel { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.25rem; padding: 1rem; border: 1px solid var(--color-slate-200); border-radius: 8px; background: var(--color-slate-50); }
  .brief-input { resize: vertical; line-height: 1.5; }

  .action-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
  .action-note { font-size: 0.75rem; color: var(--color-slate-500); flex: 1; min-width: 220px; }

  .btn-search, .btn-ai {
    display: flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.25rem;
    color: var(--color-white); border: none; border-radius: 6px;
    font-size: 0.875rem; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: background 0.15s; white-space: nowrap;
  }
  .btn-search { background: var(--color-slate-800); }
  .btn-search:hover:not(:disabled) { background: var(--color-slate-700); }
  .btn-ai { background: var(--color-purple-600); }
  .btn-ai:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-search:disabled, .btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Results */
  .results-header {
    display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;
    font-size: 0.8rem; color: var(--color-slate-500); margin: 1.25rem 0 0.75rem;
  }
  .results-header strong { color: var(--color-slate-800); }
  .results-note { font-size: 0.72rem; }
  .results-actions { display: flex; gap: 1rem; }
  .link-btn { background: none; border: none; padding: 0; font: inherit; font-size: 0.78rem; color: var(--color-purple-600); cursor: pointer; }
  .link-btn:hover { text-decoration: underline; }

  .results-list { display: flex; flex-direction: column; gap: 0.625rem; }

  .result-card {
    border: 1px solid var(--color-slate-200); border-radius: 8px; padding: 0.875rem 1rem;
    background: var(--color-white); display: flex; flex-direction: column; gap: 0.5rem;
  }
  .result-card { flex-direction: row; gap: 0.75rem; }
  .result-card.result-selected { border-color: var(--color-purple-600); background: var(--color-purple-50); }
  .pick { padding-top: 0.15rem; width: 1.1rem; flex-shrink: 0; }
  .pick input { accent-color: var(--color-purple-600); cursor: pointer; margin: 0; }
  .saved-tag { color: var(--color-purple-600); font-size: 1.05rem; }
  .card-body { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; flex: 1; }

  .view-tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--color-slate-200); margin-bottom: 1.1rem; }
  .view-tabs button {
    display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.55rem 1rem; background: none; border: none;
    border-bottom: 2px solid transparent; font: inherit; font-size: 0.875rem; color: var(--color-slate-500); cursor: pointer;
  }
  .view-tabs button.on { color: var(--color-purple-700); font-weight: 600; border-bottom-color: var(--color-purple-600); }
  .saved-note {
    display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; padding: 0.55rem 0.85rem;
    background: var(--color-purple-50); color: var(--color-purple-700); border-radius: 6px; font-size: 0.8rem;
  }
  .view-toggle { display: inline-flex; margin-left: auto; border: 1px solid var(--color-slate-200); border-radius: 6px; overflow: hidden; }
  .view-toggle button {
    display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.7rem; border: none; background: var(--color-white);
    font: inherit; font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); cursor: pointer;
  }
  .view-toggle button.active { background: var(--color-purple-600); color: var(--color-white); }
  .map-note { margin: 0.5rem 0 0; font-size: 0.75rem; color: var(--color-slate-500); }

  .select-bar { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .btn-save {
    display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.9rem;
    background: var(--color-purple-600); color: var(--color-white); border: none; border-radius: 6px;
    font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }


  .result-card.result-excluded { opacity: 0.6; background: var(--color-slate-50); }
  .result-desc { font-size: 0.875rem; color: var(--color-slate-800); line-height: 1.5; }

  .why { display: flex; flex-direction: column; align-items: flex-start; gap: 0.35rem; }
  .why-btn {
    display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.1rem 0.55rem;
    border: 1px solid var(--color-slate-200); border-radius: 20px; background: var(--color-white);
    font-size: 0.7rem; font-weight: 600; color: var(--color-slate-600); cursor: pointer; font-family: inherit;
    transition: all 0.15s;
  }
  .why-btn:hover, .why-btn.why-open { border-color: var(--color-purple-600); color: var(--color-purple-700); background: var(--color-purple-50); }
  .why-text { margin: 0; font-size: 0.8rem; line-height: 1.45; color: var(--color-slate-700); }

  .result-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; }
  .meta-item { font-size: 0.75rem; color: var(--color-slate-500); display: flex; align-items: center; gap: 0.3rem; }

  .decision-badge {
    font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem;
    border-radius: 20px; text-transform: uppercase; letter-spacing: 0.03em;
  }
  .decision-granted { background: var(--color-emerald-100); color: var(--color-green-800); }
  .decision-refused { background: var(--color-red-100); color: var(--color-red-800); }
  .decision-other   { background: var(--color-slate-100); color: var(--color-slate-600); }

  .result-link {
    font-size: 0.75rem; color: var(--color-purple-600); text-decoration: none; display: inline-flex;
    align-items: center; gap: 0.25rem; width: fit-content;
  }
  .result-link:hover { text-decoration: underline; }

  .btn-more {
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    margin: 1rem auto 0; padding: 0.6rem 1.5rem;
    border: 1px solid var(--color-slate-200); border-radius: 7px; background: var(--color-white);
    font-size: 0.875rem; color: var(--color-slate-600); cursor: pointer; font-family: inherit;
    transition: all 0.15s;
  }
  .btn-more:hover:not(:disabled) { border-color: var(--color-purple-600); color: var(--color-purple-700); }
  .btn-more:disabled { opacity: 0.5; cursor: not-allowed; }

  .empty-state {
    display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
    padding: 3rem; color: var(--color-slate-400); text-align: center;
  }
  .empty-state i { font-size: 2rem; }
  .empty-state p { margin: 0; font-size: 0.875rem; max-width: 360px; line-height: 1.5; }

  .error-banner {
    display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.65rem 0.875rem;
    background: var(--color-red-100); color: var(--color-red-800); border-radius: 6px; font-size: 0.8rem; margin-top: 0.5rem;
  }

  .spinner-sm {
    width: 0.85rem; height: 0.85rem; border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: var(--color-white); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;
  }
  .spinner-sm.spinner-dark { border-color: rgba(0, 0, 0, 0.15); border-top-color: var(--color-slate-600); }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
