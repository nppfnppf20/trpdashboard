<script>
  import { briefingNotes, openBriefingUpload } from '$lib/stores/planning-notes.js';
  import { generateStage1Review } from '$lib/api/stage1Review.js';
  import { getTemplates, createDeliverable, updateDeliverableFromHTML } from '$lib/services/planningDeliverablesApi.js';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import DeliverableEditor from '$lib/components/planning/DeliverableEditor.svelte';
  import '$lib/styles/trpformatting.css';
  import PromptEditModal from '$lib/components/shared/PromptEditModal.svelte';
  import { actionPromptState, openActionPrompt, closeActionPrompt, saveActionPromptStore, resetActionPromptStore, setPromptText } from '$lib/stores/actionPrompts.js';

  const stage1PromptState = actionPromptState('stage1_review');

  export let project;

  let selectedNoteId = null;
  let dropdownOpen = false;

  let generating = false;
  let error = null;
  let generatedHtml = null;

  let openingEditor = false;
  let editorDeliverable = null;

  let exportingWord = false;

  async function exportToWord() {
    exportingWord = true;
    try {
      const safeName = `Stage_1_Planning_Appraisal_${project.project_name}`;
      await exportHtmlToWord(generatedHtml, safeName, '/stage1reviewtemplate.docx');
    } catch (err) {
      error = err.message;
    } finally {
      exportingWord = false;
    }
  }

  function clickOutside(node, handler) {
    function onClick(e) { if (!node.contains(e.target)) handler(); }
    document.addEventListener('click', onClick, true);
    return { destroy() { document.removeEventListener('click', onClick, true); } };
  }

  async function generate() {
    generating = true;
    error = null;
    generatedHtml = null;
    try {
      const result = await generateStage1Review(project.id, { briefingNoteId: selectedNoteId });
      generatedHtml = result.html;
    } catch (err) {
      error = err.message;
    } finally {
      generating = false;
    }
  }

  async function openInEditor() {
    openingEditor = true;
    error = null;
    try {
      const templates = await getTemplates();
      const template = templates.find(t => t.template_type === 'stage1_review');
      if (!template) {
        throw new Error('Stage 1 Review template not found. Please run the database migration to seed it.');
      }

      const result = await createDeliverable(project.id, template.id, `Stage 1 Planning Appraisal — ${project.project_name}`);
      const deliverable = result.deliverable;

      // Inject the generated HTML into the deliverable
      await updateDeliverableFromHTML(deliverable.id, generatedHtml);

      // Reload with the updated HTML so the editor shows the generated content
      editorDeliverable = deliverable;
    } catch (err) {
      error = err.message;
    } finally {
      openingEditor = false;
    }
  }

  function closeEditor() {
    editorDeliverable = null;
  }
</script>

<div class="stage1-panel">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="stage1-toolbar">
    <div class="briefing-btn-group" use:clickOutside={() => dropdownOpen = false}>
      <button
        class="btn-generate"
        class:no-note={!selectedNoteId}
        on:click={generate}
        disabled={generating}
      >
        {#if generating}
          <span class="spinner"></span> Generating…
        {:else}
          <i class="las la-magic"></i> Generate Stage 1 Review
          {#if selectedNoteId}
            {@const note = $briefingNotes.find(n => n.id === selectedNoteId)}
            {#if note}<span class="briefing-note-pill">{note.title || note.file_name}</span>{/if}
          {/if}
        {/if}
      </button>
      <button
        class="btn-briefing-chevron"
        on:click={() => dropdownOpen = !dropdownOpen}
        title="Select briefing note"
        disabled={generating}
      >
        <i class="las la-angle-down"></i>
      </button>
      {#if dropdownOpen}
        <div class="briefing-dropdown">
          <button
            class="briefing-dropdown-item"
            class:active={selectedNoteId === null}
            on:click={() => { selectedNoteId = null; dropdownOpen = false; }}
          >
            <span>Latest briefing note</span>
          </button>
          {#each $briefingNotes as note}
            <button
              class="briefing-dropdown-item"
              class:active={selectedNoteId === note.id}
              on:click={() => { selectedNoteId = note.id; dropdownOpen = false; }}
            >
              <span class="briefing-dropdown-title">{note.title || note.file_name}</span>
              <span class="briefing-dropdown-date">{new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </button>
          {/each}
          <button class="briefing-dropdown-item briefing-dropdown-upload" on:click={openBriefingUpload}>
            <i class="las la-plus"></i> Upload new briefing note
          </button>
        </div>
      {/if}
    </div>
    <button class="prompt-info-btn" title="Edit generation prompt" on:click={() => openActionPrompt('stage1_review')}><i class="las la-sliders-h"></i></button>
    </div>

    {#if generatedHtml}
      <button class="btn-open-editor" on:click={openInEditor} disabled={openingEditor}>
        {#if openingEditor}
          <span class="spinner spinner-sm"></span> Opening…
        {:else}
          <i class="las la-external-link-alt"></i> Open in Editor
        {/if}
      </button>
      <button class="btn-export-word" on:click={exportToWord} disabled={exportingWord}>
        {#if exportingWord}
          <span class="spinner spinner-sm"></span> Exporting…
        {:else}
          <i class="las la-file-word"></i> Export to Word
        {/if}
      </button>
    {/if}
  </div>

  {#if error}
    <div class="error-banner">
      <i class="las la-exclamation-circle"></i>
      {error}
    </div>
  {/if}

  <!-- Empty state -->
  {#if !generatedHtml && !generating}
    <div class="empty-state">
      {#if $briefingNotes.length === 0}
        <i class="las la-file-upload"></i>
        <p>No briefing notes uploaded yet.</p>
        <p class="hint">Upload a briefing note via the project documents modal, then return here to generate.</p>
      {:else}
        <i class="las la-table"></i>
        <p>Select a briefing note and click <strong>Generate Stage 1 Review</strong> to fill the appraisal table.</p>
      {/if}
    </div>
  {/if}

  <!-- Loading state -->
  {#if generating}
    <div class="generating-state">
      <div class="generating-spinner"></div>
      <p>Generating Stage 1 Appraisal from briefing note…</p>
      <p class="generating-hint">This may take 20–30 seconds.</p>
    </div>
  {/if}

  <!-- Preview -->
  {#if generatedHtml}
    <div class="preview-header">
      <span class="preview-label"><i class="las la-eye"></i> Preview</span>
      <span class="preview-hint">Click <strong>Open in Editor</strong> to edit and save this document.</span>
    </div>
    <div class="preview-wrapper trp-document-content">
      {@html generatedHtml}
    </div>
  {/if}
</div>

<!-- Deliverable Editor -->
{#if editorDeliverable}
  <DeliverableEditor deliverable={editorDeliverable} on:close={closeEditor} />
{/if}

<PromptEditModal
  open={$stage1PromptState.open}
  title="Edit Prompt — Generate Stage 1 Review"
  promptText={$stage1PromptState.text}
  loading={$stage1PromptState.loading}
  saving={$stage1PromptState.saving}
  saved={$stage1PromptState.saved}
  on:close={() => closeActionPrompt('stage1_review')}
  on:change={(e) => setPromptText('stage1_review', e.detail)}
  on:save={() => saveActionPromptStore('stage1_review')}
  on:reset={() => resetActionPromptStore('stage1_review')}
/>

<style>
  .stage1-panel {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .briefing-btn-group {
    position: relative;
    display: flex;
    align-items: stretch;
  }

  .stage1-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .prompt-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: transparent;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.875rem;
    flex-shrink: 0;
    transition: color 0.15s, border-color 0.15s;
  }
  .prompt-info-btn:hover { color: #6366f1; border-color: #6366f1; }

  .btn-generate {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #1F4E78;
    color: white;
    border: none;
    border-radius: 6px 0 0 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-generate:hover:not(:disabled) {
    background: #163d5e;
  }

  .btn-generate:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-generate.no-note {
    background: #0d9488;
  }

  .btn-generate.no-note:hover:not(:disabled) {
    background: #0f766e;
  }

  .btn-briefing-chevron {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.6rem;
    background: #1F4E78;
    color: white;
    border: none;
    border-left: 1px solid rgba(255,255,255,0.25);
    border-radius: 0 6px 6px 0;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-briefing-chevron:hover:not(:disabled) {
    background: #163d5e;
  }

  .btn-briefing-chevron:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .briefing-note-pill {
    background: rgba(255,255,255,0.2);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-size: 0.75rem;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .briefing-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 260px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    z-index: 100;
    overflow: hidden;
  }

  .briefing-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 1rem;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    color: #1e293b;
    transition: background 0.1s;
  }

  .briefing-dropdown-item:hover {
    background: #f1f5f9;
  }

  .briefing-dropdown-item.active {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .briefing-dropdown-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .briefing-dropdown-date {
    font-size: 0.75rem;
    color: #94a3b8;
    flex-shrink: 0;
  }

  .briefing-dropdown-upload {
    border-top: 1px solid #e2e8f0;
    color: #0d9488;
    gap: 0.5rem;
  }

  .briefing-dropdown-upload i {
    font-size: 0.875rem;
  }

  .btn-open-editor {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.25rem;
    background: #0d9488;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-open-editor:hover:not(:disabled) {
    background: #0f766e;
  }

  .btn-open-editor:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-export-word {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.25rem;
    background: white;
    color: #1e293b;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-export-word:hover:not(:disabled) {
    border-color: #1F4E78;
    color: #1F4E78;
  }

  .btn-export-word:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* ── States ── */
  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    color: #dc2626;
    font-size: 0.875rem;
  }

  .error-banner i {
    flex-shrink: 0;
    font-size: 1.1rem;
    margin-top: 0.05rem;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
  }

  .empty-state i {
    font-size: 4rem;
    color: #cbd5e1;
    display: block;
    margin-bottom: 1rem;
  }

  .empty-state p {
    font-size: 1rem;
    color: #64748b;
    margin: 0 0 0.5rem;
  }

  .hint {
    font-size: 0.875rem !important;
    color: #94a3b8 !important;
  }

  .generating-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }

  .generating-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #e2e8f0;
    border-top-color: #1F4E78;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1.25rem;
  }

  .generating-state p {
    font-size: 1rem;
    color: #475569;
    margin: 0 0 0.35rem;
  }

  .generating-hint {
    font-size: 0.875rem !important;
    color: #94a3b8 !important;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Preview ── */
  .preview-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px 8px 0 0;
    border-bottom: none;
  }

  .preview-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .preview-hint {
    font-size: 0.8125rem;
    color: #94a3b8;
  }

  .preview-wrapper {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0 0 8px 8px;
    padding: 2rem 2.5rem;
    max-height: 70vh;
    overflow-y: auto;
  }

  /* ── Spinner (inline) ── */
  .spinner {
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle;
  }

  .spinner-sm {
    width: 0.75rem;
    height: 0.75rem;
  }
</style>
