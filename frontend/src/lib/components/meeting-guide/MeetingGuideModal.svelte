<script>
  import MeetingGuideSection from './MeetingGuideSection.svelte';
  import { fetchGuideContent, buildGuide } from './meetingGuideContent.js';

  export let show = false;
  export let project = null;
  export let issueTracks = []; // pass active tracks in so we don't need an extra fetch
  export let onClose;

  let sections = [];
  let guideError = null;

  $: if (show) loadSections(issueTracks);

  async function loadSections(tracks) {
    guideError = null;
    try {
      const guide = await fetchGuideContent();
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
            <h2>Briefing Meeting Guide</h2>
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
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15);
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
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    color: #7c3aed;
  }

  .header-left i {
    font-size: 1.25rem;
    margin-top: 0.15rem;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .project-name {
    margin: 0.1rem 0 0;
    font-size: 0.8rem;
    color: #64748b;
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
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  .close-btn:hover { color: #1e293b; }

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
    color: #64748b;
    line-height: 1.5;
  }

  .guide-error {
    margin: 0;
    font-size: 0.85rem;
    color: #dc2626;
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
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover { background: #f8fafc; }

  @media print {
    :global(.overlay) { position: static; background: none; }
    :global(.modal) { box-shadow: none; max-height: none; }
    :global(.header-actions) { display: none; }
  }
</style>
