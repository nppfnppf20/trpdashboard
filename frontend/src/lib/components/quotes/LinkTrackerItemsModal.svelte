<script>
  import { createEventDispatcher } from 'svelte';
  import { getProjectConditionsForLinking, getProjectIssuesForLinking } from '$lib/api/quotes.js';
  import { linkConditionQuote, unlinkConditionQuote } from '$lib/api/conditions.js';
  import { linkIssueQuote, unlinkIssueQuote, createIssue } from '$lib/api/progressTracker.js';

  export let show = false;
  export let projectPk;   // integer project id (public.projects.id)
  export let quote;       // { id, surveyor_organisation, discipline }
  export let justInstructed = false;   // opened automatically right after instructing, rather than manually

  const dispatch = createEventDispatcher();

  let conditions = [];
  let issues = [];
  let originalLinkedConditionIds = new Set();
  let originalLinkedIssueIds = new Set();
  let checkedConditionIds = new Set();
  let checkedIssueIds = new Set();
  let loading = false;
  let saving = false;
  let error = null;
  let loaded = false;

  let newIssueTitle = '';
  let creatingIssue = false;
  let createIssueError = null;

  $: defaultIssueTitle = [quote?.discipline, quote?.surveyor_organisation].filter(Boolean).join(' — ') || 'Survey';

  $: if (show && !loaded && projectPk) {
    loaded = true;
    if (justInstructed) newIssueTitle = defaultIssueTitle;
    load();
  }

  async function createAndLinkIssue() {
    const title = newIssueTitle.trim();
    if (!title) return;
    creatingIssue = true;
    createIssueError = null;
    try {
      const created = await createIssue(projectPk, { title, discipline: quote?.discipline || null });
      issues = [...issues, { id: created.id, title: created.title, linked: false }];
      checkedIssueIds = new Set([...checkedIssueIds, created.id]);
      newIssueTitle = '';
    } catch (err) {
      createIssueError = err.message;
    } finally {
      creatingIssue = false;
    }
  }

  async function load() {
    loading = true;
    error = null;
    try {
      const [{ conditions: conditionRows }, { issues: issueRows }] = await Promise.all([
        getProjectConditionsForLinking(projectPk, quote.id),
        getProjectIssuesForLinking(projectPk, quote.id),
      ]);
      conditions = conditionRows;
      issues = issueRows;
      originalLinkedConditionIds = new Set(conditionRows.filter(c => c.linked).map(c => c.id));
      originalLinkedIssueIds = new Set(issueRows.filter(i => i.linked).map(i => i.id));
      checkedConditionIds = new Set(originalLinkedConditionIds);
      checkedIssueIds = new Set(originalLinkedIssueIds);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function toggleCondition(id) {
    const next = new Set(checkedConditionIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    checkedConditionIds = next;
  }

  function toggleIssue(id) {
    const next = new Set(checkedIssueIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    checkedIssueIds = next;
  }

  async function save() {
    saving = true;
    error = null;
    try {
      const condToLink = [...checkedConditionIds].filter(id => !originalLinkedConditionIds.has(id));
      const condToUnlink = [...originalLinkedConditionIds].filter(id => !checkedConditionIds.has(id));
      for (const id of condToLink) await linkConditionQuote(id, quote.id);
      for (const id of condToUnlink) await unlinkConditionQuote(id, quote.id);

      const issueToLink = [...checkedIssueIds].filter(id => !originalLinkedIssueIds.has(id));
      const issueToUnlink = [...originalLinkedIssueIds].filter(id => !checkedIssueIds.has(id));
      for (const id of issueToLink) await linkIssueQuote(id, quote.id);
      for (const id of issueToUnlink) await unlinkIssueQuote(id, quote.id);

      dispatch('done');
      close();
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  function close() {
    if (saving) return;
    show = false;
    loaded = false;
    conditions = [];
    issues = [];
    newIssueTitle = '';
    createIssueError = null;
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={close} role="dialog" aria-modal="true">
    <div class="modal modal-link-items">
      <div class="modal-header">
        <span class="modal-title">
          {justInstructed ? `Tag this survey: ${quote?.surveyor_organisation || 'Quote'}` : `Link to Conditions / Issues: ${quote?.surveyor_organisation || 'Quote'}`}
        </span>
        <button class="modal-close" on:click={close}>&times;</button>
      </div>

      <div class="modal-body">
        {#if justInstructed}
          <p class="lc-intro">Which condition or issue is this survey for? Pick an existing one below, or create one now — you can always change this later.</p>
        {/if}
        {#if loading}
          <div class="lc-loading"><span class="lc-spinner"></span> Loading…</div>
        {:else}
          <div class="lc-section">
            <span class="lc-section-label">Conditions</span>
            {#if conditions.length === 0}
              <p class="lc-empty">No conditions on this project yet.</p>
            {:else}
              <div class="lc-list">
                {#each conditions as c (c.id)}
                  <label class="lc-row">
                    <input type="checkbox" checked={checkedConditionIds.has(c.id)} on:change={() => toggleCondition(c.id)} />
                    <span class="lc-row-text">
                      {#if c.condition_number}<span class="lc-row-number">{c.condition_number}.</span>{/if}
                      {c.title}
                    </span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>

          <div class="lc-section">
            <span class="lc-section-label">Issues</span>
            {#if issues.length === 0}
              <p class="lc-empty">No issues on this project yet.</p>
            {:else}
              <div class="lc-list">
                {#each issues as i (i.id)}
                  <label class="lc-row">
                    <input type="checkbox" checked={checkedIssueIds.has(i.id)} on:change={() => toggleIssue(i.id)} />
                    <span class="lc-row-text">{i.title}</span>
                  </label>
                {/each}
              </div>
            {/if}
            <div class="lc-create-row">
              <input
                type="text"
                class="lc-create-input"
                placeholder="New issue title…"
                bind:value={newIssueTitle}
                on:keydown={(e) => e.key === 'Enter' && createAndLinkIssue()}
              />
              <button class="lc-create-btn" on:click={createAndLinkIssue} disabled={creatingIssue || !newIssueTitle.trim()}>
                {creatingIssue ? 'Creating…' : '+ Create & link'}
              </button>
            </div>
            {#if createIssueError}<div class="lc-error">{createIssueError}</div>{/if}
          </div>
        {/if}
        {#if error}<div class="lc-error">{error}</div>{/if}
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" on:click={close} disabled={saving}>{justInstructed ? 'Skip for now' : 'Cancel'}</button>
        <button class="btn-save" on:click={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 10px;
    width: 100%;
    display: flex;
    flex-direction: column;
    max-height: 82vh;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .modal-link-items { max-width: 520px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--color-slate-500);
    cursor: pointer;
    border-radius: 4px;
    font-size: 1.1rem;
  }
  .modal-close:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .lc-intro {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-slate-600);
    line-height: 1.5;
  }

  .lc-section { display: flex; flex-direction: column; gap: 0.4rem; }

  .lc-create-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.15rem;
  }
  .lc-create-input {
    flex: 1;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.83rem;
    font-family: inherit;
    color: var(--color-slate-800);
  }
  .lc-create-input:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
  }
  .lc-create-btn {
    flex-shrink: 0;
    padding: 0.4rem 0.85rem;
    background: var(--color-slate-100);
    color: var(--color-slate-700);
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
  }
  .lc-create-btn:hover:not(:disabled) { background: var(--color-slate-200); }
  .lc-create-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .lc-section-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-slate-500);
  }

  .lc-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-slate-500);
    font-size: 0.875rem;
    padding: 1.5rem 0;
  }
  .lc-spinner {
    width: 16px; height: 16px; border: 2px solid var(--color-slate-200); border-top-color: var(--color-primary-600);
    border-radius: 50%; animation: lc-spin 0.8s linear infinite;
  }
  @keyframes lc-spin { to { transform: rotate(360deg); } }

  .lc-empty {
    margin: 0;
    padding: 0.5rem 0;
    font-size: 0.82rem;
    color: var(--color-slate-400);
  }

  .lc-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-height: 160px;
    overflow-y: auto;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    padding: 0.4rem 0.5rem;
  }
  .lc-row {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding: 0.3rem 0.4rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .lc-row:hover { background: var(--color-slate-50); }
  .lc-row input { margin-top: 2px; }
  .lc-row-text { font-size: 0.85rem; color: var(--color-slate-800); line-height: 1.4; }
  .lc-row-number { font-weight: 600; color: var(--color-slate-600); margin-right: 2px; }

  .lc-error {
    font-size: 0.8rem;
    color: var(--color-red-600);
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .btn-cancel {
    padding: 0.45rem 1rem;
    border: 1px solid var(--color-slate-300);
    background: white;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    color: var(--color-slate-500);
  }
  .btn-cancel:hover { background: var(--color-slate-50); }
  .btn-save {
    padding: 0.45rem 1.1rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-save:hover:not(:disabled) { background: var(--color-primary-700); }
  .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
