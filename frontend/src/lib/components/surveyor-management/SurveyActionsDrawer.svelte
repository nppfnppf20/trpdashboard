<script>
  // Actions timeline drawer for an instructed survey — clone of the conditions
  // tracker progress timeline drawer in projects/ConditionsTrackerTab.svelte.
  import { createEventDispatcher } from 'svelte';
  import {
    createQuoteActions,
    suggestQuoteActionSummaries,
    updateQuoteAction,
    deleteQuoteAction,
  } from '$lib/api/quoteActions.js';

  export let quote = null;      // the instructed quote whose timeline is open
  export let actions = [];      // this quote's actions, newest first
  export let projectId;

  const dispatch = createEventDispatcher();

  // Add form
  let showAdd = false;
  let addForm = { action_date: '', source_type: 'email', summary: '', full_text: '' };
  let addSaving = false;
  let addGenerating = false;
  let addGenerated = false;
  let addError = null;

  // Edit form
  let editingId = null;
  let editForm = { action_date: '', source_type: 'note', summary: '', full_text: '' };

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function openAdd() {
    addForm = {
      action_date: new Date().toISOString().slice(0, 10),
      source_type: 'email',
      summary: '',
      full_text: '',
    };
    addError = null;
    addGenerated = false;
    showAdd = true;
  }

  async function saveAdd() {
    if (!addForm.action_date) { addError = 'A date is required.'; return; }

    // Blank summary: generate it from the pasted text first, then confirm
    if (!addForm.summary.trim()) {
      if (!addForm.full_text.trim()) {
        addError = 'Type a summary, or paste the email trail / note text to summarise from.';
        return;
      }
      addGenerating = true;
      addError = null;
      try {
        const { suggestions } = await suggestQuoteActionSummaries(projectId, {
          full_text: addForm.full_text,
          items: [{ quote_id: quote.id, user_summary: null }],
        });
        const s = suggestions.find(x => x.quote_id === quote.id) ?? suggestions[0];
        if (s?.summary) {
          addForm = { ...addForm, summary: s.summary };
          addGenerated = true;
        } else {
          addError = 'Could not generate a summary from the text.';
        }
      } catch (err) {
        addError = err.message;
      } finally {
        addGenerating = false;
      }
      return; // review the generated summary, then Save again
    }

    addSaving = true;
    addError = null;
    try {
      const rows = await createQuoteActions(projectId, {
        action_date: addForm.action_date,
        full_text: addForm.full_text.trim() || null,
        source_type: addForm.source_type,
        items: [{ quote_id: quote.id, summary: addForm.summary.trim() }],
      });
      dispatch('done', { rows });
      showAdd = false;
    } catch (err) {
      addError = err.message;
    } finally {
      addSaving = false;
    }
  }

  function startEdit(a) {
    editingId = a.id;
    editForm = {
      action_date: a.action_date ? a.action_date.split('T')[0] : '',
      source_type: a.source_type || 'note',
      summary: a.summary || '',
      full_text: a.full_text || '',
    };
  }

  async function saveEdit() {
    try {
      const updated = await updateQuoteAction(editingId, {
        action_date: editForm.action_date || null,
        summary: editForm.summary,
        full_text: editForm.full_text,
        source_type: editForm.source_type,
      });
      dispatch('updated', { action: updated });
      editingId = null;
    } catch (err) {
      alert('Failed to update action: ' + err.message);
    }
  }

  async function removeAction(actionId) {
    if (!confirm('Delete this action?')) return;
    try {
      await deleteQuoteAction(actionId);
      dispatch('deleted', { id: actionId });
    } catch (err) {
      alert('Failed to delete action: ' + err.message);
    }
  }

  function close() {
    dispatch('close');
  }
</script>

{#if quote}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="tl-overlay" on:click|self={close}>
    <div class="tl-drawer">
      <div class="tl-header">
        <div class="tl-header-text">
          <h3 class="tl-title">{quote.discipline || 'Survey'} · {quote.surveyor_organisation || ''}</h3>
          <p class="tl-subtitle">
            {actions.length} action{actions.length !== 1 ? 's' : ''}
            {#if quote.work_status}· {quote.work_status}{/if}
          </p>
        </div>
        <button class="tl-icon-btn" on:click={close}><i class="las la-times"></i></button>
      </div>

      <div class="tl-body">
        {#if showAdd}
          <div class="tl-add-form">
            <div class="tl-add-row">
              <input type="date" class="tl-input" bind:value={addForm.action_date} />
              <select class="tl-input" bind:value={addForm.source_type}>
                <option value="email">Email trail</option>
                <option value="note">Note</option>
              </select>
            </div>
            <textarea class="tl-input" rows="2" bind:value={addForm.summary}
              placeholder="Summary — leave blank to auto-summarise from the text below…"></textarea>
            <textarea class="tl-input" rows="5" bind:value={addForm.full_text}
              placeholder={addForm.source_type === 'email' ? 'Paste the email trail here…' : 'Fuller detail…'}></textarea>
            {#if addGenerated}
              <div class="tl-notice"><i class="las la-magic"></i> Summary generated — review or edit it, then Save.</div>
            {/if}
            {#if addError}<div class="tl-error">{addError}</div>{/if}
            <div class="tl-add-btns">
              <button class="tl-btn tl-btn-ghost" on:click={() => showAdd = false} disabled={addSaving || addGenerating}>Cancel</button>
              <button class="tl-btn tl-btn-primary" on:click={saveAdd} disabled={addSaving || addGenerating}>
                {#if addGenerating}Summarising…{:else if addSaving}Saving…{:else if addGenerated}Confirm & Save{:else}Save Action{/if}
              </button>
            </div>
          </div>
        {:else}
          <button class="tl-add-btn" on:click={openAdd}>
            <i class="las la-plus"></i> Add Action
          </button>
        {/if}

        {#if actions.length === 0 && !showAdd}
          <p class="tl-empty">No actions recorded yet.</p>
        {/if}

        <div class="tl-entries">
          {#each actions as a (a.id)}
            <div class="tl-entry">
              <div class="tl-entry-marker"></div>
              <div class="tl-entry-content">
                {#if editingId === a.id}
                  <div class="tl-add-row">
                    <input type="date" class="tl-input" bind:value={editForm.action_date} />
                    <select class="tl-input" bind:value={editForm.source_type}>
                      <option value="email">Email trail</option>
                      <option value="note">Note</option>
                    </select>
                  </div>
                  <textarea class="tl-input" rows="2" bind:value={editForm.summary}></textarea>
                  <textarea class="tl-input" rows="5" bind:value={editForm.full_text} placeholder="Source text (optional)…"></textarea>
                  <div class="tl-add-btns">
                    <button class="tl-btn tl-btn-ghost" on:click={() => editingId = null}>Cancel</button>
                    <button class="tl-btn tl-btn-primary" on:click={saveEdit}>Save</button>
                  </div>
                {:else}
                  <div class="tl-entry-head">
                    <span class="tl-entry-date">{formatDate(a.action_date)}</span>
                    <span class="tl-source-badge" class:tl-source-email={a.source_type === 'email'}>
                      <i class="las {a.source_type === 'email' ? 'la-envelope' : 'la-sticky-note'}"></i>
                      {a.source_type === 'email' ? 'Email trail' : 'Note'}
                    </span>
                    <div class="tl-entry-btns">
                      <button class="tl-icon-btn" title="Edit" on:click={() => startEdit(a)}><i class="las la-pen"></i></button>
                      <button class="tl-icon-btn tl-icon-btn-danger" title="Delete" on:click={() => removeAction(a.id)}><i class="las la-trash"></i></button>
                    </div>
                  </div>
                  <p class="tl-entry-summary">{a.summary}</p>
                  {#if a.full_text}
                    <details class="tl-full-text">
                      <summary>View source text</summary>
                      <pre class="tl-full-text-body">{a.full_text}</pre>
                    </details>
                  {/if}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .tl-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
  }
  .tl-drawer {
    background: #fff;
    width: 100%;
    max-width: 520px;
    height: 100%;
    box-shadow: -12px 0 40px rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
  }
  .tl-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1.125rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .tl-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.4;
  }
  .tl-subtitle {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: #94a3b8;
  }
  .tl-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .tl-add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border: 2px dashed #c4b5fd;
    background: white;
    color: #9333ea;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .tl-add-btn:hover { background: #faf5ff; border-color: #9333ea; }

  .tl-add-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid #e9d5ff;
    background: #faf5ff;
    border-radius: 10px;
    padding: 0.875rem;
  }
  .tl-add-row {
    display: flex;
    gap: 0.5rem;
  }
  .tl-add-row .tl-input { flex: 1; }
  .tl-input {
    font-size: 0.8rem;
    padding: 5px 8px;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-family: inherit;
    color: #1e293b;
    background: white;
  }
  .tl-input:focus {
    outline: none;
    border-color: #9333ea;
    box-shadow: 0 0 0 3px #f3e8ff;
  }
  textarea.tl-input { font-family: inherit; resize: vertical; }
  .tl-add-btns {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .tl-error {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.78rem;
  }
  .tl-notice {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #7e22ce;
    background: #fff;
    border: 1px solid #e9d5ff;
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
  }
  .tl-empty {
    margin: 0;
    text-align: center;
    font-size: 0.8rem;
    color: #94a3b8;
    padding: 1rem 0;
  }

  /* Buttons */
  .tl-btn {
    padding: 0.35rem 0.9rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .tl-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .tl-btn-primary { background: #9333ea; color: white; border-color: #9333ea; }
  .tl-btn-primary:hover:not(:disabled) { background: #7e22ce; }
  .tl-btn-ghost { background: transparent; color: #64748b; border-color: #d1d5db; }
  .tl-btn-ghost:hover:not(:disabled) { background: #f8fafc; }
  .tl-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 1rem;
    padding: 2px 4px;
    border-radius: 4px;
  }
  .tl-icon-btn:hover { background: #f1f5f9; color: #1e293b; }
  .tl-icon-btn-danger:hover { background: #fef2f2; color: #dc2626; }

  /* Entries */
  .tl-entries {
    display: flex;
    flex-direction: column;
  }
  .tl-entry {
    display: flex;
    gap: 0.75rem;
    position: relative;
    padding-bottom: 1.125rem;
  }
  .tl-entry-marker {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #9333ea;
    flex-shrink: 0;
    margin-top: 5px;
    position: relative;
    z-index: 1;
  }
  .tl-entry:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 14px;
    bottom: -4px;
    width: 2px;
    background: #ede9fe;
  }
  .tl-entry-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tl-entry-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .tl-entry-date {
    font-size: 0.78rem;
    font-weight: 700;
    color: #1e293b;
  }
  .tl-source-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    border-radius: 100px;
    padding: 1px 8px;
  }
  .tl-source-email { color: #2563eb; background: #dbeafe; }
  .tl-entry-btns {
    margin-left: auto;
    display: flex;
    gap: 2px;
    visibility: hidden;
  }
  .tl-entry:hover .tl-entry-btns { visibility: visible; }
  .tl-entry-summary {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.55;
    color: #334155;
    white-space: pre-wrap;
  }
  .tl-full-text summary {
    font-size: 0.72rem;
    color: #9333ea;
    cursor: pointer;
    user-select: none;
  }
  .tl-full-text-body {
    margin: 6px 0 0;
    padding: 0.625rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.74rem;
    line-height: 1.55;
    color: #475569;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    max-height: 320px;
    overflow-y: auto;
  }
</style>
