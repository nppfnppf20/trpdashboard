<script>
  import { createEventDispatcher } from 'svelte';
  import { analyseDisciplines, getTemplates, getSurveyorsForDiscipline } from '$lib/api/quoteRequests.js';
  import { getLookupOptions } from '$lib/api/lookups.js';
  import SelectSurveyorModal from './SelectSurveyorModal.svelte';

  export let show = false;
  export let projectId;
  export let developmentType = null;
  export let sources = [];

  const dispatch = createEventDispatcher();

  let loading = false;
  let error = null;
  let suggestions = []; // [{ discipline, reasoning, template, hasSpecificTemplate, surveyors, manual? }]
  let allTemplates = [];
  let allDisciplines = []; // master discipline list — not limited to disciplines with a template

  // Per-discipline: accepted/skipped + selected surveyor IDs
  let accepted = new Set();
  let selectedSurveyors = {}; // { [discipline]: Set<surveyorId> }
  let selectedContacts = {};  // { [discipline]: { [surveyorId]: contactId } }
  let expandedOrgs = {};      // { [discipline]: Set<surveyorId> }

  // Full surveyor list modal
  let showFullSurveyorModal = false;
  let surveyorModalForDiscipline = null;

  // Add-discipline UI
  let addDisciplineValue = '';
  let addDisciplineLoading = false;

  $: suggestedDisciplines = new Set(suggestions.map(s => s.discipline));
  $: availableToAdd = allDisciplines.filter(d => d && !suggestedDisciplines.has(d));

  $: acceptedWithSurveyors = suggestions.filter(s =>
    accepted.has(s.discipline) &&
    (selectedSurveyors[s.discipline]?.size ?? 0) > 0
  );

  async function run() {
    loading = true;
    error = null;
    suggestions = [];
    accepted = new Set();
    selectedSurveyors = {};
    try {
      const [{ suggestions: result }, templates, disciplineOptions] = await Promise.all([
        analyseDisciplines(projectId, { sources, developmentType }),
        getTemplates(),
        getLookupOptions('surveyor_disciplines')
      ]);
      allTemplates = templates;
      allDisciplines = disciplineOptions.map(d => d.label);
      suggestions = result;
      for (const s of suggestions) {
        accepted = new Set([...accepted, s.discipline]);
        selectedSurveyors[s.discipline] = new Set();
        selectedContacts[s.discipline] = {};
        expandedOrgs[s.discipline] = new Set();
      }
    } catch (err) {
      error = err.message || 'Failed to analyse disciplines';
    } finally {
      loading = false;
    }
  }

  async function addDiscipline() {
    if (!addDisciplineValue || suggestedDisciplines.has(addDisciplineValue)) return;
    addDisciplineLoading = true;
    try {
      const surveyors = await getSurveyorsForDiscipline(addDisciplineValue);
      const specificTemplate = allTemplates.find(t => t.discipline?.toLowerCase() === addDisciplineValue.toLowerCase()) ?? null;
      const generalTemplate = allTemplates.find(t => t.discipline === null) ?? null;
      const template = specificTemplate ?? generalTemplate;
      const hasSpecificTemplate = !!specificTemplate;
      const newEntry = { discipline: addDisciplineValue, reasoning: null, template, hasSpecificTemplate, surveyors, manual: true };
      suggestions = [...suggestions, newEntry];
      accepted = new Set([...accepted, addDisciplineValue]);
      selectedSurveyors[addDisciplineValue] = new Set();
      selectedContacts[addDisciplineValue] = {};
      expandedOrgs[addDisciplineValue] = new Set();
      addDisciplineValue = '';
    } catch (err) {
      console.error('Failed to add discipline:', err);
    } finally {
      addDisciplineLoading = false;
    }
  }

  $: if (show) run();

  function toggleAccept(discipline) {
    const n = new Set(accepted);
    if (n.has(discipline)) n.delete(discipline);
    else n.add(discipline);
    accepted = n;
  }

  function selectSurveyor(discipline, surveyorId) {
    const cur = new Set(selectedSurveyors[discipline] ?? []);
    const exp = new Set(expandedOrgs[discipline] ?? []);
    if (cur.has(surveyorId)) {
      cur.delete(surveyorId);
      exp.delete(surveyorId);
    } else {
      cur.add(surveyorId);
      exp.add(surveyorId);
      // Default to primary contact
      const sv = suggestions.find(s => s.discipline === discipline)?.surveyors.find(sv => sv.id === surveyorId);
      const primary = sv?.contacts?.find(c => c.is_primary) ?? sv?.contacts?.[0];
      if (primary) {
        selectedContacts = { ...selectedContacts, [discipline]: { ...(selectedContacts[discipline] ?? {}), [surveyorId]: primary.id } };
      }
    }
    selectedSurveyors = { ...selectedSurveyors, [discipline]: cur };
    expandedOrgs = { ...expandedOrgs, [discipline]: exp };
  }

  function toggleExpandOrg(discipline, surveyorId) {
    const exp = new Set(expandedOrgs[discipline] ?? []);
    if (exp.has(surveyorId)) exp.delete(surveyorId); else exp.add(surveyorId);
    expandedOrgs = { ...expandedOrgs, [discipline]: exp };
  }

  function setContact(discipline, surveyorId, contactId) {
    selectedContacts = { ...selectedContacts, [discipline]: { ...(selectedContacts[discipline] ?? {}), [surveyorId]: contactId } };
  }

  function openFullSurveyorModal(discipline) {
    surveyorModalForDiscipline = discipline;
    showFullSurveyorModal = true;
  }

  function handleFullSurveyorSelect(event) {
    const { surveyorId, surveyorOrganisation, discipline: svDiscipline, contactId, contactName, contactEmail } = event.detail;
    const disc = surveyorModalForDiscipline;
    // Add surveyor to discipline list if not already there
    suggestions = suggestions.map(s => {
      if (s.discipline !== disc || s.surveyors.some(sv => sv.id === surveyorId)) return s;
      return { ...s, surveyors: [...s.surveyors, { id: surveyorId, organisation: surveyorOrganisation, discipline: svDiscipline, contacts: [{ id: contactId, name: contactName, email: contactEmail, is_primary: true }], avg_overall: null, location: null }] };
    });
    // Select it with the chosen contact
    const cur = new Set(selectedSurveyors[disc] ?? []);
    cur.add(surveyorId);
    selectedSurveyors = { ...selectedSurveyors, [disc]: cur };
    selectedContacts = { ...selectedContacts, [disc]: { ...(selectedContacts[disc] ?? {}), [surveyorId]: contactId } };
    showFullSurveyorModal = false;
  }

  $: totalEmails = suggestions.reduce((sum, s) =>
    accepted.has(s.discipline) ? sum + (selectedSurveyors[s.discipline]?.size ?? 0) : sum, 0
  );

  function handleProceed() {
    const output = [];
    for (const s of acceptedWithSurveyors) {
      const selected = s.surveyors.filter(sv => selectedSurveyors[s.discipline]?.has(sv.id));
      for (const sv of selected) {
        const contactId = selectedContacts[s.discipline]?.[sv.id];
        output.push({ discipline: s.discipline, template: s.template, surveyors: [{ ...sv, _selectedContactId: contactId }] });
      }
    }
    dispatch('proceed', { drafts: output });
    dispatch('close');
  }

  function handleClose() {
    dispatch('close');
  }

  function starRating(val) {
    const n = parseFloat(val);
    if (!n) return '—';
    const rounded = Math.round(n);
    return '★'.repeat(rounded) + '☆'.repeat(Math.max(0, 5 - rounded));
  }

  let detailSuggestion = null; // the suggestion being viewed in the detail popup

  function openDetail(suggestion, e) {
    e.stopPropagation();
    detailSuggestion = suggestion;
  }

  function closeDetail() {
    detailSuggestion = null;
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-left">
          <i class="las la-magic"></i>
          <h2>Draft from Briefing Note</h2>
        </div>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Analysing briefing note and identifying required disciplines…</p>
          </div>

        {:else if error}
          <div class="error-state">
            <i class="las la-exclamation-triangle"></i>
            <p>{error}</p>
            <button class="btn btn-secondary" on:click={run}>Try again</button>
          </div>

        {:else if suggestions.length === 0}
          <div class="empty-state">
            <i class="las la-search"></i>
            <p>No disciplines identified from the briefing note. Make sure a briefing note has been uploaded for this project.</p>
          </div>

        {:else}
          <p class="intro-text">
            The following disciplines were identified from the project briefing note.
            Review the suggested surveyors and accept or skip each discipline.
          </p>

          {#each suggestions as suggestion}
            {@const isAccepted = accepted.has(suggestion.discipline)}
            {@const isSkipped = !isAccepted}
            <div class="discipline-card" class:card-accepted={isAccepted} class:card-skipped={isSkipped}>
              <div class="card-header">
                <div class="card-header-left">
                  <button
                    class="accept-toggle"
                    class:is-accepted={isAccepted}
                    on:click={() => toggleAccept(suggestion.discipline)}
                    title={isAccepted ? 'Click to skip' : 'Click to accept'}
                  >
                    <i class="las {isAccepted ? 'la-check-circle' : 'la-circle'}"></i>
                  </button>
                  <div class="discipline-info">
                    <h3>{suggestion.discipline}</h3>
                    {#if suggestion.hasSpecificTemplate}
                      <span class="template-pill">
                        <i class="las la-file-alt"></i>
                        {suggestion.template.template_name}
                      </span>
                    {:else if suggestion.template}
                      <span class="general-template-pill" title="No {suggestion.discipline}-specific template exists - using the general template instead. Review before sending.">
                        <i class="las la-exclamation-triangle"></i>
                        Using general template - review before sending
                      </span>
                    {:else}
                      <span class="no-template-pill">No template, email will need to be written manually</span>
                    {/if}
                  </div>
                </div>
                <div class="card-header-right">
                  {#if isAccepted}
                    <span class="status-badge accepted">Included</span>
                  {:else}
                    <span class="status-badge skipped">Skipped</span>
                  {/if}
                </div>
              </div>

              {#if suggestion.manual}
                <div class="card-reasoning card-reasoning--manual">
                  <i class="las la-plus-circle"></i>
                  <span class="reasoning-text">Added manually</span>
                </div>
              {:else}
                <div class="card-reasoning">
                  <i class="las la-info-circle"></i>
                  <span class="reasoning-text">{suggestion.reasoning}</span>
                  <button class="btn-view-detail" on:click={(e) => openDetail(suggestion, e)} title="View full details">
                    <i class="las la-eye"></i> View
                  </button>
                </div>
              {/if}

              {#if isAccepted}
                <div class="surveyors-section">
                  <div class="surveyors-label">
                    <i class="las la-users"></i>
                    Suggested surveyors (4★+)
                    {#if suggestion.surveyors.length === 0}
                      <span class="no-surveyors-note">none on record for this discipline</span>
                    {/if}
                  </div>

                  {#if suggestion.surveyors.length > 0}
                    <div class="surveyors-list">
                      {#each suggestion.surveyors as surveyor}
                        {@const isSelected = selectedSurveyors[suggestion.discipline]?.has(surveyor.id) ?? false}
                        {@const isExpanded = expandedOrgs[suggestion.discipline]?.has(surveyor.id) ?? false}
                        {@const chosenContactId = selectedContacts[suggestion.discipline]?.[surveyor.id]}
                        {@const chosenContact = surveyor.contacts?.find(c => c.id === chosenContactId)}
                        <div class="surveyor-block" class:block-selected={isSelected}>
                          <div class="surveyor-row">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              on:change={() => selectSurveyor(suggestion.discipline, surveyor.id)}
                            />
                            <div class="surveyor-details">
                              <span class="surveyor-name">{surveyor.organisation}</span>
                              <div class="surveyor-sub">
                                {#if surveyor.location}<span class="surveyor-location">{surveyor.location}</span>{/if}
                                {#if isSelected && chosenContact}
                                  <span class="chosen-contact">{chosenContact.name}{chosenContact.email ? ` · ${chosenContact.email}` : ''}</span>
                                {/if}
                              </div>
                            </div>
                            <div class="surveyor-row-right">
                              {#if surveyor.avg_overall != null}
                                <span class="surveyor-rating">{starRating(surveyor.avg_overall)}</span>
                              {/if}
                              {#if surveyor.contacts?.length}
                                <button class="btn-expand-contacts" on:click|stopPropagation={() => toggleExpandOrg(suggestion.discipline, surveyor.id)} title="{isExpanded ? 'Hide' : 'Show'} contacts">
                                  <i class="las la-angle-{isExpanded ? 'up' : 'down'}"></i>
                                </button>
                              {/if}
                            </div>
                          </div>
                          {#if isExpanded && surveyor.contacts?.length}
                            <div class="contacts-expand">
                              {#each surveyor.contacts as contact}
                                {@const isCurrent = chosenContactId === contact.id}
                                <label class="contact-option" class:contact-current={isCurrent}>
                                  <input type="radio"
                                    name="contact-{suggestion.discipline}-{surveyor.id}"
                                    checked={isCurrent}
                                    on:change={() => setContact(suggestion.discipline, surveyor.id, contact.id)}
                                  />
                                  <div class="contact-option-info">
                                    <span class="contact-option-name">{contact.name}{#if contact.is_primary} <span class="primary-tag">Primary</span>{/if}</span>
                                    {#if contact.email}<span class="contact-option-email">{contact.email}</span>{/if}
                                  </div>
                                </label>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                  <button class="btn-open-full-list" on:click={() => openFullSurveyorModal(suggestion.discipline)}>
                    <i class="las la-users"></i> Open full surveyor list
                  </button>
                </div>
              {/if}
            </div>
          {/each}

          <!-- Add discipline -->
          <div class="add-discipline-section">
            <div class="add-discipline-label">
              <i class="las la-plus-circle"></i>
              Add a discipline not identified above
            </div>
            <div class="add-discipline-controls">
              <select
                bind:value={addDisciplineValue}
                class="add-discipline-select"
                disabled={addDisciplineLoading || availableToAdd.length === 0}
              >
                <option value="">Select discipline</option>
                {#each availableToAdd as d}
                  <option value={d}>{d}</option>
                {/each}
              </select>
              <button
                class="btn btn-secondary btn-add-discipline"
                disabled={!addDisciplineValue || addDisciplineLoading}
                on:click={addDiscipline}
              >
                {#if addDisciplineLoading}
                  <div class="spinner-sm"></div>
                {:else}
                  <i class="las la-plus"></i>
                {/if}
                Add
              </button>
            </div>
          </div>
        {/if}
      </div>

      {#if !loading && suggestions.length > 0}
        <div class="modal-footer">
          <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
          <button
            class="btn btn-primary"
            disabled={totalEmails === 0}
            on:click={handleProceed}
          >
            <i class="las la-check"></i>
            Proceed ({totalEmails} email{totalEmails !== 1 ? 's' : ''})
          </button>
        </div>
      {/if}

      <!-- Detail popup — sits inside modal-content so it clips to the modal boundary -->
      <SelectSurveyorModal
        show={showFullSurveyorModal}
        selectedSurveyors={[]}
        on:select={handleFullSurveyorSelect}
        on:close={() => showFullSurveyorModal = false}
      />

      {#if detailSuggestion}
        {@const ds = detailSuggestion}
        {@const dsAccepted = accepted.has(ds.discipline)}
        <div class="detail-overlay" on:click|self={closeDetail}>
          <div class="detail-popup">
            <div class="detail-header">
              <h3>{ds.discipline}</h3>
              <button class="close-btn" on:click={closeDetail}><i class="las la-times"></i></button>
            </div>

            {#if ds.template}
              <div class="detail-meta">
                <i class="las la-file-alt"></i>
                <span>Template: {ds.template.template_name}{#if !ds.hasSpecificTemplate} (general - no {ds.discipline}-specific template exists){/if}</span>
              </div>
            {/if}

            <div class="detail-section">
              <div class="detail-section-label">Why this discipline is needed</div>
              <p class="detail-reasoning">{ds.reasoning}</p>
            </div>

            <div class="detail-section">
              <div class="detail-section-label">
                Suggested surveyors (4★+)
                {#if ds.surveyors.length === 0}
                  <span class="no-surveyors-note">none on record</span>
                {/if}
              </div>
              {#if ds.surveyors.length > 0}
                <div class="detail-surveyors">
                  {#each ds.surveyors as surveyor}
                    {@const isSel = selectedSurveyors[ds.discipline]?.has(surveyor.id) ?? false}
                    <label class="detail-surveyor-row" class:row-selected={isSel}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        on:change={() => selectSurveyor(ds.discipline, surveyor.id)}
                      />
                      <div class="surveyor-details">
                        <span class="surveyor-name">{surveyor.organisation}</span>
                        {#if surveyor.location}<span class="surveyor-location">{surveyor.location}</span>{/if}
                      </div>
                      <div class="detail-rating">
                        <span class="surveyor-rating">{starRating(surveyor.avg_overall)}</span>
                        {#if surveyor.avg_overall != null}
                          <span class="rating-num">{parseFloat(surveyor.avg_overall).toFixed(1)}</span>
                        {/if}
                      </div>
                    </label>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="detail-footer">
              <button class="btn btn-secondary" on:click={closeDetail}>Close</button>
              <button
                class="btn {dsAccepted ? 'btn-skip' : 'btn-primary'}"
                on:click={() => { toggleAccept(ds.discipline); closeDetail(); }}
              >
                <i class="las {dsAccepted ? 'la-times-circle' : 'la-check-circle'}"></i>
                {dsAccepted ? 'Skip this discipline' : 'Include this discipline'}
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
    width: 100%;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    color: #7c3aed;
  }

  .header-left i {
    font-size: 1.25rem;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .modal-body {
    overflow-y: auto;
    max-height: 65vh;
    padding: 1.5rem;
  }

  .loading-state, .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 1rem;
    color: #64748b;
    text-align: center;
  }

  .error-state {
    color: #dc2626;
  }

  .error-state i, .empty-state i {
    font-size: 2rem;
    opacity: 0.6;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .intro-text {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
    line-height: 1.5;
  }

  /* ── Discipline card ─────────────────────────────────────────────────────── */
  .discipline-card {
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.15s;
    margin-bottom: 1rem;
  }

  .card-accepted {
    border-color: #a7f3d0;
    background: #f0fdf4;
  }

  .card-skipped {
    opacity: 0.55;
    background: #f8fafc;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 1rem 1.125rem 0.75rem;
    gap: 0.75rem;
  }

  .card-header-left {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .accept-toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-size: 1.4rem;
    color: #94a3b8;
    margin-top: 0.1rem;
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .accept-toggle.is-accepted {
    color: #10b981;
  }

  .accept-toggle:hover {
    color: #10b981;
  }

  .discipline-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .discipline-info h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .template-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #4338ca;
    background: #e0e7ff;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
  }

  .no-template-pill {
    font-size: 0.75rem;
    color: #92400e;
    background: #fef3c7;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
  }

  .general-template-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #92400e;
    background: #fef3c7;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
  }

  .card-header-right {
    flex-shrink: 0;
  }

  .status-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
  }

  .status-badge.accepted {
    background: #d1fae5;
    color: #065f46;
  }

  .status-badge.skipped {
    background: #f1f5f9;
    color: #94a3b8;
  }

  /* ── Surveyors section ───────────────────────────────────────────────────── */
  .surveyors-section {
    border-top: 1px solid #e2e8f0;
    padding: 0.875rem 1.125rem;
    background: rgba(255,255,255,0.6);
  }

  .surveyors-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin-bottom: 0.625rem;
  }

  .no-surveyors-note {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: #94a3b8;
    font-size: 0.75rem;
  }

  .surveyors-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .surveyor-block {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
    background: white;
    transition: border-color 0.15s;
  }

  .surveyor-block.block-selected {
    border-color: #6ee7b7;
    background: #ecfdf5;
  }

  .surveyor-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
  }

  .surveyor-block:not(.block-selected) .surveyor-row:hover {
    background: #f0fdf4;
  }

  .surveyor-row input[type="checkbox"] {
    width: 15px;
    height: 15px;
    cursor: pointer;
    flex-shrink: 0;
    accent-color: #10b981;
  }

  .surveyor-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .surveyor-name {
    font-weight: 600;
    font-size: 0.8rem;
    color: #1e293b;
  }

  .surveyor-sub {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem 0.5rem;
    align-items: center;
  }

  .surveyor-location {
    font-size: 0.7rem;
    color: #64748b;
  }

  .chosen-contact {
    font-size: 0.7rem;
    color: #059669;
    font-weight: 500;
  }

  .surveyor-row-right {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .surveyor-rating {
    font-size: 0.7rem;
    color: #f59e0b;
    letter-spacing: 0.05em;
  }

  .btn-expand-contacts {
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    font-size: 0.75rem;
    padding: 0.15rem 0.3rem;
    border-radius: 3px;
    display: flex;
    align-items: center;
    transition: color 0.1s;
  }
  .btn-expand-contacts:hover { color: #475569; }

  .contacts-expand {
    border-top: 1px solid #d1fae5;
    padding: 0.4rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    background: rgba(255,255,255,0.7);
  }

  .contact-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.4rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.78rem;
    transition: background 0.1s;
  }
  .contact-option:hover { background: #f0fdf4; }
  .contact-option.contact-current { background: #dcfce7; }

  .contact-option input[type="radio"] {
    accent-color: #10b981;
    flex-shrink: 0;
  }

  .contact-option-info {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
  }

  .contact-option-name {
    font-weight: 500;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .primary-tag {
    font-size: 0.65rem;
    font-weight: 600;
    background: #dbeafe;
    color: #1e40af;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .contact-option-email {
    font-size: 0.7rem;
    color: #64748b;
  }

  .btn-open-full-list {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.4rem;
    padding: 0.35rem 0.6rem;
    background: none;
    border: 1px dashed #cbd5e1;
    border-radius: 5px;
    font-size: 0.775rem;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    align-self: flex-start;
  }
  .btn-open-full-list:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #7c3aed;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #6d28d9;
  }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
  }

  .btn-skip {
    background: white;
    color: #dc2626;
    border: 1px solid #fca5a5;
  }

  .btn-skip:hover:not(:disabled) {
    background: #fef2f2;
  }

  /* ── Card reasoning truncation + view button ─────────────────────────────── */
  .card-reasoning {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0 1.125rem 0.875rem;
    font-size: 0.8rem;
    color: #475569;
    line-height: 1.5;
  }

  .card-reasoning i {
    font-size: 0.9rem;
    color: #94a3b8;
    margin-top: 0.1rem;
    flex-shrink: 0;
  }

  .reasoning-text {
    flex: 1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .btn-view-detail {
    flex-shrink: 0;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    color: #475569;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn-view-detail:hover {
    color: #7c3aed;
  }

  /* ── Detail popup ────────────────────────────────────────────────────────── */
  .detail-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    z-index: 10;
  }

  .detail-popup {
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.18);
    width: 100%;
    max-width: 520px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .detail-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #1e293b;
  }

  .detail-meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 1.25rem;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.8rem;
    color: #4338ca;
  }

  .detail-section {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
    overflow-y: auto;
  }

  .detail-section:last-of-type {
    flex: 1;
  }

  .detail-section-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #94a3b8;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .detail-reasoning {
    margin: 0;
    font-size: 0.85rem;
    color: #334155;
    line-height: 1.65;
  }

  .detail-surveyors {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .detail-surveyor-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .detail-surveyor-row:hover {
    border-color: #a7f3d0;
    background: #f0fdf4;
  }

  .detail-surveyor-row.row-selected {
    border-color: #6ee7b7;
    background: #ecfdf5;
  }

  .detail-surveyor-row input[type="checkbox"] {
    width: 15px;
    height: 15px;
    cursor: pointer;
    flex-shrink: 0;
    accent-color: #10b981;
  }

  .detail-rating {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.1rem;
    flex-shrink: 0;
  }

  .rating-num {
    font-size: 0.65rem;
    color: #94a3b8;
  }

  .detail-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid #e2e8f0;
  }

  /* ── Manual badge ────────────────────────────────────────────────────────── */
  .card-reasoning--manual i {
    color: #6366f1;
  }

  .card-reasoning--manual .reasoning-text {
    color: #6366f1;
    font-style: italic;
  }

  /* ── Add discipline section ──────────────────────────────────────────────── */
  .add-discipline-section {
    border: 1.5px dashed #cbd5e1;
    border-radius: 8px;
    padding: 0.875rem 1.125rem;
    margin-top: 0.5rem;
  }

  .add-discipline-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin-bottom: 0.625rem;
  }

  .add-discipline-label i {
    color: #94a3b8;
  }

  .add-discipline-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .add-discipline-select {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #1e293b;
    background: white;
    cursor: pointer;
  }

  .add-discipline-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-add-discipline {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .spinner-sm {
    width: 14px;
    height: 14px;
    border: 2px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
</style>
