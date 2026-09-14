<script>
  import {
    keyIssueDraftLoading,
    keyIssueDraftSuggestions,
    keyIssueDraftAccepted,
    keyIssueDraftSkipped,
    acceptKeyIssueSummary,
    skipKeyIssueSummary,
    closeKeyIssueDraft,
  } from '$lib/stores/planning-notes.js';
</script>

<div class="modal-overlay" on:click|self={closeKeyIssueDraft} role="dialog" aria-modal="true">
  <div class="modal modal-briefing-draft">
    <div class="modal-header">
      <span class="modal-title">Draft issue notes from briefing</span>
      <button class="modal-close" on:click={closeKeyIssueDraft}><i class="las la-times"></i></button>
    </div>
    <div class="modal-body">
      {#if $keyIssueDraftLoading}
        <div class="briefing-draft-loading">
          <div class="mini-spinner"></div>
          <span>Analysing briefing and drafting position notes…</span>
        </div>
      {:else if $keyIssueDraftSuggestions.length === 0}
        <p class="briefing-draft-empty">No suggestions returned.</p>
      {:else}
        <p class="briefing-draft-intro">Review the suggested position notes below. Accept to set the issue note, or skip to ignore.</p>
        <div class="briefing-draft-list">
          {#each $keyIssueDraftSuggestions as s (s.track_id)}
            {@const accepted = $keyIssueDraftAccepted.has(s.track_id)}
            {@const skipped = $keyIssueDraftSkipped.has(s.track_id)}
            <div class="briefing-draft-card" class:bd-accepted={accepted} class:bd-skipped={skipped}>
              <div class="bd-card-header">
                <span class="bd-issue-label">{s.label}</span>
                {#if accepted}
                  <span class="bd-status bd-status-accepted"><i class="las la-check"></i> Applied</span>
                {:else if skipped}
                  <span class="bd-status bd-status-skipped">Skipped</span>
                {:else}
                  <div class="bd-actions">
                    <button class="bd-btn-accept" on:click={() => acceptKeyIssueSummary(s.track_id, s.summary)}>
                      <i class="las la-check"></i> Accept
                    </button>
                    <button class="bd-btn-skip" on:click={() => skipKeyIssueSummary(s.track_id)}>Skip</button>
                  </div>
                {/if}
              </div>
              <p class="bd-argument-text">{s.summary}</p>
            </div>
          {/each}
        </div>
        <div class="briefing-draft-footer">
          <button class="btn-primary" on:click={closeKeyIssueDraft}>Done</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 10px;
    width: 100%;
    max-width: 760px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--color-slate-400);
    font-size: 1.125rem;
    cursor: pointer;
    border-radius: 4px;
  }

  .modal-close:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem;
  }

  .mini-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .modal-briefing-draft { max-width: 680px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; }
  .modal-briefing-draft .modal-body { overflow-y: auto; flex: 1; }

  .briefing-draft-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }

  .briefing-draft-intro {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    margin: 0 0 1rem;
  }

  .briefing-draft-list { display: flex; flex-direction: column; gap: 0.75rem; }

  .briefing-draft-card {
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 0.875rem;
    transition: border-color 0.15s;
  }
  .briefing-draft-card.bd-accepted { border-color: var(--color-slate-400); background: var(--color-slate-100); }
  .briefing-draft-card.bd-skipped { opacity: 0.45; }

  .bd-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .bd-issue-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-900);
  }

  .bd-actions { display: flex; gap: 0.375rem; }

  .bd-btn-accept {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    background: var(--color-violet-600);
    border: none;
    border-radius: 5px;
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
  }
  .bd-btn-accept:hover { background: var(--color-violet-700); }

  .bd-btn-skip {
    padding: 0.25rem 0.625rem;
    background: white;
    border: 1px solid var(--color-slate-300);
    border-radius: 5px;
    color: var(--color-slate-500);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .bd-btn-skip:hover { background: var(--color-slate-50); }

  .bd-status {
    font-size: 0.75rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .bd-status-accepted { color: var(--color-emerald-600); }
  .bd-status-skipped { color: var(--color-slate-400); }

  .bd-argument-text {
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  .briefing-draft-footer {
    margin-top: 1.25rem;
    display: flex;
    justify-content: flex-end;
  }

  .briefing-draft-empty { color: var(--color-slate-500); font-size: 0.875rem; }
</style>
