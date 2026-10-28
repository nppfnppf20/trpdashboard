<script>
  // Paste the text of each policy into its own box; the AI sorts it into
  // reference / name / type / wording / supporting text and the result goes to
  // the parent's review table, where anything that doesn't match what was
  // pasted word for word is flagged. Nothing is saved here.
  import { createEventDispatcher } from 'svelte';
  import { sortPastedPolicies } from '$lib/api/lpaAnalysis.js';
  import { formatOnPaste } from '$lib/utils/policyFormat.js';

  export let projectId;
  export let planId = '';
  export let policyType = 'national';

  const dispatch = createEventDispatcher();

  const BATCH = 3;
  let nextKey = 0;
  const newBox = () => ({ key: nextKey++, text: '', error: null });
  let boxes = Array.from({ length: BATCH }, newBox);
  let sorted = []; // rows already sorted by earlier runs of this dialog
  let sorting = false;
  let error = null;

  const FIELD_LABELS = {
    policy_reference: 'reference',
    policy_name: 'name',
    policy_text: 'policy text',
    relevant_supporting_text: 'supporting text'
  };

  function addBoxes() {
    boxes = [...boxes, ...Array.from({ length: BATCH }, newBox)];
  }

  function removeBox(key) {
    boxes = boxes.filter(b => b.key !== key);
  }

  function toRow(result) {
    const p = result.policy;
    const mismatched = Object.entries(p._verbatim || {})
      .filter(([, v]) => !v.verified)
      .map(([field, v]) => ({ field: FIELD_LABELS[field] || field, score: v.score }));
    return {
      policy_reference: p.policy_reference,
      policy_name: p.policy_name,
      // The type picked in the Add Policy dialog wins when it came from a plan or group
      policy_type: policyType && policyType !== 'national' ? policyType : p.policy_type,
      policy_text: p.policy_text,
      relevant_supporting_text: p.relevant_supporting_text,
      notes: '',
      is_key_policy: false,
      plan_id: planId || '',
      pasted_source: result.source_text,
      verbatim_issues: mismatched
    };
  }

  function finish() {
    const rows = sorted;
    const flagged = rows.filter(r => r.verbatim_issues.length).length;
    dispatch('review', {
      rows,
      warning: flagged
        ? `${flagged} of ${rows.length} polic${rows.length === 1 ? 'y has' : 'ies have'} wording that doesn't match what you pasted word for word. Check the flagged rows against the original before saving.`
        : null
    });
  }

  async function runSort() {
    const filled = boxes.filter(b => b.text.trim());
    if (!filled.length) { error = 'Paste the text of at least one policy'; return; }
    sorting = true;
    error = null;
    try {
      const { results } = await sortPastedPolicies(projectId, filled.map(b => b.text));
      const failedKeys = new Set();
      results.forEach((r, i) => {
        const box = filled[i];
        if (r.ok) {
          sorted = [...sorted, toRow(r)];
        } else {
          box.error = r.error;
          failedKeys.add(box.key);
        }
      });
      // Boxes that sorted are done; failed ones stay (with their error) so the
      // text isn't lost, and empty ones are dropped.
      boxes = boxes.filter(b => failedKeys.has(b.key));
      if (!failedKeys.size) {
        finish();
      } else {
        error = `${results.length - failedKeys.size} of ${results.length} sorted. The rest couldn't be sorted (see below): fix and retry, or review the ones that worked.`;
      }
    } catch (err) {
      error = err.message;
    } finally {
      sorting = false;
    }
  }
</script>

<div class="dialog-backdrop" on:click|self={() => dispatch('close')} role="presentation">
  <div class="dialog dialog-lg">
    <div class="dialog-header">
      <h3 class="dialog-title">Paste Policies &amp; Auto-fill</h3>
      <button class="dialog-close" on:click={() => dispatch('close')} aria-label="Close">&times;</button>
    </div>

    <div class="dialog-body">
      <p class="dialog-hint">
        Copy and paste the text of <strong>one policy per box</strong>, however it comes (reference, title, wording, supporting text together).
        The AI sorts it into the right fields without rewording it, then checks each field against what you pasted and flags anything that differs.
        You review and edit everything before anything is saved.
      </p>

      {#each boxes as box, i (box.key)}
        <div class="paste-box">
          <div class="paste-box-head">
            <span class="badge badge-sm badge-info">#{sorted.length + i + 1}</span>
            {#if boxes.length > 1}
              <button class="btn btn-danger-ghost btn-icon" on:click={() => removeBox(box.key)} title="Remove this box" aria-label="Remove this box" disabled={sorting}>
                <i class="las la-times"></i>
              </button>
            {/if}
          </div>
          <textarea class="form-input" rows="6" bind:value={box.text} use:formatOnPaste disabled={sorting}
            placeholder="Paste one policy here, e.g. “Policy H1: Housing Mix. Development should provide…”"></textarea>
          {#if box.error}<div class="alert alert-error">{box.error}</div>{/if}
        </div>
      {/each}

      <button class="btn btn-secondary btn-sm" on:click={addBoxes} disabled={sorting}>
        <i class="las la-plus-circle"></i> Add {BATCH} more
      </button>

      {#if error}<div class="alert alert-error">{error}</div>{/if}
    </div>

    <div class="dialog-footer">
      <span class="dialog-meta">
        {sorted.length ? `${sorted.length} sorted so far · ` : ''}{boxes.filter(b => b.text.trim()).length} to sort · Nothing is saved until you review
      </span>
      <div class="dialog-actions">
        <button class="btn btn-secondary" on:click={() => dispatch('close')} disabled={sorting}>Cancel</button>
        {#if sorted.length}
          <button class="btn btn-secondary" on:click={finish} disabled={sorting}>Review {sorted.length} sorted</button>
        {/if}
        <button class="btn btn-primary" on:click={runSort} disabled={sorting}>{sorting ? 'Sorting…' : 'Sort into fields'}</button>
      </div>
    </div>
  </div>
</div>

<style>
  .paste-box { display: flex; flex-direction: column; gap: var(--space-2); }
  .paste-box-head { display: flex; align-items: center; justify-content: space-between; }
</style>
