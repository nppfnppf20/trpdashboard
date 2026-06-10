<script>
  import { onMount } from 'svelte';
  import { getTemplates, getSentRequestsForProject, mergeTemplate, suggestEmailEditsForDiscipline } from '$lib/api/quoteRequests.js';
  import { getBriefingNotes } from '$lib/api/planningApplication.js';
  import BriefingEditor from './BriefingEditor.svelte';
  import SentBriefingsHistory from './SentBriefingsHistory.svelte';
  import EditEmailTemplate from './EditEmailTemplate.svelte';
  import EditMasterWarningModal from '$lib/components/shared/EditMasterWarningModal.svelte';
  import DraftBriefingsModal from './DraftBriefingsModal.svelte';

  function clickOutside(node, handler) {
    function onClick(e) { if (!node.contains(e.target)) handler(); }
    document.addEventListener('click', onClick, true);
    return { destroy() { document.removeEventListener('click', onClick, true); } };
  }

  export let selectedProject;

  let templates = [];
  let sentRequests = [];
  let loading = false;
  let error = null;
  let showEditor = false;
  let showTemplateEditor = false;
  let showEditWarning = false;
  let selectedTemplate = null;
  let templateToEdit = null;

  // Draft from briefing note (Flow 2)
  let showDraftModal = false;
  let draftDevelopmentType = '';
  let fromDraftFlow = false;

  // Briefing note picker
  let briefingNotes = [];
  let selectedBriefingNoteId = null;
  let briefingDropdownOpen = false;

  $: selectedBriefingNote = selectedBriefingNoteId ? briefingNotes.find(n => n.id === selectedBriefingNoteId) : null;

  async function loadBriefingNotes(projectUniqueId) {
    try {
      briefingNotes = await getBriefingNotes(projectUniqueId);
    } catch {
      briefingNotes = [];
    }
    selectedBriefingNoteId = null;
  }
  let pendingDrafts = []; // [{ discipline, template, surveyors }] — queued after modal
  let currentDraftIndex = 0; // which pending draft is open in BriefingEditor
  let editorPreselectedSurveyors = []; // passed to BriefingEditor when opening a queued draft
  // Background scope checks: keyed by discipline
  // { status: 'loading'|'ready'|'error', apiResult: {hasChanges,suggestedContent}|null, error?: string }
  let draftCheckResults = {};

  function extractScopeFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const children = Array.from(doc.body.childNodes);
    const scopeIdx = children.findIndex(n => n.nodeName === 'H3' && n.textContent.trim().toLowerCase() === 'scope of work');
    if (scopeIdx === -1) return null;
    const endIdx = children.findIndex(n => n.nodeName === 'H3' && n.textContent.trim().toLowerCase() === 'key requirements');
    const end = endIdx === -1 ? children.length : endIdx;
    return children.slice(scopeIdx, end).map(n => n.nodeType === 3 ? n.textContent : n.outerHTML).join('');
  }

  async function runBackgroundChecks(drafts, projectUniqueId, noteId) {
    const initial = {};
    for (const d of drafts) initial[d.discipline] = { status: 'loading' };
    draftCheckResults = { ...initial };

    await Promise.all(drafts.map(async (draft) => {
      try {
        if (!draft.template) {
          draftCheckResults = { ...draftCheckResults, [draft.discipline]: { status: 'ready', apiResult: null } };
          return;
        }
        const surveyorIds = draft.surveyors.map(sv => sv.id);
        const merged = await mergeTemplate(draft.template.id, projectUniqueId, surveyorIds);
        const scopeContent = extractScopeFromHtml(merged.content);
        if (!scopeContent) {
          draftCheckResults = { ...draftCheckResults, [draft.discipline]: { status: 'ready', apiResult: null } };
          return;
        }
        const apiResult = await suggestEmailEditsForDiscipline(projectUniqueId, {
          briefingNoteId: noteId,
          discipline: draft.discipline,
          templateContent: scopeContent
        });
        draftCheckResults = { ...draftCheckResults, [draft.discipline]: { status: 'ready', apiResult } };
      } catch (err) {
        draftCheckResults = { ...draftCheckResults, [draft.discipline]: { status: 'error', error: err.message } };
      }
    }));
  }

  $: if (selectedProject) {
    loadData();
    loadBriefingNotes(selectedProject.id);
  }

  async function loadData() {
    loading = true;
    error = null;
    try {
      await Promise.all([
        loadTemplates(),
        loadSentRequests()
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadTemplates() {
    try {
      templates = await getTemplates();
    } catch (err) {
      console.error('Error loading templates:', err);
      throw err;
    }
  }

  async function loadSentRequests() {
    if (!selectedProject?.unique_id) return;
    try {
      sentRequests = await getSentRequestsForProject(selectedProject.unique_id);
    } catch (err) {
      console.error('Error loading sent requests:', err);
      throw err;
    }
  }

  function openNewRequest() {
    selectedTemplate = null;
    editorPreselectedSurveyors = [];
    fromDraftFlow = false;
    showEditor = true;
  }

  function handleDraftProceed(event) {
    pendingDrafts = event.detail.drafts;
    currentDraftIndex = 0;
    showDraftModal = false;
    draftCheckResults = {};
    // Fire all scope checks in background — no await
    runBackgroundChecks(pendingDrafts, selectedProject.unique_id, selectedBriefingNoteId);
    openNextDraft();
  }

  function openNextDraft() {
    if (currentDraftIndex >= pendingDrafts.length) {
      pendingDrafts = [];
      currentDraftIndex = 0;
      return;
    }
    const draft = pendingDrafts[currentDraftIndex];
    selectedTemplate = draft.template;
    // Map surveyors to the shape BriefingEditor expects for preSelectedSurveyors
    editorPreselectedSurveyors = draft.surveyors.flatMap(sv => {
      const primaryContact = sv.contacts?.find(c => c.is_primary) ?? sv.contacts?.[0] ?? null;
      if (!primaryContact) return [];
      return [{
        surveyorId: sv.id,
        surveyorOrganisation: sv.organisation,
        discipline: sv.discipline,
        contactId: primaryContact.id,
        contactName: primaryContact.name,
        contactEmail: primaryContact.email ?? ''
      }];
    });
    fromDraftFlow = true;
    showEditor = true;
  }

  function openTemplateForEditing(template) {
    templateToEdit = template;
    showEditWarning = true;
  }

  function handleWarningCancel() {
    showEditWarning = false;
    templateToEdit = null;
  }

  function handleWarningContinue() {
    showEditWarning = false;
    showTemplateEditor = true;
  }

  async function handleSaved() {
    showEditor = false;
    selectedTemplate = null;
    editorPreselectedSurveyors = [];
    fromDraftFlow = false;
    await loadSentRequests();
    // Advance to next queued draft if any
    currentDraftIndex += 1;
    openNextDraft();
  }

  function handleClose() {
    showEditor = false;
    selectedTemplate = null;
    editorPreselectedSurveyors = [];
    fromDraftFlow = false;
    // User closed without saving — skip this draft and open next
    if (pendingDrafts.length > 0) {
      currentDraftIndex += 1;
      openNextDraft();
    }
  }

  async function handleTemplateEditorClose() {
    showTemplateEditor = false;
    templateToEdit = null;
    // Reload templates to get updated content
    await loadTemplates();
  }

  function handleDeleted(event) {
    // Remove from local array
    sentRequests = sentRequests.filter(r => r.id !== event.detail.id);
  }
</script>

<div class="briefing-panel">
  <div class="panel-header">
    <h2>Surveyor Quote Requests</h2>
    <div class="header-actions">
      <select class="dev-type-select" bind:value={draftDevelopmentType}>
        <option value="">Development type...</option>
        <option value="Renewables">Renewables</option>
        <option value="Residential">Residential</option>
      </select>
      <div class="briefing-btn-group" use:clickOutside={() => briefingDropdownOpen = false}>
        <button class="btn-draft-main" on:click={() => showDraftModal = true} disabled={!selectedProject?.unique_id}>
          <i class="las la-magic"></i>
          Draft from Briefing Note
          {#if selectedBriefingNote}<span class="briefing-note-pill">{selectedBriefingNote.title || selectedBriefingNote.file_name}</span>{/if}
        </button>
        <button class="btn-briefing-chevron" disabled={!selectedProject?.unique_id} on:click={() => briefingDropdownOpen = !briefingDropdownOpen} title="Select briefing note">
          <i class="las la-angle-down"></i>
        </button>
        {#if briefingDropdownOpen}
          <div class="briefing-dropdown">
            <button class="briefing-dropdown-item" class:active={!selectedBriefingNoteId} on:click={() => { selectedBriefingNoteId = null; briefingDropdownOpen = false; }}>
              <span>Latest briefing note</span>
            </button>
            {#each briefingNotes as note}
              <button class="briefing-dropdown-item" class:active={selectedBriefingNoteId === note.id} on:click={() => { selectedBriefingNoteId = note.id; briefingDropdownOpen = false; }}>
                <span class="briefing-dropdown-title">{note.title || note.file_name}</span>
                <span class="briefing-dropdown-date">{new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <button class="btn btn-primary" on:click={openNewRequest}>
        <i class="las la-plus"></i>
        New Quote Request
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if error}
    <div class="error">
      <i class="las la-exclamation-triangle"></i>
      <p>{error}</p>
    </div>
  {:else}
    <!-- Sent Requests History -->
    <div class="section">
      <h3 class="section-title">Sent Requests</h3>
      <SentBriefingsHistory {sentRequests} on:deleted={handleDeleted} />
    </div>

    <!-- Master Templates Section -->
    <div class="section">
      <h3 class="section-title">Master Templates</h3>
      <div class="template-cards">
        {#each templates as template}
          <div class="template-card">
            <button
              class="edit-btn"
              on:click={() => openTemplateForEditing(template)}
              title="Edit template"
            >
              <i class="las la-edit"></i>
            </button>
            <div class="card-icon">
              <i class="las la-envelope"></i>
            </div>
            <div class="card-content">
              <h4>{template.template_name}</h4>
              <p class="discipline-badge">{template.discipline || 'General'}</p>
              <p class="description">{template.description || ''}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Briefing Editor Modal -->
{#if showEditor}
  <BriefingEditor
    show={showEditor}
    projectId={selectedProject?.unique_id}
    preSelectedTemplate={selectedTemplate}
    preSelectedSurveyors={editorPreselectedSurveyors}
    briefingNoteId={selectedBriefingNoteId}
    precomputedCheck={draftCheckResults[pendingDrafts[currentDraftIndex]?.discipline]}
    on:saved={handleSaved}
    on:close={handleClose}
  />
{/if}

<!-- Draft from Briefing Note Modal -->
<DraftBriefingsModal
  show={showDraftModal}
  projectId={selectedProject?.unique_id}
  developmentType={draftDevelopmentType || null}
  briefingNoteId={selectedBriefingNoteId}
  on:proceed={handleDraftProceed}
  on:close={() => showDraftModal = false}
/>

<!-- Edit Master Warning Modal -->
<EditMasterWarningModal
  isOpen={showEditWarning}
  title="Edit Master Template"
  itemName={templateToEdit?.template_name || ''}
  itemType="email template"
  hint="To create a quote request for this project only, click <strong>New Quote Request</strong> instead."
  on:cancel={handleWarningCancel}
  on:continue={handleWarningContinue}
/>

<!-- Template Editor Modal -->
{#if showTemplateEditor && templateToEdit}
  <EditEmailTemplate
    template={templateToEdit}
    on:close={handleTemplateEditorClose}
  />
{/if}

<style>
  .briefing-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    height: 100%;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dev-type-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #475569;
    background: white;
    cursor: pointer;
  }

  .dev-type-select:focus {
    outline: none;
    border-color: #7c3aed;
  }

  .briefing-btn-group {
    position: relative;
    display: flex;
    align-items: stretch;
  }

  .btn-draft-main {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: #faf5ff;
    border: 1px solid #d8b4fe;
    border-right: none;
    border-radius: 6px 0 0 6px;
    color: #7c3aed;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-draft-main:hover:not(:disabled) { background: #f3e8ff; border-color: #a855f7; }
  .btn-draft-main:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-briefing-chevron {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.5rem;
    background: #faf5ff;
    border: 1px solid #d8b4fe;
    border-radius: 0 6px 6px 0;
    color: #7c3aed;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-briefing-chevron:hover:not(:disabled) { background: #f3e8ff; border-color: #a855f7; }
  .btn-briefing-chevron:disabled { opacity: 0.4; cursor: not-allowed; }

  .briefing-note-pill {
    background: #ede9fe;
    color: #6d28d9;
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .briefing-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    min-width: 240px;
    z-index: 100;
    overflow: hidden;
  }

  .briefing-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 0.875rem;
    background: transparent;
    border: none;
    border-bottom: 1px solid #f1f5f9;
    text-align: left;
    font-size: 0.8125rem;
    color: #374151;
    cursor: pointer;
    transition: background 0.1s;
    font-family: inherit;
  }
  .briefing-dropdown-item:last-child { border-bottom: none; }
  .briefing-dropdown-item:hover { background: #f8fafc; }
  .briefing-dropdown-item.active { background: #faf5ff; color: #7c3aed; }

  .briefing-dropdown-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .briefing-dropdown-date {
    font-size: 0.75rem;
    color: #94a3b8;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .loading, .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #94a3b8;
  }

  .error {
    color: #ef4444;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .section {
    padding: 1.5rem;
  }

  .section-title {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #475569;
  }

  .template-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .template-card {
    display: flex;
    gap: 1rem;
    padding: 1.25rem;
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.2s;
    position: relative;
  }

  .template-card:hover {
    border-color: #3b82f6;
    background: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .card-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e0e7ff;
    border-radius: 8px;
    color: #3b82f6;
    font-size: 1.5rem;
  }

  .card-content {
    flex: 1;
    min-width: 0;
  }

  .card-content h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1e293b;
  }

  .discipline-badge {
    display: inline-block;
    margin: 0 0 0.5rem 0;
    padding: 0.125rem 0.5rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .description {
    margin: 0;
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .edit-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    color: #94a3b8;
    border: none;
    border-radius: 4px;
    font-size: 1.125rem;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0.7;
  }

  .edit-btn:hover {
    background: #f1f5f9;
    color: #64748b;
    opacity: 1;
  }

  .template-card:hover .edit-btn {
    opacity: 1;
  }
</style>
