<script>
  // The workbook's own meeting notes: paste text or drop a file, keep it with the workbook, and optionally go
  // straight on to Add advancement with it. Separate from the main Meeting Notes feature.
  import { onMount } from 'svelte';
  import { listWorkbookNotes, getWorkbookNote, createWorkbookNote, deleteWorkbookNote } from '$lib/api/workbook.js';
  import { SOURCES, today, fmtLong } from './workbookUtils.js';

  export let projectId;
  export let onClose = () => {};
  export let onDraft = () => {};   // (note) - open Add advancement with this saved note

  let notes = [];
  let loading = true;
  let saving = false;
  let error = null;
  let mode = 'paste';        // 'paste' | 'upload'
  let title = '';
  let noteDate = today();
  let source = 'Meeting notes';
  let pasteText = '';
  let file = null;
  let dragOver = false;
  let fileInput;
  let armedId = null;

  onMount(load);

  async function load() {
    loading = true;
    try {
      notes = (await listWorkbookNotes(projectId)).notes;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function pick(e) { file = e.target.files[0] || null; }
  function drop(e) {
    e.preventDefault();
    dragOver = false;
    const f = e.dataTransfer.files[0];
    if (f) { file = f; mode = 'upload'; }
  }

  async function save(thenDraft) {
    if (mode === 'paste' && !pasteText.trim()) { error = 'Paste some text first.'; return; }
    if (mode === 'upload' && !file) { error = 'Choose a file first.'; return; }
    saving = true;
    error = null;
    try {
      const note = await createWorkbookNote(projectId, {
        text: mode === 'paste' ? pasteText : '',
        file: mode === 'upload' ? file : null,
        title: title.trim(),
        date: noteDate,
        source,
      });
      if (thenDraft) { onDraft(note); return; }
      pasteText = ''; file = null; title = '';
      await load();
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  async function draftFrom(n) {
    try {
      onDraft(await getWorkbookNote(n.id));
    } catch (err) {
      error = err.message;
    }
  }

  function arm(id) {
    if (armedId === id) { armedId = null; remove(id); return; }
    armedId = id;
    setTimeout(() => { if (armedId === id) armedId = null; }, 3000);
  }
  async function remove(id) {
    try {
      await deleteWorkbookNote(id);
      notes = notes.filter(n => n.id !== id);
    } catch (err) {
      error = err.message;
    }
  }
  function onKey(e) { if (e.key === 'Escape' && !saving) onClose(); }
</script>

<svelte:window on:keydown={onKey} />

<div class="wm-backdrop" on:click|self={() => !saving && onClose()} role="presentation">
  <div class="wm-modal" role="dialog" aria-modal="true" aria-label="Meeting notes">
    <div class="wm-head">
      <div>
        <div class="wm-eyebrow">Project Workbook</div>
        <h2>Meeting notes</h2>
      </div>
      <button class="btn btn-secondary btn-sm" on:click={onClose} disabled={saving}>Close</button>
    </div>

    <div class="wm-body">
      <section class="wm-new">
        <div class="wm-tabs">
          <button class="wm-tab" class:active={mode === 'paste'} on:click={() => (mode = 'paste')}>Paste text</button>
          <button class="wm-tab" class:active={mode === 'upload'} on:click={() => (mode = 'upload')}>Upload a file</button>
        </div>

        <div class="wm-three">
          <label class="wm-field"><span class="form-label">Title</span><input class="form-input" bind:value={title} placeholder="e.g. Client call"></label>
          <label class="wm-field"><span class="form-label">Date</span><input class="form-input" type="date" bind:value={noteDate}></label>
          <label class="wm-field"><span class="form-label">Source</span>
            <select class="form-input" bind:value={source}>{#each SOURCES as s (s)}<option value={s}>{s}</option>{/each}</select>
          </label>
        </div>

        {#if mode === 'paste'}
          <textarea class="form-input wm-text" rows="8" bind:value={pasteText} placeholder="Paste meeting notes, an email or a transcript"></textarea>
        {:else}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="wm-drop" class:over={dragOver} on:dragover|preventDefault={() => (dragOver = true)} on:dragleave={() => (dragOver = false)} on:drop={drop}>
            {#if file}
              <strong>{file.name}</strong>
              <button class="btn btn-secondary btn-sm" on:click={() => { file = null; if (fileInput) fileInput.value = ''; }}>Remove</button>
            {:else}
              Drop a .docx, .pdf, .txt or .md file here, or
              <button class="btn btn-secondary btn-sm" on:click={() => fileInput.click()}>Choose a file</button>
            {/if}
            <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt,.md" on:change={pick} hidden>
          </div>
        {/if}

        {#if error}<div class="wm-error">{error}</div>{/if}

        <div class="wm-actions">
          <button class="btn btn-secondary btn-sm" on:click={() => save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button>
          <button class="btn btn-primary btn-sm" on:click={() => save(true)} disabled={saving}>Save and draft updates</button>
        </div>
      </section>

      <section>
        <div class="wm-list-title">Saved notes</div>
        {#if loading}
          <div class="wm-empty">Loading…</div>
        {:else if !notes.length}
          <div class="wm-empty">No notes saved on this workbook yet.</div>
        {:else}
          {#each notes as n (n.id)}
            <div class="wm-note">
              <div class="wm-note-head">
                <strong>{n.title}</strong>
                <span class="wm-meta">{fmtLong(n.note_date)} · {n.source}</span>
                <span class="wm-grow"></span>
                <button class="btn btn-secondary btn-sm" on:click={() => draftFrom(n)}>Draft updates</button>
                <button class="wm-del" class:armed={armedId === n.id} on:click={() => arm(n.id)}>{armedId === n.id ? 'Sure?' : 'Delete'}</button>
              </div>
              <p>{n.preview}{n.length > 240 ? '…' : ''}</p>
            </div>
          {/each}
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .wm-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
  .wm-modal { background: var(--color-white); border-radius: var(--radius-lg); width: min(42rem, 100%); max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-modal); overflow: hidden; }
  .wm-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-slate-200); }
  .wm-head h2 { margin: 0.125rem 0 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .wm-eyebrow { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); }
  .wm-body { padding: 1rem 1.25rem 1.25rem; overflow: auto; display: flex; flex-direction: column; gap: 1.25rem; }
  .wm-new { display: flex; flex-direction: column; gap: 0.75rem; }
  .wm-tabs { display: flex; gap: 0.25rem; }
  .wm-tab { background: var(--color-slate-50); border: 1px solid var(--color-slate-200); border-radius: var(--radius-pill); padding: 0.25rem 0.875rem; font-family: inherit; font-size: 0.78rem; font-weight: 500; color: var(--color-slate-500); cursor: pointer; }
  .wm-tab.active { background: var(--color-primary-50); border-color: var(--color-primary-200); color: var(--color-primary-700); font-weight: 600; }
  .wm-three { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.625rem; }
  .wm-field { display: flex; flex-direction: column; }
  .wm-text { min-height: 9rem; }
  .wm-drop { border: 2px dashed var(--color-slate-300); border-radius: var(--radius-md); padding: 1.5rem; text-align: center; color: var(--color-slate-500); font-size: 0.85rem; display: flex; gap: 0.625rem; align-items: center; justify-content: center; flex-wrap: wrap; }
  .wm-drop.over { border-color: var(--color-primary-500); background: var(--color-primary-50); }
  .wm-error { font-size: 0.8rem; color: var(--color-red-600); background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; }
  .wm-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  .wm-list-title { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); margin-bottom: 0.5rem; }
  .wm-empty { color: var(--color-slate-500); font-size: 0.85rem; padding: 0.5rem 0; }
  .wm-note { border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: 0.625rem 0.75rem; margin-bottom: 0.5rem; }
  .wm-note-head { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; }
  .wm-meta { font-size: 0.75rem; color: var(--color-slate-500); }
  .wm-grow { flex: 1; }
  .wm-note p { margin: 0.375rem 0 0; font-size: 0.8125rem; color: var(--color-slate-600); line-height: 1.45; }
  .wm-del { background: none; border: none; padding: 0.125rem; font-family: inherit; font-size: 0.6875rem; color: var(--color-slate-400); text-decoration: underline; cursor: pointer; }
  .wm-del.armed { color: var(--color-red-600); }
  @media (max-width: 36rem) { .wm-three { grid-template-columns: 1fr; } }
</style>
