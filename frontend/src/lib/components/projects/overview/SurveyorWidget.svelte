<script>
  import { getQuotes } from '$lib/api/quotes.js';
  import { getSentRequestsForProject } from '$lib/api/quoteRequests.js';
  import {
    openSurveyorManagement,
    setPendingQuoteUploadFile,
    setPendingQuoteUploadText
  } from '$lib/stores/projectViewModal.js';
  import { debounce } from '$lib/utils/debounce.js';

  export let project;
  // Optional — when set (non-empty), sums stats across all these projects
  // instead of just `project`. A new quote still has to be uploaded/pasted
  // against one specific project, so merged mode adds a small project
  // picker above the upload/paste tabs for that.
  export let projects = null;
  $: merged = Array.isArray(projects) && projects.length > 0;
  $: projectList = merged ? projects : (project ? [project] : []);
  $: projectId = project?.id;
  $: uniqueId = project?.unique_id;

  let stats = null;
  let loading = true;
  let error = null;
  let dragOver = false;
  let fileInput;
  let inputMode = 'upload'; // 'upload' | 'paste'
  let pasteText = '';
  let targetProjectId = null; // merged mode only — which project a new quote belongs to
  $: if (merged && !projectList.some(p => p.id === targetProjectId)) targetProjectId = projectList[0]?.id ?? null;

  // Per-project cache so re-ticking an already-seen project in the merged
  // multi-select is instant, and debounced so a burst of quick ticks
  // collapses into one load instead of one per click.
  const cache = new Map();
  const scheduleLoad = debounce(load, 350);

  let loadedKey = null;
  $: {
    const key = projectList.map(p => p.id).sort((a, b) => a - b).join(',');
    if (key !== loadedKey) {
      loadedKey = key;
      if (cache.size === 0) load(); else scheduleLoad();
    }
  }

  async function load() {
    loading = true;
    error = null;
    try {
      const missing = projectList.filter(p => !cache.has(p.id));
      if (missing.length) {
        const fetched = await Promise.all(missing.map(async (p) => {
          const [quotes, sentRequests] = await Promise.all([
            getQuotes({ projectId: p.unique_id }),
            getSentRequestsForProject(p.unique_id),
          ]);
          const instructed = quotes.filter(q =>
            q.instruction_status === 'instructed' || q.instruction_status === 'partially_instructed'
          );
          return [p.id, {
            quotesSent: sentRequests.length,
            quotesReceived: quotes.length,
            quotesInstructed: instructed.length,
            instructedSpend: instructed.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0),
            worksCompleted: instructed.filter(q => q.work_status === 'completed').length,
            worksOutstanding: instructed.filter(q => q.work_status !== 'completed').length,
          }];
        }));
        for (const [id, s] of fetched) cache.set(id, s);
      }
      const perProject = projectList.map(p => cache.get(p.id)).filter(Boolean);
      stats = perProject.reduce((sum, s) => ({
        quotesSent: sum.quotesSent + s.quotesSent,
        quotesReceived: sum.quotesReceived + s.quotesReceived,
        quotesInstructed: sum.quotesInstructed + s.quotesInstructed,
        instructedSpend: sum.instructedSpend + s.instructedSpend,
        worksCompleted: sum.worksCompleted + s.worksCompleted,
        worksOutstanding: sum.worksOutstanding + s.worksOutstanding,
      }), { quotesSent: 0, quotesReceived: 0, quotesInstructed: 0, instructedSpend: 0, worksCompleted: 0, worksOutstanding: 0 });
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openManage() {
    openSurveyorManagement(merged ? targetProjectId : projectId, null, 'details');
  }

  // Hands off to the full Quotes tab rather than parsing here — same pattern
  // as the Overview Meeting Notes widget: seed the store, then open the tab
  // that picks it up on mount and opens the Add Quote modal pre-seeded.
  function handOffFile(file) {
    if (!file) return;
    setPendingQuoteUploadFile(file);
    openSurveyorManagement(merged ? targetProjectId : projectId, 'quotes', 'details');
  }

  function handOffText() {
    if (!pasteText.trim()) return;
    setPendingQuoteUploadText(pasteText);
    openSurveyorManagement(merged ? targetProjectId : projectId, 'quotes', 'details');
  }

  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    handOffFile(e.dataTransfer?.files?.[0]);
  }

  function handleFileChange(e) {
    handOffFile(e.target.files?.[0]);
  }
</script>

<div class="widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-user-tie"></i>
      Surveyor Management
    </div>
    <button class="widget-expand" on:click={openManage}>
      Manage <i class="las la-angle-right"></i>
    </button>
  </div>
  <div class="widget-body sv-body">
    {#if merged}
      <select class="form-input sv-target-select" bind:value={targetProjectId}>
        {#each projectList as p (p.id)}
          <option value={p.id}>{p.project_name}</option>
        {/each}
      </select>
    {/if}
    <div class="sv-input-tabs">
      <button class="sv-tab" class:active={inputMode === 'upload'} on:click={() => inputMode = 'upload'}>
        <i class="las la-upload"></i> Upload
      </button>
      <button class="sv-tab" class:active={inputMode === 'paste'} on:click={() => inputMode = 'paste'}>
        <i class="las la-clipboard"></i> Paste Text
      </button>
    </div>

    {#if inputMode === 'upload'}
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div
        class="sv-drop-zone"
        class:drag-over={dragOver}
        role="button"
        tabindex="0"
        on:dragover|preventDefault={() => dragOver = true}
        on:dragleave={() => dragOver = false}
        on:drop={handleDrop}
        on:click={() => fileInput.click()}
        on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
      >
        <i class="las la-cloud-upload-alt sv-drop-icon"></i>
        <span>Drop a quote here or click to browse</span>
        <span class="sv-drop-hint">PDF, DOCX or TXT</span>
      </div>
      <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleFileChange} />
    {:else}
      <textarea class="form-input sv-paste" bind:value={pasteText} placeholder="Paste the quote text here (e.g. from an email)…" rows="3"></textarea>
      <button class="btn btn-primary btn-sm sv-process-btn" on:click={handOffText} disabled={!pasteText.trim()}>
        <i class="las la-magic"></i> Process
      </button>
    {/if}

    {#if loading}
      <div class="sv-state">Loading…</div>
    {:else if error}
      <div class="sv-state sv-state-error">{error}</div>
    {:else if stats}
      <div class="sv-stats">
        <div><div class="sv-num">{stats.quotesSent}</div><div class="sv-label">Sent</div></div>
        <div><div class="sv-num">{stats.quotesReceived}</div><div class="sv-label">Received</div></div>
        <div><div class="sv-num">{stats.quotesInstructed}</div><div class="sv-label">Instructed</div></div>
      </div>
      <div class="sv-spend">£{stats.instructedSpend.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} instructed spend</div>
      <div class="sv-badges">
        <span class="badge badge-warning">{stats.worksOutstanding} outstanding</span>
        <span class="badge badge-success">{stats.worksCompleted} completed</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .sv-body { display: flex; flex-direction: column; gap: 10px; }
  .sv-target-select { font-size: 11px; padding: 0.35rem 0.5rem; }
  .sv-state { font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.5rem 0; }
  .sv-state-error { color: var(--color-red-600); }
  .sv-stats { display: flex; gap: 16px; }
  .sv-num { font-size: 17px; font-weight: 700; color: var(--color-slate-900); }
  .sv-label { font-size: 10px; color: var(--color-slate-400); }
  .sv-spend { font-size: 12px; font-weight: 600; color: var(--color-slate-700); }
  .sv-badges { display: flex; gap: 6px; }

  .sv-input-tabs { display: flex; gap: 5px; }
  .sv-tab {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: var(--radius-pill);
    border: 1px solid var(--color-slate-200); background: var(--color-white);
    font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-500);
    cursor: pointer; font-family: inherit;
  }
  .sv-tab:hover { background: var(--color-slate-50); }
  .sv-tab.active { border-color: var(--color-primary-200); background: var(--color-primary-50); color: var(--color-primary-700); }

  .sv-drop-zone {
    border: 2px dashed var(--color-primary-200);
    border-radius: var(--radius-md);
    padding: 0.65rem 0.75rem;
    text-align: center;
    cursor: pointer;
    color: var(--color-slate-500);
    font-size: 11px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .sv-drop-zone:hover, .sv-drop-zone.drag-over { background: var(--color-primary-50); border-color: var(--color-primary-500); }
  .sv-drop-icon { font-size: 1.15rem; color: var(--color-primary-200); }
  .sv-drop-hint { font-size: 9.5px; color: var(--color-slate-400); }

  .sv-paste { font-size: 11px; resize: vertical; }
  .sv-process-btn { align-self: flex-start; }
</style>
