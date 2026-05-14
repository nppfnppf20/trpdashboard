<script>
  import { onMount } from 'svelte';
  import { getTemplates, getSentRequestsForProject } from '$lib/api/quoteRequests.js';
  import BriefingEditor from './BriefingEditor.svelte';
  import SentBriefingsHistory from './SentBriefingsHistory.svelte';
  import EditEmailTemplate from './EditEmailTemplate.svelte';
  import EditMasterWarningModal from '$lib/components/shared/EditMasterWarningModal.svelte';
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
  let pendingDrafts = []; // [{ discipline, template, surveyors }] — queued after modal
  let currentDraftIndex = 0; // which pending draft is open in BriefingEditor
  let editorPreselectedSurveyors = []; // passed to BriefingEditor when opening a queued draft

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
    showEditor = true;
  }

  function handleDraftProceed(event) {
    pendingDrafts = event.detail.drafts;
    currentDraftIndex = 0;
    showDraftModal = false;
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
    await loadSentRequests();
    // Advance to next queued draft if any
    currentDraftIndex += 1;
    openNextDraft();
  }

  function handleClose() {
    showEditor = false;
    selectedTemplate = null;
    editorPreselectedSurveyors = [];
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
      <button class="btn btn-draft" on:click={() => showDraftModal = true} disabled={!selectedProject?.unique_id}>
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
{#if showEditor}
  <BriefingEditor
    show={showEditor}
    projectId={selectedProject?.unique_id}
    preSelectedTemplate={selectedTemplate}
    preSelectedSurveyors={editorPreselectedSurveyors}
    on:saved={handleSaved}
    on:close={handleClose}
  />
{/if}

<!-- Draft from Briefing Note Modal -->
<DraftBriefingsModal
  show={showDraftModal}
  projectId={selectedProject?.unique_id}
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

  .btn-draft {
    background: white;
    color: #7c3aed;
    border: 1px solid #7c3aed;
  }

  .btn-draft:hover:not(:disabled) {
    background: #f5f3ff;
  }

  .btn-draft:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
