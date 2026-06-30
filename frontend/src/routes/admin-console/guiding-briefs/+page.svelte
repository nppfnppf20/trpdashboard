<script>
  import { onMount } from 'svelte';
  import { listDocumentTypes, listGuidingBriefs, createGuidingBrief, updateGuidingBrief, deleteGuidingBrief } from '$lib/api/guidingBriefs.js';
  import { md } from '$lib/utils/markdown.js';

  let documentTypes = $state([]);

  const DEVELOPMENT_TYPES = [
    'Residential', 'Co-Living', 'Commercial', 'Solar', 'Wind',
    'Mixed Use', 'Industrial', 'Change of Use', 'Agricultural', 'Urban Site', 'Other',
  ];

  // Ordered list of tool groups; 'All' is synthetic
  const TOOL_GROUPS = ['Planning Application', 'Marketing'];

  let briefs = $state([]);
  let loading = $state(true);
  let error = $state(null);

  // Page-level tab filter
  let activeGroup = $state('All');

  let modalOpen = $state(false);
  let modalSaving = $state(false);
  let modalError = $state(null);
  let isNew = $state(false);
  let activeId = $state(null);
  let activeTab = $state('guidance');
  let guidanceEditMode = $state(false);
  let showEditWarning = $state(false);
  let form = $state({ name: '', document_type: '', development_type: '', guidance_content: '', review_checklist: '', meeting_prompt: '', style_example: '' });

  let confirmDeleteId = $state(null);

  onMount(load);

  async function load() {
    loading = true; error = null;
    try {
      [documentTypes, briefs] = await Promise.all([listDocumentTypes(), listGuidingBriefs()]);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Map from doc type value → its group
  const docTypeGroupMap = $derived(
    Object.fromEntries(documentTypes.map(d => [d.value, d.group ?? 'Other']))
  );

  // documentTypes grouped by tool, for <optgroup> in modal
  const docTypesByGroup = $derived(
    (() => {
      const order = [...TOOL_GROUPS, 'Other'];
      const map = {};
      for (const g of order) map[g] = [];
      for (const dt of documentTypes) {
        const g = dt.group ?? 'Other';
        if (!map[g]) map[g] = [];
        map[g].push(dt);
      }
      return order.filter(g => map[g].length > 0).map(g => ({ group: g, types: map[g] }));
    })()
  );

  // Count briefs per group for tab badges
  const briefCountByGroup = $derived(
    (() => {
      const counts = { All: briefs.length };
      for (const b of briefs) {
        const g = docTypeGroupMap[b.document_type] ?? 'Other';
        counts[g] = (counts[g] ?? 0) + 1;
      }
      return counts;
    })()
  );

  // Which tabs to show (only groups that have ≥1 brief or ≥1 doc type)
  const visibleGroups = $derived(
    TOOL_GROUPS.filter(g =>
      (briefCountByGroup[g] ?? 0) > 0 || documentTypes.some(d => (d.group ?? 'Other') === g)
    )
  );

  // Group briefs by document_type for display, filtered by activeGroup
  const grouped = $derived(
    (() => {
      const knownValues = new Set(documentTypes.map(d => d.value));
      const allTypes = [
        ...documentTypes,
        ...briefs
          .filter(b => !knownValues.has(b.document_type))
          .map(b => ({ value: b.document_type, label: b.document_type, group: 'Other' }))
          .filter((d, i, arr) => arr.findIndex(x => x.value === d.value) === i),
      ];
      return allTypes
        .filter(dt => activeGroup === 'All' || (dt.group ?? 'Other') === activeGroup)
        .map(dt => ({ ...dt, items: briefs.filter(b => b.document_type === dt.value) }))
        .filter(g => g.items.length > 0);
    })()
  );

  function openNew() {
    isNew = true; activeId = null;
    // Pre-select first type in the active group if filtered, otherwise overall first
    const preferred = activeGroup !== 'All'
      ? documentTypes.find(d => (d.group ?? 'Other') === activeGroup)
      : documentTypes[0];
    form = { name: '', document_type: preferred?.value ?? documentTypes[0]?.value ?? '', development_type: '', guidance_content: '', review_checklist: '', meeting_prompt: '', style_example: '' };
    activeTab = 'guidance';
    guidanceEditMode = true;
    modalError = null;
    modalOpen = true;
  }

  function openEdit(b) {
    isNew = false; activeId = b.id;
    form = {
      name:             b.name ?? '',
      document_type:    b.document_type ?? '',
      development_type: b.development_type ?? '',
      guidance_content: b.guidance_content ?? '',
      review_checklist: b.review_checklist ?? '',
      meeting_prompt:   b.meeting_prompt ?? '',
      style_example:    b.style_example ?? '',
    };
    activeTab = 'guidance';
    guidanceEditMode = false;
    modalError = null;
    modalOpen = true;
  }

  async function save() {
    if (!form.name.trim()) { modalError = 'Name is required'; return; }
    if (!form.document_type) { modalError = 'Document type is required'; return; }
    modalSaving = true; modalError = null;
    try {
      const payload = {
        name:             form.name.trim(),
        document_type:    form.document_type,
        development_type: form.development_type || null,
        guidance_content: form.guidance_content.trim() || null,
        review_checklist: form.review_checklist.trim() || null,
        meeting_prompt:   form.meeting_prompt.trim() || null,
        style_example:    form.style_example.trim() || null,
      };
      if (isNew) {
        const created = await createGuidingBrief(payload);
        briefs = [...briefs, created].sort((a, b) => a.document_type.localeCompare(b.document_type) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
      } else {
        const updated = await updateGuidingBrief(activeId, payload);
        briefs = briefs.map(b => b.id === activeId ? updated : b);
      }
      modalOpen = false;
    } catch (err) {
      modalError = err.message;
    } finally {
      modalSaving = false;
    }
  }

  async function confirmDelete(id) {
    try {
      await deleteGuidingBrief(id);
      briefs = briefs.filter(b => b.id !== id);
    } catch (err) {
      error = err.message;
    } finally {
      confirmDeleteId = null;
    }
  }

  function wordCount(text) {
    if (!text?.trim()) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function lineCount(text) {
    if (!text?.trim()) return 0;
    return text.trim().split('\n').filter(l => l.trim()).length;
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Guiding Briefs</h1>
      <p>Document standards that guide generation and provide post-generation review checklists. Applied per document type and optional development type.</p>
    </div>
    <button class="btn-add" onclick={openNew}><i class="las la-plus"></i> New Guiding Brief</button>
  </div>

  {#if error}<div class="error-banner">{error}</div>{/if}

  {#if !loading}
    <!-- Tool filter tabs -->
    <div class="tool-tabs">
      <button class="tool-tab" class:active={activeGroup === 'All'} onclick={() => activeGroup = 'All'}>
        All
        <span class="tab-count">{briefCountByGroup['All'] ?? 0}</span>
      </button>
      {#each visibleGroups as g}
        <button class="tool-tab" class:active={activeGroup === g} onclick={() => activeGroup = g}>
          {g}
          <span class="tab-count">{briefCountByGroup[g] ?? 0}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading…</div>
  {:else if !briefs.length}
    <div class="empty-state">
      <i class="las la-book-open"></i>
      <p>No guiding briefs yet. Click "New Guiding Brief" to add one.</p>
    </div>
  {:else if grouped.length === 0}
    <div class="empty-state">
      <i class="las la-book-open"></i>
      <p>No guiding briefs for {activeGroup} yet.</p>
    </div>
  {:else}
    {#each grouped as group (group.value)}
      <div class="group">
        <div class="group-header">
          <span class="group-label">{group.label}</span>
          <span class="group-count">{group.items.length} brief{group.items.length !== 1 ? 's' : ''}</span>
        </div>
        <table class="briefs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Dev Type</th>
              <th>Guidance</th>
              <th>Review Checklist</th>
              <th>Meeting Agenda</th>
              <th>Style Template</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each group.items as b (b.id)}
              <tr>
                <td class="name-cell">{b.name}</td>
                <td class="devtype-cell">
                  {#if b.development_type}
                    <span class="devtype-badge">{b.development_type}</span>
                  {:else}
                    <span class="muted">All types</span>
                  {/if}
                </td>
                <td class="content-cell">
                  {#if b.guidance_content?.trim()}
                    <span class="pill pill-ok">{wordCount(b.guidance_content)}w</span>
                  {:else}
                    <span class="pill pill-empty">—</span>
                  {/if}
                </td>
                <td class="content-cell">
                  {#if b.review_checklist?.trim()}
                    <span class="pill pill-blue">{lineCount(b.review_checklist)} line{lineCount(b.review_checklist) !== 1 ? 's' : ''}</span>
                  {:else}
                    <span class="pill pill-empty">—</span>
                  {/if}
                </td>
                <td class="content-cell">
                  {#if b.meeting_prompt?.trim()}
                    <span class="pill pill-teal">{wordCount(b.meeting_prompt)}w</span>
                  {:else}
                    <span class="pill pill-empty">—</span>
                  {/if}
                </td>
                <td class="content-cell">
                  {#if b.style_example?.trim()}
                    <span class="pill pill-amber">{wordCount(b.style_example)}w</span>
                  {:else}
                    <span class="pill pill-empty">—</span>
                  {/if}
                </td>
                <td class="actions-cell">
                  {#if confirmDeleteId === b.id}
                    <span class="confirm-delete">
                      Delete?
                      <button class="btn-danger-sm" onclick={() => confirmDelete(b.id)}>Yes</button>
                      <button class="btn-cancel-sm" onclick={() => confirmDeleteId = null}>No</button>
                    </span>
                  {:else}
                    <button class="btn-edit" onclick={() => openEdit(b)}><i class="las la-edit"></i> Edit</button>
                    <button class="btn-delete" onclick={() => confirmDeleteId = b.id}><i class="las la-trash"></i></button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  {/if}
</div>

{#if modalOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) modalOpen = false; }}>
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>{isNew ? 'New Guiding Brief' : form.name}</h2>
          <p class="modal-sub">Define how this document should be written and what to check post-generation.</p>
        </div>
        <button class="close-btn" onclick={() => modalOpen = false}><i class="las la-times"></i></button>
      </div>

      {#if modalError}<div class="modal-error">{modalError}</div>{/if}

      <div class="modal-meta">
        <div class="meta-field meta-field-grow">
          <label for="gb-name">Name</label>
          <input id="gb-name" type="text" bind:value={form.name} placeholder="e.g. HLPV — Solar Farm" />
        </div>
        <div class="meta-field">
          <label for="gb-doctype">Document Type</label>
          <select id="gb-doctype" bind:value={form.document_type}>
            {#each docTypesByGroup as grp}
              <optgroup label={grp.group}>
                {#each grp.types as dt}
                  <option value={dt.value}>{dt.label}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        </div>
        <div class="meta-field">
          <label for="gb-devtype">Development Type <span class="optional">optional</span></label>
          <select id="gb-devtype" bind:value={form.development_type}>
            <option value="">All development types</option>
            {#each DEVELOPMENT_TYPES as dt}
              <option value={dt}>{dt}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="field-tabs">
        <button class="field-tab" class:active={activeTab === 'guidance'} onclick={() => activeTab = 'guidance'}>
          <i class="las la-pen-nib"></i>
          Guidance
          {#if form.guidance_content?.trim()}<span class="tab-dot tab-dot-ok"></span>{:else}<span class="tab-dot tab-dot-empty"></span>{/if}
        </button>
        <button class="field-tab" class:active={activeTab === 'checklist'} onclick={() => activeTab = 'checklist'}>
          <i class="las la-clipboard-check"></i>
          Review Checklist
          {#if form.review_checklist?.trim()}<span class="tab-dot tab-dot-ok"></span>{:else}<span class="tab-dot tab-dot-empty"></span>{/if}
        </button>
        <button class="field-tab" class:active={activeTab === 'meeting'} onclick={() => activeTab = 'meeting'}>
          <i class="las la-calendar-alt"></i>
          Meeting Agenda
          {#if form.meeting_prompt?.trim()}<span class="tab-dot tab-dot-ok"></span>{:else}<span class="tab-dot tab-dot-empty"></span>{/if}
        </button>
        <button class="field-tab" class:active={activeTab === 'style'} onclick={() => activeTab = 'style'}>
          <i class="las la-file-alt"></i>
          Style Template
          {#if form.style_example?.trim()}<span class="tab-dot tab-dot-ok"></span>{:else}<span class="tab-dot tab-dot-empty"></span>{/if}
        </button>
      </div>

      <div class="editor-wrap">
        {#if activeTab === 'guidance'}
          <div class="tab-help guidance-help">
            <span>Instructions injected into the prompt when drafting this document. Supports markdown — use ## for headings, **bold**, - for bullet lists.</span>
            <button class="toggle-edit-btn" onclick={() => guidanceEditMode ? (guidanceEditMode = false) : (showEditWarning = true)}>
              <i class="las {guidanceEditMode ? 'la-eye' : 'la-edit'}"></i>
              {guidanceEditMode ? 'Preview' : 'Edit'}
            </button>
          </div>
          {#if guidanceEditMode}
            <textarea
              class="text-area"
              bind:value={form.guidance_content}
              placeholder="Describe how this document should be written. What sections are required? What should be emphasised?&#10;&#10;## Structure&#10;- Always open with a clear description of the proposed development&#10;- Address landscape and visual impact in a dedicated section&#10;&#10;## Key issues&#10;- For solar farms, always consider cumulative impact"
            ></textarea>
          {:else}
            <div class="preview-body md-body">
              {#if form.guidance_content?.trim()}
                {@html md(form.guidance_content)}
              {:else}
                <p class="preview-empty">Nothing written yet — click Edit to add content.</p>
              {/if}
            </div>
          {/if}
        {:else if activeTab === 'checklist'}
          <div class="tab-help">
            Things to check after the document is drafted. Written as plain prose or a bullet list.
          </div>
          <textarea
            class="text-area"
            bind:value={form.review_checklist}
            placeholder="List topics or elements to verify in the draft. Example:&#10;&#10;- Ecology: check for SSSI, habitats, biodiversity net gain — flag if not mentioned&#10;- Landscape and visual impact: must be addressed with reference to the relevant LVIA&#10;- Cumulative impact: check if other schemes are referenced"
          ></textarea>
        {:else if activeTab === 'meeting'}
          <div class="tab-help">
            LLM prompt used to generate a meeting agenda for this document type. The agenda generator will inject the guiding brief, project brief, briefing notes, and any prior meeting transcripts alongside this prompt.
          </div>
          <textarea
            class="text-area"
            bind:value={form.meeting_prompt}
            placeholder="Describe how to structure the meeting agenda. What topics must be covered? What questions should be raised? What decisions need to be made?&#10;&#10;Example:&#10;&#10;## Purpose&#10;Generate an agenda for an initial project meeting with the client and design team.&#10;&#10;## Required topics&#10;- Site description and key constraints identified in the HLPV&#10;- Planning policy context and key policies&#10;- Proposal design and layout&#10;- Likely application timeline"
          ></textarea>
        {:else if activeTab === 'style'}
          <div class="tab-help">
            Paste a real example of this document type. Used by the LLM to calibrate tone, register, sentence structure, and level of detail — not as content to copy. The guiding brief always takes precedence.
          </div>
          <textarea
            class="text-area"
            bind:value={form.style_example}
            placeholder="Paste a real example document here. Plain text is fine — HTML will be stripped automatically before the LLM sees it."
          ></textarea>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => modalOpen = false} disabled={modalSaving}>Cancel</button>
        <button class="btn-primary" onclick={save} disabled={modalSaving}>
          {modalSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showEditWarning}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) showEditWarning = false; }}>
    <div class="warning-modal">
      <div class="warning-icon"><i class="las la-exclamation-triangle"></i></div>
      <h3>Edit guiding brief?</h3>
      <p>Changes to this guiding brief will apply to <strong>all future documents of this type</strong>. They will not affect any documents that have already been generated.</p>
      <div class="warning-footer">
        <button class="btn-secondary" onclick={() => showEditWarning = false}>Cancel</button>
        <button class="btn-warning" onclick={() => { guidanceEditMode = true; showEditWarning = false; }}>
          <i class="las la-edit"></i> I understand, edit
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page { max-width: 1100px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; }
  .page-header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; color: #1e293b; }
  .page-header p { margin: 0; color: #64748b; font-size: 0.875rem; max-width: 600px; }

  .btn-add {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1.1rem; background: #2563eb; color: white;
    border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; white-space: nowrap;
  }
  .btn-add:hover { background: #1d4ed8; }

  /* Tool tabs */
  .tool-tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 1.75rem;
  }

  .tool-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: -1px;
    white-space: nowrap;
  }
  .tool-tab:hover { color: #1e293b; background: #f8fafc; }
  .tool-tab.active { color: #2563eb; border-bottom-color: #2563eb; }

  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding: 0 5px;
    background: #f1f5f9;
    color: #64748b;
    border-radius: 9px;
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1;
  }
  .tool-tab.active .tab-count { background: #dbeafe; color: #1d4ed8; }

  /* Groups */
  .group { margin-bottom: 2rem; }
  .group-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .group-label { font-size: 0.9375rem; font-weight: 700; color: #1e293b; }
  .group-count { font-size: 0.8125rem; color: #94a3b8; }

  /* Table */
  .briefs-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }
  .briefs-table th { background: #f8fafc; padding: 0.625rem 1rem; text-align: left; font-size: 0.8125rem; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .briefs-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.875rem; color: #1e293b; vertical-align: middle; }
  .briefs-table tr:last-child td { border-bottom: none; }

  .name-cell { font-weight: 500; }
  .devtype-cell { }
  .devtype-badge { display: inline-block; padding: 0.15rem 0.5rem; background: #ede9fe; color: #6d28d9; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
  .muted { color: #94a3b8; font-size: 0.8125rem; }
  .content-cell { }

  .pill { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
  .pill-ok { background: #dcfce7; color: #15803d; }
  .pill-blue { background: #dbeafe; color: #1d4ed8; }
  .pill-teal { background: #ccfbf1; color: #0d9488; }
  .pill-amber { background: #fef3c7; color: #b45309; }
  .pill-empty { background: #f1f5f9; color: #94a3b8; }

  .actions-cell { white-space: nowrap; display: flex; align-items: center; gap: 0.4rem; }
  .btn-edit { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-edit:hover { background: #dbeafe; }
  .btn-delete { display: inline-flex; align-items: center; padding: 0.35rem 0.5rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-delete:hover { background: #fee2e2; }
  .confirm-delete { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: #dc2626; }
  .btn-danger-sm { padding: 0.2rem 0.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .btn-cancel-sm { padding: 0.2rem 0.5rem; background: #f1f5f9; color: #374151; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }

  .empty-state { text-align: center; padding: 4rem 2rem; color: #94a3b8; }
  .empty-state i { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
  .empty-state p { margin: 0; font-size: 0.9375rem; }

  .loading { padding: 3rem; text-align: center; color: #64748b; }
  .error-banner { padding: 1rem; background: #fef2f2; color: #dc2626; border-radius: 6px; margin-bottom: 1rem; }

  /* Modal */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { background: white; border-radius: 10px; width: 900px; max-width: 98vw; height: 80vh; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
  .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
  .modal-header h2 { margin: 0 0 0.2rem; font-size: 1.2rem; color: #1e293b; }
  .modal-sub { margin: 0; font-size: 0.8125rem; color: #64748b; }
  .close-btn { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #64748b; padding: 0.25rem; flex-shrink: 0; }
  .close-btn:hover { color: #1e293b; }
  .modal-error { padding: 0.75rem 1.5rem; background: #fef2f2; color: #dc2626; font-size: 0.875rem; flex-shrink: 0; border-bottom: 1px solid #fecaca; }

  .modal-meta { display: flex; gap: 0.75rem; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; align-items: flex-end; }
  .meta-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .meta-field-grow { flex: 1; }
  .meta-field label { font-size: 0.8125rem; font-weight: 500; color: #374151; }
  .optional { font-weight: 400; color: #94a3b8; font-size: 0.75rem; }
  .meta-field input, .meta-field select { padding: 0.5rem 0.625rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.875rem; background: white; min-width: 180px; }
  .meta-field input:focus, .meta-field select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

  .field-tabs { display: flex; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
  .field-tab { display: flex; align-items: center; gap: 0.4rem; padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; font-size: 0.8125rem; font-weight: 500; color: #64748b; cursor: pointer; transition: all 0.15s; margin-bottom: -1px; }
  .field-tab:hover { color: #1e293b; background: #f8fafc; }
  .field-tab.active { color: #0d9488; border-bottom-color: #0d9488; }
  .field-tab i { font-size: 1rem; }
  .tab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .tab-dot-ok { background: #22c55e; }
  .tab-dot-empty { background: #cbd5e1; }

  .editor-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .tab-help { padding: 0.625rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #f1f5f9; font-size: 0.8rem; color: #64748b; line-height: 1.5; flex-shrink: 0; }
  .guidance-help { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .toggle-edit-btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.625rem; background: white; border: 1px solid #cbd5e1; border-radius: 5px; font-size: 0.75rem; font-weight: 500; color: #374151; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
  .toggle-edit-btn:hover { background: #f1f5f9; border-color: #94a3b8; }

  .warning-modal { background: white; border-radius: 10px; width: 420px; max-width: 95vw; padding: 2rem 1.75rem 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.25); text-align: center; }
  .warning-icon { font-size: 2.25rem; color: #d97706; margin-bottom: 0.75rem; }
  .warning-modal h3 { margin: 0 0 0.75rem; font-size: 1.1rem; color: #1e293b; }
  .warning-modal p { margin: 0 0 1.5rem; font-size: 0.875rem; color: #475569; line-height: 1.6; }
  .warning-footer { display: flex; justify-content: center; gap: 0.75rem; }
  .btn-warning { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.25rem; background: #d97706; color: white; border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
  .btn-warning:hover { background: #b45309; }
  .text-area { flex: 1; width: 100%; padding: 1rem 1.5rem; border: none; resize: none; font-size: 0.875rem; line-height: 1.7; color: #1e293b; font-family: inherit; background: white; box-sizing: border-box; }
  .text-area:focus { outline: none; }
  .text-area::placeholder { color: #94a3b8; }
  .preview-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; background: white; font-size: 0.875rem; }
  .preview-empty { color: #94a3b8; font-style: italic; margin: 0; }

  .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; flex-shrink: 0; }
  .btn-primary { padding: 0.5rem 1.25rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { padding: 0.5rem 1.25rem; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; cursor: pointer; }
  .btn-secondary:hover { background: #f9fafb; }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
