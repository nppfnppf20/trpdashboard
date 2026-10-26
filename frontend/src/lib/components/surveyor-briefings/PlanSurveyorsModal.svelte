<script>
  import { createEventDispatcher } from 'svelte';
  import { getAllSurveyorOrganisations } from '$lib/api/surveyorOrganisations.js';

  export let show = false;
  export let preselected = []; // items to restore when coming back from the review step

  const dispatch = createEventDispatcher();

  let surveyors = [];
  let loading = false;
  let error = null;

  let step = 1;                  // 1 = pick disciplines, 2 = pick surveyors per discipline
  let chosenDisciplines = [];
  let selected = {};             // surveyorId -> { key, surveyorId, ..., contactId, contactName, contactEmail }

  // Reset and load each time the modal opens
  let wasShown = false;
  $: if (show && !wasShown) {
    wasShown = true;
    step = preselected.length ? 2 : 1;
    chosenDisciplines = [...new Set(preselected.map(p => p.discipline))];
    selected = Object.fromEntries(preselected.map(p => [p.surveyorId, p]));
    loadSurveyors();
  } else if (!show) {
    wasShown = false;
  }

  async function loadSurveyors() {
    loading = true;
    error = null;
    try {
      surveyors = await getAllSurveyorOrganisations();
    } catch (err) {
      console.error('Error loading surveyors:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Disciplines that actually have surveyors on file, with how many
  $: disciplines = Object.entries(
    surveyors.reduce((acc, s) => {
      if (s.discipline) acc[s.discipline] = (acc[s.discipline] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  $: surveyorsByDiscipline = chosenDisciplines.map(d => ({
    discipline: d,
    surveyors: surveyors
      .filter(s => s.discipline === d)
      .sort((a, b) => (parseFloat(b.avg_overall) || 0) - (parseFloat(a.avg_overall) || 0)
        || (a.organisation || '').localeCompare(b.organisation || ''))
  }));

  $: selectedCount = Object.keys(selected).length;

  function toggleDiscipline(name) {
    chosenDisciplines = chosenDisciplines.includes(name)
      ? chosenDisciplines.filter(d => d !== name)
      : [...chosenDisciplines, name];
  }

  const itemFor = (surveyor, contact) => ({
    key: surveyor.id,
    surveyorId: surveyor.id,
    surveyorOrganisation: surveyor.organisation,
    discipline: surveyor.discipline,
    contactId: contact.id,
    contactName: contact.name,
    contactEmail: contact.email ?? ''
  });

  // Ticking a surveyor picks their primary contact (or the first); switch it with the radios below
  function toggleSurveyor(surveyor) {
    if (selected[surveyor.id]) {
      const { [surveyor.id]: _removed, ...rest } = selected;
      selected = rest;
      return;
    }
    const contact = surveyor.contacts?.find(c => c.is_primary) ?? surveyor.contacts?.[0];
    if (!contact) return;
    selected = { ...selected, [surveyor.id]: itemFor(surveyor, contact) };
  }

  function setContact(surveyor, contact) {
    selected = { ...selected, [surveyor.id]: itemFor(surveyor, contact) };
  }

  const countFor = (discipline) => Object.values(selected).filter(i => i.discipline === discipline).length;

  const toNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) || !n ? null : n;
  };

  const formatRating = (val) => {
    const n = toNum(val);
    return n === null ? 'N/A' : n.toFixed(1);
  };

  function starRating(val) {
    const n = toNum(val);
    if (n === null) return '';
    const rounded = Math.round(n);
    return '★'.repeat(rounded) + '☆'.repeat(Math.max(0, 5 - rounded));
  }

  // Colour band for a 1 to 5 score
  function tier(val) {
    const n = toNum(val);
    if (n === null) return 'none';
    if (n >= 4.0) return 'good';
    if (n >= 3.5) return 'ok';
    if (n >= 3.0) return 'poor';
    return 'bad';
  }

  function handleReview() {
    dispatch('review', { items: Object.values(selected) });
  }

  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose} role="presentation">
    <div class="modal-content" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div>
          <h2>Select Surveyors</h2>
          <p class="modal-subtitle">
            {step === 1 ? 'Step 1 of 2: which disciplines do you need?' : 'Step 2 of 2: choose the surveyors for each discipline'}
          </p>
        </div>
        <button class="close-btn" on:click={handleClose} aria-label="Close">
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="state"><div class="spinner"></div><p>Loading surveyors...</p></div>
        {:else if error}
          <div class="state"><i class="las la-exclamation-circle"></i><p>Error loading surveyors: {error}</p></div>
        {:else if disciplines.length === 0}
          <div class="state"><i class="las la-users"></i><p>No surveyors found</p></div>
        {:else if step === 1}
          <div class="chips">
            {#each disciplines as d}
              <button
                class="chip"
                class:active={chosenDisciplines.includes(d.name)}
                on:click={() => toggleDiscipline(d.name)}
              >
                {#if chosenDisciplines.includes(d.name)}<i class="las la-check"></i>{/if}
                {d.name}
                <span class="chip-count">{d.count}</span>
              </button>
            {/each}
          </div>
        {:else}
          {#each surveyorsByDiscipline as group}
            <section class="group">
              <h3>
                {group.discipline}
                <span class="group-count">{countFor(group.discipline)} selected</span>
              </h3>
              <div class="surveyor-list">
                {#each group.surveyors as surveyor (surveyor.id)}
                  {@const chosen = selected[surveyor.id]}
                  {@const hasContacts = !!surveyor.contacts?.length}
                  <div class="card" class:card-selected={!!chosen}>
                    <label class="card-main" class:disabled={!hasContacts}>
                      <input
                        type="checkbox"
                        checked={!!chosen}
                        disabled={!hasContacts}
                        on:change={() => toggleSurveyor(surveyor)}
                      />
                      <div class="card-info">
                        <div class="name-line">
                          <span class="surveyor-name">{surveyor.organisation}</span>
                          {#if !surveyor.total_reviews}
                            <span class="pill pill-warning">Unreviewed</span>
                          {:else if surveyor.approval_status === 'rejected'}
                            <span class="pill pill-danger">Rejected</span>
                          {:else if surveyor.approval_status === 'approved'}
                            <span class="pill pill-success">Approved</span>
                          {/if}
                        </div>
                        <span class="surveyor-meta">
                          {surveyor.location || 'No location on record'}
                          {#if !hasContacts} · No contacts{/if}
                        </span>
                      </div>

                      <div class="ratings">
                        <div class="overall tier-{tier(surveyor.avg_overall)}">
                          {#if toNum(surveyor.avg_overall) !== null}
                            <span class="stars">{starRating(surveyor.avg_overall)}</span>
                          {/if}
                          <span class="overall-num">{formatRating(surveyor.avg_overall)}</span>
                        </div>
                        <div class="sub-ratings">
                          <span class="sub tier-{tier(surveyor.avg_quality)}" title="Quality">Quality {formatRating(surveyor.avg_quality)}</span>
                          <span class="sub tier-{tier(surveyor.avg_responsiveness)}" title="Responsiveness">Resp. {formatRating(surveyor.avg_responsiveness)}</span>
                          <span class="sub tier-{tier(surveyor.avg_on_time)}" title="On time">On time {formatRating(surveyor.avg_on_time)}</span>
                        </div>
                        <span class="review-count">{surveyor.total_reviews || 0} review{surveyor.total_reviews === 1 ? '' : 's'}</span>
                      </div>
                    </label>

                    {#if chosen && surveyor.contacts?.length}
                      <div class="contacts">
                        {#each surveyor.contacts as contact (contact.id)}
                          <label class="contact" class:current={chosen.contactId === contact.id}>
                            {#if surveyor.contacts.length > 1}
                              <input
                                type="radio"
                                name="contact-{surveyor.id}"
                                checked={chosen.contactId === contact.id}
                                on:change={() => setContact(surveyor, contact)}
                              />
                            {:else}
                              <i class="las la-envelope"></i>
                            {/if}
                            <span class="contact-name">{contact.name}</span>
                            {#if contact.is_primary}<span class="primary-badge">Primary</span>{/if}
                            {#if contact.email}<span class="contact-email">{contact.email}</span>{/if}
                          </label>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </section>
          {/each}
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
        {#if step === 1}
          <button class="btn btn-primary" on:click={() => step = 2} disabled={chosenDisciplines.length === 0}>
            Next
            <i class="las la-arrow-right"></i>
          </button>
        {:else}
          <button class="btn btn-secondary" on:click={() => step = 1}>
            <i class="las la-arrow-left"></i>
            Back
          </button>
          <button class="btn btn-primary" on:click={handleReview} disabled={selectedCount === 0}>
            Review {selectedCount} surveyor{selectedCount !== 1 ? 's' : ''}
            <i class="las la-arrow-right"></i>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 860px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .modal-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--color-slate-500);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--color-slate-800);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    color: var(--color-slate-500);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-pill);
    font: inherit;
    color: var(--color-slate-800);
    cursor: pointer;
  }

  .chip:hover {
    border-color: var(--color-primary-500);
  }

  .chip.active {
    background: var(--color-primary-50);
    border-color: var(--color-primary-600);
    color: var(--color-primary-700);
    font-weight: 600;
  }

  .chip-count {
    font-size: 0.75rem;
    color: var(--color-slate-400);
  }

  .group + .group {
    margin-top: 1.5rem;
  }

  .group h3 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: var(--color-slate-800);
  }

  .group-count {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-primary-600);
  }

  .surveyor-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card {
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    background: white;
    transition: border-color 0.15s, background 0.15s;
  }

  .card:hover {
    border-color: var(--color-slate-400);
  }

  .card.card-selected {
    border-color: var(--color-primary-600);
    background: var(--color-primary-50);
  }

  .card-main {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
  }

  .card-main.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .card-main input[type="checkbox"] {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    cursor: inherit;
    accent-color: var(--color-primary-600);
  }

  .card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .name-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .surveyor-name {
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .surveyor-meta {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
  }

  .pill {
    padding: 0 0.5rem;
    border-radius: var(--radius-pill);
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .pill-success {
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }

  .pill-warning {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
  }

  .pill-danger {
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }

  .ratings {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .overall {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.625rem;
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .stars {
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  .sub-ratings {
    display: flex;
    gap: 0.25rem;
  }

  .sub {
    padding: 0 0.4rem;
    border-radius: var(--radius-sm);
    font-size: 0.6875rem;
    white-space: nowrap;
  }

  .review-count {
    font-size: 0.6875rem;
    color: var(--color-slate-400);
  }

  /* Colour bands shared by the overall pill and the three sub-scores */
  .tier-good {
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }

  .tier-ok {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
  }

  .tier-poor {
    background: var(--color-badge-orange-bg);
    color: var(--color-badge-orange-fg);
  }

  .tier-bad {
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }

  .tier-none {
    background: var(--color-slate-100);
    color: var(--color-slate-500);
  }

  .contacts {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0 1rem 0.75rem 2.75rem;
  }

  .contact {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--color-slate-600);
  }

  .contact:hover {
    background: white;
  }

  .contact.current {
    color: var(--color-slate-800);
    font-weight: 500;
  }

  .contact i {
    color: var(--color-emerald-600);
  }

  .contact-email {
    color: var(--color-slate-500);
    font-size: 0.8125rem;
    font-weight: 400;
  }

  .primary-badge {
    font-size: 0.6875rem;
    padding: 0 0.375rem;
    border-radius: var(--radius-pill);
    background: var(--color-badge-info-bg);
    color: var(--color-badge-info-fg);
  }

  @media (max-width: 700px) {
    .card-main {
      flex-wrap: wrap;
    }

    .ratings {
      align-items: flex-start;
    }
  }
</style>
