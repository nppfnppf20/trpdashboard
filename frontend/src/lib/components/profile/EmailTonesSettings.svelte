<script>
  import { onMount } from 'svelte';
  import { getEmailTones, createEmailTone, updateEmailTone, deleteEmailTone } from '$lib/api/emailTones.js';

  export let onClose = () => {};

  let tones = [];
  let loading = true;
  let error = null;

  let formOpen = false;
  let editingId = null; // null while adding, tone id while editing
  let formLabel = '';
  let formSampleText = '';
  let formGuidanceNotes = '';
  let formIsDefault = false;
  let saving = false;
  let formError = null;

  let confirmDeleteId = null;

  onMount(load);

  async function load() {
    loading = true;
    error = null;
    try {
      tones = await getEmailTones();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openAdd() {
    editingId = null;
    formLabel = '';
    formSampleText = '';
    formGuidanceNotes = '';
    formIsDefault = tones.length === 0;
    formError = null;
    formOpen = true;
  }

  function openEdit(tone) {
    editingId = tone.id;
    formLabel = tone.label;
    formSampleText = tone.sample_text;
    formGuidanceNotes = tone.guidance_notes ?? '';
    formIsDefault = tone.is_default;
    formError = null;
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
  }

  async function save() {
    if (!formLabel.trim() || !formSampleText.trim()) {
      formError = 'Give the tone a name and at least one example email.';
      return;
    }
    saving = true;
    formError = null;
    try {
      const payload = {
        label: formLabel.trim(),
        sampleText: formSampleText.trim(),
        guidanceNotes: formGuidanceNotes.trim(),
        isDefault: formIsDefault,
      };
      if (editingId == null) {
        const created = await createEmailTone(payload);
        tones = formIsDefault ? [...tones.map(t => ({ ...t, is_default: false })), created] : [...tones, created];
      } else {
        const updated = await updateEmailTone(editingId, payload);
        tones = tones.map(t => {
          if (t.id === editingId) return updated;
          return formIsDefault ? { ...t, is_default: false } : t;
        });
      }
      formOpen = false;
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function setDefault(tone) {
    if (tone.is_default) return;
    try {
      const updated = await updateEmailTone(tone.id, { isDefault: true });
      tones = tones.map(t => (t.id === updated.id ? updated : { ...t, is_default: false }));
    } catch (err) {
      error = err.message;
    }
  }

  async function confirmDelete(id) {
    try {
      await deleteEmailTone(id);
      tones = tones.filter(t => t.id !== id);
    } catch (err) {
      error = err.message;
    } finally {
      confirmDeleteId = null;
    }
  }

  const truncate = (text, n = 140) => (text.length > n ? `${text.slice(0, n).trim()}…` : text);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="etl-backdrop" on:click={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="etl-modal">
    <div class="etl-head">
      <h2><i class="las la-signature"></i> Email Tones</h2>
      <button class="ets-close-btn" on:click={onClose}><i class="las la-times"></i></button>
    </div>

    <p class="ets-hint">
      Saved tones let you tell the project chat's Email picker how to write in your voice — paste one or more emails
      you've actually sent as examples. Your default tone is used automatically; add more to switch between them.
    </p>

    <button class="ets-add-btn" on:click={openAdd}>
      <i class="las la-plus"></i> Add tone
    </button>

    <div class="etl-body">
      {#if loading}
        <div class="ets-loading"><i class="las la-spinner la-spin"></i> Loading tones…</div>
      {:else if error}
        <div class="ets-error">{error}</div>
      {:else if !tones.length}
        <div class="ets-empty">No tones yet. Add one to start using the Email picker in project chat.</div>
      {:else}
        <div class="ets-list">
          {#each tones as tone (tone.id)}
            <div class="ets-row">
              <button
                class="ets-star"
                class:ets-star-active={tone.is_default}
                title={tone.is_default ? 'Default tone' : 'Set as default'}
                on:click={() => setDefault(tone)}
              >
                <i class="{tone.is_default ? 'las' : 'lar'} la-star"></i>
              </button>
              <div class="ets-row-main">
                <div class="ets-row-label">
                  {tone.label}
                  {#if tone.is_default}<span class="badge badge-neutral ets-default-badge">Default</span>{/if}
                  {#if tone.guidance_notes?.trim()}<i class="las la-list-ul ets-guidance-icon" title="Has instructions: {tone.guidance_notes}"></i>{/if}
                </div>
                <div class="ets-row-preview">{truncate(tone.sample_text)}</div>
              </div>
              <div class="ets-row-actions">
                {#if confirmDeleteId === tone.id}
                  <span class="ets-confirm">
                    Delete?
                    <button class="ets-confirm-yes" on:click={() => confirmDelete(tone.id)}>Yes</button>
                    <button class="ets-confirm-no" on:click={() => (confirmDeleteId = null)}>No</button>
                  </span>
                {:else}
                  <button class="ets-icon-btn" title="Edit" on:click={() => openEdit(tone)}><i class="las la-edit"></i></button>
                  <button class="ets-icon-btn ets-icon-btn-danger" title="Delete" on:click={() => (confirmDeleteId = tone.id)}><i class="las la-trash"></i></button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if formOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="ets-modal-backdrop" on:click={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
    <div class="ets-modal">
      <div class="ets-modal-head">
        <h2>{editingId == null ? 'Add Email Tone' : 'Edit Email Tone'}</h2>
        <button class="ets-close-btn" on:click={closeForm}><i class="las la-times"></i></button>
      </div>

      {#if formError}<div class="ets-modal-error">{formError}</div>{/if}

      <div class="ets-modal-field">
        <label for="ets-label">Name</label>
        <input id="ets-label" type="text" bind:value={formLabel} placeholder="e.g. Formal, Client-facing" />
      </div>

      <div class="ets-modal-field ets-modal-field-grow">
        <label for="ets-sample">Example emails</label>
        <p class="ets-modal-help">Paste one or more emails you've actually sent. The more examples, the better the model can match your voice.</p>
        <textarea id="ets-sample" bind:value={formSampleText} placeholder="Paste example email(s) here…"></textarea>
      </div>

      <div class="ets-modal-field">
        <label for="ets-guidance">Instructions (optional)</label>
        <p class="ets-modal-help">Plain instructions to follow every time this tone is used, e.g. "no em dashes", "always sign off with Kind regards".</p>
        <textarea id="ets-guidance" class="ets-guidance-textarea" bind:value={formGuidanceNotes} placeholder="e.g. No em dashes. Keep it under 150 words. Sign off with 'Many thanks'."></textarea>
      </div>

      <label class="ets-default-check">
        <input type="checkbox" bind:checked={formIsDefault} />
        <span>Use as my default tone</span>
      </label>

      <div class="ets-modal-footer">
        <button class="btn-secondary" on:click={closeForm} disabled={saving}>Cancel</button>
        <button class="btn-primary" on:click={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Outer modal — the tone list ── */
  .etl-backdrop {
    position: fixed; inset: 0; background: var(--overlay-bg);
    display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;
  }

  .etl-modal {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    width: 480px;
    max-width: 96vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-modal);
    padding: 1.25rem 1.5rem;
    gap: 0.75rem;
  }

  .etl-head { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .etl-head h2 {
    margin: 0; font-size: 1.05rem; color: var(--color-slate-800);
    display: flex; align-items: center; gap: 0.4rem;
  }

  .etl-body { flex: 1; min-height: 0; overflow-y: auto; }

  .ets-hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--color-slate-500);
    line-height: 1.5;
    flex-shrink: 0;
  }

  .ets-add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-primary-200);
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
    width: fit-content;
  }
  .ets-add-btn:hover { background: var(--color-primary-100); }

  .ets-loading, .ets-empty {
    padding: 1rem;
    text-align: center;
    color: var(--color-slate-400);
    font-size: 0.85rem;
  }

  .ets-error {
    padding: 0.6rem 0.75rem;
    background: var(--color-red-50);
    color: var(--color-red-600);
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .ets-list { display: flex; flex-direction: column; gap: 0.4rem; }

  .ets-row {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
  }

  .ets-star {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--color-slate-300);
    font-size: 1.1rem;
    flex-shrink: 0;
    line-height: 1;
  }
  .ets-star-active { color: var(--color-badge-warning-fg); }

  .ets-row-main { flex: 1; min-width: 0; }
  .ets-row-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  .ets-default-badge { font-size: 0.65rem; padding: 0.05rem 0.4rem; }
  .ets-guidance-icon { font-size: 0.75rem; color: var(--color-slate-400); }
  .ets-row-preview {
    margin-top: 0.2rem;
    font-size: 0.78rem;
    color: var(--color-slate-500);
    line-height: 1.4;
  }

  .ets-row-actions { display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0; }
  .ets-icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 6px;
    border: 1px solid var(--color-slate-200); background: var(--color-white);
    color: var(--color-slate-500); cursor: pointer; font-size: 0.8rem;
  }
  .ets-icon-btn:hover { background: var(--color-slate-50); color: var(--color-slate-800); }
  .ets-icon-btn-danger:hover { background: var(--color-red-50); color: var(--color-red-600); border-color: var(--color-red-200); }

  .ets-confirm { display: flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; color: var(--color-red-600); white-space: nowrap; }
  .ets-confirm-yes { padding: 0.15rem 0.45rem; background: var(--color-red-600); color: white; border: none; border-radius: 4px; font-size: 0.72rem; cursor: pointer; }
  .ets-confirm-no { padding: 0.15rem 0.45rem; background: var(--color-slate-100); color: var(--color-slate-700); border: 1px solid var(--color-slate-200); border-radius: 4px; font-size: 0.72rem; cursor: pointer; }

  /* ── Add/edit modal (stacks above the list modal) ── */
  .ets-modal-backdrop {
    position: fixed; inset: 0; background: var(--overlay-bg);
    display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem;
  }
  .ets-modal {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    width: 640px;
    max-width: 96vw;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-modal);
    padding: 1.25rem 1.5rem;
    gap: 0.9rem;
  }
  .ets-modal-head { display: flex; align-items: center; justify-content: space-between; }
  .ets-modal-head h2 { margin: 0; font-size: 1.05rem; color: var(--color-slate-800); }
  .ets-close-btn { background: none; border: none; font-size: 1.2rem; color: var(--color-slate-500); cursor: pointer; }
  .ets-close-btn:hover { color: var(--color-slate-800); }

  .ets-modal-error {
    padding: 0.6rem 0.75rem; background: var(--color-red-50); color: var(--color-red-600);
    border-radius: 6px; font-size: 0.85rem;
  }

  .ets-modal-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .ets-modal-field-grow { flex: 1; min-height: 0; }
  .ets-modal-field label { font-size: 0.8rem; font-weight: 600; color: var(--color-slate-700); }
  .ets-modal-help { margin: 0; font-size: 0.75rem; color: var(--color-slate-500); }
  .ets-modal-field input {
    padding: 0.5rem 0.65rem; border: 1px solid var(--color-slate-300); border-radius: 6px;
    font-size: 0.875rem; font-family: inherit;
  }
  .ets-modal-field input:focus { outline: none; border-color: var(--color-primary-500); box-shadow: var(--focus-ring-blue); }
  .ets-modal-field textarea {
    flex: 1; min-height: 220px; resize: vertical;
    padding: 0.6rem 0.7rem; border: 1px solid var(--color-slate-300); border-radius: 6px;
    font-size: 0.85rem; font-family: inherit; line-height: 1.5;
  }
  .ets-modal-field textarea:focus { outline: none; border-color: var(--color-primary-500); box-shadow: var(--focus-ring-blue); }
  .ets-guidance-textarea { min-height: 70px; flex: none; }

  .ets-default-check {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.83rem; color: var(--color-slate-700); cursor: pointer;
  }

  .ets-modal-footer { display: flex; justify-content: flex-end; gap: 0.6rem; }
  .btn-primary { padding: 0.5rem 1.1rem; background: var(--color-primary-600); color: white; border: none; border-radius: 6px; font-size: 0.85rem; font-weight: 500; cursor: pointer; }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-700); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { padding: 0.5rem 1.1rem; background: var(--color-white); color: var(--color-slate-700); border: 1px solid var(--color-slate-300); border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
  .btn-secondary:hover:not(:disabled) { background: var(--color-slate-50); }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
