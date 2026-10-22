<script>
  // Actions saved from meetings, with Resolve and progress-update controls.
  // The parent supplies `load` (returns the action rows) so this works for one
  // meeting, one project, or several projects merged. Changing `loadKey`
  // reloads; `dispatch('changed')` tells the parent counts may be stale.
  import { createEventDispatcher } from 'svelte';
  import { addMeetingActionUpdate, updateMeetingAction, deleteMeetingAction } from '$lib/api/meetingNotes.js';
  import OwnerInput from '$lib/components/shared/OwnerInput.svelte';

  export let load;
  export let loadKey = '';
  export let showProject = false;     // tag each row with its project name (merged views)
  export let showCompleted = false;   // include resolved actions, greyed out
  export let showMeeting = false;     // show which meeting an action came from
  export let emptyText = 'No actions.';
  export let compact = false;         // narrow widget: smaller text, icon-only buttons
  /** @type {'open' | 'resolved' | 'all' | null} */
  export let statusFilter = null;     // 'open' | 'resolved' | 'all' — overrides showCompleted when set
  export let search = '';             // case-insensitive match on action text, owner and meeting
  // Fold the per-person copies of one action (same meeting, text, due date and
  // notes) into a single row listing everyone it's assigned to. Each person still
  // has their own row underneath, so it shows separately on their own actions.
  export let groupByAction = false;
  // Give the owner(s) their own column beside the action instead of a line of
  // small text under it, so who it belongs to is obvious at a glance.
  export let ownerColumn = false;
  // The action's free-text notes line under it. Always still editable via Edit.
  export let showNotes = true;
  // Optional predicate on a raw action row (e.g. "assigned to me", "in these
  // projects"). Applied client-side to the already-loaded rows, so changing it
  // never refetches. A grouped row shows if any of the people on it match.
  export let rowFilter = null;

  const dispatch = createEventDispatcher();

  let actions = [];
  let loading = true;
  let error = null;
  let lastKey = null;

  $: if (loadKey !== lastKey) {
    lastKey = loadKey;
    reload();
  }

  export async function reload() {
    loading = actions.length === 0;
    error = null;
    try {
      actions = (await load()) || [];
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function groupKey(a) {
    return [a.transcript_id, (a.action_text || '').trim().toLowerCase(), (a.due_date || '').slice(0, 10), (a.notes || '').trim()].join('|');
  }

  // Rows become display items with a `members` list (just themselves unless grouped).
  function buildItems(rows, group) {
    if (!group) return rows.map(a => ({ ...a, members: [a] }));
    const byKey = new Map();
    for (const a of rows) {
      const key = groupKey(a);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(a);
    }
    return [...byKey.values()].map(members => {
      if (members.length === 1) return { ...members[0], members };
      const seen = new Set();
      const updates = members.flatMap(m => m.updates || []).filter(u => {
        const k = `${u.update_type}|${u.update_text}|${(u.created_at || '').slice(0, 10)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return {
        ...members[0],
        members,
        updates,
        status: members.every(m => m.status === 'complete') ? 'complete' : 'pending'
      };
    });
  }

  $: visible = buildItems(actions, groupByAction).filter(a => {
    const status = statusFilter ?? (showCompleted ? 'all' : 'open');
    if (status === 'open' && a.status === 'complete') return false;
    if (status === 'resolved' && a.status !== 'complete') return false;
    if (rowFilter && !a.members.some(rowFilter)) return false;
    const q = search.trim().toLowerCase();
    return !q || [a.action_text, ...a.members.map(m => m.owner), a.meeting_title, a.project_name].some(v => v?.toLowerCase().includes(q));
  });

  const isGroup = a => a.members.length > 1;

  function ownersLabel(a) {
    return a.members.map(m => m.owner || 'Unassigned').join(', ');
  }

  let editingId = null;
  let draft = '';
  let busyId = null;

  function startUpdate(a) {
    fieldsId = null;
    resolvingId = null;
    editingId = a.id;
    draft = '';
  }

  // Resolve opens an optional "what happened?" note before closing the action.
  // The note is saved as the 'completed' update and shows as "Resolved. <note>".
  let resolvingId = null;
  let resolveDraft = '';

  function startResolve(a) {
    fieldsId = null;
    editingId = null;
    resolvingId = a.id;
    resolveDraft = '';
  }

  // Edit the action's own fields (text, owner, due date, notes) — works on
  // resolved actions too. The PUT overwrites owner/due/notes, so all are sent.
  let fieldsId = null;
  let fields = { action_text: '', owner: '', due_date: '', notes: '' };

  function startFieldsEdit(a) {
    editingId = null;
    resolvingId = null;
    fieldsId = a.id;
    fieldsGroup = isGroup(a);
    fields = {
      action_text: a.action_text || '',
      owner: a.owner || '',
      due_date: a.due_date ? a.due_date.slice(0, 10) : '',
      notes: a.notes || ''
    };
  }

  let fieldsGroup = false; // editing a grouped action: each person keeps their own owner
  $: fieldsInvalid = !fields.action_text.trim() || (!fieldsGroup && !fields.owner.trim());

  async function removeAction(a) {
    const who = isGroup(a) ? ` for all ${a.members.length} people it is assigned to` : '';
    if (!confirm(`Delete this action${who}?\n\n"${a.action_text}"`)) return;
    busyId = a.id;
    error = null;
    try {
      for (const m of a.members) await deleteMeetingAction(m.id);
      if (fieldsId === a.id) fieldsId = null;
      if (editingId === a.id) editingId = null;
      await reload();
      dispatch('changed');
    } catch (err) {
      error = err.message;
    } finally {
      busyId = null;
    }
  }

  async function saveFields(a) {
    if (fieldsInvalid) return;
    busyId = a.id;
    error = null;
    try {
      if (isGroup(a)) {
        // Shared fields change for everyone; each person keeps their own owner and account link.
        for (const m of a.members) {
          await updateMeetingAction(m.id, {
            action_text: fields.action_text,
            owner: m.owner,
            assigned_user_id: m.assigned_user_id || null,
            due_date: fields.due_date || null,
            notes: fields.notes
          });
        }
      } else {
        await updateMeetingAction(a.id, {
          action_text: fields.action_text,
          owner: fields.owner,
          due_date: fields.due_date || null,
          notes: fields.notes
        });
      }
      fieldsId = null;
      await reload();
      dispatch('changed');
    } catch (err) {
      error = err.message;
    } finally {
      busyId = null;
    }
  }

  async function submit(a, update_type, update_text = null) {
    busyId = a.id;
    error = null;
    try {
      for (const m of a.members.filter(m => m.status !== 'complete')) {
        await addMeetingActionUpdate(m.id, { update_type, update_text });
      }
      editingId = null;
      resolvingId = null;
      draft = '';
      resolveDraft = '';
      await reload();
      dispatch('changed');
    } catch (err) {
      error = err.message;
    } finally {
      busyId = null;
    }
  }

  function formatDate(d) {
    return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
  }

  function isOverdue(a) {
    return a.status !== 'complete' && a.due_date && a.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
  }
</script>

<div class="mal" class:mal--compact={compact}>
  {#if error}<p class="mal-error">{error}</p>{/if}
  {#if loading}
    <p class="mal-state">Loading…</p>
  {:else if visible.length === 0}
    <p class="mal-state">{emptyText}</p>
  {:else}
    {#each visible as a (a.id)}
      <div class="mal-row" class:mal-row--done={a.status === 'complete'}>
        <div class="mal-main">
          {#if fieldsId === a.id}
            <div class="mal-fields">
              <input class="form-input" type="text" placeholder="Action…" bind:value={fields.action_text} />
              <div class="mal-fields-row">
                {#if fieldsGroup}
                  <span class="mal-owners-static">{ownersLabel(a)}</span>
                {:else}
                  <OwnerInput bind:value={fields.owner} />
                {/if}
                <input class="form-input" type="date" bind:value={fields.due_date} />
              </div>
              <input class="form-input" type="text" placeholder="Notes (optional)" bind:value={fields.notes} />
              {#if !fieldsGroup && !fields.owner.trim()}<p class="mal-warn">An owner is required.</p>{/if}
              <div class="mal-edit">
                <button class="btn btn-primary btn-sm" disabled={fieldsInvalid || busyId === a.id} on:click={() => saveFields(a)}>Save</button>
                <button class="btn btn-ghost btn-sm" on:click={() => (fieldsId = null)}>Cancel</button>
              </div>
            </div>
          {:else}
          <div class="mal-line">
            {#if a.status === 'complete'}<i class="las la-check-circle mal-tick"></i>{/if}
            <span class="mal-text">{a.action_text}</span>
          </div>
          <div class="mal-meta">
            {#if showProject && a.project_name}<span class="mal-project" title={a.project_name}>{a.project_name}</span>{/if}
            {#if ownerColumn}
              <!-- owners are shown in their own column -->
            {:else if isGroup(a)}
              <span class="mal-owners" title={ownersLabel(a)}>
                {#each a.members.slice(0, 4) as m, i}{#if i > 0}, {/if}<span class:mal-owner-done={m.status === 'complete'}>{m.owner || 'Unassigned'}</span>{/each}{#if a.members.length > 4} +{a.members.length - 4} more{/if}
              </span>
            {:else if a.owner}<span>{a.owner}</span>{/if}
            {#if a.due_date}<span class:mal-overdue={isOverdue(a)}>Due {formatDate(a.due_date)}</span>{/if}
            {#if showMeeting && a.meeting_title}<span>from {a.meeting_title}</span>{/if}
          </div>
          {#if showNotes && a.notes}<div class="mal-notes">{a.notes}</div>{/if}
          {/if}
          {#each a.updates || [] as u}
            <div class="mal-update">
              <span class="mal-update-date">{formatDate(u.created_at)}</span>
              {#if u.update_type === 'completed'}<strong>Resolved.</strong>{/if}
              {u.update_text || ''}
            </div>
          {/each}

          {#if editingId === a.id}
            <div class="mal-edit">
              <input
                class="form-input"
                type="text"
                placeholder="What's happened on this action…"
                bind:value={draft}
                on:keydown={(e) => e.key === 'Enter' && draft.trim() && submit(a, 'progress', draft)}
              />
              <button class="btn btn-primary btn-sm" disabled={!draft.trim() || busyId === a.id} on:click={() => submit(a, 'progress', draft)}>Save</button>
              <button class="btn btn-ghost btn-sm" on:click={() => (editingId = null)}>Cancel</button>
            </div>
          {/if}

          {#if resolvingId === a.id}
            <div class="mal-edit">
              <input
                class="form-input"
                type="text"
                placeholder="What happened? (optional)"
                bind:value={resolveDraft}
                on:keydown={(e) => e.key === 'Enter' && submit(a, 'completed', resolveDraft.trim() || null)}
              />
              <button class="btn btn-primary btn-sm" disabled={busyId === a.id} on:click={() => submit(a, 'completed', resolveDraft.trim() || null)}>Resolve</button>
              <button class="btn btn-ghost btn-sm" on:click={() => (resolvingId = null)}>Cancel</button>
            </div>
          {/if}
        </div>

        {#if ownerColumn && fieldsId !== a.id}
          <div class="mal-owner-col">
            <div class="mal-owner-label">{isGroup(a) ? `Assigned to (${a.members.length})` : 'Owner'}</div>
            <div class="mal-owner-names">
              {#each a.members as m (m.id)}
                <div class="mal-owner-name" class:mal-owner-done={m.status === 'complete'} title={m.status === 'complete' ? 'Done' : 'Open'}>
                  {#if m.status === 'complete'}<i class="las la-check-circle mal-tick"></i>{/if}{m.owner || 'Unassigned'}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if editingId !== a.id && fieldsId !== a.id && resolvingId !== a.id}
          <div class="mal-buttons">
            {#if a.status !== 'complete'}
              <button class="btn btn-secondary btn-sm" title="Update" aria-label="Update" disabled={busyId === a.id} on:click={() => startUpdate(a)}>
                <i class="las la-comment"></i><span class="mal-btn-label"> Update</span>
              </button>
              <button class="btn btn-secondary btn-sm" title="Resolve" aria-label="Resolve" disabled={busyId === a.id} on:click={() => startResolve(a)}>
                <i class="las la-check"></i><span class="mal-btn-label"> Resolve</span>
              </button>
            {/if}
            <button class="btn btn-icon btn-ghost" title="Edit action" aria-label="Edit action" disabled={busyId === a.id} on:click={() => startFieldsEdit(a)}>
              <i class="las la-pen"></i>
            </button>
            <button class="btn btn-icon btn-ghost" title="Delete action" aria-label="Delete action" disabled={busyId === a.id} on:click={() => removeAction(a)}>
              <i class="las la-trash"></i>
            </button>
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .mal { display: flex; flex-direction: column; gap: 0.5rem; }
  .mal-state { margin: 0; font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 0.5rem 0; }
  .mal-error { margin: 0; font-size: 0.8rem; color: var(--color-red-600); }
  .mal-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.6rem; border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); font-size: 0.8rem; }
  .mal-row--done { opacity: 0.6; }
  .mal-row--done .mal-text { text-decoration: line-through; }
  .mal-main { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; flex: 1; }
  .mal-line { display: flex; align-items: flex-start; gap: 0.3rem; }
  .mal-tick { color: var(--color-emerald-600); margin-top: 1px; }
  .mal-text { color: var(--color-slate-800); font-weight: 500; }
  .mal-meta { display: flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; align-items: center; font-size: 0.72rem; color: var(--color-slate-500); }
  .mal-project { font-weight: 600; color: var(--color-primary-600); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mal-overdue { color: var(--color-red-600); font-weight: 600; }
  .mal-update { font-size: 0.75rem; color: var(--color-slate-600); padding-left: 0.6rem; border-left: 2px solid var(--color-slate-200); }
  .mal-update-date { color: var(--color-slate-400); margin-right: 0.3rem; }
  .mal-edit { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.25rem; }
  .mal--compact .mal-row { gap: 0.4rem; padding: 0.35rem 0.45rem; font-size: 0.72rem; }
  .mal--compact .mal-text { font-size: 0.72rem; }
  .mal--compact .mal-meta, .mal--compact .mal-update, .mal--compact .mal-notes { font-size: 0.65rem; }
  .mal--compact .mal-btn-label { display: none; }
  .mal--compact .mal-buttons { gap: 0.15rem; }
  .mal--compact .mal-buttons :global(.btn) { padding: 0; width: 1.4rem; height: 1.4rem; min-width: 0; justify-content: center; font-size: 0.8rem; }
  .mal-notes { font-size: 0.72rem; color: var(--color-slate-500); }
  .mal-fields { display: flex; flex-direction: column; gap: 0.4rem; }
  .mal-fields-row { display: grid; grid-template-columns: 1fr 9.5rem; gap: 0.5rem; }
  .mal-owner-col { flex: 0 0 15rem; display: flex; flex-direction: column; gap: 0.2rem; padding-left: 0.75rem; border-left: 1px solid var(--color-slate-200); align-self: stretch; }
  .mal-owner-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-slate-500); }
  .mal-owner-names { display: flex; flex-direction: column; gap: 0.15rem; max-height: 7.5rem; overflow-y: auto; }
  .mal-owner-name { font-size: 0.85rem; font-weight: 500; color: var(--color-slate-800); }
  .mal--compact .mal-owner-col { display: none; }
  .mal-owners-static { font-size: 0.8rem; color: var(--color-slate-600); align-self: center; }
  .mal-owner-done { text-decoration: line-through; color: var(--color-slate-400); }
  .mal-warn { margin: 0; font-size: 0.75rem; color: var(--color-amber-800); }
  .mal-buttons { display: flex; gap: 0.35rem; flex-shrink: 0; }
</style>
