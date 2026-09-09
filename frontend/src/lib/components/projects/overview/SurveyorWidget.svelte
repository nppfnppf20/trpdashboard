<script>
  import { onMount } from 'svelte';
  import { getQuotes } from '$lib/api/quotes.js';
  import { getSentRequestsForProject } from '$lib/api/quoteRequests.js';
  import {
    openSurveyorManagement,
    setPendingQuoteUploadFile,
    setPendingQuoteUploadText
  } from '$lib/stores/projectViewModal.js';

  export let project;
  $: projectId = project?.id;
  $: uniqueId = project?.unique_id;

  let stats = null;
  let loading = true;
  let error = null;
  let dragOver = false;
  let fileInput;
  let inputMode = 'upload'; // 'upload' | 'paste'
  let pasteText = '';

  onMount(load);

  async function load() {
    loading = true;
    error = null;
    try {
      const [quotes, sentRequests] = await Promise.all([
        getQuotes({ projectId: uniqueId }),
        getSentRequestsForProject(uniqueId),
      ]);

      const instructed = quotes.filter(q =>
        q.instruction_status === 'instructed' || q.instruction_status === 'partially_instructed'
      );
      const instructedSpend = instructed.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);
      const worksCompleted = instructed.filter(q => q.work_status === 'completed');
      const worksOutstanding = instructed.filter(q => q.work_status !== 'completed');

      stats = {
        quotesSent: sentRequests.length,
        quotesReceived: quotes.length,
        quotesInstructed: instructed.length,
        instructedSpend,
        worksCompleted: worksCompleted.length,
        worksOutstanding: worksOutstanding.length,
      };
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openManage() {
    openSurveyorManagement(projectId, null, 'details');
  }

  // Hands off to the full Quotes tab rather than parsing here — same pattern
  // as the Overview Meeting Notes widget: seed the store, then open the tab
  // that picks it up on mount and opens the Add Quote modal pre-seeded.
  function handOffFile(file) {
    if (!file) return;
    setPendingQuoteUploadFile(file);
    openSurveyorManagement(projectId, 'quotes', 'details');
  }

  function handOffText() {
    if (!pasteText.trim()) return;
    setPendingQuoteUploadText(pasteText);
    openSurveyorManagement(projectId, 'quotes', 'details');
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
