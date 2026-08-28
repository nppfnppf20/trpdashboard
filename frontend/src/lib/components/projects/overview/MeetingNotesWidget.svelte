<script>
  import { onMount } from 'svelte';
  import { getMeetingNotes } from '$lib/api/meetingNotes.js';
  import { openProjectModal, setPendingMeetingUploadFile } from '$lib/stores/projectViewModal.js';

  export let project;
  $: projectId = project?.id;

  let notes = [];
  let loading = true;
  let error = null;
  let dragOver = false;
  let fileInput;

  onMount(load);

  async function load() {
    loading = true;
    error = null;
    try {
      const all = await getMeetingNotes(projectId);
      notes = [...(all || [])]
        .sort((a, b) => String(b.meeting_date || b.created_at || '').localeCompare(String(a.meeting_date || a.created_at || '')))
        .slice(0, 2);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handOff(file) {
    if (!file) return;
    setPendingMeetingUploadFile(file);
    openProjectModal(projectId, 'meeting_notes', 'details');
  }

  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    handOff(e.dataTransfer?.files?.[0]);
  }

  function handleFileChange(e) {
    handOff(e.target.files?.[0]);
  }

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<div class="widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-file-signature"></i>
      Meeting Notes
    </div>
    <button class="widget-expand" on:click={() => openProjectModal(projectId, 'meeting_notes', 'details')}>
      View all <i class="las la-angle-right"></i>
    </button>
  </div>
  <div class="widget-body mnw-body">
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
      class="mnw-drop-zone"
      class:drag-over={dragOver}
      role="button"
      tabindex="0"
      on:dragover|preventDefault={() => dragOver = true}
      on:dragleave={() => dragOver = false}
      on:drop={handleDrop}
      on:click={() => fileInput.click()}
      on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
    >
      <i class="las la-cloud-upload-alt mnw-drop-icon"></i>
      <span>Drop a file here or click to browse</span>
      <span class="mnw-drop-hint">PDF, DOCX or TXT</span>
    </div>
    <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleFileChange} />

    {#if loading}
      <div class="mnw-state">Loading…</div>
    {:else if error}
      <div class="mnw-state mnw-state-error">{error}</div>
    {:else}
      {#each notes as n}
        <div class="mnw-note">
          <div class="mnw-note-title">{n.title}</div>
          <div class="mnw-note-date">{formatDate(n.meeting_date || n.created_at)}</div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .mnw-body { display: flex; flex-direction: column; gap: 9px; }

  .mnw-drop-zone {
    border: 2px dashed var(--color-primary-200);
    border-radius: 6px;
    padding: 0.65rem 0.75rem;
    text-align: center;
    cursor: pointer;
    color: var(--color-slate-500);
    font-size: 11px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .mnw-drop-zone:hover, .mnw-drop-zone.drag-over { background: var(--color-primary-50); border-color: var(--color-primary-500); }
  .mnw-drop-icon { font-size: 1.15rem; color: var(--color-primary-200); }
  .mnw-drop-hint { font-size: 9.5px; color: var(--color-slate-400); }

  .mnw-state { font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.25rem 0; }
  .mnw-state-error { color: var(--color-red-600); }

  .mnw-note-title { font-size: 12px; font-weight: 600; color: var(--color-slate-900); }
  .mnw-note-date { font-size: 10px; color: var(--color-slate-400); }
</style>
