<script>
  // Tick several policies from the shared NPPF library. Their exact wording
  // comes with them, so no document is needed. Ones the project already has
  // are shown but not selectable.
  import { createEventDispatcher, onMount } from 'svelte';
  import { getNppfPolicies } from '$lib/api/nppfPolicies.js';

  export let existingPolicies = [];

  const dispatch = createEventDispatcher();

  let library = [];
  let loading = true;
  let error = null;
  let filter = '';
  let selected = new Set();

  const keyOf = (ref, name) => `${(ref || '').trim().toLowerCase()}|${(name || '').trim().toLowerCase()}`;
  $: existingKeys = new Set(existingPolicies.filter(p => p.policy_type === 'national').map(p => keyOf(p.policy_reference, p.policy_name)));

  onMount(async () => {
    try {
      library = await getNppfPolicies();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  $: shown = library.filter(p => {
    const q = filter.trim().toLowerCase();
    return !q || `${p.policy_reference || ''} ${p.policy_name || ''}`.toLowerCase().includes(q);
  });
  const isAdded = p => existingKeys.has(keyOf(p.policy_reference, p.policy_name));

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected = next;
  }

  function addSelected() {
    const rows = library
      .filter(p => selected.has(p.id))
      .map(p => ({
        policy_reference: p.policy_reference || '',
        policy_name: p.policy_name || '',
        policy_type: 'national',
        policy_text: p.policy_text || '',
        relevant_supporting_text: '',
        notes: '',
        is_key_policy: false,
        plan_id: ''
      }));
    dispatch('review', { rows });
  }
</script>

<div class="dialog-backdrop" on:click|self={() => dispatch('close')} role="presentation">
  <div class="dialog dialog-md">
    <div class="dialog-header">
      <h3 class="dialog-title">Add Policies from the NPPF Library</h3>
      <button class="dialog-close" on:click={() => dispatch('close')} aria-label="Close">&times;</button>
    </div>

    <div class="dialog-body">
      <p class="dialog-hint">Tick the policies you want. Their exact wording is filled in automatically, and you can review it before saving.</p>
      <input type="text" class="form-input" bind:value={filter} placeholder="Filter by reference or name…" />

      {#if loading}
        <p class="dialog-hint">Loading the library…</p>
      {:else if error}
        <div class="alert alert-error">{error}</div>
      {:else if shown.length === 0}
        <p class="dialog-hint">{library.length ? 'Nothing matches that filter.' : 'The NPPF library is empty.'}</p>
      {:else}
        <div class="np-list">
          {#each shown as p (p.id)}
            {@const added = isAdded(p)}
            <label class="np-item" class:added class:picked={selected.has(p.id)}>
              <input type="checkbox" checked={selected.has(p.id)} disabled={added} on:change={() => toggle(p.id)} />
              {#if p.policy_reference}<span class="ref-chip">{p.policy_reference}</span>{/if}
              <span class="np-name">{p.policy_name}</span>
              {#if added}<span class="badge badge-sm badge-neutral">Already added</span>{/if}
            </label>
          {/each}
        </div>
      {/if}
    </div>

    <div class="dialog-footer">
      <span class="dialog-meta">{selected.size} selected</span>
      <div class="dialog-actions">
        <button class="btn btn-secondary" on:click={() => dispatch('close')}>Cancel</button>
        <button class="btn btn-primary" on:click={addSelected} disabled={!selected.size}>Review {selected.size || ''} polic{selected.size === 1 ? 'y' : 'ies'}</button>
      </div>
    </div>
  </div>
</div>

<style>
  .np-list { border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); overflow: hidden; }
  .np-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-slate-100);
    cursor: pointer;
  }
  .np-item:last-child { border-bottom: none; }
  .np-item:hover { background: var(--color-slate-50); }
  .np-item.picked { background: var(--color-primary-50); }
  .np-item.added { opacity: 0.55; cursor: default; }
  .np-item input { width: 16px; height: 16px; accent-color: var(--color-primary-600); flex-shrink: 0; }
  .np-name { flex: 1; font-size: var(--font-size-sm); color: var(--color-slate-800); }

  .ref-chip {
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-slate-100);
    color: var(--color-slate-600);
    font-family: monospace;
    font-size: var(--font-size-xs);
    font-weight: 600;
    white-space: nowrap;
  }
</style>
