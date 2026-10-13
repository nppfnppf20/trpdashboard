<script>
  // Existing open actions this meeting spoke to. The AI suggests a status
  // (complete / progress) and an update sentence; the user accepts or changes
  // each one. `dirty` flips true on any edit.
  export let updates = [];
  export let dirty = false;

  function touch() {
    dirty = true;
    updates = updates;
  }
</script>

<div class="aue">
  {#if updates.length === 0}
    <p class="aue-empty">None of the project's open actions were spoken to in this meeting.</p>
  {:else}
    {#each updates as u (u._key)}
      <div class="aue-row" class:aue-row--none={u.status === 'none'}>
        <div class="aue-top">
          <div class="aue-action">
            <span class="aue-text">{u.action_text}</span>
            {#if u.owner}<span class="aue-owner">Owner: {u.owner}</span>{/if}
          </div>
          <select class="form-input aue-status" bind:value={u.status} on:change={touch} aria-label="Status for {u.action_text}">
            <option value="complete">Mark complete</option>
            <option value="progress">Progress update</option>
            <option value="none">No change</option>
          </select>
        </div>
        {#if u.status !== 'none'}
          <input
            class="form-input"
            type="text"
            placeholder={u.status === 'complete' ? 'Optional note on how it was closed…' : 'What happened on this action…'}
            bind:value={u.update_text}
            on:input={touch}
          />
        {/if}
        {#if u.evidence}<p class="aue-evidence">“{u.evidence}”</p>{/if}
      </div>
    {/each}
  {/if}
  {#if dirty}
    <p class="aue-hint">Saving will update the completed / updates lists in the summary text to match.</p>
  {/if}
</div>

<style>
  .aue { display: flex; flex-direction: column; gap: 0.6rem; }
  .aue-row { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.6rem 0.75rem; border: 1px solid var(--color-slate-200); border-radius: 6px; }
  .aue-row--none { opacity: 0.65; }
  .aue-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
  .aue-action { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
  .aue-text { font-size: 0.85rem; font-weight: 500; color: var(--color-slate-800); }
  .aue-owner { font-size: 0.75rem; color: var(--color-slate-500); }
  .aue-status { width: 11rem; flex-shrink: 0; }
  .aue-evidence { margin: 0; font-size: 0.75rem; font-style: italic; color: var(--color-slate-500); }
  .aue-empty { margin: 0; font-size: 0.85rem; color: var(--color-slate-500); }
  .aue-hint { margin: 0; font-size: 0.75rem; color: var(--color-slate-500); }
</style>
