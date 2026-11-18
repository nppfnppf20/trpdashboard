<script>
  // Paste one big block containing many policies; the AI splits it into policies and sorts each into
  // reference / name / type / wording / supporting text and the result goes to
  // the parent's review table, where anything that doesn't match what was
  // pasted word for word is flagged. Nothing is saved here.
  import { createEventDispatcher } from 'svelte';
  import { sortPastedSheet } from '$lib/api/lpaAnalysis.js';
  import { formatOnPaste } from '$lib/utils/policyFormat.js';

  export let projectId;
  export let planId = '';
  export let policyType = 'national';

  const dispatch = createEventDispatcher();

  let text = '';
  let sorting = false;
  let error = null;

  const FIELD_LABELS = {
    policy_reference: 'reference',
    policy_name: 'name',
    policy_text: 'policy text',
    relevant_supporting_text: 'supporting text'
  };

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

  async function runSort() {
    if (!text.trim()) { error = 'Paste the policy text first'; return; }
    sorting = true;
    error = null;
    try {
      const { results } = await sortPastedSheet(projectId, text);
      const rows = results.filter(r => r.ok).map(toRow);
      const flagged = rows.filter(r => r.verbatim_issues.length).length;
      dispatch('review', {
        rows,
        warning: flagged
          ? `${flagged} of ${rows.length} polic${rows.length === 1 ? 'y has' : 'ies have'} wording that doesn't match what you pasted word for word. Check the flagged rows against the original before saving.`
          : null
      });
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
        Paste <strong>everything in one go</strong>: as many policies as you like, with their supporting text, however it comes.
        The AI works out where each policy starts and ends and sorts each into the right fields without rewording it, then checks every field against what you pasted and flags anything that differs.
        You review and edit everything before anything is saved.
      </p>

      <textarea class="form-input" rows="18" bind:value={text} use:formatOnPaste disabled={sorting}
        placeholder="Paste the policies here, e.g. “Policy H1: Housing Mix. Development should provide… Policy H2: …”"></textarea>

      {#if error}<div class="alert alert-error">{error}</div>{/if}
    </div>

    <div class="dialog-footer">
      <span class="dialog-meta">Nothing is saved until you review</span>
      <div class="dialog-actions">
        <button class="btn btn-secondary" on:click={() => dispatch('close')} disabled={sorting}>Cancel</button>
        <button class="btn btn-primary" on:click={runSort} disabled={sorting}>{sorting ? 'Sorting…' : 'Split & sort into fields'}</button>
      </div>
    </div>
  </div>
</div>
