<script>
  import {
    briefingNotes,
    selectedBriefingNoteId,
    briefingDropdownOpen,
    selectBriefingNote
  } from '$lib/stores/hlpv-narrative.js';

  function clickOutside(node, handler) {
    function onDocClick(e) { if (!node.contains(e.target)) handler(); }
    document.addEventListener('click', onDocClick, true);
    return { destroy() { document.removeEventListener('click', onDocClick, true); } };
  }

  $: selectedNote = $briefingNotes.find(n => n.id === $selectedBriefingNoteId) ?? null;
</script>

<div class="briefing-selector" use:clickOutside={() => ($briefingDropdownOpen = false)}>
  <button
    class="briefing-trigger"
    on:click={() => ($briefingDropdownOpen = !$briefingDropdownOpen)}
    title="Select briefing note for narrative context"
  >
    <i class="las la-file-alt"></i>
    {#if selectedNote}
      <span class="briefing-trigger-name">{selectedNote.title || selectedNote.file_name}</span>
    {:else}
      <span class="briefing-trigger-placeholder">No briefing note</span>
    {/if}
    <i class="las la-angle-down briefing-chevron"></i>
  </button>

  {#if $briefingDropdownOpen}
    <div class="briefing-dropdown">
      <button
        class="briefing-option"
        class:briefing-option--active={$selectedBriefingNoteId === null}
        on:click={() => selectBriefingNote(null)}
      >
        No briefing note
      </button>

      {#each $briefingNotes as note}
        <button
          class="briefing-option"
          class:briefing-option--active={$selectedBriefingNoteId === note.id}
          on:click={() => selectBriefingNote(note.id)}
        >
          <span class="briefing-option-title">{note.title || note.file_name}</span>
          <span class="briefing-option-date">
            {new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </button>
      {/each}

      {#if $briefingNotes.length === 0}
        <div class="briefing-empty">No briefing notes for this project</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .briefing-selector {
    position: relative;
  }

  .briefing-trigger {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.75rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8rem;
    color: var(--color-slate-600);
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: border-color 0.15s, background 0.15s;
  }

  .briefing-trigger:hover {
    background: var(--color-slate-100);
    border-color: var(--color-slate-300);
  }

  .briefing-trigger-name {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-slate-800);
    font-weight: 500;
  }

  .briefing-trigger-placeholder {
    color: var(--color-slate-400);
    font-style: italic;
  }

  .briefing-chevron {
    font-size: 0.6rem;
    color: var(--color-slate-400);
    flex-shrink: 0;
  }

  .briefing-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 240px;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    z-index: 100;
    overflow: hidden;
  }

  .briefing-option {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-slate-100);
    font-size: 0.8rem;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
  }

  .briefing-option:last-child {
    border-bottom: none;
  }

  .briefing-option:hover {
    background: var(--color-slate-50);
  }

  .briefing-option--active {
    background: var(--color-primary-50);
    color: var(--color-primary-700);
  }

  .briefing-option-title {
    font-weight: 500;
  }

  .briefing-option-date {
    font-size: 0.72rem;
    color: var(--color-slate-400);
  }

  .briefing-empty {
    padding: 0.6rem 0.75rem;
    font-size: 0.8rem;
    color: var(--color-slate-400);
    font-style: italic;
  }
</style>
