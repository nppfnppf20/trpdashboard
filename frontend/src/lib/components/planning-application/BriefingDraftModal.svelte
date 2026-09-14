<script>
  import {
    briefingDraftLoading,
    briefingDraftSuggestions,
    briefingDraftSkipped,
    briefingEvolveState,
    startEvolveArgument,
    sendEvolveRefinement,
    applyEvolvedArgument,
    skipBriefingDraftSuggestion,
    closeBriefingDraft,
  } from '$lib/stores/planning-notes.js';

  export let project;
</script>

<div class="modal-overlay" on:click|self={closeBriefingDraft} role="dialog" aria-modal="true">
  <div class="modal modal-briefing-draft">
    <div class="modal-header">
      <span class="modal-title">Draft arguments from briefing</span>
      <button class="modal-close" on:click={closeBriefingDraft}><i class="las la-times"></i></button>
    </div>
    <div class="modal-body">
      {#if $briefingDraftLoading}
        <div class="briefing-draft-loading">
          <div class="mini-spinner"></div>
          <span>Analysing briefing transcript and drafting arguments…</span>
        </div>
      {:else if $briefingDraftSuggestions.length === 0}
        <p class="briefing-draft-empty">No suggestions returned.</p>
      {:else}
        <p class="briefing-draft-intro">Review the suggested changes below. Click "Evolve argument" to see how the AI proposes to rework the existing argument, then refine or apply it.</p>
        <div class="briefing-draft-list">
          {#each $briefingDraftSuggestions as s (s.track_id)}
            {@const skipped = $briefingDraftSkipped.has(s.track_id)}
            {@const evolve = $briefingEvolveState[s.track_id]}
            <div class="briefing-draft-card" class:bd-skipped={skipped} class:bd-applied={evolve?.applied}>
              <div class="bd-card-header">
                <span class="bd-issue-label">{s.label}</span>
                {#if evolve?.applied}
                  <span class="bd-status bd-status-accepted"><i class="las la-check"></i> Applied</span>
                {:else if skipped}
                  <span class="bd-status bd-status-skipped">Skipped</span>
                {:else if !evolve}
                  <div class="bd-actions">
                    <button class="bd-btn-accept" on:click={() => startEvolveArgument(project.id, s.track_id, s.argument_for)}>
                      <i class="las la-magic"></i> Evolve argument
                    </button>
                    <button class="bd-btn-skip" on:click={() => skipBriefingDraftSuggestion(s.track_id)}>Skip</button>
                  </div>
                {/if}
              </div>

              <!-- New information from briefing -->
              <div class="bd-new-info">
                <span class="bd-new-info-label">From briefing</span>
                <p class="bd-argument-text">{s.argument_for}</p>
              </div>

              <!-- Evolve panel -->
              {#if evolve && !evolve.applied}
                <div class="bd-evolve-panel">
                  {#if evolve.loading}
                    <div class="bd-evolve-loading">
                      <div class="mini-spinner"></div>
                      <span>Reworking argument…</span>
                    </div>
                  {:else if evolve.evolved}
                    <div class="bd-evolve-result">
                      <span class="bd-evolved-label">Proposed argument</span>
                      <p class="bd-evolved-text">{evolve.evolved}</p>
                    </div>
                    <div class="bd-evolve-chat">
                      <textarea
                        class="bd-chat-input"
                        placeholder="Ask for changes, e.g. 'keep the reference to the original scheme but lead with the new position'…"
                        rows="2"
                        value={evolve.input}
                        on:input={(e) => briefingEvolveState.update(st => ({ ...st, [s.track_id]: { ...st[s.track_id], input: e.target.value } }))}
                        on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEvolveRefinement(project.id, s.track_id, s.argument_for); } }}
                      ></textarea>
                      <div class="bd-evolve-actions">
                        <button class="bd-chat-send" disabled={!evolve.input?.trim() || evolve.loading} on:click={() => sendEvolveRefinement(project.id, s.track_id, s.argument_for)}>
                          <i class="las la-paper-plane"></i>
                        </button>
                        <button class="bd-btn-apply" on:click={() => applyEvolvedArgument(s.track_id)}>
                          <i class="las la-check"></i> Apply
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <div class="briefing-draft-footer">
          <button class="btn-primary" on:click={closeBriefingDraft}>Done</button>
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

  .bd-new-info {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.625rem 0.75rem;
    margin-top: 0.5rem;
  }

  .bd-new-info-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-slate-400);
    display: block;
    margin-bottom: 0.25rem;
  }

  .bd-evolve-panel {
    margin-top: 0.75rem;
    border-top: 1px solid var(--color-slate-200);
    padding-top: 0.75rem;
  }

  .bd-evolve-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    padding: 0.5rem 0;
  }

  .bd-evolve-result {
    background: var(--color-slate-100);
    border: 1px solid var(--color-emerald-100);
    border-radius: 6px;
    padding: 0.625rem 0.75rem;
    margin-bottom: 0.625rem;
  }

  .bd-evolved-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-emerald-600);
    display: block;
    margin-bottom: 0.25rem;
  }

  .bd-evolved-text {
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  .bd-evolve-chat {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }

  .bd-chat-input {
    flex: 1;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    resize: none;
    line-height: 1.5;
  }
  .bd-chat-input:focus { outline: none; border-color: var(--color-violet-600); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08); }

  .bd-evolve-actions {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .bd-chat-send {
    padding: 0.4rem 0.5rem;
    background: var(--color-slate-100);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    color: var(--color-slate-500);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }
  .bd-chat-send:hover:not(:disabled) { background: var(--color-slate-200); }
  .bd-chat-send:disabled { opacity: 0.4; cursor: default; }

  .bd-btn-apply {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 0.625rem;
    background: var(--color-emerald-600);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
    white-space: nowrap;
  }
  .bd-btn-apply:hover { background: var(--color-green-800); }

  .bd-applied { opacity: 0.7; }

  .briefing-draft-footer {
    margin-top: 1.25rem;
    display: flex;
    justify-content: flex-end;
  }

  .briefing-draft-empty { color: var(--color-slate-500); font-size: 0.875rem; }
</style>
