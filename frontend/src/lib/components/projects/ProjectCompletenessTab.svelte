<script>
  import { onMount } from 'svelte';
  import { getProjectCompleteness } from '$lib/api/briefingPopulate.js';
  import CompletenessSection from '$lib/components/completeness/CompletenessSection.svelte';
  import MeetingGuideModal from '$lib/components/meeting-guide/MeetingGuideModal.svelte';
  import PopulateFromBriefingModal from '$lib/components/briefing-populate/PopulateFromBriefingModal.svelte';

  export let project;
  $: projectId = project?.id;

  let completeness = null;
  let loading = true;
  let error = null;

  let showGuide = false;
  let showPopulate = false;

  // Pass issue tracks from completeness data to meeting guide without an extra fetch
  $: issueTracks = completeness?.sections
    ?.find(s => s.key === 'issue_notes')
    ?.items
    ?.map(i => ({ id: i.track_id, label: i.label }))
    ?? [];

  $: hasBriefing = completeness?.sections
    ?.find(s => s.key === 'document_summaries')
    ?.items
    ?.find(i => i.key === 'briefing_transcript')
    ?.status === 'complete';

  onMount(() => { if (projectId) load(); });
  $: if (projectId) load();

  async function load() {
    loading = true;
    error = null;
    try {
      completeness = await getProjectCompleteness(projectId);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function handleDraftFromBriefing(_item) {
    showPopulate = true;
  }

  function handlePopulateComplete() {
    showPopulate = false;
    load();
  }
</script>

<div class="tab-root">
  {#if loading}
    <div class="state-center">
      <div class="spinner"></div>
      <p>Checking project completeness…</p>
    </div>

  {:else if error}
    <div class="state-center error">
      <i class="las la-exclamation-triangle"></i>
      <p>{error}</p>
      <button class="btn btn-secondary" on:click={load}>Retry</button>
    </div>

  {:else if completeness}
    <div class="header">
      <div class="header-left">
        <div class="percentage-ring">
          <svg viewBox="0 0 36 36" class="ring-svg">
            <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path
              class="ring-fill"
              stroke-dasharray="{completeness.overall_percentage}, 100"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span class="ring-label">{completeness.overall_percentage}%</span>
        </div>
        <div>
          <h3 class="heading">Project Completeness</h3>
          <p class="subheading">Showing data coverage across all project areas</p>
        </div>
      </div>

      <div class="header-actions">
        <button class="btn btn-secondary" on:click={() => (showGuide = true)}>
          <i class="las la-clipboard-list"></i> Meeting Guide
        </button>
        {#if hasBriefing}
          <button class="btn btn-primary" on:click={() => (showPopulate = true)}>
            <i class="las la-magic"></i> Populate from Briefing
          </button>
        {/if}
      </div>
    </div>

    {#if !hasBriefing}
      <div class="briefing-prompt">
        <i class="las la-info-circle"></i>
        Upload a briefing transcript in <strong>Project Docs</strong> to unlock auto-population of missing fields.
      </div>
    {/if}

    <div class="sections">
      {#each completeness.sections as section}
        <CompletenessSection {section} onDraftFromBriefing={handleDraftFromBriefing} />
      {/each}
    </div>
  {/if}
</div>

<MeetingGuideModal
  show={showGuide}
  {project}
  {issueTracks}
  onClose={() => (showGuide = false)}
/>

<PopulateFromBriefingModal
  show={showPopulate}
  {projectId}
  onClose={() => (showPopulate = false)}
  onComplete={handlePopulateComplete}
/>

<style>
  .tab-root {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    height: 100%;
  }

  .state-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    color: #64748b;
    text-align: center;
  }

  .error { color: #dc2626; }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .percentage-ring {
    position: relative;
    width: 60px;
    height: 60px;
    flex-shrink: 0;
  }

  .ring-svg {
    width: 60px;
    height: 60px;
    transform: rotate(-90deg);
  }

  .ring-bg {
    fill: none;
    stroke: #e2e8f0;
    stroke-width: 3;
  }

  .ring-fill {
    fill: none;
    stroke: #7c3aed;
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke-dasharray 0.6s ease;
  }

  .ring-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #1e293b;
  }

  .heading {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .subheading {
    margin: 0.15rem 0 0;
    font-size: 0.8rem;
    color: #64748b;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .briefing-prompt {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    font-size: 0.825rem;
    color: #1e40af;
  }

  .briefing-prompt i {
    flex-shrink: 0;
    font-size: 1rem;
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .btn-primary {
    background: #7c3aed;
    color: white;
  }

  .btn-primary:hover { background: #6d28d9; }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover { background: #f8fafc; }
</style>
