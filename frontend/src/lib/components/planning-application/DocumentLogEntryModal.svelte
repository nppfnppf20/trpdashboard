<script>
  import {
    logModalOpen,
    logTitle,
    logCode,
    logItemType,
    logPreparedBy,
    logSummary,
    logPoints,
    logSaving,
    removeLogPoint,
    saveLogEntry,
  } from '$lib/stores/planning-log.js';

  export let project;

  function autoresize(node, _value) {
    function resize() {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    }
    node.addEventListener('input', resize);
    resize();
    return {
      update() { resize(); },
      destroy() { node.removeEventListener('input', resize); }
    };
  }
</script>

<div class="modal-overlay" on:click|self={() => $logModalOpen = false} role="dialog" aria-modal="true">
  <div class="modal modal-log">
    <div class="modal-header">
      <span class="modal-title">Save to Document Log</span>
      <button class="modal-close" on:click={() => $logModalOpen = false}><i class="las la-times"></i></button>
    </div>
    <div class="modal-body log-modal-body">
      <div class="log-form">
        <div class="log-form-row">
          <div class="log-form-field">
            <label class="section-field-label">Document title <span style="color:var(--color-red-500)">*</span></label>
            <input class="add-section-input" type="text" bind:value={$logTitle} placeholder="e.g. Officer Report, Land at Station Road" />
          </div>
          <div class="log-form-field log-form-field-sm">
            <label class="section-field-label">Reference / code</label>
            <input class="add-section-input" type="text" bind:value={$logCode} placeholder="e.g. CD/1.2" />
          </div>
        </div>
        <div class="log-form-row">
          <div class="log-form-field log-form-field-sm">
            <label class="section-field-label">Type</label>
            <select class="template-select" bind:value={$logItemType}>
              <option value="document">Document</option>
              <option value="drawing">Drawing</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="log-form-field">
            <label class="section-field-label">Prepared by</label>
            <input class="add-section-input" type="text" bind:value={$logPreparedBy} placeholder="e.g. Third Revolution Projects Ltd" />
          </div>
        </div>

        {#if $logSummary}
          <div class="log-form-field">
            <label class="section-field-label">Document summary</label>
            <textarea class="prompt-editor" style="min-height:80px;resize:vertical" bind:value={$logSummary}></textarea>
          </div>
        {/if}

        <div class="log-form-field">
          <label class="section-field-label">Arguments used ({$logPoints.length})</label>
          {#if $logPoints.length === 0}
            <p class="sections-empty" style="padding:0.5rem 0;text-align:left">No arguments were ticked during analysis. You can add them manually after saving.</p>
          {:else}
            <div class="log-points-editor">
              {#each $logPoints as lp, i (lp.id)}
                <div class="log-point-edit">
                  <div class="log-point-edit-header">
                    <span class="result-field-tag" class:against={lp.field === 'argument_against'} class:for={lp.field === 'argument_for'}>
                      {lp.field === 'argument_against' ? 'Against' : 'For'}
                    </span>
                    <span class="log-point-issue">{lp.issue_label}</span>
                    <button class="section-delete-btn" style="margin-left:auto" on:click={() => removeLogPoint(lp.id)} title="Remove"><i class="las la-times"></i></button>
                  </div>
                  <textarea class="notes-field" style="min-height:60px" bind:value={$logPoints[i].text} use:autoresize={$logPoints[i].text}></textarea>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="modal-cancel" on:click={() => $logModalOpen = false}>Cancel</button>
        <button class="modal-run" disabled={!$logTitle.trim() || $logSaving} on:click={() => saveLogEntry(project.id)}>
          {$logSaving ? 'Saving...' : 'Save to log'}
        </button>
      </div>
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

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-footer-left { display: flex; gap: 0.5rem; }
  .modal-footer-right { display: flex; gap: 0.5rem; }

  .modal-cancel {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
  }
  .modal-cancel:hover { background: var(--color-slate-100); }

  .modal-run {
    padding: 0.5rem 1.25rem;
    background: var(--color-violet-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .modal-run:hover:not(:disabled) { background: var(--color-violet-700); }
  .modal-run:disabled { opacity: 0.4; cursor: not-allowed; }

  .section-field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
  }

  .add-section-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    transition: border-color 0.15s;
  }
  .add-section-input:focus { outline: none; border-color: var(--color-violet-600); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.07); }
  .add-section-input::placeholder { color: var(--color-slate-400); }

  .prompt-editor {
    flex: 1;
    width: 100%;
    min-height: 400px;
    box-sizing: border-box;
    padding: 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: 'Menlo', 'Consolas', monospace;
    line-height: 1.6;
    color: var(--color-slate-800);
    background: var(--color-slate-50);
    resize: vertical;
  }
  .prompt-editor:focus { outline: none; border-color: var(--color-violet-600); background: white; }

  .sections-empty {
    margin: 0;
    padding: 2rem 1.25rem 1rem;
    font-size: 0.875rem;
    color: var(--color-slate-400);
    text-align: center;
  }

  .section-delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    background: white;
    color: var(--color-slate-400);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }
  .section-delete-btn:hover { background: var(--color-red-100); border-color: var(--color-red-200); color: var(--color-red-800); }

  .result-field-tag {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .result-field-tag.against { background: var(--color-red-100); color: var(--color-red-800); }
  .result-field-tag.for     { background: var(--color-violet-100); color: var(--color-violet-700); }

  .log-point-issue { font-size: 0.8rem; font-weight: 500; color: var(--color-slate-700); }

  .modal-log { max-width: 680px; }

  .log-modal-body {
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }

  .log-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .log-form-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .log-form-field { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
  .log-form-field-sm { flex: 0 0 160px; }

  .log-points-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .log-point-edit {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
  }

  .log-point-edit-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .notes-field {
    width: 100%;
    box-sizing: border-box;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-700);
    background: var(--color-slate-50);
    resize: none;
    overflow: hidden;
    line-height: 1.5;
    transition: border-color 0.15s, background 0.15s;
    min-height: 100px;
  }

  .notes-field:focus {
    outline: none;
    border-color: var(--color-violet-600);
    background: white;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.07);
  }

  .notes-field::placeholder { color: var(--color-slate-400); }
</style>
