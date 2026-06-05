<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import {
    getStartingDocs,
    upsertStartingDocText,
    upsertStartingDocFile,
    deleteStartingDoc as apiDeleteStartingDoc,
    getDraftContext,
    getBriefingNotes,
    uploadBriefingNote,
  } from '$lib/api/appeal.js';

  export let project;
  export let typeId;   // e.g. 'appeal_1'
  export let typeSlug; // e.g. 'statement_of_case'
  export let typeName; // e.g. 'Statement of Case'

  const dispatch = createEventDispatcher();

  const rawTypeId = parseInt(typeId.replace('appeal_', ''), 10);

  // Hardcoded slot definitions per draft type slug
  const SLOT_DEFS = {
    statement_of_case: [
      { slug: 'decision_notice',    label: 'Decision Notice',    variable: '{{DECISION_NOTICE}}' },
      { slug: 'officers_report',    label: "Officer's Report",   variable: '{{OFFICERS_REPORT}}' },
      { slug: 'planning_statement', label: 'Planning Statement', variable: '{{PLANNING_STATEMENT}}' },
    ],
    statement_of_common_ground: [
      { slug: 'decision_notice',    label: 'Decision Notice',    variable: '{{DECISION_NOTICE}}' },
      { slug: 'officers_report',    label: "Officer's Report",   variable: '{{OFFICERS_REPORT}}' },
      { slug: 'planning_statement', label: 'Planning Statement', variable: '{{PLANNING_STATEMENT}}' },
      { slug: 'committee_report',   label: 'Committee Report',   variable: '{{COMMITTEE_REPORT}}' },
      { slug: 'committee_minutes',  label: 'Committee Minutes',  variable: '{{COMMITTEE_MINUTES}}' },
    ],
  };

  const OTHER_SLOT = { slug: 'other', label: 'Other Documents', variable: '{{OTHER_DOCS}}' };

  $: namedSlots = SLOT_DEFS[typeSlug] ?? [];
  $: allSlots = [...namedSlots, OTHER_SLOT];

  // Per-slot state: { content_text, file_name, saving, uploading, fileInput }
  let slotState = {};
  let loading = true;
  let fileInputs = {};

  // Briefing note multi-select
  let briefingNotes = [];
  let selectedNoteIds = new Set();
  let briefingNotesSaving = false;
  let briefingUploading = false;
  let briefingFileInput;
  let pasteOpen = false;
  let pasteText = '';
  let pasteTitle = '';

  // Baseline context chars: prompt template overhead + guiding brief + project brief
  // Fetched on mount so the bar starts at the real baseline, not zero.
  let baselineChars = 1500; // rough prompt template overhead

  function initSlotState() {
    slotState = Object.fromEntries(allSlots.map(s => [s.slug, {
      content_text: '',
      file_name: null,
      saving: false,
      uploading: false,
    }]));
  }

  onMount(async () => {
    initSlotState();
    try {
      const [rows, ctx, notes] = await Promise.all([
        getStartingDocs(project.id, rawTypeId),
        getDraftContext(project.id, rawTypeId).catch(() => null),
        getBriefingNotes(project.id).catch(() => []),
      ]);
      briefingNotes = notes;
      for (const row of rows) {
        if (slotState[row.slot_slug] !== undefined) {
          slotState[row.slot_slug].content_text = row.content_text;
          slotState[row.slot_slug].file_name = row.file_name;
        }
      }
      // Load saved briefing note selection
      const sel = rows.find(r => r.slot_slug === 'briefing_notes');
      if (sel?.content_text) {
        try {
          const ids = JSON.parse(sel.content_text);
          selectedNoteIds = new Set(ids);
        } catch { /* ignore malformed */ }
      }
      if (ctx) {
        if (ctx.guidingBrief?.content) baselineChars += ctx.guidingBrief.content.length;
        if (ctx.projectBrief) baselineChars += ctx.projectBrief.replace(/<[^>]+>/g, '').length;
      }
    } catch (err) {
      console.error('Failed to load starting docs:', err);
    } finally {
      loading = false;
    }
  });

  async function toggleNote(id) {
    const next = new Set(selectedNoteIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedNoteIds = next;
    briefingNotesSaving = true;
    try {
      await upsertStartingDocText(project.id, rawTypeId, 'briefing_notes', JSON.stringify([...next]));
    } catch (err) {
      console.error('Failed to save briefing note selection:', err);
    } finally {
      briefingNotesSaving = false;
    }
  }

  async function handleBriefingUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    briefingUploading = true;
    try {
      const note = await uploadBriefingNote(project.id, { file, title: file.name.replace(/\.[^.]+$/, '') });
      briefingNotes = [...briefingNotes, note];
      await toggleNote(note.id);
    } catch (err) {
      console.error('Failed to upload briefing note:', err);
    } finally {
      briefingUploading = false;
      if (briefingFileInput) briefingFileInput.value = '';
    }
  }

  async function handleBriefingPaste() {
    if (!pasteText.trim()) return;
    briefingUploading = true;
    try {
      const note = await uploadBriefingNote(project.id, { text: pasteText.trim(), title: pasteTitle.trim() || 'Briefing note' });
      briefingNotes = [...briefingNotes, note];
      await toggleNote(note.id);
      pasteText = '';
      pasteTitle = '';
      pasteOpen = false;
    } catch (err) {
      console.error('Failed to save briefing note:', err);
    } finally {
      briefingUploading = false;
    }
  }

  async function handleBlur(slug) {
    const st = slotState[slug];
    if (st.saving) return;
    st.saving = true;
    slotState = slotState;
    try {
      const saved = await upsertStartingDocText(project.id, rawTypeId, slug, st.content_text);
      slotState[slug].file_name = saved.file_name;
    } catch (err) {
      console.error('Failed to save starting doc:', err);
    } finally {
      slotState[slug].saving = false;
      slotState = slotState;
    }
  }

  async function handleFileChange(slug, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    slotState[slug].uploading = true;
    slotState = slotState;
    try {
      const saved = await upsertStartingDocFile(project.id, rawTypeId, slug, file);
      slotState[slug].content_text = saved.content_text;
      slotState[slug].file_name = saved.file_name;
    } catch (err) {
      console.error('Failed to upload starting doc:', err);
    } finally {
      slotState[slug].uploading = false;
      slotState = slotState;
      // Reset file input
      if (fileInputs[slug]) fileInputs[slug].value = '';
    }
  }

  async function handleRemove(slug) {
    slotState[slug].saving = true;
    slotState = slotState;
    try {
      await apiDeleteStartingDoc(project.id, rawTypeId, slug);
      slotState[slug].content_text = '';
      slotState[slug].file_name = null;
    } catch (err) {
      console.error('Failed to remove starting doc:', err);
    } finally {
      slotState[slug].saving = false;
      slotState = slotState;
    }
  }

  // Context % — baseline (prompt + guiding brief + project brief) + uploaded docs, out of 200 000 chars
  $: docsChars = Object.values(slotState).reduce((acc, st) => acc + (st.content_text?.length ?? 0), 0);
  $: totalChars = baselineChars + docsChars;
  $: contextPct = Math.min(100, Math.round(totalChars / 200000 * 100));
  $: contextColour = contextPct >= 75 ? '#dc2626' : contextPct >= 50 ? '#d97706' : '#16a34a';
</script>

<div class="modal-overlay" on:click|self={() => dispatch('close')} role="dialog" aria-modal="true">
  <div class="modal modal-starting-docs">
    <div class="modal-header">
      <span class="modal-title">Starting Documents — {typeName}</span>
      <button class="modal-close" on:click={() => dispatch('close')}><i class="las la-times"></i></button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="sd-loading"><div class="spinner"></div><span>Loading...</span></div>
      {:else}
        <p class="sd-intro">
          Paste or upload source documents for this draft type. They are injected into the generation prompt via the variables shown below.
          Documents without a matching variable in the prompt are appended automatically.
        </p>

        <!-- Briefing notes multi-select -->
        <div class="sd-briefing-section">
          <div class="sd-briefing-header">
            <div class="sd-briefing-title-row">
              <span class="sd-section-label">Project Briefing Notes</span>
              <code class="sd-var-badge">{'{{BRIEFING_NOTES}}'}</code>
            </div>
            <div class="sd-briefing-actions">
              {#if briefingNotesSaving || briefingUploading}
                <div class="mini-spinner"></div>
              {/if}
              <button class="sd-briefing-add-btn" on:click={() => { pasteOpen = !pasteOpen; }} disabled={briefingUploading}>
                <i class="las la-paste"></i> Paste
              </button>
              <label class="sd-briefing-add-btn" title="Upload a briefing note (PDF, TXT or MD)">
                {#if briefingUploading}
                  <div class="mini-spinner"></div>
                {:else}
                  <i class="las la-file-upload"></i> Upload
                {/if}
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  style="display:none"
                  bind:this={briefingFileInput}
                  on:change={handleBriefingUpload}
                  disabled={briefingUploading}
                />
              </label>
            </div>
          </div>

          {#if pasteOpen}
            <div class="sd-paste-form">
              <input class="sd-paste-title" type="text" placeholder="Title (optional)" bind:value={pasteTitle} disabled={briefingUploading} />
              <textarea class="sd-paste-textarea" placeholder="Paste briefing note text here..." bind:value={pasteText} disabled={briefingUploading}></textarea>
              <div class="sd-paste-actions">
                <button class="sd-paste-submit" on:click={handleBriefingPaste} disabled={briefingUploading || !pasteText.trim()}>
                  {#if briefingUploading}<div class="mini-spinner"></div> Saving...{:else}Save note{/if}
                </button>
                <button class="sd-paste-cancel" on:click={() => { pasteOpen = false; pasteText = ''; pasteTitle = ''; }}>Cancel</button>
              </div>
            </div>
          {/if}

          {#if briefingNotes.length === 0 && !pasteOpen}
            <p class="sd-briefing-empty">No briefing notes yet — paste or upload one using the buttons above.</p>
          {:else}
            <p class="sd-briefing-desc">Select meeting notes to inject as project-specific context. Multiple notes can be selected.</p>
            <div class="sd-briefing-list">
              {#each briefingNotes as note (note.id)}
                <label class="sd-briefing-item" class:sd-briefing-item--checked={selectedNoteIds.has(note.id)}>
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.has(note.id)}
                    on:change={() => toggleNote(note.id)}
                    disabled={briefingNotesSaving || briefingUploading}
                  />
                  <span class="sd-briefing-name">{note.title || note.file_name || `Briefing note ${note.id}`}</span>
                  <span class="sd-briefing-date">{new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>

        <div class="sd-grid">
          {#each allSlots as slot (slot.slug)}
            {@const st = slotState[slot.slug]}
            <div class="sd-card" class:sd-card--filled={!!st?.content_text}>
              <div class="sd-card-header">
                <span class="sd-card-label">{slot.label}</span>
                <code class="sd-var-badge">{slot.variable}</code>
              </div>

              {#if st?.file_name}
                <span class="sd-file-name"><i class="las la-file-alt"></i> {st.file_name}</span>
              {/if}

              <textarea
                class="sd-textarea"
                placeholder="Paste document text here..."
                value={st?.content_text ?? ''}
                on:input={(e) => { slotState[slot.slug].content_text = e.target.value; slotState = slotState; }}
                on:blur={() => handleBlur(slot.slug)}
                disabled={st?.uploading}
              ></textarea>

              <div class="sd-card-actions">
                <label class="sd-upload-btn" title="Upload file">
                  {#if st?.uploading}
                    <div class="mini-spinner"></div> Parsing...
                  {:else}
                    <i class="las la-file-upload"></i> Upload
                  {/if}
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    style="display:none"
                    bind:this={fileInputs[slot.slug]}
                    on:change={(e) => handleFileChange(slot.slug, e)}
                    disabled={st?.uploading}
                  />
                </label>
                {#if st?.content_text || st?.file_name}
                  <button
                    class="sd-remove-btn"
                    disabled={st?.saving || st?.uploading}
                    on:click={() => handleRemove(slot.slug)}
                    title="Remove"
                  >
                    {#if st?.saving}<div class="mini-spinner"></div>{:else}<i class="las la-trash"></i>{/if}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <div class="sd-context-bar">
          <span class="sd-context-label">~{contextPct}% of context window used (prompt + guiding brief + project brief + documents)</span>
          <div class="sd-context-track">
            <div class="sd-context-fill" style="width:{contextPct}%; background:{contextColour}"></div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
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
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }

  .modal-starting-docs { max-width: 780px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: #1e293b; }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    border-radius: 4px;
    font-size: 1.1rem;
  }
  .modal-close:hover { background: #f1f5f9; color: #374151; }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sd-loading {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    color: #64748b;
    font-size: 0.875rem;
    padding: 2rem 0;
    justify-content: center;
  }

  .sd-intro {
    margin: 0;
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.5;
  }

  .sd-briefing-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.875rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fafafa;
  }

  .sd-briefing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sd-briefing-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sd-section-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .sd-briefing-add-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.775rem;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .sd-briefing-add-btn:hover:not(:disabled) { background: #f1f5f9; }
  .sd-briefing-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .sd-paste-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .sd-paste-title {
    padding: 0.4rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #374151;
    background: white;
  }
  .sd-paste-title:focus { outline: none; border-color: #7c3aed; }

  .sd-paste-textarea {
    min-height: 120px;
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #374151;
    background: white;
    resize: vertical;
    line-height: 1.5;
  }
  .sd-paste-textarea:focus { outline: none; border-color: #7c3aed; }

  .sd-paste-actions {
    display: flex;
    gap: 0.5rem;
  }

  .sd-paste-submit {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.875rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .sd-paste-submit:hover:not(:disabled) { background: #6d28d9; }
  .sd-paste-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .sd-paste-cancel {
    padding: 0.4rem 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #64748b;
    cursor: pointer;
  }
  .sd-paste-cancel:hover { background: #f1f5f9; }

  .sd-briefing-desc, .sd-briefing-empty {
    margin: 0;
    font-size: 0.8rem;
    color: #64748b;
    line-height: 1.5;
  }

  .sd-briefing-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .sd-briefing-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    font-size: 0.8125rem;
    color: #374151;
  }

  .sd-briefing-item:hover { background: #f8fafc; }

  .sd-briefing-item--checked {
    border-color: #a78bfa;
    background: #f5f3ff;
  }

  .sd-briefing-item input[type="checkbox"] {
    flex-shrink: 0;
    accent-color: #7c3aed;
    cursor: pointer;
  }

  .sd-briefing-name {
    flex: 1;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sd-briefing-date {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .sd-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .sd-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.875rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fafafa;
    transition: border-color 0.15s;
  }

  .sd-card--filled {
    border-color: #c4b5fd;
    background: #faf5ff;
  }

  .sd-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .sd-card-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .sd-var-badge {
    font-size: 0.65rem;
    color: #7c3aed;
    background: #ede9fe;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    white-space: nowrap;
    font-family: monospace;
    flex-shrink: 0;
  }

  .sd-file-name {
    font-size: 0.75rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .sd-textarea {
    width: 100%;
    min-height: 100px;
    max-height: 200px;
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #374151;
    background: white;
    resize: vertical;
    line-height: 1.5;
    box-sizing: border-box;
  }
  .sd-textarea:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.08); }
  .sd-textarea::placeholder { color: #94a3b8; }
  .sd-textarea:disabled { background: #f8fafc; cursor: not-allowed; }

  .sd-card-actions {
    display: flex;
    gap: 0.375rem;
    align-items: center;
  }

  .sd-upload-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.625rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.775rem;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .sd-upload-btn:hover { background: #f1f5f9; }

  .sd-remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem 0.5rem;
    background: white;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #ef4444;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .sd-remove-btn:hover:not(:disabled) { background: #fef2f2; }
  .sd-remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .sd-context-bar {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .sd-context-label {
    font-size: 0.75rem;
    color: #64748b;
  }

  .sd-context-track {
    width: 100%;
    height: 5px;
    background: #e2e8f0;
    border-radius: 99px;
    overflow: hidden;
  }

  .sd-context-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.3s ease, background 0.3s;
  }

  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .mini-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid #cbd5e1;
    border-top-color: #94a3b8;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
