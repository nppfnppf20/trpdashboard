<script>
  import OwnerInput from '$lib/components/shared/OwnerInput.svelte';
  // Editable rows for the actions the AI pulled from a meeting. `actions` is
  // bound by the parent; `dirty` flips true on any edit so the parent knows to
  // rewrite the summary's Actions block on save.
  export let actions = [];
  export let dirty = false;

  let nextKey = 1000;

  function touch() {
    dirty = true;
    actions = actions;
  }

  function addRow() {
    actions = [...actions, { _key: nextKey++, action_text: '', owner: '', due_date: '', notes: '' }];
    dirty = true;
  }

  function removeRow(key) {
    actions = actions.filter(a => a._key !== key);
    dirty = true;
  }
</script>

<div class="sae">
  {#if actions.length === 0}
    <p class="sae-empty">No actions were picked up from this meeting.</p>
  {:else}
    <div class="sae-head">
      <span>Action</span><span>Owner</span><span>Due</span><span></span>
    </div>
    {#each actions as a (a._key)}
      <div class="sae-row">
        <input class="form-input" type="text" placeholder="Action…" bind:value={a.action_text} on:input={touch} />
        <OwnerInput bind:value={a.owner} on:input={touch} />
        <input class="form-input" type="date" bind:value={a.due_date} on:input={touch} />
        <button type="button" class="btn btn-icon btn-ghost" title="Remove action" aria-label="Remove action" on:click={() => removeRow(a._key)}>
          <i class="las la-trash"></i>
        </button>
      </div>
    {/each}
  {/if}
  <button type="button" class="btn btn-secondary btn-sm sae-add" on:click={addRow}>
    <i class="las la-plus"></i> Add action
  </button>
  {#if dirty}
    <p class="sae-hint">Saving will update the Actions list in the summary text to match.</p>
  {/if}
</div>

<style>
  .sae { display: flex; flex-direction: column; gap: 0.4rem; }
  .sae-head, .sae-row {
    display: grid;
    grid-template-columns: 1fr 9rem 9.5rem 2rem;
    gap: 0.5rem;
    align-items: center;
  }
  .sae-head { font-size: 0.72rem; font-weight: 600; color: var(--color-slate-500); text-transform: uppercase; }
  .sae-empty { margin: 0; font-size: 0.85rem; color: var(--color-slate-500); }
  .sae-add { align-self: flex-start; }
  .sae-hint { margin: 0; font-size: 0.75rem; color: var(--color-slate-500); }
</style>
