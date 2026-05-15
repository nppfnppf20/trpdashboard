<script>
  import { createEventDispatcher } from 'svelte';
  import { analyseDisciplines } from '$lib/api/quoteRequests.js';

  export let show = false;
  export let projectId;

  const dispatch = createEventDispatcher();

  let loading = false;
  let error = null;
  let suggestions = []; // [{ discipline, reasoning, template, surveyors }]

  // Per-discipline: accepted/skipped + selected surveyor IDs
  let accepted = new Set();
  let skipped = new Set();
  let selectedSurveyors = {}; // { [discipline]: Set<id> }

  $: acceptedCount = [...accepted].filter(d => !skipped.has(d)).length;
  $: acceptedWithSurveyors = suggestions.filter(s =>
    accepted.has(s.discipline) && !skipped.has(s.discipline) &&
    (selectedSurveyors[s.discipline]?.size ?? 0) > 0
  );

  async function run() {
    loading = true;
    error = null;
    suggestions = [];
    accepted = new Set();
    skipped = new Set();
    selectedSurveyors = {};
    try {
      const { suggestions: result } = await analyseDisciplines(projectId);
      suggestions = result;
      // Default: accept all, select all surveyors
      for (const s of suggestions) {
        accepted = new Set([...accepted, s.discipline]);
        selectedSurveyors[s.discipline] = new Set(s.surveyors.map(sv => sv.id));
      }
    } catch (err) {
      // Surface the actual server message if available
      error = err.message || 'Failed to analyse disciplines';
    } finally {
      loading = false;
    }
  }

  $: if (show) run();

  function toggleAccept(discipline) {
    const n = new Set(accepted);
    if (n.has(discipline)) n.delete(discipline);
    else n.add(discipline);
    accepted = n;
  }

  function toggleSurveyor(discipline, surveyorId) {
    const cur = new Set(selectedSurveyors[discipline] ?? []);
    if (cur.has(surveyorId)) cur.delete(surveyorId);
    else cur.add(surveyorId);
    selectedSurveyors = { ...selectedSurveyors, [discipline]: cur };
  }

  function handleProceed() {
    const output = acceptedWithSurveyors.map(s => ({
      discipline: s.discipline,
      template: s.template,
      surveyors: s.surveyors.filter(sv => selectedSurveyors[s.discipline]?.has(sv.id))
    }));
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
                    {#if suggestion.template}
                      <span class="template-pill">
                        <i class="las la-file-alt"></i>
                        {suggestion.template.template_name}
                      </span>
                    {:else}
                      <span class="no-template-pill">No template — email will need to be written manually</span>
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

              <div class="card-reasoning">
                <i class="las la-info-circle"></i>
                <span>{suggestion.reasoning}</span>
              </div>

              {#if isAccepted}
                <div class="surveyors-section">
                  <div class="surveyors-label">
                    <i class="las la-users"></i>
                    Suggested surveyors (4★+)
                    {#if suggestion.surveyors.length === 0}
                      <span class="no-surveyors-note">— none on record for this discipline</span>
                    {/if}
                  </div>

                  {#if suggestion.surveyors.length > 0}
                    <div class="surveyors-list">
                      {#each suggestion.surveyors as surveyor}
                        {@const isSelected = selectedSurveyors[suggestion.discipline]?.has(surveyor.id) ?? false}
                        <label class="surveyor-row" class:row-selected={isSelected}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            on:change={() => toggleSurveyor(suggestion.discipline, surveyor.id)}
                          />
                          <div class="surveyor-details">
                            <span class="surveyor-name">{surveyor.organisation}</span>
                            {#if surveyor.location}
                              <span class="surveyor-location">{surveyor.location}</span>
                            {/if}
                          </div>
                          <span class="surveyor-rating" title="Overall rating: {surveyor.avg_overall != null ? parseFloat(surveyor.avg_overall).toFixed(1) : '—'}">
                            {starRating(surveyor.avg_overall)}
                          </span>
                        </label>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      {#if !loading && suggestions.length > 0}
        <div class="modal-footer">
          <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
          <button
            class="btn btn-primary"
            disabled={acceptedWithSurveyors.length === 0}
            on:click={handleProceed}
          >
            <i class="las la-check"></i>
            Proceed with {acceptedWithSurveyors.length} discipline{acceptedWithSurveyors.length !== 1 ? 's' : ''}
          </button>
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
    max-height: 90vh;
    display: flex;
    flex-direction: column;
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
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
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

  .surveyor-row {
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

  .surveyor-row:hover {
    border-color: #a7f3d0;
    background: #f0fdf4;
  }

  .surveyor-row.row-selected {
    border-color: #6ee7b7;
    background: #ecfdf5;
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

  .surveyor-location {
    font-size: 0.7rem;
    color: #64748b;
  }

  .surveyor-rating {
    font-size: 0.7rem;
    color: #f59e0b;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

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
</style>
