<script>
  import MeetingGuideSection from './MeetingGuideSection.svelte';
  import { fetchGuideContent, buildGuide } from './meetingGuideContent.js';

  export let show = false;
  export let project = null;
  export let issueTracks = []; // pass active tracks (or drafting issues) in so we don't need an extra fetch
  export let docTypeSlug = null; // e.g. 'planning_statement_v3' — omit for the generic guide
  export let docTypeLabel = null; // display label shown in the header when docTypeSlug is set
  export let onClose;

  let sections = [];
  let guideError = null;

  $: if (show) loadSections(issueTracks, docTypeSlug, project?.id);

  async function loadSections(tracks, docType, projectId) {
    guideError = null;
    try {
      const guide = await fetchGuideContent(docType, projectId);
      sections = buildGuide(guide, tracks);
    } catch (err) {
      guideError = err.message;
    }
  }

  function handlePrint() {
    window.print();
  }
</script>

{#if show}
  <div class="overlay" on:click|self={onClose}>
    <div class="modal">
      <div class="modal-header">
        <div class="header-left">
          <i class="las la-clipboard-list"></i>
          <div>
            <h2>Briefing Meeting Guide{#if docTypeLabel} <span class="doc-type-tag">{docTypeLabel}</span>{/if}</h2>
            {#if project}
              <p class="project-name">{project.project_name}</p>
            {/if}
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" on:click={handlePrint}>
            <i class="las la-print"></i> Print
          </button>
          <button class="close-btn" on:click={onClose}>
            <i class="las la-times"></i>
          </button>
        </div>
      </div>

      <div class="modal-body">
        <p class="intro">
          This guide covers all topics that should be addressed in the briefing meeting.
          Each section maps to data the system can extract from the resulting transcript.
        </p>

        {#if guideError}
          <p class="guide-error">{guideError}</p>
        {:else if sections.length === 0}
          <p class="intro">Loading guide…</p>
        {:else}
          <div class="sections">
            {#each sections as section}
              <MeetingGuideSection {section} />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }

  .modal {
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
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    color: var(--color-violet-600);
  }

  .header-left i {
    font-size: 1.25rem;
    margin-top: 0.15rem;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .doc-type-tag {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-violet-600);
    background: var(--color-violet-100);
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    vertical-align: middle;
  }

  .project-name {
    margin: 0.1rem 0 0;
    font-size: 0.8rem;
    color: var(--color-slate-500);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--color-slate-400);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  .close-btn:hover { color: var(--color-slate-800); }

  .modal-body {
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .intro {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-slate-500);
    line-height: 1.5;
  }

  .guide-error {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-red-600);
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
    transition: all 0.15s;
  }

  .btn-secondary {
    background: white;
    color: var(--color-slate-500);
    border: 1px solid var(--color-slate-300);
  }

  .btn-secondary:hover { background: var(--color-slate-50); }

  @media print {
    :global(.overlay) { position: static; background: none; }
    :global(.modal) { box-shadow: none; max-height: none; }
    :global(.header-actions) { display: none; }
  }
</style>
