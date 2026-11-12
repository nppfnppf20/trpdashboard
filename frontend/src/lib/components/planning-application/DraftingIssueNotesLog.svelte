<script>
  // Consolidate bar for one Drafting Issue, shown directly under its Notes box.
  // Each "Draft from document" run appends a dated section ("[12 Nov 2026 ·
  // Meeting title]" header, then bullets) to the Notes text, so successive
  // meetings stack up in the one field. Once there are two or more sections,
  // "Consolidate" merges them into a single set of notes (later meetings
  // supersede earlier ones) after the user reviews the proposal.
  import { consolidateNotesLog, applyConsolidatedNotes } from '$lib/api/draftingIssues.js';

  export let issue;
  // Called with the updated issue after a consolidation is saved
  export let onApplied = (/** @type {any} */ _updated) => {};

  let consolidating = false;
  let saving = false;
  let error = '';
  let proposal = null; // { notes, changes }

  // Dated sections, plus any undated notes that sit above the first header
  // (notes written before this feature, or typed by hand)
  $: notesText = (issue.argument_for ?? '').trim();
  $: headerCount = (notesText.match(/^\[.+\]\s*$/gm) ?? []).length;
  $: hasLeadingNotes = headerCount > 0 && !/^\[.+\]\s*(\n|$)/.test(notesText);
  $: sectionCount = headerCount + (hasLeadingNotes ? 1 : 0);

  async function consolidate() {
    consolidating = true;
    error = '';
    try {
      proposal = await consolidateNotesLog(issue.id);
    } catch (err) {
      error = err.message || 'Failed to consolidate notes';
    } finally {
      consolidating = false;
    }
  }

  async function accept() {
    if (!proposal?.notes?.trim()) return;
    saving = true;
    error = '';
    try {
      const updated = await applyConsolidatedNotes(issue.id, proposal.notes);
      proposal = null;
      onApplied(updated);
    } catch (err) {
      error = err.message || 'Failed to save consolidated notes';
    } finally {
      saving = false;
    }
  }
</script>

{#if sectionCount >= 2 || proposal || error}
  <div class="nl">
    {#if sectionCount >= 2 && !proposal}
      <div class="nl-bar">
        <span class="nl-heading"><i class="las la-history"></i> {sectionCount} meetings of notes above</span>
        <button class="btn btn-primary btn-sm nl-consolidate" type="button" on:click={consolidate}
          disabled={consolidating || saving}
          title="Merge the meetings into one set of notes. Later meetings supersede earlier ones. You review before anything is saved.">
          {#if consolidating}<div class="mini-spinner"></div> Consolidating...{:else}<i class="las la-layer-group"></i> Consolidate{/if}
        </button>
      </div>
    {/if}

    {#if error}<p class="nl-error">{error}</p>{/if}

    {#if proposal}
      <div class="nl-proposal">
        <p class="nl-proposal-title">Proposed notes (edit if needed, nothing is saved yet)</p>
        <textarea class="form-input nl-proposal-text" rows="10" bind:value={proposal.notes}></textarea>
        {#if proposal.changes}
          <p class="nl-proposal-title">Dropped or changed because a later meeting superseded it</p>
          <p class="nl-changes">{proposal.changes}</p>
        {/if}
        <p class="nl-note">Saving replaces the notes above. A copy of the current notes is kept as a record.</p>
        <div class="nl-actions">
          <button class="btn btn-secondary btn-sm" type="button" on:click={() => proposal = null} disabled={saving}>Discard</button>
          <button class="btn btn-primary btn-sm" type="button" on:click={accept} disabled={saving || !proposal.notes.trim()}>
            {#if saving}<div class="mini-spinner"></div> Saving...{:else}Replace notes{/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .nl { margin: 0.4rem 0 0.75rem; }
  .nl-bar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .nl-heading { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-slate-700); }
  .nl-consolidate { margin-left: auto; }
  .nl-note { font-size: var(--font-size-xs); color: var(--color-slate-500); margin: 0.25rem 0 0.5rem; }
  .nl-error { color: var(--color-red-600); font-size: var(--font-size-xs); margin: 0.4rem 0 0; }

  .nl-proposal {
    margin-top: 0.5rem; padding: 0.75rem; border: 1px solid var(--color-primary-200);
    background: var(--color-primary-50); border-radius: var(--radius-md);
  }
  .nl-proposal-title { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-slate-700); margin: 0 0 0.3rem; }
  .nl-proposal-text { width: 100%; resize: vertical; margin-bottom: 0.5rem; line-height: 1.5; }
  .nl-changes { font-size: var(--font-size-xs); color: var(--color-slate-700); white-space: pre-wrap; margin: 0 0 0.5rem; }
  .nl-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
