<script>
  import { onMount } from 'svelte';
  import {
    getTrackerActions,
    createTrackerAction,
    updateTrackerAction,
    deleteTrackerAction,
    intakeText,
    saveIntakeUpdates,
    addActionUpdate,
    deleteActionUpdate
  } from '$lib/api/trackerActions.js';

  export let project;
  $: projectId = project?.id;

  // ── Grid state ──────────────────────────────────────────────────────────────
  let actions = [];
  let loading = true;
  let loadError = null;

  // Derived: unique sorted dates across all updates
  $: dates = [...new Set(
    actions.flatMap(a => a.updates.map(u => u.update_date))
  )].sort();

  async function load() {
    loading = true;
    loadError = null;
    try {
      actions = await getTrackerActions(projectId);
    } catch (e) {
      loadError = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { if (projectId) load(); });
  $: if (projectId) load();

  // ── Cell detail panel ────────────────────────────────────────────────────────
  let detailUpdate = null; // the action_update object being viewed
  let detailAction = null; // parent tracker_action

  function openDetail(action, update) {
    detailAction = action;
    detailUpdate = update;
  }
  function closeDetail() { detailAction = null; detailUpdate = null; }

  async function handleDeleteUpdate(updateId, actionId) {
    if (!confirm('Delete this update?')) return;
    try {
      await deleteActionUpdate(updateId);
      actions = actions.map(a => a.id === actionId
        ? { ...a, updates: a.updates.filter(u => u.id !== updateId) }
        : a
      );
      closeDetail();
    } catch (e) { alert(e.message); }
  }

  // ── Inline action editing ────────────────────────────────────────────────────
  let editingActionId = null;
  let editTitle = '';
  let editOwner = '';
  let editStatus = '';
  let editSaving = false;

  function startEditAction(action) {
    editingActionId = action.id;
    editTitle = action.title;
    editOwner = action.owner || '';
    editStatus = action.status;
  }
  function cancelEditAction() { editingActionId = null; }

  async function saveEditAction() {
    editSaving = true;
    try {
      const updated = await updateTrackerAction(editingActionId, {
        title: editTitle,
        owner: editOwner || null,
        status: editStatus
      });
      actions = actions.map(a => a.id === editingActionId ? { ...a, ...updated } : a);
      editingActionId = null;
    } catch (e) { alert(e.message); }
    finally { editSaving = false; }
  }

  async function handleDeleteAction(actionId) {
    if (!confirm('Remove this action from the tracker? All its updates will also be deleted.')) return;
    try {
      await deleteTrackerAction(actionId);
      actions = actions.filter(a => a.id !== actionId);
    } catch (e) { alert(e.message); }
  }

  // ── Add action manually ──────────────────────────────────────────────────────
  let showAddAction = false;
  let newTitle = '';
  let newOwner = '';
  let addingSaving = false;

  async function handleAddAction() {
    if (!newTitle.trim()) return;
    addingSaving = true;
    try {
      const created = await createTrackerAction(projectId, { title: newTitle, owner: newOwner || null });
      actions = [...actions, { ...created, updates: [] }];
      newTitle = '';
      newOwner = '';
      showAddAction = false;
    } catch (e) { alert(e.message); }
    finally { addingSaving = false; }
  }

  // ── AI intake modal ──────────────────────────────────────────────────────────
  let showIntake = false;
  let intakeStep = 'input'; // 'input' | 'reviewing' | 'confirmed'
  let intakeText_ = '';
  let intakeSourceType = 'meeting';
  let intakeDate = new Date().toISOString().slice(0, 10);
  let intakeProcessing = false;
  let intakeSuggestions = []; // raw from API
  let intakeReview = [];      // editable copy: [{ action_id, action_title, summary, include, is_new, suggested_title }]
  let intakeSaving = false;
  let intakeError = null;

  function openIntake() {
    showIntake = true;
    intakeStep = 'input';
    intakeText_ = '';
    intakeSuggestions = [];
    intakeReview = [];
    intakeError = null;
  }
  function closeIntake() { showIntake = false; }

  async function runIntake() {
    if (!intakeText_.trim()) return;
    intakeProcessing = true;
    intakeError = null;
    try {
      const suggestions = await intakeText(projectId, intakeText_);
      intakeSuggestions = suggestions;

      // Build editable review rows
      intakeReview = suggestions.map(s => {
        if (s.action_id != null) {
          const action = actions.find(a => a.id === s.action_id);
          return {
            action_id: s.action_id,
            action_title: action?.title || `Action #${s.action_id}`,
            summary: s.summary || '',
            include: true,
            is_new: false
          };
        } else {
          return {
            action_id: null,
            action_title: '',
            summary: s.summary || '',
            include: true,
            is_new: true,
            suggested_title: s.suggested_title || ''
          };
        }
      });

      intakeStep = 'reviewing';
    } catch (e) {
      intakeError = e.message;
    } finally {
      intakeProcessing = false;
    }
  }

  async function saveIntake() {
    intakeSaving = true;
    intakeError = null;
    try {
      const toSave = intakeReview.filter(r => r.include);
      const updates = toSave
        .filter(r => !r.is_new)
        .map(r => ({ action_id: r.action_id, summary: r.summary }));
      const new_actions = toSave
        .filter(r => r.is_new)
        .map(r => ({ title: r.suggested_title, summary: r.summary }));

      await saveIntakeUpdates(projectId, {
        update_date: intakeDate,
        full_text: intakeText_,
        source_type: intakeSourceType,
        updates,
        new_actions
      });
      await load();
      closeIntake();
    } catch (e) {
      intakeError = e.message;
    } finally {
      intakeSaving = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function formatDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  const STATUS_LABELS = { active: 'Active', blocked: 'Blocked', complete: 'Complete' };
  const STATUS_COLORS = { active: '#3b82f6', blocked: '#f59e0b', complete: '#10b981' };
</script>

<!-- ── Toolbar ─────────────────────────────────────────────────────────────── -->
<div class="at-toolbar">
  <button class="at-btn at-btn--primary" on:click={openIntake}>
    <i class="las la-file-import"></i> Add Update
  </button>
  <button class="at-btn at-btn--secondary" on:click={() => showAddAction = !showAddAction}>
    <i class="las la-plus"></i> Add Action
  </button>
  <button class="at-btn at-btn--ghost" on:click={load} title="Refresh">
    <i class="las la-sync"></i>
  </button>
</div>

<!-- ── Add action form ────────────────────────────────────────────────────── -->
{#if showAddAction}
  <div class="at-add-form">
    <input class="at-input" placeholder="Action title (verb-led)" bind:value={newTitle} />
    <input class="at-input" placeholder="Owner (optional)" bind:value={newOwner} />
    <button class="at-btn at-btn--primary" on:click={handleAddAction} disabled={addingSaving || !newTitle.trim()}>
      {addingSaving ? 'Saving…' : 'Add'}
    </button>
    <button class="at-btn at-btn--ghost" on:click={() => showAddAction = false}>Cancel</button>
  </div>
{/if}

<!-- ── Grid ───────────────────────────────────────────────────────────────── -->
{#if loading}
  <div class="at-empty">Loading…</div>
{:else if loadError}
  <div class="at-empty at-empty--error">{loadError}</div>
{:else if actions.length === 0}
  <div class="at-empty">
    <i class="las la-tasks" style="font-size:2rem;opacity:.3"></i>
    <p>No actions in tracker yet. Process a meeting note or add an action manually.</p>
  </div>
{:else}
  <div class="at-grid-wrap">
    <table class="at-grid">
      <thead>
        <tr>
          <th class="at-col-action">Action</th>
          {#each dates as date}
            <th class="at-col-date">{formatDate(date)}</th>
          {/each}
          <th class="at-col-actions-menu"></th>
        </tr>
      </thead>
      <tbody>
        {#each actions as action (action.id)}
          {#if editingActionId === action.id}
            <!-- Inline edit row -->
            <tr class="at-row at-row--editing">
              <td class="at-col-action">
                <input class="at-input at-input--sm" bind:value={editTitle} placeholder="Action title" />
                <input class="at-input at-input--sm" bind:value={editOwner} placeholder="Owner" />
                <select class="at-select" bind:value={editStatus}>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                  <option value="complete">Complete</option>
                </select>
                <div class="at-edit-btns">
                  <button class="at-btn at-btn--primary at-btn--xs" on:click={saveEditAction} disabled={editSaving}>
                    {editSaving ? '…' : 'Save'}
                  </button>
                  <button class="at-btn at-btn--ghost at-btn--xs" on:click={cancelEditAction}>Cancel</button>
                </div>
              </td>
              {#each dates as _}
                <td class="at-cell"></td>
              {/each}
              <td></td>
            </tr>
          {:else}
            <tr class="at-row" class:at-row--complete={action.status === 'complete'}>
              <td class="at-col-action">
                <div class="at-action-title">{action.title}</div>
                <div class="at-action-meta">
                  {#if action.owner}<span class="at-owner">{action.owner}</span>{/if}
                  <span class="at-status" style="color:{STATUS_COLORS[action.status]}">
                    {STATUS_LABELS[action.status]}
                  </span>
                </div>
              </td>
              {#each dates as date}
                {@const update = action.updates.find(u => u.update_date === date)}
                <td class="at-cell" class:at-cell--filled={!!update}
                    on:click={() => update && openDetail(action, update)}
                    title={update ? update.summary : ''}>
                  {#if update}
                    <span class="at-summary">{update.summary}</span>
                  {/if}
                </td>
              {/each}
              <td class="at-col-actions-menu">
                <button class="at-icon-btn" title="Edit action" on:click={() => startEditAction(action)}>
                  <i class="las la-edit"></i>
                </button>
                <button class="at-icon-btn at-icon-btn--danger" title="Delete action" on:click={() => handleDeleteAction(action.id)}>
                  <i class="las la-trash"></i>
                </button>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<!-- ── Cell detail panel ──────────────────────────────────────────────────── -->
{#if detailUpdate}
  <div class="at-overlay" on:click={closeDetail}></div>
  <div class="at-panel">
    <div class="at-panel-header">
      <div>
        <div class="at-panel-title">{detailAction?.title}</div>
        <div class="at-panel-date">{formatDate(detailUpdate.update_date)}
          · <span class="at-source-badge">{detailUpdate.source_type}</span>
          {#if detailUpdate.source_meeting_title}· {detailUpdate.source_meeting_title}{/if}
        </div>
      </div>
      <button class="at-icon-btn" on:click={closeDetail}><i class="las la-times"></i></button>
    </div>
    <p class="at-panel-summary">{detailUpdate.summary}</p>
    {#if detailUpdate.full_text}
      <div class="at-panel-section">Source text</div>
      <pre class="at-panel-full">{detailUpdate.full_text}</pre>
    {/if}
    <div class="at-panel-footer">
      <button class="at-btn at-btn--danger at-btn--xs"
              on:click={() => handleDeleteUpdate(detailUpdate.id, detailAction.id)}>
        Delete update
      </button>
    </div>
  </div>
{/if}

<!-- ── AI intake modal ────────────────────────────────────────────────────── -->
{#if showIntake}
  <div class="at-modal-backdrop" on:click|self={closeIntake}>
    <div class="at-modal">
      <div class="at-modal-header">
        <h3>Add Update</h3>
        <button class="at-icon-btn" on:click={closeIntake}><i class="las la-times"></i></button>
      </div>

      {#if intakeStep === 'input'}
        <div class="at-modal-body">
          <div class="at-form-row">
            <label class="at-label">Date</label>
            <input class="at-input" type="date" bind:value={intakeDate} />
          </div>
          <div class="at-form-row">
            <label class="at-label">Source</label>
            <select class="at-select" bind:value={intakeSourceType}>
              <option value="meeting">Meeting notes</option>
              <option value="email">Email thread</option>
              <option value="manual">Manual note</option>
            </select>
          </div>
          <div class="at-form-row">
            <label class="at-label">Paste text</label>
            <textarea class="at-textarea" rows="10" placeholder="Paste meeting notes, email thread, or any text here…"
                      bind:value={intakeText_}></textarea>
          </div>
          {#if intakeError}<p class="at-error">{intakeError}</p>{/if}
        </div>
        <div class="at-modal-footer">
          <button class="at-btn at-btn--ghost" on:click={closeIntake}>Cancel</button>
          <button class="at-btn at-btn--primary" on:click={runIntake}
                  disabled={intakeProcessing || !intakeText_.trim()}>
            {intakeProcessing ? 'Analysing…' : 'Analyse'}
          </button>
        </div>

      {:else if intakeStep === 'reviewing'}
        <div class="at-modal-body">
          {#if intakeReview.length === 0}
            <p class="at-empty-msg">No actions were identified in the text. You can go back and try different text, or add an action manually.</p>
          {:else}
            <p class="at-review-hint">Review the suggestions below. Edit summaries, remove rows you don't want, or adjust new action titles before saving.</p>
            {#each intakeReview as row, i}
              <div class="at-review-row" class:at-review-row--excluded={!row.include}>
                <label class="at-checkbox-label">
                  <input type="checkbox" bind:checked={row.include} />
                  {#if row.is_new}
                    <span class="at-new-badge">New action</span>
                    <input class="at-input at-input--sm" bind:value={row.suggested_title}
                           placeholder="Action title" style="margin-top:.25rem" />
                  {:else}
                    <span class="at-review-action-title">{row.action_title}</span>
                  {/if}
                </label>
                <textarea class="at-textarea at-textarea--sm" rows="2" bind:value={row.summary}
                          disabled={!row.include}></textarea>
              </div>
            {/each}
          {/if}
          {#if intakeError}<p class="at-error">{intakeError}</p>{/if}
        </div>
        <div class="at-modal-footer">
          <button class="at-btn at-btn--ghost" on:click={() => intakeStep = 'input'}>Back</button>
          <button class="at-btn at-btn--primary" on:click={saveIntake}
                  disabled={intakeSaving || intakeReview.filter(r => r.include).length === 0}>
            {intakeSaving ? 'Saving…' : `Save ${intakeReview.filter(r => r.include).length} update${intakeReview.filter(r => r.include).length !== 1 ? 's' : ''}`}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ── Toolbar ──────────────────────────────────────────────────────────────── */
  .at-toolbar { display: flex; gap: .5rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }

  .at-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .4rem .85rem;
    border-radius: 6px; font-size: .85rem; font-weight: 500; cursor: pointer;
    border: 1px solid transparent; transition: background .15s, opacity .15s; }
  .at-btn:disabled { opacity: .5; cursor: not-allowed; }
  .at-btn--primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
  .at-btn--primary:hover:not(:disabled) { background: #2563eb; }
  .at-btn--secondary { background: #f1f5f9; color: #334155; border-color: #e2e8f0; }
  .at-btn--secondary:hover:not(:disabled) { background: #e2e8f0; }
  .at-btn--ghost { background: transparent; color: #64748b; border-color: #e2e8f0; }
  .at-btn--ghost:hover:not(:disabled) { background: #f8fafc; }
  .at-btn--danger { background: #fef2f2; color: #ef4444; border-color: #fecaca; }
  .at-btn--danger:hover:not(:disabled) { background: #fee2e2; }
  .at-btn--xs { padding: .25rem .55rem; font-size: .78rem; }

  /* ── Add form ─────────────────────────────────────────────────────────────── */
  .at-add-form { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;
    padding: .75rem; background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 8px; margin-bottom: 1rem; }

  /* ── Inputs ───────────────────────────────────────────────────────────────── */
  .at-input { padding: .4rem .65rem; border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: .85rem; background: #fff; outline: none; }
  .at-input:focus { border-color: #93c5fd; }
  .at-input--sm { font-size: .82rem; padding: .3rem .55rem; width: 100%; }
  .at-select { padding: .4rem .65rem; border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: .85rem; background: #fff; outline: none; }
  .at-textarea { padding: .5rem .65rem; border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: .85rem; font-family: inherit; resize: vertical; width: 100%; background: #fff; outline: none; }
  .at-textarea:focus { border-color: #93c5fd; }
  .at-textarea--sm { font-size: .82rem; margin-top: .35rem; }

  /* ── Empty / error ────────────────────────────────────────────────────────── */
  .at-empty { display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: .5rem; padding: 3rem 1rem; color: #94a3b8; text-align: center; }
  .at-empty--error { color: #ef4444; }
  .at-empty p { font-size: .9rem; max-width: 26rem; }

  /* ── Grid ─────────────────────────────────────────────────────────────────── */
  .at-grid-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e2e8f0;
    border-radius: 8px; }
  .at-grid { width: 100%; border-collapse: collapse; font-size: .85rem; }

  .at-grid thead th { position: sticky; top: 0; background: #f8fafc; z-index: 2;
    padding: .55rem .75rem; text-align: left; font-weight: 600; color: #475569;
    border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  .at-col-action { min-width: 220px; max-width: 280px; position: sticky; left: 0;
    background: #f8fafc; z-index: 3; }
  .at-grid thead .at-col-action { z-index: 4; }
  .at-col-date { min-width: 140px; max-width: 200px; }
  .at-col-actions-menu { width: 60px; }

  .at-row td { border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .at-row:last-child td { border-bottom: none; }
  .at-row--complete .at-action-title { text-decoration: line-through; opacity: .55; }

  .at-col-action { padding: .6rem .75rem; position: sticky; left: 0; background: #fff;
    z-index: 1; box-shadow: 2px 0 4px -2px rgba(0,0,0,.06); }
  .at-row--editing .at-col-action { background: #f8fafc; }

  .at-action-title { font-weight: 500; color: #1e293b; line-height: 1.3; margin-bottom: .2rem; }
  .at-action-meta { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; }
  .at-owner { font-size: .75rem; background: #e0f2fe; color: #0369a1;
    padding: .1rem .45rem; border-radius: 99px; }
  .at-status { font-size: .75rem; font-weight: 600; }

  .at-cell { padding: .55rem .75rem; cursor: default; vertical-align: top; }
  .at-cell--filled { cursor: pointer; background: #f0f9ff; }
  .at-cell--filled:hover { background: #dbeafe; }
  .at-summary { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    overflow: hidden; color: #334155; font-size: .82rem; line-height: 1.45; }

  .at-icon-btn { background: none; border: none; cursor: pointer; padding: .25rem;
    color: #94a3b8; border-radius: 4px; transition: color .15s, background .15s; }
  .at-icon-btn:hover { color: #475569; background: #f1f5f9; }
  .at-icon-btn--danger:hover { color: #ef4444; background: #fef2f2; }
  .at-col-actions-menu td, .at-col-actions-menu { padding: .45rem .35rem; vertical-align: top;
    display: flex; gap: .1rem; }

  .at-edit-btns { display: flex; gap: .35rem; margin-top: .4rem; }

  /* ── Detail panel ─────────────────────────────────────────────────────────── */
  .at-overlay { position: fixed; inset: 0; z-index: 40; }
  .at-panel { position: fixed; right: 0; top: 0; bottom: 0; width: min(420px, 90vw);
    background: #fff; box-shadow: -4px 0 20px rgba(0,0,0,.12); z-index: 50;
    display: flex; flex-direction: column; overflow: hidden; }
  .at-panel-header { display: flex; justify-content: space-between; align-items: flex-start;
    padding: 1rem 1rem .75rem; border-bottom: 1px solid #e2e8f0; gap: .5rem; }
  .at-panel-title { font-weight: 600; color: #1e293b; font-size: .95rem; }
  .at-panel-date { font-size: .8rem; color: #64748b; margin-top: .2rem; }
  .at-source-badge { background: #e0f2fe; color: #0369a1; padding: .1rem .4rem;
    border-radius: 99px; font-size: .72rem; font-weight: 600; text-transform: capitalize; }
  .at-panel-summary { padding: .85rem 1rem; color: #1e293b; font-size: .9rem; line-height: 1.5;
    font-style: italic; border-bottom: 1px solid #f1f5f9; margin: 0; }
  .at-panel-section { padding: .6rem 1rem .2rem; font-size: .75rem; font-weight: 700;
    color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .at-panel-full { padding: .5rem 1rem 1rem; font-size: .8rem; color: #475569;
    white-space: pre-wrap; word-break: break-word; line-height: 1.5; overflow-y: auto;
    flex: 1; margin: 0; font-family: inherit; }
  .at-panel-footer { padding: .75rem 1rem; border-top: 1px solid #e2e8f0; display: flex;
    justify-content: flex-end; }

  /* ── Intake modal ─────────────────────────────────────────────────────────── */
  .at-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.35);
    z-index: 60; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .at-modal { background: #fff; border-radius: 12px; width: min(640px, 100%);
    max-height: 90vh; display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,.2); }
  .at-modal-header { display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.25rem .75rem; border-bottom: 1px solid #e2e8f0; }
  .at-modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: #1e293b; }
  .at-modal-body { padding: 1rem 1.25rem; overflow-y: auto; flex: 1; display: flex;
    flex-direction: column; gap: .85rem; }
  .at-modal-footer { padding: .75rem 1.25rem; border-top: 1px solid #e2e8f0;
    display: flex; justify-content: flex-end; gap: .5rem; }

  .at-form-row { display: flex; flex-direction: column; gap: .3rem; }
  .at-label { font-size: .8rem; font-weight: 600; color: #475569; }
  .at-error { color: #ef4444; font-size: .83rem; margin: 0; }

  .at-review-hint { font-size: .83rem; color: #64748b; margin: 0; }
  .at-empty-msg { font-size: .85rem; color: #64748b; }

  .at-review-row { padding: .75rem; border: 1px solid #e2e8f0; border-radius: 8px;
    display: flex; flex-direction: column; gap: .3rem; transition: opacity .15s; }
  .at-review-row--excluded { opacity: .45; }
  .at-checkbox-label { display: flex; align-items: flex-start; gap: .5rem; cursor: pointer;
    font-size: .85rem; font-weight: 500; color: #1e293b; }
  .at-checkbox-label input[type=checkbox] { margin-top: .15rem; flex-shrink: 0; }
  .at-checkbox-label > div { display: flex; flex-direction: column; gap: .2rem; width: 100%; }
  .at-new-badge { display: inline-block; background: #fef3c7; color: #92400e;
    font-size: .72rem; font-weight: 700; padding: .1rem .45rem; border-radius: 99px;
    text-transform: uppercase; letter-spacing: .04em; margin-bottom: .2rem; }
  .at-review-action-title { font-weight: 500; color: #1e293b; }
</style>
