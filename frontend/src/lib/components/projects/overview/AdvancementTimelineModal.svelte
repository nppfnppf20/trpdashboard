<script>
  // Shared "view + quick-add + edit + delete" popup for a single tracked
  // item's advancement/action history. Generalizes the inline timeline panel
  // that already exists (duplicated) inside ConsultationTrackerTab.svelte,
  // ConditionsTrackerTab.svelte and ProgressTrackerTab.svelte — those stay
  // as-is; this is a new, additive component used by the Overview page's
  // Trackers widget only.
  //
  // `items` must already be normalized and sorted newest-first:
  //   { id, date, summary, fullText, sourceLabel, editable }
  // Non-editable rows (e.g. Conditions' merged-in quote/key-date events)
  // render read-only with their sourceLabel as a small tag.

  export let show = false;
  export let title = '';
  export let items = [];
  export let showSourceToggle = true;
  export let onAdd; // (form) => Promise
  export let onUpdate; // (id, form) => Promise
  export let onDelete; // (id) => Promise
  export let onGenerate = null; // (fullText) => Promise<string>
  export let onClose = () => {};

  let formDate = '';
  let formSourceType = 'note';
  let formFullText = '';
  let formSummary = '';
  let editingId = null;
  let saving = false;
  let deletingId = null;
  let generating = false;
  let error = null;
  let seeded = false;

  $: if (show && !seeded) {
    resetForm();
    seeded = true;
  }
  $: if (!show && seeded) {
    seeded = false;
  }

  function resetForm() {
    formDate = new Date().toISOString().slice(0, 10);
    formSourceType = 'note';
    formFullText = '';
    formSummary = '';
    editingId = null;
    error = null;
  }

  function startEdit(item) {
    editingId = item.id;
    formDate = item.date ? item.date.slice(0, 10) : '';
    formSourceType = item.sourceType || 'note';
    formFullText = item.fullText || '';
    formSummary = item.summary || '';
    error = null;
  }

  function cancelEdit() {
    resetForm();
  }

  async function generate() {
    if (!onGenerate || !formFullText.trim() || generating) return;
    generating = true;
    error = null;
    try {
      const summary = await onGenerate(formFullText);
      if (summary) formSummary = summary;
    } catch (err) {
      error = err.message;
    } finally {
      generating = false;
    }
  }

  async function save() {
    if (!formSummary.trim()) { error = 'A summary is required.'; return; }
    if (!formDate) { error = 'A date is required.'; return; }
    saving = true;
    error = null;
    try {
      const form = {
        date: formDate,
        sourceType: formSourceType,
        fullText: formFullText.trim() || null,
        summary: formSummary.trim(),
      };
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onAdd(form);
      }
      resetForm();
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  async function remove(id) {
    if (!confirm('Delete this entry?')) return;
    deletingId = id;
    error = null;
    try {
      await onDelete(id);
      if (editingId === id) resetForm();
    } catch (err) {
      error = err.message;
    } finally {
      deletingId = null;
    }
  }

  function close() {
    if (saving) return;
    show = false;
    onClose();
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

{#if show}
  <div class="atm-backdrop" on:click|self={close} role="presentation">
    <div class="atm-modal">
      <div class="atm-header">
        <h3>{title}</h3>
        <button class="atm-close-btn" on:click={close}>&times;</button>
      </div>

      <div class="atm-body">
        <div class="atm-list">
          {#each items as item (item.id)}
            <div class="atm-row" class:editing={editingId === item.id}>
              <div class="atm-row-main">
                <span class="atm-row-date">{formatDate(item.date)}</span>
                {#if !item.editable && item.sourceLabel}
                  <span class="atm-row-tag">{item.sourceLabel}</span>
                {/if}
                <p class="atm-row-summary">{item.summary}</p>
              </div>
              {#if item.editable}
                <div class="atm-row-actions">
                  <button class="btn btn-icon btn-ghost" title="Edit" on:click={() => startEdit(item)}><i class="las la-pen"></i></button>
                  <button class="btn btn-icon btn-danger-ghost" title="Delete" on:click={() => remove(item.id)} disabled={deletingId === item.id}><i class="las la-trash"></i></button>
                </div>
              {/if}
            </div>
          {:else}
            <p class="atm-empty">No entries yet — add the first one below.</p>
          {/each}
        </div>

        <div class="atm-form">
          <div class="atm-form-title">{editingId ? 'Edit entry' : 'Add entry'}</div>
          <div class="atm-form-row">
            <div class="field field--date">
              <label>Date</label>
              <input type="date" bind:value={formDate} />
            </div>
            {#if showSourceToggle}
              <div class="field field--source">
                <label>Source</label>
                <div class="atm-source-toggle">
                  <button type="button" class:active={formSourceType === 'note'} on:click={() => formSourceType = 'note'}>
                    <i class="las la-sticky-note"></i> Note
                  </button>
                  <button type="button" class:active={formSourceType === 'email'} on:click={() => formSourceType = 'email'}>
                    <i class="las la-envelope"></i> Email trail
                  </button>
                </div>
              </div>
            {/if}
          </div>

          {#if onGenerate}
            <div class="field">
              <label>Detail <span class="hint">optional — paste the full note or email trail</span></label>
              <textarea rows="3" bind:value={formFullText} placeholder="Paste the full detail here…"></textarea>
              <button type="button" class="btn-generate" on:click={generate} disabled={!formFullText.trim() || generating}>
                {#if generating}<span class="mini-spinner"></span> Generating…{:else}<i class="las la-magic"></i> Generate summary{/if}
              </button>
            </div>
          {/if}

          <div class="field">
            <label>Summary</label>
            <textarea rows="2" bind:value={formSummary} placeholder="What happened…"></textarea>
          </div>

          {#if error}<div class="atm-error">{error}</div>{/if}

          <div class="atm-form-actions">
            {#if editingId}
              <button class="btn btn-secondary btn-sm" on:click={cancelEdit} disabled={saving}>Cancel edit</button>
            {/if}
            <button class="btn btn-primary btn-sm" on:click={save} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .atm-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  .atm-modal {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    width: 95%;
    max-width: 640px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-modal);
    overflow: hidden;
  }
  .atm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .atm-header h3 { margin: 0; font-size: 1.02rem; font-weight: 700; color: var(--color-slate-900); }
  .atm-close-btn {
    background: none; border: none; font-size: 1.6rem; color: var(--color-slate-500);
    cursor: pointer; line-height: 1; padding: 0; width: 2rem; height: 2rem;
  }
  .atm-close-btn:hover { color: var(--color-slate-800); }

  .atm-body { flex: 1; overflow-y: auto; padding: 1.1rem 1.4rem; display: flex; flex-direction: column; gap: 1rem; }

  .atm-list { display: flex; flex-direction: column; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); overflow: hidden; }
  .atm-row { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.65rem 0.85rem; border-bottom: 1px solid var(--color-slate-100); }
  .atm-row:last-child { border-bottom: none; }
  .atm-row.editing { background: var(--color-primary-50); }
  .atm-row-main { flex: 1; min-width: 0; }
  .atm-row-date { font-size: 0.7rem; font-weight: 700; color: var(--color-slate-400); }
  .atm-row-tag { margin-left: 0.4rem; font-size: 0.64rem; font-weight: 700; color: var(--color-slate-600); background: var(--color-slate-100); border-radius: 999px; padding: 1px 7px; }
  .atm-row-summary { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--color-slate-800); line-height: 1.45; }
  .atm-row-actions { display: flex; gap: 0.2rem; flex-shrink: 0; }
  .atm-empty { margin: 0; padding: 0.9rem; text-align: center; font-size: 0.83rem; color: var(--color-slate-400); }

  .atm-form { border-top: 1px dashed var(--color-slate-200); padding-top: 0.9rem; display: flex; flex-direction: column; gap: 0.7rem; }
  .atm-form-title { font-size: 0.78rem; font-weight: 700; color: var(--color-slate-600); }
  .atm-form-row { display: flex; gap: 0.75rem; align-items: flex-start; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field--date { flex: 0 0 160px; }
  .field--source { flex: 1; }
  label { font-size: 0.76rem; font-weight: 600; color: var(--color-slate-600); }
  .hint { font-weight: 400; color: var(--color-slate-400); }

  input[type="date"], textarea {
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.83rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: var(--color-white);
    resize: vertical;
  }
  input:focus, textarea:focus { outline: none; border-color: var(--color-primary-600); box-shadow: 0 0 0 3px var(--focus-ring-blue); }

  .atm-source-toggle { display: flex; border: 1px solid var(--color-slate-200); border-radius: 8px; overflow: hidden; align-self: flex-start; }
  .atm-source-toggle button {
    display: flex; align-items: center; gap: 0.3rem; padding: 0.4rem 0.8rem;
    font-size: 0.78rem; font-weight: 500; color: var(--color-slate-500);
    background: var(--color-slate-50); border: none; cursor: pointer; font-family: inherit;
  }
  .atm-source-toggle button:not(:last-child) { border-right: 1px solid var(--color-slate-200); }
  .atm-source-toggle button.active { color: var(--color-primary-600); background: var(--color-primary-50); font-weight: 600; }

  .btn-generate {
    align-self: flex-start;
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.35rem 0.8rem; margin-top: 0.4rem;
    background: var(--color-primary-50); color: var(--color-primary-700);
    border: 1px solid var(--color-primary-200); border-radius: 6px;
    font-size: 0.76rem; font-weight: 600; font-family: inherit; cursor: pointer;
  }
  .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; }
  .mini-spinner {
    display: inline-block; width: 0.75rem; height: 0.75rem;
    border: 2px solid var(--color-primary-200); border-top-color: var(--color-primary-700);
    border-radius: 50%; animation: atm-spin 0.6s linear infinite;
  }
  @keyframes atm-spin { to { transform: rotate(360deg); } }

  .atm-error {
    font-size: 0.78rem; color: var(--color-red-600); background: var(--color-red-50);
    border: 1px solid var(--color-red-200); border-radius: 6px; padding: 0.5rem 0.7rem;
  }
  .atm-form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
