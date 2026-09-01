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

  import AdvancementEntryFields from '../AdvancementEntryFields.svelte';
  import AddKeyDateModal from '$lib/components/admin-console/AddKeyDateModal.svelte';

  export let show = false;
  export let title = '';
  export let items = [];
  export let onAdd; // (form) => Promise
  export let onUpdate; // (id, form) => Promise
  export let onDelete; // (id) => Promise
  export let onGenerate = null; // (fullText) => Promise<string>
  export let onClose = () => {};

  // Key dates owned directly by this row — same "direct key date" concept
  // the full-page tracker tabs already have, mirrored here.
  export let keyDates = []; // [{ id, title, date, colour }]
  export let onAddKeyDate = null; // (form) => Promise
  export let onUpdateKeyDate = null; // (id, form) => Promise
  export let onDeleteKeyDate = null; // (id) => Promise
  $: keyDatesEnabled = !!(onAddKeyDate && onUpdateKeyDate && onDeleteKeyDate);

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
  let showForm = false; // form is hidden by default — just the timeline + an "Add Advancement" button to reveal it

  $: if (show && !seeded) {
    resetForm();
    showForm = false;
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

  function openAddForm() {
    resetForm();
    showForm = true;
  }

  function startEdit(item) {
    editingId = item.id;
    formDate = item.date ? item.date.slice(0, 10) : '';
    formSourceType = item.sourceType || 'note';
    formFullText = item.fullText || '';
    formSummary = item.summary || '';
    error = null;
    showForm = true;
  }

  function cancelEdit() {
    resetForm();
    showForm = false;
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
      showForm = false;
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

  // ── Key dates ────────────────────────────────────────────────────────────
  let showKeyDateModal = false;
  let editingKeyDate = null; // null = adding new, row = editing existing
  let keyDateError = null;

  function openAddKeyDate() {
    editingKeyDate = null;
    keyDateError = null;
    showKeyDateModal = true;
  }

  function openEditKeyDate(kd) {
    editingKeyDate = kd;
    keyDateError = null;
    showKeyDateModal = true;
  }

  async function handleKeyDateSubmit(event) {
    const { data, isEdit } = event.detail;
    try {
      if (isEdit) {
        await onUpdateKeyDate(data.id, { title: data.title, date: data.date, colour: data.color });
      } else {
        await onAddKeyDate({ title: data.title, date: data.date, colour: data.color });
      }
    } catch (err) {
      keyDateError = err.message;
    }
    showKeyDateModal = false;
    editingKeyDate = null;
  }

  async function removeKeyDate(id) {
    if (!confirm('Delete this key date?')) return;
    try {
      await onDeleteKeyDate(id);
    } catch (err) {
      keyDateError = err.message;
    }
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
        {#if keyDatesEnabled}
          <div class="atm-keydates">
            <div class="atm-keydates-hd">
              <span class="atm-keydates-label"><i class="las la-calendar-alt"></i> Key Dates</span>
              <button class="atm-keydates-add" on:click={openAddKeyDate}>+ Add key date</button>
            </div>
            {#if keyDates.length}
              <div class="atm-keydates-list">
                {#each keyDates as kd (kd.id)}
                  <span class="atm-keydate" on:click={() => openEditKeyDate(kd)}>
                    {kd.title} - {formatDate(kd.date)}
                    <button class="atm-keydate-remove" title="Delete" on:click|stopPropagation={() => removeKeyDate(kd.id)}>
                      <i class="las la-times"></i>
                    </button>
                  </span>
                {/each}
              </div>
            {:else}
              <p class="atm-keydates-none">No key dates yet.</p>
            {/if}
            {#if keyDateError}<div class="atm-error">{keyDateError}</div>{/if}
          </div>
        {/if}

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

        {#if showForm}
          <div class="atm-form">
            <div class="atm-form-title">{editingId ? 'Edit entry' : 'Add entry'}</div>
            <AdvancementEntryFields
              bind:date={formDate}
              bind:fullText={formFullText}
              onGenerate={onGenerate ? generate : null}
              {generating}
              canGenerate={!!formFullText.trim()}
              generateLabel="Generate Summary"
              generateHint=""
              rows={3}
            />

            <div class="field">
              <label class="form-label">Summary <span class="atm-label-hint">saved exactly as typed</span></label>
              <textarea class="form-input" rows="2" bind:value={formSummary} placeholder="Write it yourself, or use Generate above to draft one from the source text."></textarea>
            </div>

            {#if error}<div class="atm-error">{error}</div>{/if}

            <div class="atm-form-actions">
              <button class="btn btn-secondary btn-sm" on:click={cancelEdit} disabled={saving}>Cancel</button>
              <button class="btn btn-primary btn-sm" on:click={save} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add entry'}
              </button>
            </div>
          </div>
        {:else}
          <button class="btn btn-primary btn-sm atm-add-btn" on:click={openAddForm}>
            <i class="las la-plus"></i> Add Advancement
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if keyDatesEnabled}
  <AddKeyDateModal
    bind:show={showKeyDateModal}
    type="tracker-row"
    typeLabel="Key Date"
    existingDate={editingKeyDate}
    on:submit={handleKeyDateSubmit}
    on:close={() => { showKeyDateModal = false; editingKeyDate = null; }}
  />
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

  .atm-keydates { border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 0.65rem 0.75rem; background: var(--color-slate-50); }
  .atm-keydates-hd { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .atm-keydates-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-slate-500); display: flex; align-items: center; gap: 0.3rem; }
  .atm-keydates-add { font-size: 0.72rem; color: var(--color-primary-500); background: none; border: none; padding: 0; cursor: pointer; text-decoration: underline; }
  .atm-keydates-none { margin: 0.4rem 0 0; font-size: 0.76rem; color: var(--color-slate-400); }
  .atm-keydates-list { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-top: 0.4rem; font-size: 0.72rem; }
  .atm-keydate {
    display: inline-flex; align-items: center; gap: 0.3rem; background: var(--color-red-50); border: 1px solid var(--color-amber-200);
    color: var(--color-amber-800); border-radius: 6px; padding: 1px 7px; cursor: pointer;
  }
  .atm-keydate-remove { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: none; background: none; padding: 0; color: inherit; opacity: 0.6; cursor: pointer; font-size: 0.65rem; }
  .atm-keydate-remove:hover { opacity: 1; }

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
  .atm-add-btn { align-self: flex-start; }
  .atm-form-title { font-size: 0.78rem; font-weight: 700; color: var(--color-slate-600); }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .atm-label-hint { font-size: 0.72rem; font-weight: 400; color: var(--color-slate-400); margin-left: 0.3rem; }

  .atm-error {
    font-size: 0.78rem; color: var(--color-red-600); background: var(--color-red-50);
    border: 1px solid var(--color-red-200); border-radius: 6px; padding: 0.5rem 0.7rem;
  }
  .atm-form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
