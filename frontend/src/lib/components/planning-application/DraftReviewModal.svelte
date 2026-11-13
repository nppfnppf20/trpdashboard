<script>
  // Review step for "Draft from document". Drafting returns a proposal and saves
  // nothing; this modal shows it as rows the user can edit and tick, and only the
  // ticked rows are applied:
  //   - updates to existing issues (notes appended under the dated header below)
  //   - new issues (or "add to an existing issue" instead)
  //   - renames / merges / drops the meeting explicitly stated, each with the exact
  //     sentence it was based on. These start unticked.
  import { createEventDispatcher } from 'svelte';
  import { applyDraftReview } from '$lib/api/draftingIssues.js';
  import { continueBulletOnEnter } from '$lib/utils/bulletList.js';

  export let projectId;
  // True while the "possibly missed" check is still running in the background
  export let missedLoading = false;
  /** @type {{ rows: any[], returned?: number, returned_summary?: string[], issues: {id:number,label:string}[], source: {title:string,date:string}, missed: string[] }} */
  export let proposal;

  const dispatch = createEventDispatcher();

  let title = proposal.source?.title ?? '';
  let date = proposal.source?.date || new Date().toLocaleDateString('en-CA');
  let applying = false;
  let error = '';
  let showMissed = false;

  // Editable copies of the rows. Additive changes start ticked; anything that
  // renames, merges or deletes starts unticked.
  let rows = proposal.rows.map(r => {
    if (r.kind === 'update') {
      return { ...r, include: true, includeSpecialist: !!r.specialist_report, policies: r.policies.map(p => ({ ...p, include: true })) };
    }
    if (r.kind === 'new') {
      return { ...r, include: true, mode: 'new', targetId: '', includeSpecialist: !!r.specialist_report, policies: r.policies.map(p => ({ ...p, include: true })) };
    }
    if (r.kind === 'merge') return { ...r, include: false, delete_merged: false };
    return { ...r, include: false };
  });

  $: updates = rows.filter(r => r.kind === 'update');
  $: news = rows.filter(r => r.kind === 'new');
  $: changes = rows.filter(r => r.kind === 'rename' || r.kind === 'merge' || r.kind === 'drop');
  $: selected = rows.filter(r => r.include).length;

  const chosenPolicyIds = (r) => r.policies.filter(p => p.include).map(p => p.id);

  function buildItems() {
    const items = [];
    for (const r of rows) {
      if (!r.include) continue;
      if (r.kind === 'update') {
        items.push({
          kind: 'update', drafting_issue_id: r.drafting_issue_id, notes: r.notes,
          specialist_report: r.includeSpecialist ? r.specialist_report : '', policy_ids: chosenPolicyIds(r),
        });
      } else if (r.kind === 'new') {
        const specialist = r.includeSpecialist ? r.specialist_report : '';
        if (r.mode === 'existing' && r.targetId) {
          items.push({ kind: 'update', drafting_issue_id: Number(r.targetId), notes: r.notes, specialist_report: specialist, policy_ids: chosenPolicyIds(r) });
        } else {
          items.push({ kind: 'new', label: r.label, discipline: r.discipline, notes: r.notes, specialist_report: specialist, policy_ids: chosenPolicyIds(r) });
        }
      } else if (r.kind === 'rename') {
        items.push({ kind: 'rename', drafting_issue_id: r.drafting_issue_id, new_label: r.new_label });
      } else if (r.kind === 'merge') {
        items.push({
          kind: 'merge', keep_id: Number(r.keep_id), label: r.label, delete_merged: r.delete_merged,
          merge_ids: r.issues.map(i => i.id).filter(id => id !== Number(r.keep_id)),
        });
      } else if (r.kind === 'drop') {
        items.push({ kind: 'drop', drafting_issue_id: r.drafting_issue_id });
      }
    }
    return items;
  }

  async function apply() {
    const items = buildItems();
    if (!items.length) return;
    applying = true;
    error = '';
    try {
      await applyDraftReview(projectId, { title, date, items });
      dispatch('applied', { missed: proposal.missed ?? [] });
    } catch (err) {
      error = err.message || 'Failed to apply the changes';
    } finally {
      applying = false;
    }
  }

  function close() {
    if (!applying) dispatch('close');
  }

  // Grows the textarea to fit its text (also on programmatic changes)
  function autoresize(node, _value) {
    const resize = () => { node.style.height = 'auto'; node.style.height = `${node.scrollHeight}px`; };
    resize();
    node.addEventListener('input', resize);
    return { update: resize, destroy() { node.removeEventListener('input', resize); } };
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape') close(); }} />

<div class="dialog-backdrop" role="presentation">
  <div class="dialog dialog-lg">
    <div class="dialog-header">
      <h3 class="dialog-title">Review drafted changes</h3>
      <button class="dialog-close" on:click={close} aria-label="Close">&times;</button>
    </div>

    <div class="dialog-body">
      <div class="dr-source">
        <div class="form-item dr-source-title">
          <label class="form-label" for="dr-title">Title</label>
          <input id="dr-title" class="form-input" bind:value={title} placeholder="e.g. Kick-off call" />
        </div>
        <div class="form-item dr-source-date">
          <label class="form-label" for="dr-date">Date</label>
          <input id="dr-date" class="form-input" type="date" bind:value={date} />
        </div>
      </div>
      <p class="dialog-hint">Shown as a header above the notes added in this run. Nothing is saved until you click Apply.</p>

      {#if rows.length === 0}
        <p class="dr-empty">
          {#if proposal.returned === 0}
            The AI found nothing in this source that relates to your issues.
          {:else if proposal.returned > 0}
            The AI returned {proposal.returned} {proposal.returned === 1 ? 'entry' : 'entries'}, but none could be matched to your issues or are allowed by the fields chosen in the previous step.
          {:else}
            Nothing was proposed from this source.
          {/if}
        </p>
        {#if proposal.returned_summary?.length}
          <ul class="dr-missed">{#each proposal.returned_summary as line}<li>{line}</li>{/each}</ul>
        {/if}
      {/if}

      {#if updates.length}
        <h4 class="dr-heading">Updates to existing issues ({updates.length})</h4>
        {#each updates as r (r.row_id)}
          <div class="dr-row" class:dr-row-off={!r.include}>
            <label class="dr-row-head">
              <input type="checkbox" bind:checked={r.include} />
              <span class="dr-row-title">{r.label}</span>
            </label>
            {#if r.include}
              <textarea class="form-input dr-notes" bind:value={r.notes} use:autoresize={r.notes}
                on:keydown={continueBulletOnEnter} placeholder="No notes for this issue in this run"></textarea>
              {#if r.specialist_report}
                <label class="dr-sub"><input type="checkbox" bind:checked={r.includeSpecialist} /> Replace the specialist report with:</label>
                {#if r.includeSpecialist}
                  <textarea class="form-input dr-notes" bind:value={r.specialist_report} use:autoresize={r.specialist_report}></textarea>
                {/if}
              {/if}
              {#if r.policies.length}
                <div class="dr-policies">
                  <span class="dr-sub">Link policies:</span>
                  {#each r.policies as p (p.id)}
                    <label class="dr-chip" class:dr-chip-off={!p.include}><input type="checkbox" bind:checked={p.include} /> {p.label}</label>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        {/each}
      {/if}

      {#if news.length}
        <h4 class="dr-heading">New issues ({news.length})</h4>
        {#each news as r (r.row_id)}
          <div class="dr-row" class:dr-row-off={!r.include}>
            <label class="dr-row-head">
              <input type="checkbox" bind:checked={r.include} />
              <span class="dr-row-title">{r.mode === 'existing' ? 'Add to an existing issue' : 'New issue'}</span>
            </label>
            {#if r.include}
              <div class="dr-new-top">
                {#if r.mode === 'new'}
                  <input class="form-input" bind:value={r.label} placeholder="Issue label" aria-label="Issue label" />
                  <input class="form-input dr-new-discipline" bind:value={r.discipline} placeholder="Discipline (optional)" aria-label="Discipline" />
                {/if}
                <select class="form-input" bind:value={r.mode} aria-label="What to do with this">
                  <option value="new">Add as a new issue</option>
                  <option value="existing">Add to an existing issue instead</option>
                </select>
                {#if r.mode === 'existing'}
                  <select class="form-input" bind:value={r.targetId} aria-label="Existing issue">
                    <option value="">Choose an issue…</option>
                    {#each proposal.issues as i (i.id)}<option value={i.id}>{i.label}</option>{/each}
                  </select>
                {/if}
              </div>
              <textarea class="form-input dr-notes" bind:value={r.notes} use:autoresize={r.notes}
                on:keydown={continueBulletOnEnter} placeholder="Notes"></textarea>
              {#if r.specialist_report}
                <label class="dr-sub"><input type="checkbox" bind:checked={r.includeSpecialist} /> Include the specialist report:</label>
                {#if r.includeSpecialist}
                  <textarea class="form-input dr-notes" bind:value={r.specialist_report} use:autoresize={r.specialist_report}></textarea>
                {/if}
              {/if}
              {#if r.policies.length}
                <div class="dr-policies">
                  <span class="dr-sub">Link policies:</span>
                  {#each r.policies as p (p.id)}
                    <label class="dr-chip" class:dr-chip-off={!p.include}><input type="checkbox" bind:checked={p.include} /> {p.label}</label>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        {/each}
      {/if}

      {#if changes.length}
        <h4 class="dr-heading">Changes to the issue list ({changes.length})</h4>
        <p class="dialog-hint">The meeting said these outright. Each shows the sentence it is based on. None is applied unless you tick it.</p>
        {#each changes as r (r.row_id)}
          <div class="dr-row" class:dr-row-off={!r.include}>
            {#if r.kind === 'rename'}
              <label class="dr-row-head">
                <input type="checkbox" bind:checked={r.include} />
                <span class="dr-row-title">Rename: {r.label} &rarr;</span>
                <input class="form-input dr-inline" bind:value={r.new_label} disabled={!r.include} aria-label="New label" />
              </label>
            {:else if r.kind === 'merge'}
              <label class="dr-row-head">
                <input type="checkbox" bind:checked={r.include} />
                <span class="dr-row-title">Combine {r.issues.map(i => i.label).join(' + ')}</span>
              </label>
              {#if r.include}
                <div class="dr-merge">
                  <span class="dr-sub">Keep this one:</span>
                  {#each r.issues as i (i.id)}
                    <label class="dr-chip"><input type="radio" bind:group={r.keep_id} value={i.id} /> {i.label}</label>
                  {/each}
                  <input class="form-input dr-inline" bind:value={r.label} aria-label="Combined label" placeholder="Combined label" />
                </div>
                <label class="dr-sub dr-danger"><input type="checkbox" bind:checked={r.delete_merged} /> Delete the other issue(s) afterwards. If left unticked they stay, emptied, with their notes moved across.</label>
                <p class="dialog-hint">Notes, specialist reports and policy links from the others are moved into the one you keep. Its previous notes are saved as a record first.</p>
              {/if}
            {:else}
              <label class="dr-row-head">
                <input type="checkbox" bind:checked={r.include} />
                <span class="dr-row-title">Delete the issue "{r.label}"</span>
              </label>
              <p class="dialog-hint">The meeting dropped it. Nothing is deleted unless you tick this.</p>
            {/if}
            <blockquote class="dr-evidence">
              &ldquo;{r.evidence}&rdquo;
              {#if r.evidence_verified}
                <span class="dr-badge dr-badge-ok">Found in the source</span>
              {:else}
                <span class="dr-badge dr-badge-warn">Not found word for word, check it</span>
              {/if}
            </blockquote>
          </div>
        {/each}
      {/if}

      {#if missedLoading}
        <div class="dr-checking"><div class="mini-spinner"></div> Checking the source for anything the notes missed...</div>
      {/if}

      {#if proposal.missed?.length}
        <button class="dr-missed-toggle" type="button" on:click={() => showMissed = !showMissed}>
          <i class="las {showMissed ? 'la-angle-down' : 'la-angle-right'}"></i>
          Possibly missed ({proposal.missed.length})
        </button>
        {#if showMissed}
          <ul class="dr-missed">{#each proposal.missed as point}<li>{point}</li>{/each}</ul>
        {/if}
      {/if}

      {#if error}<div class="alert alert-error">{error}</div>{/if}
    </div>

    <div class="dialog-footer">
      <span class="dialog-meta">{selected} selected</span>
      <div class="dialog-actions">
        <button class="btn btn-secondary" on:click={close} disabled={applying}>Cancel</button>
        <button class="btn btn-primary" on:click={apply} disabled={applying || selected === 0}>
          {#if applying}<div class="mini-spinner"></div> Applying...{:else}Apply {selected} change{selected === 1 ? '' : 's'}{/if}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .dr-source { display: flex; gap: var(--space-3); }
  .dr-source-title { flex: 1; min-width: 0; }
  .dr-source-date { flex: 0 0 11rem; }
  .dr-empty { color: var(--color-slate-500); font-size: var(--font-size-xs); }

  .dr-heading { margin: var(--space-5) 0 var(--space-2); font-size: var(--font-size-xs); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-slate-600); }

  .dr-row { border: 1px solid var(--color-slate-200); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-2); background: var(--color-slate-50); }
  .dr-row-off { opacity: 0.65; }
  .dr-row-head { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; }
  .dr-row-title { font-weight: 600; font-size: 0.85rem; color: var(--color-slate-800); }

  .dr-notes { width: 100%; box-sizing: border-box; margin-top: var(--space-2); resize: none; overflow: hidden; line-height: 1.5; font-size: 0.825rem; }
  .dr-new-top { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2); }
  .dr-new-top :global(.form-input) { flex: 1; min-width: 10rem; }
  .dr-new-top :global(.dr-new-discipline) { flex: 0 1 12rem; }
  .dr-inline { flex: 1; min-width: 10rem; }

  .dr-sub { display: inline-flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--color-slate-600); }
  .dr-danger { color: var(--color-red-600); }
  .dr-policies, .dr-merge { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-2); }
  .dr-chip { display: inline-flex; align-items: center; gap: var(--space-1); padding: 0.1rem 0.5rem; border: 1px solid var(--color-primary-200); background: var(--color-primary-50); border-radius: var(--radius-pill); font-size: var(--font-size-xs); color: var(--color-slate-700); cursor: pointer; }
  .dr-chip-off { opacity: 0.5; }

  .dr-evidence { margin: var(--space-2) 0 0; padding: var(--space-2) var(--space-3); border-left: 3px solid var(--color-slate-300); background: var(--color-slate-100); font-size: var(--font-size-xs); color: var(--color-slate-700); font-style: italic; }
  .dr-badge { display: inline-block; margin-left: var(--space-2); padding: 0.05rem 0.45rem; border-radius: var(--radius-pill); font-style: normal; font-weight: 600; }
  .dr-badge-ok { background: var(--color-badge-success-bg); color: var(--color-badge-success-fg); }
  .dr-badge-warn { background: var(--color-badge-warning-bg); color: var(--color-badge-warning-fg); }

  .dr-checking { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-4); font-size: var(--font-size-xs); color: var(--color-slate-500); }

  .dr-missed-toggle { margin-top: var(--space-4); background: none; border: none; padding: 0; cursor: pointer; font-size: var(--font-size-xs); font-weight: 600; color: var(--color-slate-600); display: inline-flex; align-items: center; gap: var(--space-1); }
  .dr-missed { margin: var(--space-2) 0 0; padding-left: 1.2rem; font-size: var(--font-size-xs); color: var(--color-slate-700); line-height: 1.7; }
</style>
