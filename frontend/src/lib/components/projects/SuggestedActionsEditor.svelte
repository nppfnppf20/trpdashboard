<script>
  import OwnerPicker from '$lib/components/shared/OwnerPicker.svelte';
  import { autoGrow } from '$lib/utils/autoGrow.js';
  import { sourceContext } from '$lib/utils/meetingActions.js';
  // Editable rows for the actions the AI pulled from a meeting. `actions` is
  // bound by the parent; `dirty` flips true on any edit so the parent knows to
  // rewrite the summary's Actions block on save.
  export let actions = [];
  export let dirty = false;
  // Number of rows with no owner — bound by the parent to disable Save until 0.
  export let missingOwner = 0;
  // Full transcript, so an action's source quote can be shown with the lines around it.
  export let transcriptText = '';
  $: missingOwner = actions.filter(a => !(a.owner || '').trim()).length;

  let nextKey = 1000;

  function touch() {
    dirty = true;
    actions = actions;
  }

  function addRow() {
    actions = [...actions, { _key: nextKey++, action_text: '', owner: '', owner_sel: { users: [], external: '' }, due_date: '', notes: '' }];
    dirty = true;
  }

  let sourceView = null; // { action, ctx } for the open source pop-up

  function sourceFor(a) {
    return transcriptText ? sourceContext(transcriptText, a.source_start, a.source_quote) : null;
  }

  function openSource(a) {
    const ctx = sourceFor(a);
    if (ctx) sourceView = { action: a.action_text, ctx };
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
        <textarea class="form-input sae-text" rows="1" placeholder="Action…" bind:value={a.action_text} on:input={touch} use:autoGrow={a.action_text}></textarea>
        <OwnerPicker bind:value={a.owner} bind:selection={a.owner_sel} on:change={touch} />
        <input class="form-input" type="date" bind:value={a.due_date} on:input={touch} />
        <div class="sae-btns">
          {#if a.source_quote && sourceFor(a)}
            <button type="button" class="btn btn-icon btn-ghost sae-source" title="Show where this came from" aria-label="Show source" on:click={() => openSource(a)}>
              <i class="las la-quote-right"></i>
            </button>
          {/if}
          <button type="button" class="btn btn-icon btn-ghost" title="Remove action" aria-label="Remove action" on:click={() => removeRow(a._key)}>
            <i class="las la-trash"></i>
          </button>
        </div>
      </div>
    {/each}
  {/if}
  <button type="button" class="btn btn-secondary btn-sm sae-add" on:click={addRow}>
    <i class="las la-plus"></i> Add action
  </button>
  {#if missingOwner > 0}
    <p class="sae-warn"><i class="las la-exclamation-circle"></i> Assign an owner to {missingOwner === 1 ? '1 action' : `${missingOwner} actions`} (or remove {missingOwner === 1 ? 'it' : 'them'}) before saving.</p>
  {/if}
  {#if dirty}
    <p class="sae-hint">Saving will update the Actions list in the summary text to match.</p>
  {/if}
</div>

{#if sourceView}
  <div class="sae-src-backdrop" role="presentation" on:click|self={() => (sourceView = null)}>
    <div class="sae-src-modal" role="dialog" aria-modal="true" aria-label="Source of action" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && (sourceView = null)}>
      <div class="sae-src-head">
        <div>
          <div class="sae-src-label">Source</div>
          <div class="sae-src-action">{sourceView.action}</div>
        </div>
        <button type="button" class="btn btn-icon btn-ghost" title="Close" aria-label="Close" on:click={() => (sourceView = null)}>
          <i class="las la-times"></i>
        </button>
      </div>
      <pre class="sae-src-text">{#if sourceView.ctx.cutBefore}…{/if}{sourceView.ctx.before}<mark>{sourceView.ctx.match}</mark>{sourceView.ctx.after}{#if sourceView.ctx.cutAfter}…{/if}</pre>
    </div>
  </div>
{/if}

<style>
  .sae { display: flex; flex-direction: column; gap: 0.4rem; }
  .sae-head, .sae-row {
    display: grid;
    grid-template-columns: 1fr 12rem 9.5rem 4.25rem;
    gap: 0.5rem;
    align-items: center;
  }
  .sae-text { resize: none; overflow: hidden; line-height: 1.4; min-height: 2.25rem; font-family: inherit; }
  .sae-head { font-size: 0.72rem; font-weight: 600; color: var(--color-slate-500); text-transform: uppercase; }
  .sae-btns { display: flex; align-items: center; justify-content: flex-end; }
  .sae-source { color: var(--color-slate-500); }
  .sae-src-backdrop {
    position: fixed; inset: 0; z-index: 3000; background: var(--overlay-bg);
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }
  .sae-src-modal {
    background: var(--color-white); border-radius: var(--radius-lg); box-shadow: var(--shadow-modal);
    width: 100%; max-width: 640px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden;
  }
  .sae-src-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;
    padding: 0.9rem 1.1rem; border-bottom: 1px solid var(--color-slate-200);
  }
  .sae-src-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-slate-500); }
  .sae-src-action { font-size: 0.9rem; font-weight: 600; color: var(--color-slate-800); }
  .sae-src-text {
    margin: 0; padding: 1rem 1.1rem; overflow-y: auto; white-space: pre-wrap;
    font-family: inherit; font-size: 0.85rem; line-height: 1.6; color: var(--color-slate-600);
  }
  .sae-src-text mark { background: var(--color-amber-200); color: var(--color-slate-900); border-radius: 2px; padding: 0 1px; }
  .sae-empty { margin: 0; font-size: 0.85rem; color: var(--color-slate-500); }
  .sae-add { align-self: flex-start; margin-top: 0.6rem; }
  .sae-hint { margin: 0.4rem 0 0.75rem; font-size: 0.75rem; color: var(--color-slate-500); }
  .sae-warn { margin: 0.4rem 0 0; font-size: 0.75rem; color: var(--color-amber-800); }
</style>
