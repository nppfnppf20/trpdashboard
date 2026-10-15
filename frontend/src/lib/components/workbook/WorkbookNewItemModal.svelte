<script>
  // Form for the "+ Add risk / action / issue / decision" buttons.
  import { TYPE_LABEL, parentOptions, today } from './workbookUtils.js';

  export let type = 'action';
  export let gate = [];
  export let items = [];
  export let refs = {};
  export let onSubmit = async () => {};   // (data)
  export let onClose = () => {};

  $: isDecision = type === 'decision';
  $: parents = parentOptions(type, items, refs);

  let gateRef = '';
  let parentId = '';
  let subject = '';
  let details = '';
  let owner = '';
  let dateValue = type === 'decision' ? today() : '';
  let priority = 2;
  let saving = false;
  let error = null;

  $: sortedGate = gate.slice().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  async function submit(e) {
    e.preventDefault();
    if (!subject.trim()) { error = 'Add a subject.'; return; }
    saving = true;
    error = null;
    try {
      const parent = items.find(i => String(i.id) === parentId);
      const data = {
        type,
        subject: subject.trim(),
        text: details.trim(),
        owner: owner.trim(),
        gate_refs: gateRef ? [gateRef] : [...(parent?.gate_refs || [])],
        parent_id: parentId ? parseInt(parentId, 10) : null,
      };
      if (isDecision) data.raised = dateValue || today();
      else { data.target = dateValue; data.priority = priority; }
      await onSubmit(data);
      onClose();
    } catch (err) {
      error = err.message;
      saving = false;
    }
  }
  function onKey(e) { if (e.key === 'Escape' && !saving) onClose(); }
</script>

<svelte:window on:keydown={onKey} />

<div class="wn-backdrop" on:click|self={() => !saving && onClose()} role="presentation">
  <form class="wn-modal" on:submit={submit} role="dialog" aria-modal="true" aria-label="Add {type}">
    <div class="wn-head">
      <div>
        <div class="wn-eyebrow">New</div>
        <h2>Add {type}</h2>
      </div>
      <button class="btn btn-secondary btn-sm" type="button" on:click={onClose} disabled={saving}>Close</button>
    </div>

    <div class="wn-body">
      <label class="wn-field">
        <span class="form-label">Gate question</span>
        <select class="form-input" bind:value={gateRef}>
          <option value="">Not linked to a gate question</option>
          {#each sortedGate as g (g.id)}
            <option value={g.ref}>{g.ref} · {g.question.length > 90 ? g.question.slice(0, 90) + '…' : g.question}</option>
          {/each}
        </select>
      </label>

      {#if parents.length}
        <label class="wn-field">
          <span class="form-label">{type === 'action' ? 'Under risk' : 'Arising from'}</span>
          <select class="form-input" bind:value={parentId}>
            {#each parents as p (p.value)}<option value={p.value}>{p.label}</option>{/each}
          </select>
        </label>
      {/if}

      <label class="wn-field">
        <span class="form-label">Subject</span>
        <!-- svelte-ignore a11y-autofocus -->
        <input class="form-input" bind:value={subject} placeholder="Short title, e.g. Chase ecology quote" autocomplete="off" autofocus>
      </label>

      <label class="wn-field">
        <span class="form-label">{isDecision ? 'Decision' : `${TYPE_LABEL[type]} details`}</span>
        <textarea class="form-input" rows="3" bind:value={details} placeholder={isDecision ? 'What was decided, and why' : 'The full wording'}></textarea>
      </label>

      <div class="wn-two">
        <label class="wn-field">
          <span class="form-label">{isDecision ? 'Taken by' : 'Owner'}</span>
          <input class="form-input" bind:value={owner} list="wb-owners" autocomplete="off">
        </label>
        <label class="wn-field">
          <span class="form-label">{isDecision ? 'Decision date' : 'Target date'}</span>
          <input class="form-input" type="date" bind:value={dateValue}>
        </label>
      </div>

      {#if !isDecision}
        <label class="wn-field wn-half">
          <span class="form-label">Priority</span>
          <select class="form-input" bind:value={priority}>
            <option value={1}>1 · High</option>
            <option value={2}>2 · Medium</option>
            <option value={3}>3 · Low</option>
          </select>
        </label>
      {/if}

      {#if error}<div class="wn-error">{error}</div>{/if}
    </div>

    <div class="wn-foot">
      <button class="btn btn-secondary btn-sm" type="button" on:click={onClose} disabled={saving}>Cancel</button>
      <button class="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Adding…' : `Add ${type}`}</button>
    </div>
  </form>
</div>

<style>
  .wn-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
  .wn-modal { background: var(--color-white); border-radius: var(--radius-lg); width: min(36rem, 100%); max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-modal); overflow: hidden; }
  .wn-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-slate-200); }
  .wn-head h2 { margin: 0.125rem 0 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .wn-eyebrow { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-slate-400); }
  .wn-body { padding: 1rem 1.25rem; overflow: auto; display: flex; flex-direction: column; gap: 0.75rem; }
  .wn-field { display: flex; flex-direction: column; }
  .wn-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .wn-half { max-width: 50%; }
  .wn-error { font-size: 0.8rem; color: var(--color-red-600); background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; }
  .wn-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.875rem 1.25rem; border-top: 1px solid var(--color-slate-200); }
</style>
