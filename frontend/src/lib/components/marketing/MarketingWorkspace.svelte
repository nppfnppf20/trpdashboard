<script>
  import { onMount } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import {
    draftTypes, drafts, draftGenerating, activeDraftTypeId,
    draftEditorHtml, draftSaving, draftSaved,
    setMarketingEditor, loadDraftTypes,
    openDraft, closeDraft, handleSaveDraft, handleGenerate,
  } from '$lib/stores/marketing-drafts.js';

  let editor;
  let autoSaveTimer = null;
  let regenPending = null;
  let loading = true;
  let loadError = null;

  onMount(async () => {
    loading = true;
    loadError = null;
    try {
      await loadDraftTypes();
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
  });

  $: setMarketingEditor(editor);

  function onDraftChange(e) {
    if (e?.detail?.html !== undefined) $draftEditorHtml = e.detail.html;
    $draftSaved = false;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(handleSaveDraft, 2000);
  }

  async function closeDraftWithSave() {
    clearTimeout(autoSaveTimer);
    if (!$draftSaved && $activeDraftTypeId) await handleSaveDraft();
    closeDraft();
  }

  function requestGenerate(typeId, hasDraft) {
    if (hasDraft) {
      regenPending = typeId;
    } else {
      handleGenerate(typeId);
    }
  }

  function confirmRegen() {
    if (!regenPending) return;
    handleGenerate(regenPending);
    regenPending = null;
  }
</script>

<div class="workspace">

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading...</span>
    </div>

  {:else if loadError}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>{loadError}</p>
      <button on:click={() => { loading = true; loadDraftTypes().finally(() => loading = false); }}>Retry</button>
    </div>

  {:else if $activeDraftTypeId !== null}
    <!-- ── Editor view ── -->
    {@const activeType = $draftTypes.find(t => t.id === $activeDraftTypeId)}
    <div class="draft-editor-bar">
      <button class="reset-btn" on:click={closeDraftWithSave}>
        <i class="las la-arrow-left"></i> Content
      </button>
      <span class="draft-editor-title">{activeType?.name ?? ''}</span>
      <div class="draft-editor-actions">
        <button class="draft-regen-btn" disabled={$draftGenerating === $activeDraftTypeId} on:click={() => requestGenerate($activeDraftTypeId, true)}>
          {#if $draftGenerating === $activeDraftTypeId}
            <div class="mini-spinner"></div> Generating...
          {:else}
            <i class="las la-sync"></i> Regenerate
          {/if}
        </button>
        <button class="draft-save-btn" disabled={$draftSaving} on:click={handleSaveDraft}>
          {#if $draftSaving}Saving...{:else if $draftSaved}<i class="las la-check"></i> Saved{:else}Save{/if}
        </button>
      </div>
    </div>

    <div class="draft-editor-panel">
      <RichTextEditor bind:this={editor} content={$draftEditorHtml} on:change={onDraftChange} />
    </div>

  {:else}
    <!-- ── Card list ── -->
    <div class="tab-body">
      <div class="draft-types-list">
        {#each $draftTypes as type (type.id)}
          {@const draft = $drafts[type.id]}
          <div class="draft-type-card">
            <div class="draft-type-main">
              <div class="draft-type-info">
                <span class="draft-type-name">{type.name}</span>
                {#if type.description}<span class="draft-type-desc">{type.description}</span>{/if}
                {#if draft?.generated_at}
                  <span class="draft-type-meta">Last generated {new Date(draft.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {/if}
              </div>
              <div class="draft-type-actions">
                {#if draft}
                  <button class="draft-open-btn" on:click={() => openDraft(type.id)}>Open</button>
                {/if}
                <button class="draft-generate-btn" disabled={$draftGenerating === type.id} on:click={() => requestGenerate(type.id, !!draft)}>
                  {#if $draftGenerating === type.id}
                    <div class="mini-spinner"></div> Generating...
                  {:else}
                    <i class="las la-magic"></i> {draft ? 'Regenerate' : 'Generate'}
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

</div>

<!-- Regenerate confirmation modal -->
{#if regenPending !== null}
  <div class="modal-overlay" on:click|self={() => regenPending = null} role="dialog" aria-modal="true">
    <div class="modal modal-confirm">
      <div class="modal-header">
        <span class="modal-title">Regenerate content?</span>
        <button class="modal-close" on:click={() => regenPending = null}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body">
        <p>This will overwrite the existing content with a freshly generated version.</p>
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left"></div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => regenPending = null}>Cancel</button>
          <button class="modal-run" on:click={confirmRegen}>Regenerate</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* ── Loading / error ── */

  .loading-state, .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #64748b;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #e2e8f0;
    border-top-color: #0369a1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Card list ── */

  .tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  .draft-types-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 720px;
  }

  .draft-type-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 1rem 1.125rem;
    transition: box-shadow 0.15s;
  }

  .draft-type-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  }

  .draft-type-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .draft-type-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .draft-type-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
  }

  .draft-type-desc {
    font-size: 0.78rem;
    color: #64748b;
    line-height: 1.4;
  }

  .draft-type-meta {
    font-size: 0.72rem;
    color: #94a3b8;
    margin-top: 0.1rem;
  }

  .draft-type-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .draft-open-btn {
    height: 32px;
    padding: 0 0.875rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-open-btn:hover { background: #f8fafc; border-color: #cbd5e1; }

  .draft-generate-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    height: 32px;
    padding: 0 0.875rem;
    background: #0369a1;
    border: none;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .draft-generate-btn:hover:not(:disabled) { background: #0284c7; }
  .draft-generate-btn:disabled { opacity: 0.6; cursor: default; }

  /* ── Editor bar ── */

  .draft-editor-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    height: 46px;
    padding: 0 1rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    height: 30px;
    padding: 0 0.625rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .reset-btn:hover { background: #f8fafc; border-color: #cbd5e1; }

  .draft-editor-title {
    font-size: 0.825rem;
    font-weight: 600;
    color: #1e293b;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .draft-editor-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .draft-regen-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    height: 30px;
    padding: 0 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-regen-btn:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
  .draft-regen-btn:disabled { opacity: 0.6; cursor: default; }

  .draft-save-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    height: 30px;
    padding: 0 0.875rem;
    background: #0369a1;
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .draft-save-btn:hover:not(:disabled) { background: #0284c7; }
  .draft-save-btn:disabled { opacity: 0.6; cursor: default; }

  .draft-editor-panel {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Mini spinner ── */

  .mini-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
  }
  .draft-regen-btn .mini-spinner {
    border-color: rgba(0,0,0,0.15);
    border-top-color: #374151;
  }

  /* ── Modal ── */

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    width: 420px;
    max-width: 94vw;
    overflow: hidden;
  }

  .modal-confirm { width: 380px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem 0.875rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #1e293b;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.125rem 0.25rem;
  }
  .modal-close:hover { color: #475569; }

  .modal-body {
    padding: 1rem 1.25rem;
  }

  .modal-body p {
    margin: 0;
    font-size: 0.825rem;
    color: #374151;
    line-height: 1.5;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .modal-footer-left, .modal-footer-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-cancel {
    height: 32px;
    padding: 0 0.875rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .modal-cancel:hover { background: #f1f5f9; }

  .modal-run {
    height: 32px;
    padding: 0 0.875rem;
    background: #0369a1;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .modal-run:hover { background: #0284c7; }
</style>
