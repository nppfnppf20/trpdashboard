<script>
  // Manually add an action that didn't come from a meeting note. With more
  // than one project in play (merged Overview view) a project picker shows.
  import OwnerInput from '$lib/components/shared/OwnerInput.svelte';
  import { createMeetingAction } from '$lib/api/meetingNotes.js';
  import { bumpActionsVersion } from '$lib/stores/keyDates.js';

  export let projects = [];
  export let onClose = () => {};

  let projectId = projects[0]?.id ?? null;
  let action_text = '';
  let owner = '';
  let due_date = '';
  let notes = '';
  let saving = false;
  let error = null;

  $: invalid = !projectId || !action_text.trim() || !owner.trim();

  async function save() {
    if (invalid) return;
    saving = true;
    error = null;
    try {
      await createMeetingAction(Number(projectId), { action_text, owner, due_date: due_date || null, notes });
      bumpActionsVersion();
      onClose();
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="ama-backdrop" role="dialog" aria-modal="true" tabindex="-1" on:click|self={onClose} on:keydown={(e) => e.key === 'Escape' && !saving && onClose()}>
  <div class="ama-modal">
    <div class="ama-header">
      <h2 class="ama-title"><i class="las la-plus-circle"></i> Add action</h2>
      <button class="btn btn-icon btn-ghost" on:click={onClose} disabled={saving} title="Close" aria-label="Close">
        <i class="las la-times"></i>
      </button>
    </div>

    <div class="ama-body">
      {#if projects.length > 1}
        <div class="form-group">
          <label for="ama-project">Project</label>
          <select id="ama-project" class="form-input" bind:value={projectId}>
            {#each projects as p (p.id)}<option value={p.id}>{p.project_name}</option>{/each}
          </select>
        </div>
      {/if}
      <div class="form-group">
        <label for="ama-text">Action</label>
        <input id="ama-text" class="form-input" type="text" placeholder="e.g. Instruct heritage consultant" bind:value={action_text} on:keydown={(e) => e.key === 'Enter' && save()} />
      </div>
      <div class="ama-row">
        <div class="form-group">
          <label for="ama-owner">Owner</label>
          <OwnerInput bind:value={owner} />
        </div>
        <div class="form-group">
          <label for="ama-due">Due</label>
          <input id="ama-due" class="form-input" type="date" bind:value={due_date} />
        </div>
      </div>
      <div class="form-group">
        <label for="ama-notes">Notes</label>
        <input id="ama-notes" class="form-input" type="text" placeholder="Optional" bind:value={notes} />
      </div>
      {#if error}<p class="ama-error">{error}</p>{/if}
    </div>

    <div class="ama-footer">
      <button class="btn btn-secondary btn-sm" on:click={onClose} disabled={saving}>Cancel</button>
      <button class="btn btn-primary btn-sm" on:click={save} disabled={invalid || saving} title={!owner.trim() ? 'Assign an owner before saving' : ''}>
        {saving ? 'Saving…' : 'Add action'}
      </button>
    </div>
  </div>
</div>

<style>
  .ama-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2100;
    padding: 1rem;
  }
  .ama-modal {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .ama-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-slate-200); }
  .ama-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.5rem; }
  .ama-body { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .ama-row { display: grid; grid-template-columns: 1fr 10rem; gap: 0.6rem; }
  .ama-error { margin: 0; font-size: 0.8rem; color: var(--color-red-600); }
  .ama-footer { display: flex; justify-content: flex-end; gap: 0.6rem; padding: 0.75rem 1.25rem; border-top: 1px solid var(--color-slate-200); background: var(--color-slate-50); }
</style>
