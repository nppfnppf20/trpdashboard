<script>
  // Choose individual policies from the project's Relevant Policies. Shows the chosen ones as removable chips and
  // a button that opens a searchable checklist grouped by the plan each policy comes from.
  export let policies = []; // [{ id, policy_reference, policy_name, policy_type, plan_name, is_key_policy }]
  export let selected = []; // chosen policy ids
  export let showChips = true;
  export let label = 'Choose policies';

  let open = false;
  let query = '';

  const display = p => `${p.policy_reference ? `${p.policy_reference} ` : ''}${p.policy_name}`;

  $: byId = new Map(policies.map(p => [p.id, p]));
  $: chosen = selected.map(id => byId.get(id)).filter(Boolean);
  $: shown = policies.filter(p => !query.trim() || display(p).toLowerCase().includes(query.trim().toLowerCase()));
  $: groups = groupPolicies(shown);

  function groupPolicies(list) {
    const map = new Map();
    for (const p of list) {
      const key = p.plan_name || p.policy_type || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return [...map.entries()];
  }

  function toggle(id) {
    selected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
  }

  function selectShown() {
    selected = [...new Set([...selected, ...shown.map(p => p.id)])];
  }

  function clear() {
    selected = [];
  }
</script>

<div class="picker">
  {#if showChips}
    <div class="chosen">
      {#each chosen as p (p.id)}
        <span class="chip on" title={p.policy_name}>
          {p.policy_reference || p.policy_name}
          <button class="x" on:click={() => toggle(p.id)} aria-label="Remove {display(p)}"><i class="las la-times"></i></button>
        </span>
      {/each}
    </div>
  {/if}
  <button class="trigger" class:on={!showChips && selected.length > 0} on:click={() => (open = !open)} aria-expanded={open}>
    {#if showChips}
      <i class="las la-plus"></i> {label}
    {:else}
      {selected.length ? `${selected.length} polic${selected.length === 1 ? 'y' : 'ies'}` : label} <i class="las la-angle-down"></i>
    {/if}
  </button>

  {#if open}
    <button class="backdrop" on:click={() => (open = false)} aria-label="Close policy list" tabindex="-1"></button>
    <div class="pop" role="dialog" aria-label="Choose policies">
      <input class="search" type="search" placeholder="Search policies" bind:value={query} />
      <div class="pop-actions">
        <button class="link" on:click={selectShown}>Select {query.trim() ? 'shown' : 'all'}</button>
        <button class="link" on:click={clear}>Clear</button>
        <span class="n">{selected.length} chosen</span>
      </div>
      <div class="list">
        {#each groups as [group, items] (group)}
          <div class="group">{group}</div>
          {#each items as p (p.id)}
            <label class="row" class:checked={selected.includes(p.id)}>
              <input type="checkbox" checked={selected.includes(p.id)} on:change={() => toggle(p.id)} />
              <span class="name">{display(p)}</span>
              {#if p.is_key_policy}<span class="key">Key</span>{/if}
            </label>
          {/each}
        {:else}
          <p class="none">{policies.length ? 'No policies match.' : 'This project has no relevant policies yet. Add some on the Policy & History tab.'}</p>
        {/each}
      </div>
      <div class="pop-foot"><button class="done" on:click={() => (open = false)}>Done</button></div>
    </div>
  {/if}
</div>

<style>
  .picker { position: relative; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  .chosen { display: contents; }
  .chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.3rem 0.15rem 0.65rem; border: 1px solid var(--color-purple-600); border-radius: 20px; background: var(--color-violet-100); color: var(--color-purple-700); font-size: 0.73rem; font-weight: 600; max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x { display: inline-flex; background: none; border: none; padding: 0.1rem; border-radius: 50%; color: var(--color-purple-700); cursor: pointer; font-size: 0.8rem; }
  .x:hover { background: var(--color-purple-50); }
  .trigger { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.65rem; border: 1px solid var(--color-slate-200); border-radius: 20px; background: var(--color-white); font: inherit; font-size: 0.73rem; color: var(--color-slate-600); cursor: pointer; }
  .trigger.on { background: var(--color-violet-100); border-color: var(--color-purple-600); color: var(--color-purple-700); font-weight: 600; }
  .trigger:hover { border-color: var(--color-purple-600); }

  .backdrop { position: fixed; inset: 0; background: transparent; border: none; cursor: default; z-index: 40; }
  .pop { position: absolute; z-index: 41; top: calc(100% + 6px); left: 0; width: min(26rem, 90vw); background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 10px; box-shadow: var(--shadow-dropdown); display: flex; flex-direction: column; padding: 0.6rem; gap: 0.5rem; }
  .search { padding: 0.4rem 0.6rem; border: 1px solid var(--color-slate-200); border-radius: 6px; font: inherit; font-size: 0.8rem; color: var(--color-slate-800); }
  .search:focus { outline: none; border-color: var(--color-purple-600); }
  .pop-actions { display: flex; gap: 0.9rem; align-items: center; }
  .n { margin-left: auto; font-size: 0.72rem; color: var(--color-slate-500); }
  .link { background: none; border: none; padding: 0; font: inherit; font-size: 0.75rem; color: var(--color-purple-600); cursor: pointer; }
  .link:hover { text-decoration: underline; }
  .list { max-height: 18rem; overflow-y: auto; border: 1px solid var(--color-slate-100); border-radius: 6px; }
  .group { position: sticky; top: 0; padding: 0.3rem 0.6rem; background: var(--color-slate-50); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-slate-500); }
  .row { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.35rem 0.6rem; font-size: 0.8rem; color: var(--color-slate-800); cursor: pointer; line-height: 1.35; }
  .row:hover { background: var(--color-slate-50); }
  .row.checked { background: var(--color-purple-50); }
  .row input { margin-top: 0.15rem; accent-color: var(--color-purple-600); }
  .name { flex: 1; min-width: 0; }
  .key { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); padding: 0.05rem 0.4rem; border-radius: 20px; }
  .none { margin: 0; padding: 0.8rem; font-size: 0.78rem; color: var(--color-slate-500); }
  .pop-foot { display: flex; justify-content: flex-end; }
  .done { padding: 0.3rem 0.9rem; border: none; border-radius: 6px; background: var(--color-purple-600); color: var(--color-white); font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
</style>
