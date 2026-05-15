<script>
  import { populateFromBriefing, saveSuggestion } from '$lib/api/briefingPopulate.js';
  import BriefingSuggestionGroup from './BriefingSuggestionGroup.svelte';

  export let show = false;
  export let projectId;
  export let onClose;
  export let onComplete;

  let loading = false;
  let applying = false;
  let error = null;
  let suggestions = []; // each item gets a _state: 'pending' | 'accepted' | 'skipped'

  $: docSuggestions   = suggestions.filter(s => s.type === 'document_summary');
  $: issueSuggestions = suggestions.filter(s => s.type === 'issue_summary');
  $: acceptedCount    = suggestions.filter(s => s._state === 'accepted').length;

  $: if (show) load();

  async function load() {
    loading = true;
    error = null;
    suggestions = [];
    try {
      const { suggestions: raw } = await populateFromBriefing(projectId);
      suggestions = raw.map(s => ({ ...s, _state: 'pending' }));
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function handleAccept(suggestion) {
    suggestions = suggestions.map(s =>
      key(s) === key(suggestion) ? { ...s, _state: 'accepted' } : s
    );
  }

  function handleReject(suggestion) {
    suggestions = suggestions.map(s =>
      key(s) === key(suggestion) ? { ...s, _state: 'skipped' } : s
    );
  }

  function key(s) {
    return s.type === 'document_summary' ? `doc_${s.doc_type}` : `issue_${s.track_id}`;
  }

  async function handleApply() {
    applying = true;
    error = null;
    const accepted = suggestions.filter(s => s._state === 'accepted');
    try {
      for (const s of accepted) {
        await saveSuggestion(projectId, s);
      }
      onComplete?.();
    } catch (e) {
      error = e.message;
      applying = false;
    }
  }
</script>

{#if show}
  <div class="overlay" on:click|self={onClose}>
    <div class="modal">
      <div class="modal-header">
        <div class="header-left">
          <i class="las la-magic"></i>
          <h2>Populate from Briefing</h2>
        </div>
        <button class="close-btn" on:click={onClose}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="state-center">
            <div class="spinner"></div>
            <p>Analysing briefing note…</p>
          </div>

        {:else if error}
          <div class="state-center error">
            <i class="las la-exclamation-triangle"></i>
            <p>{error}</p>
            <button class="btn btn-secondary" on:click={load}>Try again</button>
          </div>

        {:else if suggestions.length === 0}
          <div class="state-center">
            <i class="las la-search"></i>
            <p>No suggestions could be extracted from the briefing note.</p>
          </div>

        {:else}
          <p class="intro">
            Review the suggested content below. Accept what looks right — skipped items will be ignored.
          </p>

          <div class="groups">
            <BriefingSuggestionGroup
              label="Document summaries"
              suggestions={docSuggestions}
              onAccept={handleAccept}
              onReject={handleReject}
            />
            <BriefingSuggestionGroup
              label="Issue working notes"
              suggestions={issueSuggestions}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          </div>
        {/if}
      </div>

      {#if !loading && suggestions.length > 0}
        <div class="modal-footer">
          {#if error}
            <p class="footer-error">{error}</p>
          {/if}
          <button class="btn btn-secondary" on:click={onClose} disabled={applying}>Cancel</button>
          <button
            class="btn btn-primary"
            disabled={acceptedCount === 0 || applying}
            on:click={handleApply}
          >
            {#if applying}
              <div class="spinner-sm"></div> Applying…
            {:else}
              <i class="las la-check"></i> Apply {acceptedCount} suggestion{acceptedCount !== 1 ? 's' : ''}
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15);
    width: 100%;
    max-width: 680px;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    color: #7c3aed;
    gap: 0.625rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .header-left i { font-size: 1.25rem; }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .close-btn:hover { color: #1e293b; }

  .modal-body {
    overflow-y: auto;
    max-height: 65vh;
    padding: 1.5rem;
  }

  .state-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    color: #64748b;
    text-align: center;
  }

  .state-center i { font-size: 2rem; opacity: 0.6; }
  .error { color: #dc2626; }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner-sm {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .intro {
    margin: 0 0 1.25rem;
    font-size: 0.85rem;
    color: #64748b;
    line-height: 1.5;
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .footer-error {
    flex: 1;
    margin: 0;
    font-size: 0.8rem;
    color: #dc2626;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-primary { background: #7c3aed; color: white; }
  .btn-primary:hover:not(:disabled) { background: #6d28d9; }

  .btn-secondary { background: white; color: #64748b; border: 1px solid #cbd5e1; }
  .btn-secondary:hover:not(:disabled) { background: #f8fafc; }
</style>
