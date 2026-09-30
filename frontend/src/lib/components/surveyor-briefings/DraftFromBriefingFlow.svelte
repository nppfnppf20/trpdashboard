<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { mergeTemplate, suggestEmailEditsForDiscipline } from '$lib/api/quoteRequests.js';
  import { listDevelopmentTypes } from '$lib/api/guidingBriefs.js';
  import BriefingEditor from './BriefingEditor.svelte';
  import NoteSourcePicker from '$lib/components/shared/NoteSourcePicker.svelte';
  import DraftBriefingsModal from './DraftBriefingsModal.svelte';

  // The "Draft from Briefing Note" flow: setup modal (pick briefing/meeting
  // notes + development type) → DraftBriefingsModal (disciplines, templates,
  // surveyors) → BriefingEditor once per queued draft. Shared by the Surveyor
  // Management page and the project chat; the host calls open() and listens
  // for 'saved' (a request was saved) and 'close' (flow finished or abandoned).
  export let projectUniqueId;

  const dispatch = createEventDispatcher();

  let showDraftSetupModal = false;
  let showDraftModal = false;
  let showEditor = false;
  let draftDevelopmentType = null;
  let selectedTemplate = null;

  // Source picker — nothing ticked = fall back to the latest briefing note,
  // matching the previous single-select default.
  let sourcePicker; // bind:this — used to reset ticks when the setup modal reopens
  let setupSources = []; // [{ type, id, full }] — bound from NoteSourcePicker
  let setupOverBudget = false;
  let selectedSources = []; // [{ type, id, full }] — confirmed selection, threaded to DraftBriefingsModal/BriefingEditor
  let setupDevType = null;

  // Development types with a guiding brief already set up for surveyor briefings —
  // drives the setup modal's dropdown instead of a hardcoded list
  let devTypes = [];

  let pendingDrafts = []; // [{ discipline, template, surveyors }] — queued after modal
  let currentDraftIndex = 0; // which pending draft is open in BriefingEditor
  let editorPreselectedSurveyors = []; // passed to BriefingEditor when opening a queued draft
  // Background scope checks: keyed by discipline
  // { status: 'loading'|'ready'|'error', apiResult: {hasChanges,suggestedContent}|null, error?: string }
  let draftCheckResults = {};

  onMount(async () => {
    try {
      devTypes = await listDevelopmentTypes('surveyor_briefing');
    } catch {
      devTypes = [];
    }
  });

  export function open() {
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

  function handleDraftProceed(event) {
    pendingDrafts = event.detail.drafts;
    currentDraftIndex = 0;
    showDraftModal = false;
    draftCheckResults = {};
    const uniqueDrafts = pendingDrafts.filter((d, i) => pendingDrafts.findIndex(x => x.discipline === d.discipline) === i);
    runBackgroundChecks(uniqueDrafts, projectUniqueId, selectedSources);
    openDraft(0);
  }

  function openDraft(index) {
    if (index < 0 || index >= pendingDrafts.length) {
      pendingDrafts = [];
      currentDraftIndex = 0;
      showEditor = false;
      dispatch('close');
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
    showEditor = true;
  }

  function handleSaved() {
    showEditor = false;
    selectedTemplate = null;
    editorPreselectedSurveyors = [];
    dispatch('saved');
    openDraft(currentDraftIndex + 1);
  }

  function handleEditorClose() {
    showEditor = false;
    selectedTemplate = null;
    editorPreselectedSurveyors = [];
    pendingDrafts = [];
    currentDraftIndex = 0;
    dispatch('close');
  }

  function handleSetupClose() {
    showDraftSetupModal = false;
    dispatch('close');
  }

  function handleDraftModalClose() {
    // 'close' is also dispatched after 'proceed' — only treat it as an abandon
    // when no drafts were queued.
    showDraftModal = false;
    if (!pendingDrafts.length) dispatch('close');
  }

  function handlePrev() { openDraft(currentDraftIndex - 1); }
  function handleNext() { openDraft(currentDraftIndex + 1); }
</script>

<!-- Keyed so prev/next navigation remounts the editor with fresh per-draft state
     (briefingApplied, mergeDone, selectedSurveyors) instead of reusing the old instance -->
{#if showEditor}
  {#key currentDraftIndex}
  <BriefingEditor
    show={showEditor}
    projectId={projectUniqueId}
    preSelectedTemplate={selectedTemplate}
    preSelectedSurveyors={editorPreselectedSurveyors}
    sources={selectedSources}
    precomputedCheck={draftCheckResults[pendingDrafts[currentDraftIndex]?.discipline]}
    stepCurrent={currentDraftIndex + 1}
    stepTotal={pendingDrafts.length}
    on:saved={handleSaved}
    on:close={handleEditorClose}
    on:prev={handlePrev}
    on:next={handleNext}
  />
  {/key}
{/if}

{#if showDraftSetupModal}
  <div class="setup-overlay" on:click|self={handleSetupClose}>
    <div class="setup-modal setup-modal-wide">
      <div class="setup-header">
        <div class="setup-header-left">
          <i class="las la-magic"></i>
          <h3>Draft from Briefing Note</h3>
        </div>
        <button class="setup-close" on:click={handleSetupClose}><i class="las la-times"></i></button>
      </div>
      <div class="setup-body">
        <NoteSourcePicker
          bind:this={sourcePicker}
          {projectUniqueId}
          hint="Tick any briefing notes and meeting notes to use as source material - leave everything unticked to use the latest briefing note automatically."
          bind:selectedSources={setupSources}
          bind:overBudget={setupOverBudget}
        />

        <div class="setup-field">
          <label for="draft-flow-dev-type">Development type</label>
          <select id="draft-flow-dev-type" bind:value={setupDevType}>
            <option value={null}>Other (no guiding brief)</option>
            {#each devTypes as dt}
              <option value={dt}>{dt}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="setup-footer">
        <button class="btn btn-secondary" on:click={handleSetupClose}>Cancel</button>
        <button class="btn btn-draft-go" on:click={confirmDraftSetup} disabled={setupOverBudget}>
          <i class="las la-magic"></i> Draft
        </button>
      </div>
    </div>
  </div>
{/if}

<DraftBriefingsModal
  show={showDraftModal}
  projectId={projectUniqueId}
  developmentType={draftDevelopmentType || null}
  sources={selectedSources}
  on:proceed={handleDraftProceed}
  on:close={handleDraftModalClose}
/>

<style>
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
</style>
