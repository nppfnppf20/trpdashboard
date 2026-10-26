<script>
  import { getTemplates, getSentRequestsForProject, saveSentRequest, mergeTemplate, suggestEmailEditsForDiscipline } from '$lib/api/quoteRequests.js';
  import PlanSurveyorsModal from './PlanSurveyorsModal.svelte';
  import ReviewSelectionsModal from './ReviewSelectionsModal.svelte';
  import DraftSourcesModal from './DraftSourcesModal.svelte';
  import { partialJsonString } from '$lib/utils/partialJson.js';
  import { adaptEmailForRecipient } from '$lib/utils/adaptEmailForRecipient.js';
  import NewRequestChoiceModal from './NewRequestChoiceModal.svelte';
  import BriefingEditor from './BriefingEditor.svelte';
  import SentBriefingsHistory from './SentBriefingsHistory.svelte';
  import EditEmailTemplate from './EditEmailTemplate.svelte';
  import EditMasterWarningModal from '$lib/components/shared/EditMasterWarningModal.svelte';
  import DraftFromBriefingFlow from './DraftFromBriefingFlow.svelte';

  export let selectedProject;

  let templates = [];
  let sentRequests = [];
  let loading = false;
  let error = null;
  let showEditor = false;
  let showTemplateEditor = false;
  let showEditWarning = false;
  let templateToEdit = null;
  let showChoice = false;     // "select only" vs "draft email" first step of New Quote Request
  let showPlanModal = false;
  let showReview = false;
  let reviewItems = [];        // [{ key, surveyorId, contactId, ..., state: 'pending'|'sent' }]
  let reviewBusy = false;
  let editorQueue = [];        // review items being drafted one after another in the editor
  let editorIndex = 0;
  let pendingDraftItems = null; // items waiting on the "which notes?" popup
  let draftSources = [];        // [{ type, id, full }] confirmed in the popup
  let draftChecks = {};         // discipline -> { status: 'loading'|'ready'|'error', apiResult, error? }
  let draftOverrides = {};      // review item key -> edited email HTML copied over by "Apply to the rest"

  // Draft from briefing note (Flow 2) — lives in the shared flow component
  let draftFlow; // bind:this
  function openDraftSetup() { draftFlow?.open(); }

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
    showEditor = true;
  }

  // Chosen surveyors go to a review window - nothing is saved until each is drafted or saved as sent
  function handleReview(event) {
    reviewItems = event.detail.items.map(i => ({ ...i, state: 'pending' }));
    showPlanModal = false;
    showReview = true;
  }

  function markSent(keys) {
    reviewItems = reviewItems.map(i => keys.includes(i.key) ? { ...i, state: 'sent' } : i);
  }

  // Record a briefing as sent with no email stored (the email went out some other way)
  async function saveItemsAsSent(items) {
    reviewBusy = true;
    try {
      await Promise.all(items.map(i =>
        saveSentRequest(selectedProject.unique_id, {
          recipients: [{ surveyorId: i.surveyorId, contactId: i.contactId }]
        })
      ));
      markSent(items.map(i => i.key));
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      reviewBusy = false;
      await loadSentRequests();
    }
  }

  const pendingReviewItems = () => reviewItems.filter(i => i.state === 'pending');

  // The template to open the editor with for a surveyor's discipline: exact match, then a loose one
  // ("Landscape" vs "Landscape and Visual"), then the general (no-discipline) template
  function templateFor(discipline) {
    const d = (discipline || '').trim().toLowerCase();
    if (d) {
      const exact = templates.find(t => (t.discipline || '').toLowerCase() === d);
      if (exact) return exact;
      const loose = templates.find(t => {
        const td = (t.discipline || '').toLowerCase();
        return td && (td.includes(d) || d.includes(td));
      });
      if (loose) return loose;
    }
    return templates.find(t => !t.discipline) || null;
  }

  function startDrafting(items) {
    editorQueue = items;
    editorIndex = 0;
    draftOverrides = {};
  }

  // Emails still to do after the current one that share its discipline - what "Apply to the rest" overwrites
  $: applyTargets = editorQueue.length
    ? editorQueue.filter((item, i) =>
        i !== editorIndex
        && item.discipline === editorQueue[editorIndex]?.discipline
        && reviewItems.find(r => r.key === item.key)?.state === 'pending')
    : [];

  // Copy the email being edited to the other same-discipline emails, swapping in each one's organisation and contact name
  function handleApplyToRest(event) {
    const current = editorQueue[editorIndex];
    const next = { ...draftOverrides };
    for (const item of applyTargets) {
      next[item.key] = adaptEmailForRecipient(event.detail.html, current, item);
    }
    draftOverrides = next;
  }

  // Every Draft click asks which notes (if any) to draft from first
  function askSources(items) {
    pendingDraftItems = items;
  }

  function draftTemplateOnly() {
    const items = pendingDraftItems;
    pendingDraftItems = null;
    draftSources = [];
    draftChecks = {};
    startDrafting(items);
  }

  function draftWithNotes(event) {
    const items = pendingDraftItems;
    pendingDraftItems = null;
    draftSources = event.detail.sources;
    startDrafting(items);
    runDraftChecks(items, event.detail.sources, event.detail.guidance);
  }

  // Pulls the "Scope of Work" section out of the merged template so the LLM doesn't repeat it
  function extractScopeFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const children = Array.from(doc.body.childNodes);
    const scopeIdx = children.findIndex(n => n.nodeName === 'H3' && n.textContent.trim().toLowerCase() === 'scope of work');
    if (scopeIdx === -1) return null;
    const endIdx = children.findIndex(n => n.nodeName === 'H3' && n.textContent.trim().toLowerCase() === 'key requirements');
    const end = endIdx === -1 ? children.length : endIdx;
    return children.slice(scopeIdx, end).map(n => n.nodeType === 3 ? n.textContent : n.outerHTML).join('');
  }

  // One LLM draft per discipline (shared by every surveyor in it), run in the background while the editor opens
  async function runDraftChecks(items, sources, guidance) {
    const disciplines = [...new Set(items.map(i => i.discipline))];
    draftChecks = Object.fromEntries(disciplines.map(d => [d, { status: 'loading' }]));
    await Promise.all(disciplines.map(async (discipline) => {
      try {
        const template = templateFor(discipline);
        if (!template) {
          draftChecks = { ...draftChecks, [discipline]: { status: 'ready', apiResult: null } };
          return;
        }
        const surveyorIds = items.filter(i => i.discipline === discipline).map(i => i.surveyorId);
        const merged = await mergeTemplate(template.id, selectedProject.unique_id, surveyorIds);
        const scopeContent = extractScopeFromHtml(merged.content) ?? '(This template has no separate scope of work section.)';
        // Stream the draft: the editor shows the intro and Project Information as they are written
        let raw = '';
        const apiResult = await suggestEmailEditsForDiscipline(selectedProject.unique_id, {
          sources,
          discipline,
          templateContent: scopeContent,
          guidance,
          onDelta: (text) => {
            raw += text;
            draftChecks = {
              ...draftChecks,
              [discipline]: {
                status: 'loading',
                partial: {
                  intro: partialJsonString(raw, 'intro'),
                  projectInfo: partialJsonString(raw, 'suggestedContent')
                }
              }
            };
          }
        });
        draftChecks = { ...draftChecks, [discipline]: { status: 'ready', apiResult } };
      } catch (err) {
        draftChecks = { ...draftChecks, [discipline]: { status: 'error', error: err.message } };
      }
    }));
  }

  function handleEditorSaved() {
    markSent([editorQueue[editorIndex].key]);
    loadSentRequests();
    if (editorIndex + 1 < editorQueue.length) editorIndex += 1;
    else editorQueue = [];
  }

  function closeReview() {
    showReview = false;
    reviewItems = [];
    loadSentRequests();
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
    await loadSentRequests();
  }

  function handleClose() {
    showEditor = false;
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
      <!-- Hidden for now (may return): AI-suggested disciplines/surveyors from a briefing note. The flow component below is still mounted.
      <button class="btn-draft-main" on:click={openDraftSetup} disabled={!selectedProject?.unique_id}>
        <i class="las la-magic"></i>
        Draft from Briefing Note
      </button>
      -->
      <button class="btn btn-primary" on:click={() => showChoice = true}>
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

<!-- Briefing Editor Modal (manual "New Quote Request") -->
{#if showEditor}
  <BriefingEditor
    show={showEditor}
    projectId={selectedProject?.unique_id}
    on:saved={handleSaved}
    on:close={handleClose}
  />
{/if}

<NewRequestChoiceModal
  show={showChoice}
  on:select={() => { showChoice = false; showPlanModal = true; }}
  on:draft={() => { showChoice = false; openNewRequest(); }}
  on:close={() => showChoice = false}
/>

<!-- Pick disciplines, then surveyors for each, then review -->
<PlanSurveyorsModal
  show={showPlanModal}
  preselected={reviewItems}
  on:review={handleReview}
  on:close={() => showPlanModal = false}
/>

<ReviewSelectionsModal
  show={showReview}
  items={reviewItems}
  busy={reviewBusy}
  on:draft={(e) => askSources([e.detail.item])}
  on:save={(e) => saveItemsAsSent([e.detail.item])}
  on:draftall={() => askSources(pendingReviewItems())}
  on:saveall={() => saveItemsAsSent(pendingReviewItems())}
  on:back={() => { showReview = false; showPlanModal = true; }}
  on:close={closeReview}
/>

<DraftSourcesModal
  show={!!pendingDraftItems}
  projectUniqueId={selectedProject?.unique_id}
  draftCount={pendingDraftItems?.length ?? 1}
  on:go={draftWithNotes}
  on:skip={draftTemplateOnly}
  on:close={() => pendingDraftItems = null}
/>

<!-- Editor for the review window's drafts; rendered after it so it sits on top. Keyed so each draft starts fresh -->
{#if editorQueue.length}
  {#key editorIndex}
    <BriefingEditor
      show={true}
      projectId={selectedProject?.unique_id}
      preSelectedSurveyors={[editorQueue[editorIndex]]}
      preSelectedTemplate={templateFor(editorQueue[editorIndex].discipline)}
      preSelectedDiscipline={editorQueue[editorIndex].discipline}
      sources={draftSources}
      precomputedCheck={draftChecks[editorQueue[editorIndex].discipline]}
      stepCurrent={editorIndex + 1}
      stepTotal={editorQueue.length}
      initialHtml={draftOverrides[editorQueue[editorIndex].key] ?? null}
      applyTargetCount={applyTargets.length}
      on:applytorest={handleApplyToRest}
      on:saved={handleEditorSaved}
      on:close={() => editorQueue = []}
      on:prev={() => editorIndex = Math.max(0, editorIndex - 1)}
      on:next={() => editorIndex = Math.min(editorQueue.length - 1, editorIndex + 1)}
    />
  {/key}
{/if}

<DraftFromBriefingFlow
  bind:this={draftFlow}
  projectUniqueId={selectedProject?.unique_id}
  on:saved={loadSentRequests}
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

  .briefing-dropdown-date {
    font-size: 0.75rem;
    color: var(--color-slate-400);
    white-space: nowrap;
    flex-shrink: 0;
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
