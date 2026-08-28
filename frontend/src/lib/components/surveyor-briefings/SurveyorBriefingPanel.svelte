<script>
  import { onMount } from 'svelte';
  import { getTemplates, getSentRequestsForProject, mergeTemplate, suggestEmailEditsForDiscipline } from '$lib/api/quoteRequests.js';
  import { listDevelopmentTypes } from '$lib/api/guidingBriefs.js';
  import BriefingEditor from './BriefingEditor.svelte';
  import SentBriefingsHistory from './SentBriefingsHistory.svelte';
  import EditEmailTemplate from './EditEmailTemplate.svelte';
  import EditMasterWarningModal from '$lib/components/shared/EditMasterWarningModal.svelte';
  import NoteSourcePicker from '$lib/components/shared/NoteSourcePicker.svelte';
  import DraftBriefingsModal from './DraftBriefingsModal.svelte';

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
  let showDraftSetupModal = false;
  let draftDevelopmentType = null;
  let fromDraftFlow = false;

  // Source picker — nothing ticked = fall back to the latest briefing note,
  // matching the previous single-select default.
  let sourcePicker; // bind:this — used to reset ticks when the setup modal reopens
  let setupSources = []; // [{ type, id, full }] — bound from NoteSourcePicker
  let setupOverBudget = false;
  let selectedSources = []; // [{ type, id, full }] — confirmed selection, threaded to DraftBriefingsModal/BriefingEditor

  // Setup modal state
  let setupDevType = null;

  // Development types with a guiding brief already set up for surveyor briefings —
  // drives the setup modal's dropdown instead of a hardcoded list
  let devTypes = [];

  onMount(async () => {
    try {
      devTypes = await listDevelopmentTypes('surveyor_briefing');
    } catch {
      devTypes = [];
    }
  });

  function openDraftSetup() {
    sourcePicker?.reset();
    setupDevType = null;
    showDraftSetupModal = true;
  }

  function confirmDraftSetup() {
    selectedSources = setupSources;
    draftDevelopmentType = setupDevType;
    showDraftSetupModal = false;
    showDraftModal = true;
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

  async function runBackgroundChecks(drafts, projectUniqueId, sources) {
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
          sources,
          discipline: draft.discipline,
          templateContent: scopeContent
        });
        console.log(`[BriefingCheck] ${draft.discipline}:`, { hasChanges: apiResult.hasChanges, reasoning: apiResult.reasoning });
        draftCheckResults = { ...draftCheckResults, [draft.discipline]: { status: 'ready', apiResult } };
      } catch (err) {
        draftCheckResults = { ...draftCheckResults, [draft.discipline]: { status: 'error', error: err.message } };
      }
    }));
  }

  $: if (selectedProject) {
    loadData();
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
    const uniqueDrafts = pendingDrafts.filter((d, i) => pendingDrafts.findIndex(x => x.discipline === d.discipline) === i);
    runBackgroundChecks(uniqueDrafts, selectedProject.unique_id, selectedSources);
    openDraft(0);
  }

  function openDraft(index) {
    if (index < 0 || index >= pendingDrafts.length) {
      pendingDrafts = [];
      currentDraftIndex = 0;
      showEditor = false;
      return;
    }
    currentDraftIndex = index;
    const draft = pendingDrafts[index];
    selectedTemplate = draft.template;
    editorPreselectedSurveyors = draft.surveyors.flatMap(sv => {
      const primaryContact = (sv._selectedContactId ? sv.contacts?.find(c => c.id === sv._selectedContactId) : null) ?? sv.contacts?.find(c => c.is_primary) ?? sv.contacts?.[0] ?? null;
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
    openDraft(currentDraftIndex + 1);
  }

  function handleClose() {
    showEditor = false;
    selectedTemplate = null;
    editorPreselectedSurveyors = [];
    fromDraftFlow = false;
    pendingDrafts = [];
    currentDraftIndex = 0;
  }

  function handlePrev() { openDraft(currentDraftIndex - 1); }
  function handleNext() { openDraft(currentDraftIndex + 1); }

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
      <button class="btn-draft-main" on:click={openDraftSetup} disabled={!selectedProject?.unique_id}>
        <i class="las la-magic"></i>
        Draft from Briefing Note
      </button>
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
<!-- Keyed so prev/next navigation remounts the editor with fresh per-draft state
     (briefingApplied, mergeDone, selectedSurveyors) instead of reusing the old instance -->
{#if showEditor}
  {#key currentDraftIndex}
  <BriefingEditor
    show={showEditor}
    projectId={selectedProject?.unique_id}
    preSelectedTemplate={selectedTemplate}
    preSelectedSurveyors={editorPreselectedSurveyors}
    sources={selectedSources}
    precomputedCheck={draftCheckResults[pendingDrafts[currentDraftIndex]?.discipline]}
    stepCurrent={currentDraftIndex + 1}
    stepTotal={pendingDrafts.length}
    on:saved={handleSaved}
    on:close={handleClose}
    on:prev={handlePrev}
    on:next={handleNext}
  />
  {/key}
{/if}

<!-- Draft Setup Modal -->
{#if showDraftSetupModal}
  <div class="setup-overlay" on:click|self={() => showDraftSetupModal = false}>
    <div class="setup-modal setup-modal-wide">
      <div class="setup-header">
        <div class="setup-header-left">
          <i class="las la-magic"></i>
          <h3>Draft from Briefing Note</h3>
        </div>
        <button class="setup-close" on:click={() => showDraftSetupModal = false}><i class="las la-times"></i></button>
      </div>
      <div class="setup-body">
        <NoteSourcePicker
          bind:this={sourcePicker}
          projectUniqueId={selectedProject?.unique_id}
          hint="Tick any briefing notes and meeting notes to use as source material - leave everything unticked to use the latest briefing note automatically."
          bind:selectedSources={setupSources}
          bind:overBudget={setupOverBudget}
        />

        <div class="setup-field">
          <label>Development type</label>
          <select bind:value={setupDevType}>
            <option value={null}>Other (no guiding brief)</option>
            {#each devTypes as dt}
              <option value={dt}>{dt}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="setup-footer">
        <button class="btn btn-secondary" on:click={() => showDraftSetupModal = false}>Cancel</button>
        <button class="btn btn-draft-go" on:click={confirmDraftSetup} disabled={setupOverBudget}>
          <i class="las la-magic"></i> Draft
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Draft from Briefing Note Modal -->
<DraftBriefingsModal
  show={showDraftModal}
  projectId={selectedProject?.unique_id}
  developmentType={draftDevelopmentType || null}
  sources={selectedSources}
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
    /* min-height (not height) so the card grows with its content instead of
       letting long tables spill past the card bounds */
    min-height: 100%;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-draft-main {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: var(--color-purple-50);
    border: 1px solid var(--color-violet-300);
    border-radius: 6px;
    color: var(--color-violet-600);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-draft-main:hover:not(:disabled) { background: var(--color-violet-100); border-color: var(--color-purple-600); }
  .btn-draft-main:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Setup modal */
  .setup-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }

  .setup-modal {
    background: white;
    border-radius: 10px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
  }

  .setup-modal-wide {
    max-width: 520px;
    max-height: 85vh;
  }

  .setup-modal-wide .setup-body {
    overflow-y: auto;
  }

  .setup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.125rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    color: var(--color-violet-600);
  }

  .setup-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .setup-header-left i { font-size: 1.1rem; }

  .setup-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .setup-close {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: var(--color-slate-400);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }
  .setup-close:hover { color: var(--color-slate-800); }

  .setup-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .setup-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .setup-field label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-slate-700);
  }

  .setup-field select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-slate-800);
    background: white;
    cursor: pointer;
    font-family: inherit;
  }
  .setup-field select:focus { outline: none; border-color: var(--color-violet-600); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1); }

  .setup-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
  }

  .btn-draft-go {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1.25rem;
    background: var(--color-violet-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-draft-go:hover:not(:disabled) { background: var(--color-violet-700); }
  .btn-draft-go:disabled { opacity: 0.5; cursor: not-allowed; }


  .briefing-dropdown-date {
    font-size: 0.75rem;
    color: var(--color-slate-400);
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
    background: var(--color-primary-500);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-600);
  }

  .loading, .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--color-slate-400);
  }

  .error {
    color: var(--color-red-500);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-slate-200);
    border-top-color: var(--color-primary-500);
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
    color: var(--color-slate-600);
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
    background: var(--color-slate-50);
    border: 2px solid var(--color-slate-200);
    border-radius: 8px;
    transition: all 0.2s;
    position: relative;
  }

  .template-card:hover {
    border-color: var(--color-primary-500);
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
    background: var(--color-indigo-100);
    border-radius: 8px;
    color: var(--color-primary-500);
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
    color: var(--color-slate-800);
  }

  .discipline-badge {
    display: inline-block;
    margin: 0 0 0.5rem 0;
    padding: 0.125rem 0.5rem;
    background: var(--color-primary-100);
    color: var(--color-primary-800);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .description {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-slate-500);
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
    color: var(--color-slate-400);
    border: none;
    border-radius: 4px;
    font-size: 1.125rem;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0.7;
  }

  .edit-btn:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-500);
    opacity: 1;
  }

  .template-card:hover .edit-btn {
    opacity: 1;
  }
</style>
