<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { completeStage, getPriorStageEntries } from '$lib/services/workflowApi.js';

  export let project;
  export let stage;
  export let tracks = [];
  export let currentUserName = null;

  const dispatch = createEventDispatcher();

  const RISK_OPTIONS = [
    { value: '',                  label: '— No change —' },
    { value: 'showstopper',       label: 'Showstopper' },
    { value: 'extremely_high_risk', label: 'Extremely High Risk' },
    { value: 'high_risk',         label: 'High Risk' },
    { value: 'medium_high_risk',  label: 'Medium-High Risk' },
    { value: 'medium_risk',       label: 'Medium Risk' },
    { value: 'medium_low_risk',   label: 'Medium-Low Risk' },
    { value: 'low_risk',          label: 'Low Risk' }
  ];

  // Editable row state: keyed by track id
  let rowState = {};
  let saving = false;
  let loadingPrefill = true;
  let error = null;

  onMount(async () => {
    // Initialise rows from tracks
    rowState = Object.fromEntries(
      tracks.map(t => [t.id, {
        riskLevel: t.last_known_risk_level || '',
        summary: '',
        notes: '',
        isKeyIssue: t.is_key_issue
      }])
    );

    // Prefill from prior completed stage
    try {
      const res = await getPriorStageEntries(project.id, stage.instance_id);
      for (const e of res.entries) {
        if (rowState[e.issue_track_id]) {
          rowState[e.issue_track_id].riskLevel = e.risk_level || rowState[e.issue_track_id].riskLevel;
          rowState[e.issue_track_id].summary = e.summary || '';
          rowState[e.issue_track_id].notes = e.notes || '';
        }
      }
      rowState = { ...rowState }; // trigger reactivity
    } catch {
      // Prefill failed — not critical
    } finally {
      loadingPrefill = false;
    }
  });

  async function save() {
    saving = true;
    error = null;
    try {
      const entries = tracks.map(t => ({
        issueTrackId: t.id,
        riskLevel: rowState[t.id]?.riskLevel || null,
        summary: rowState[t.id]?.summary || null,
        notes: rowState[t.id]?.notes || null,
        isKeyIssue: rowState[t.id]?.isKeyIssue ?? t.is_key_issue
      }));

      await completeStage(project.id, stage.instance_id, {
        entries,
        completedBy: currentUserName || null
      });
      dispatch('saved');
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  function close() {
    dispatch('close');
  }
</script>

<div class="modal-backdrop" on:click|self={close} role="dialog" aria-modal="true">
  <div class="modal">
    <div class="modal-header">
      <h2>
        <i class="las la-check-circle"></i>
        Complete Stage: {stage.stage_name}
      </h2>
      <button class="close-btn" on:click={close} aria-label="Close">
        <i class="las la-times"></i>
      </button>
    </div>

    {#if loadingPrefill}
      <div class="modal-loading">
        <i class="las la-spinner la-spin"></i>
        Loading prior values…
      </div>
    {:else}
      <div class="modal-body">
        <p class="modal-hint">
          Update risk levels and summaries for this stage. Values are pre-filled from the most
          recently completed prior stage where available.
        </p>

        {#if error}
          <div class="error-banner">
            <i class="las la-exclamation-circle"></i>
            {error}
          </div>
        {/if}

        <div class="rows-list">
          {#each tracks as track}
            {@const row = rowState[track.id] || {}}
            <div class="issue-row">
              <div class="issue-row-header">
                <div class="issue-label-area">
                  <button
                    class="key-issue-toggle"
                    class:active={row.isKeyIssue}
                    title={row.isKeyIssue ? 'Remove key issue flag' : 'Mark as key issue'}
                    on:click={() => {
                      rowState[track.id].isKeyIssue = !row.isKeyIssue;
                      rowState = { ...rowState };
                    }}
                  >
                    <i class="las la-flag"></i>
                  </button>
                  <span class="issue-label" class:key-issue={row.isKeyIssue}>{track.label}</span>
                </div>

                <select
                  class="risk-select"
                  bind:value={rowState[track.id].riskLevel}
                >
                  {#each RISK_OPTIONS as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>

              <input
                type="text"
                class="summary-input"
                placeholder="Summary…"
                bind:value={rowState[track.id].summary}
              />

              <textarea
                class="notes-input"
                placeholder="Notes (optional)…"
                rows="2"
                bind:value={rowState[track.id].notes}
              ></textarea>
            </div>
          {/each}

          {#if tracks.length === 0}
            <p class="no-tracks">No issue rows on this board yet.</p>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" on:click={close}>Cancel</button>
        <button class="btn-save" on:click={save} disabled={saving}>
          {#if saving}
            <i class="las la-spinner la-spin"></i>
            Saving…
          {:else}
            <i class="las la-check"></i>
            Mark stage complete
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 700px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-header h2 i { color: #10b981; }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.375rem;
    color: #94a3b8;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.15s;
  }

  .close-btn:hover { color: #1e293b; }

  .modal-loading {
    padding: 3rem;
    text-align: center;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-hint {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
    line-height: 1.5;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .rows-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .issue-row {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: #fafafa;
  }

  .issue-row-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .issue-label-area {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .key-issue-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9375rem;
    color: #cbd5e1;
    padding: 0;
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .key-issue-toggle.active { color: #f59e0b; }
  .key-issue-toggle:hover { color: #f59e0b; }

  .issue-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1e293b;
  }

  .issue-label.key-issue { font-weight: 700; }

  .risk-select {
    padding: 0.375rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    cursor: pointer;
    min-width: 180px;
  }

  .risk-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
  }

  .summary-input,
  .notes-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    box-sizing: border-box;
    font-family: inherit;
    resize: vertical;
  }

  .summary-input:focus,
  .notes-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
  }

  .notes-input { color: #64748b; }

  .no-tracks {
    color: #94a3b8;
    font-size: 0.875rem;
    text-align: center;
    padding: 1.5rem 0;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn-cancel {
    padding: 0.5rem 1.25rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-cancel:hover { border-color: #94a3b8; color: #1e293b; }

  .btn-save {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1.5rem;
    background: #10b981;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-save:hover:not(:disabled) { background: #059669; }
  .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
