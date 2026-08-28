<script>
  import { onMount } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import {
    draftTypes, drafts, draftGenerating, activeDraftTypeId,
    draftEditorHtml, draftSaving, draftSaved,
    setMarketingEditor, loadDraftTypes,
    openDraft, closeDraft, handleSaveDraft, handleGenerate,
  } from '$lib/stores/marketing-drafts.js';
  import { listPolicyItems } from '$lib/api/policy.js';

  let editor;
  let autoSaveTimer = null;
  let loading = true;
  let loadError = null;

  // Generate modal state
  let genModalTypeId = null;
  let genModalSelected = new Set(); // Set<"source_type:id">
  let genAngle = '';
  let genTopics = [];
  let genTopicsLoading = false;
  let genTopicsError = null;
  let genTopicsFetched = false;

  $: genModalType = $draftTypes.find(t => t.id === genModalTypeId) ?? null;
  $: genModalDraft = genModalTypeId !== null ? ($drafts[genModalTypeId] ?? null) : null;

  async function openGenerateModal(typeId) {
    genModalTypeId = typeId;
    genAngle = '';
    genModalSelected = new Set();
    if (!genTopicsFetched) {
      genTopicsLoading = true;
      genTopicsError = null;
      try {
        genTopics = await listPolicyItems();
        genTopicsFetched = true;
      } catch (err) {
        genTopicsError = err.message;
      } finally {
        genTopicsLoading = false;
      }
    }
  }

  function closeGenerateModal() {
    genModalTypeId = null;
  }

  function topicKey(item) {
    return `${item.source_type}:${item.id}`;
  }

  function toggleGenTopic(item) {
    const key = topicKey(item);
    const next = new Set(genModalSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    genModalSelected = next;
  }

  function topicSourceLabel(item) {
    if (item.source_type === 'document') return 'Uploaded';
    if (item.meeting_type === 'cpd') return 'CPD';
    return 'Internal Meeting';
  }

  function topicBadgeClass(item) {
    if (item.source_type === 'document') return 'topic-badge-upload';
    if (item.meeting_type === 'cpd') return 'topic-badge-cpd';
    return 'topic-badge-internal';
  }

  // Topic preview
  let previewTopic = null;

  async function submitGenerate() {
    const typeId = genModalTypeId;
    closeGenerateModal();
    await handleGenerate(typeId, {
      selectedTopicKeys: [...genModalSelected],
      userAngle: genAngle.trim() || null,
    });
  }

  onMount(async () => {
    loading = true;
    loadError = null;
    try {
      await loadDraftTypes();
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
  });

  $: setMarketingEditor(editor);

  function onDraftChange(e) {
    if (e?.detail?.html !== undefined) $draftEditorHtml = e.detail.html;
    $draftSaved = false;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(handleSaveDraft, 2000);
  }

  async function closeDraftWithSave() {
    clearTimeout(autoSaveTimer);
    if (!$draftSaved && $activeDraftTypeId) await handleSaveDraft();
    closeDraft();
  }

</script>

<div class="workspace">

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading...</span>
    </div>

  {:else if loadError}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>{loadError}</p>
      <button on:click={() => { loading = true; loadDraftTypes().finally(() => loading = false); }}>Retry</button>
    </div>

  {:else if $activeDraftTypeId !== null}
    <!-- ── Editor view ── -->
    {@const activeType = $draftTypes.find(t => t.id === $activeDraftTypeId)}
    <div class="draft-editor-bar">
      <button class="reset-btn" on:click={closeDraftWithSave}>
        <i class="las la-arrow-left"></i> Content
      </button>
      <span class="draft-editor-title">{activeType?.name ?? ''}</span>
      <div class="draft-editor-actions">
        <button class="draft-regen-btn" disabled={$draftGenerating === $activeDraftTypeId} on:click={() => requestGenerate($activeDraftTypeId, true)}>
          {#if $draftGenerating === $activeDraftTypeId}
            <div class="mini-spinner"></div> Generating...
          {:else}
            <i class="las la-sync"></i> Regenerate
          {/if}
        </button>
        <button class="draft-save-btn" disabled={$draftSaving} on:click={handleSaveDraft}>
          {#if $draftSaving}Saving...{:else if $draftSaved}<i class="las la-check"></i> Saved{:else}Save{/if}
        </button>
      </div>
    </div>

    <div class="draft-editor-panel">
      <RichTextEditor bind:this={editor} content={$draftEditorHtml} on:change={onDraftChange} />
    </div>

  {:else}
    <!-- ── Card list ── -->
    <div class="tab-body">
      <div class="draft-types-list">
        {#each $draftTypes as type (type.id)}
          {@const draft = $drafts[type.id]}
          <div class="card draft-type-card">
            <div class="draft-type-main">
              <div class="draft-type-info">
                <span class="draft-type-name">{type.name}</span>
                {#if type.description}<span class="draft-type-desc">{type.description}</span>{/if}
                {#if draft?.generated_at}
                  <span class="draft-type-meta">Last generated {new Date(draft.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {/if}
              </div>
              <div class="draft-type-actions">
                {#if draft}
                  <button class="draft-open-btn" on:click={() => openDraft(type.id)}>Open</button>
                {/if}
                <button class="draft-generate-btn" disabled={$draftGenerating === type.id} on:click={() => openGenerateModal(type.id)}>
                  {#if $draftGenerating === type.id}
                    <div class="mini-spinner"></div> Generating...
                  {:else}
                    <i class="las la-magic"></i> Generate
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

</div>

<!-- Generate modal -->
{#if genModalTypeId !== null}
  <div class="modal-overlay" on:click|self={closeGenerateModal} role="dialog" aria-modal="true">
    <div class="modal modal-generate">
      <div class="modal-header">
        <span class="modal-title">Generate: {genModalType?.name ?? ''}</span>
        <button class="modal-close" on:click={closeGenerateModal}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body gen-body">

        <!-- Policy context -->
        <div class="gen-section">
          <div class="gen-section-label">Policy context <span class="gen-optional">optional</span></div>
          {#if genTopicsLoading}
            <div class="topics-empty"><div class="spinner"></div><p>Loading…</p></div>
          {:else if genTopicsError}
            <div class="topics-empty"><i class="las la-exclamation-circle"></i><p>{genTopicsError}</p></div>
          {:else if genTopics.length === 0}
            <p class="gen-none">No policy updates yet, add some on the Policy &amp; Industry Updates page.</p>
          {:else}
            <div class="topics-list">
              {#each genTopics as item (topicKey(item))}
                {@const selected = genModalSelected.has(topicKey(item))}
                <div class="topic-row" class:topic-row--selected={selected}>
                  <input type="checkbox" class="topic-checkbox" checked={selected} on:change={() => toggleGenTopic(item)} />
                  <span class="topic-info">
                    <span class="topic-title">{item.title}</span>
                    <span class="topic-meta">
                      <span class="topic-source {topicBadgeClass(item)}">{topicSourceLabel(item)}</span>
                      {#if item.created_at}<span class="topic-date">{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>{/if}
                    </span>
                  </span>
                  <button class="topic-preview-btn" title="View summary" on:click|stopPropagation={() => previewTopic = item}>
                    <i class="las la-eye"></i>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Angle / guidance -->
        <div class="gen-section">
          <div class="gen-section-label">My angle <span class="gen-optional">optional</span></div>
          <textarea
            class="gen-angle-input"
            bind:value={genAngle}
            rows="3"
            placeholder="e.g. Focus on the cumulative impact angle, we've seen 3 refusals on this recently and want to position ourselves as the go-to experts."
          ></textarea>
        </div>

        {#if genModalDraft}
          <p class="gen-overwrite-note"><i class="las la-exclamation-triangle"></i> This will overwrite the existing draft. Click Open to review what is there before generating.</p>
        {/if}

      </div>

      <div class="modal-footer">
        <div class="modal-footer-left"></div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={closeGenerateModal}>Cancel</button>
          <button class="modal-run" on:click={submitGenerate}>
            <i class="las la-magic"></i> Generate
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Topic preview modal -->
{#if previewTopic !== null}
  {@const prev = previewTopic}
  {@const prevSelected = genModalSelected.has(topicKey(prev))}
  <div class="modal-overlay" on:click|self={() => previewTopic = null} role="dialog" aria-modal="true">
    <div class="modal modal-preview">
      <div class="modal-header">
        <span class="modal-title">{prev.title}</span>
        <button class="modal-close" on:click={() => previewTopic = null}><i class="las la-times"></i></button>
      </div>
      <div class="modal-body preview-body">
        <span class="topic-source {topicBadgeClass(prev)}">{topicSourceLabel(prev)}</span>

        {#if prev.summary_html}
          <div class="preview-section">
            <div class="preview-label">Summary</div>
            <div class="preview-html">{@html prev.summary_html}</div>
          </div>
        {/if}

        {#if prev.key_points}
          <div class="preview-section">
            <div class="preview-label">Key Points</div>
            <div class="preview-html">{@html prev.key_points}</div>
          </div>
        {/if}

        {#if prev.implications}
          <div class="preview-section">
            <div class="preview-label">Implications</div>
            <div class="preview-html">{@html prev.implications}</div>
          </div>
        {/if}

        {#if prev.raised_by}
          <p class="preview-raised">Raised by {prev.raised_by}</p>
        {/if}
      </div>
      <div class="modal-footer">
        <div class="modal-footer-left"></div>
        <div class="modal-footer-right">
          <button class="modal-cancel" on:click={() => previewTopic = null}>Close</button>
          <button
            class="modal-run"
            class:modal-run--deselect={prevSelected}
            on:click={() => { toggleGenTopic(prev); previewTopic = null; }}
          >
            {prevSelected ? 'Deselect' : 'Select this topic'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* ── Loading / error ── */

  .loading-state, .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--color-slate-500);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--color-slate-200);
    border-top-color: var(--color-teal-600);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Card list ── */

  .tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  .draft-types-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 720px;
  }

  .draft-type-card {
    padding: 1rem 1.125rem;
    transition: box-shadow 0.15s;
  }

  .draft-type-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  }

  .draft-type-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .draft-type-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .draft-type-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .draft-type-desc {
    font-size: 0.78rem;
    color: var(--color-slate-500);
    line-height: 1.4;
  }

  .draft-type-meta {
    font-size: 0.72rem;
    color: var(--color-slate-400);
    margin-top: 0.1rem;
  }

  .draft-type-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .draft-open-btn {
    height: 32px;
    padding: 0 0.875rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-open-btn:hover { background: var(--color-slate-50); border-color: var(--color-slate-300); }

  .draft-generate-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    height: 32px;
    padding: 0 0.875rem;
    background: var(--color-teal-600);
    border: none;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .draft-generate-btn:hover:not(:disabled) { background: var(--color-primary-600); }
  .draft-generate-btn:disabled { opacity: 0.6; cursor: default; }

  /* ── Editor bar ── */

  .draft-editor-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    height: 46px;
    padding: 0 1rem;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    height: 30px;
    padding: 0 0.625rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .reset-btn:hover { background: var(--color-slate-50); border-color: var(--color-slate-300); }

  .draft-editor-title {
    font-size: 0.825rem;
    font-weight: 600;
    color: var(--color-slate-800);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .draft-editor-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .draft-regen-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    height: 30px;
    padding: 0 0.75rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-regen-btn:hover:not(:disabled) { background: var(--color-slate-50); border-color: var(--color-slate-300); }
  .draft-regen-btn:disabled { opacity: 0.6; cursor: default; }

  .draft-save-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    height: 30px;
    padding: 0 0.875rem;
    background: var(--color-teal-600);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .draft-save-btn:hover:not(:disabled) { background: var(--color-primary-600); }
  .draft-save-btn:disabled { opacity: 0.6; cursor: default; }

  .draft-editor-panel {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Mini spinner ── */

  .mini-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
  }
  .draft-regen-btn .mini-spinner {
    border-color: rgba(0, 0, 0, 0.15);
    border-top-color: var(--color-slate-700);
  }

  /* ── Modal ── */

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    width: 480px;
    max-width: 94vw;
    overflow: hidden;
  }


  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem 0.875rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: var(--color-slate-400);
    cursor: pointer;
    padding: 0.125rem 0.25rem;
  }
  .modal-close:hover { color: var(--color-slate-600); }

  .modal-body {
    padding: 1rem 1.25rem;
  }

  .modal-body p {
    margin: 0;
    font-size: 0.825rem;
    color: var(--color-slate-700);
    line-height: 1.5;
  }

  /* Generate modal */
  .modal-generate { width: 540px; }

  .gen-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 500px;
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }

  .gen-section { display: flex; flex-direction: column; gap: 0.4rem; }

  .gen-section-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-slate-700);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .gen-optional {
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--color-slate-400);
    text-transform: none;
    letter-spacing: 0;
    margin-left: 0.25rem;
  }

  .gen-none {
    font-size: 0.8rem;
    color: var(--color-slate-400);
    margin: 0;
    font-style: italic;
  }

  .gen-angle-input {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-slate-800);
    resize: vertical;
    box-sizing: border-box;
    line-height: 1.5;
  }
  .gen-angle-input:focus { outline: none; border-color: var(--color-primary-200); box-shadow: 0 0 0 2px var(--color-primary-100); }
  .gen-angle-input::placeholder { color: var(--color-slate-400); }

  .gen-overwrite-note {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: var(--color-amber-800);
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 6px;
    padding: 0.4rem 0.625rem;
    margin: 0;
  }

  /* Topics list (shared between gen modal) */
  .topics-body {
    min-height: 200px;
    max-height: 300px;
    overflow-y: auto;
  }

  .topics-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    color: var(--color-slate-400);
    text-align: center;
  }

  .topics-empty i {
    font-size: 2.5rem;
  }

  .topics-empty p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-slate-500);
    font-weight: 500;
  }

  .topics-empty-sub {
    font-size: 0.78rem !important;
    color: var(--color-slate-400) !important;
    font-weight: 400 !important;
  }

  .topics-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .topic-row {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.5rem 0.625rem;
    border-radius: 6px;
    transition: background 0.1s;
  }
  .topic-row:hover { background: var(--color-slate-50); }
  .topic-row--selected { background: var(--color-primary-50); }
  .topic-row--selected:hover { background: var(--color-primary-100); }

  .topic-preview-btn {
    margin-left: auto;
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--color-slate-400);
    cursor: pointer;
    padding: 0.1rem 0.25rem;
    font-size: 0.95rem;
    line-height: 1;
    border-radius: 4px;
    transition: color 0.1s;
  }
  .topic-preview-btn:hover { color: var(--color-teal-600); }

  .topic-checkbox {
    margin-top: 2px;
    flex-shrink: 0;
    accent-color: var(--color-teal-600);
  }

  .topic-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .topic-title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-800);
    line-height: 1.3;
  }

  .topic-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .topic-date {
    font-size: 0.7rem;
    color: var(--color-slate-400);
  }

  .topic-source {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    width: fit-content;
  }
  .topic-badge-upload  { background: var(--color-emerald-100); color: var(--color-green-800); }
  .topic-badge-internal { background: var(--color-primary-100); color: var(--color-primary-800); }
  .topic-badge-cpd     { background: var(--color-violet-100); color: var(--color-violet-800); }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }

  .modal-footer-left, .modal-footer-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-cancel {
    height: 32px;
    padding: 0 0.875rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .modal-cancel:hover { background: var(--color-slate-100); }

  .modal-run {
    height: 32px;
    padding: 0 0.875rem;
    background: var(--color-teal-600);
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .modal-run:hover { background: var(--color-primary-600); }
  .modal-run--deselect { background: var(--color-slate-500); }
  .modal-run--deselect:hover { background: var(--color-slate-600); }

  /* Topic preview modal */
  .modal-preview { width: 560px; }

  .preview-body {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    max-height: 480px;
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }

  .preview-section { display: flex; flex-direction: column; gap: 0.25rem; }

  .preview-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-slate-400);
  }

  .preview-html {
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    line-height: 1.6;
  }
  .preview-html :global(p) { margin: 0 0 0.5rem; }
  .preview-html :global(ul), .preview-html :global(ol) { margin: 0 0 0.5rem; padding-left: 1.25rem; }
  .preview-html :global(li) { margin-bottom: 0.2rem; }

  .preview-raised {
    font-size: 0.78rem;
    color: var(--color-slate-500);
    margin: 0;
    font-style: italic;
  }
</style>
