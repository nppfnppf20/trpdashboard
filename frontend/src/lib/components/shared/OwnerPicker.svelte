<script context="module">
  import { getUsers } from '$lib/api/userProfiles.js';

  // One fetch shared by every row on the page.
  let usersPromise = null;
  function loadUsersOnce() {
    if (!usersPromise) {
      usersPromise = getUsers().catch(err => {
        usersPromise = null;
        throw err;
      });
    }
    return usersPromise;
  }
</script>

<script>
  // Owner picker for actions. Pick any number of TRP people (or tick "All TRP"),
  // and/or type an external name (client, consultant, anyone without a login).
  //   selection: { users: [{ id, name }], external: '' }  — what gets saved
  //   value:     display string for the summary text and the "owner needed" check
  // If `selection` isn't set yet, `value` (e.g. a name the AI picked up) is
  // matched to a TRP user once users load, otherwise treated as external.
  import { onMount, createEventDispatcher } from 'svelte';
  import { composeOwnerDisplay, selectionFromText } from '$lib/utils/meetingActions.js';

  export let value = '';
  export let selection = null;

  let users = [];
  let open = false;
  let btnEl;
  let popEl;
  let popStyle = '';

  $: selectedIds = new Set((selection?.users || []).map(u => u.id));
  $: allSelected = users.length > 0 && selectedIds.size === users.length;

  onMount(async () => {
    try {
      users = await loadUsersOnce();
    } catch (err) {
      console.error('OwnerPicker: failed to load users', err);
    }
    if (!selection) selection = selectionFromText(value, users);
    syncValue();
  });

  const dispatch = createEventDispatcher();

  // `value` is written here (not in a reactive statement) so the parent's two-way
  // binding on it can't feed back into this component and loop.
  function syncValue() {
    const display = composeOwnerDisplay(selection, users.length);
    if (display !== value) value = display;
  }

  function setSelection(next) {
    selection = next;
    syncValue();
    dispatch('change');
  }

  function toggleUser(u) {
    const cur = selection?.users || [];
    const next = selectedIds.has(u.id) ? cur.filter(x => x.id !== u.id) : [...cur, { id: u.id, name: u.display_name }];
    setSelection({ users: next, external: selection?.external || '' });
  }

  function toggleAll() {
    setSelection({
      users: allSelected ? [] : users.map(u => ({ id: u.id, name: u.display_name })),
      external: selection?.external || ''
    });
  }

  function setExternal(e) {
    setSelection({ users: selection?.users || [], external: e.currentTarget.value });
  }

  function positionPopover() {
    if (!btnEl) return;
    const r = btnEl.getBoundingClientRect();
    const width = Math.max(r.width, 260);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    popStyle = window.innerHeight - r.bottom < 340
      ? `left:${left}px; bottom:${window.innerHeight - r.top + 4}px; width:${width}px;`
      : `left:${left}px; top:${r.bottom + 4}px; width:${width}px;`;
  }

  function toggleOpen() {
    if (open) { open = false; return; }
    positionPopover();
    open = true;
  }

  function onWindowClick(e) {
    if (open && !btnEl?.contains(e.target) && !popEl?.contains(e.target)) open = false;
  }

  // Ticking a box can re-lay-out the surrounding modal (e.g. the "saving will
  // update the summary" hint appears), which scrolls an ancestor. Follow the
  // button instead of closing, otherwise the first tick closes the list.
  function onWindowScroll(e) {
    if (open && !popEl?.contains(e.target)) positionPopover();
  }
</script>

<svelte:window on:click={onWindowClick} on:resize={() => open && positionPopover()} on:scroll|capture={onWindowScroll} on:keydown={(e) => e.key === 'Escape' && (open = false)} />

<button type="button" class="form-input op-trigger" class:op-empty={!value} bind:this={btnEl} on:click={toggleOpen} aria-haspopup="listbox" aria-expanded={open}>
  <span class="op-text">{value || 'Owner'}</span>
  <i class="las la-angle-down"></i>
</button>

{#if open}
  <div class="op-pop" style={popStyle} bind:this={popEl} role="dialog" aria-label="Choose owners">
    <label class="op-item op-all">
      <input type="checkbox" checked={allSelected} on:change={toggleAll} />
      <span>All TRP</span>
    </label>
    <div class="op-list">
      {#each users as u (u.id)}
        <label class="op-item">
          <input type="checkbox" checked={selectedIds.has(u.id)} on:change={() => toggleUser(u)} />
          <span>{u.display_name}</span>
        </label>
      {:else}
        <p class="op-empty-note">No TRP users loaded.</p>
      {/each}
    </div>
    <div class="op-external">
      <label for="op-ext-input">External / other</label>
      <input id="op-ext-input" class="form-input" type="text" placeholder="e.g. client or consultant name" autocomplete="off" value={selection?.external || ''} on:input={setExternal} />
    </div>
  </div>
{/if}

<style>
  .op-trigger {
    display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;
    text-align: left; cursor: pointer; min-height: 2.25rem; width: 100%;
  }
  .op-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .op-empty .op-text { color: var(--color-slate-400); }
  .op-pop {
    position: fixed; z-index: 2000;
    background: var(--color-white); border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md); box-shadow: var(--shadow-dropdown);
    display: flex; flex-direction: column; max-height: 22rem;
  }
  .op-list { overflow-y: auto; padding: 0.25rem 0; flex: 1; min-height: 0; }
  .op-item {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.35rem 0.75rem; font-size: 0.85rem; color: var(--color-slate-700); cursor: pointer;
  }
  .op-item:hover { background: var(--color-slate-50); }
  .op-all { font-weight: 600; border-bottom: 1px solid var(--color-slate-200); }
  .op-external { padding: 0.5rem 0.75rem; border-top: 1px solid var(--color-slate-200); display: flex; flex-direction: column; gap: 0.25rem; }
  .op-external label { font-size: 0.72rem; font-weight: 600; color: var(--color-slate-500); text-transform: uppercase; }
  .op-empty-note { margin: 0; padding: 0.5rem 0.75rem; font-size: 0.8rem; color: var(--color-slate-500); }
</style>
