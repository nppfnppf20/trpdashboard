<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { completeStage, getPriorStageEntries } from '$lib/services/workflowApi.js';

  export let project;
  export let stage;
  export let tracks = [];
  export let currentUserName = null;

  const dispatch = createEventDispatcher();

  const RISK_OPTIONS = [
    { value: '', label: '— Unchanged —' },
    { value: 'showstopper', label: 'Showstopper' },
    { value: 'extremely_high_risk', label: 'Extremely High Risk' },
    { value: 'high_risk', label: 'High Risk' },
    { value: 'medium_high_risk', label: 'Medium-High Risk' },
    { value: 'medium_risk', label: 'Medium Risk' },
    { value: 'medium_low_risk', label: 'Medium-Low Risk' },
    { value: 'low_risk', label: 'Low Risk' }
  ];

  let rowState = {};
  let saving = false;
  let loadingPrefill = true;
  let error = null;

  onMount(async () => {
    rowState = Object.fromEntries(
      tracks.map(t => [t.id, { riskLevel: t.last_known_risk_level || '', summary: '', notes: '', isKeyIssue: t.is_key_issue }])
    );
    try {
      const res = await getPriorStageEntries(project.id, stage.instance_id);
      for (const e of res.entries) {
        if (rowState[e.issue_track_id]) {
          rowState[e.issue_track_id].riskLevel = e.risk_level || rowState[e.issue_track_id].riskLevel;
          rowState[e.issue_track_id].summary = e.summary || '';
          rowState[e.issue_track_id].notes = e.notes || '';
        }
      }
      rowState = { ...rowState };
    } catch { /* prefill failed - not critical */ }
    finally { loadingPrefill = false; }
  });

  async function save() {
    saving = true; error = null;
    try {
      const entries = tracks.map(t => ({
        issueTrackId: t.id,
        riskLevel: rowState[t.id]?.riskLevel || null,
        summary: rowState[t.id]?.summary || null,
        notes: rowState[t.id]?.notes || null,
        isKeyIssue: rowState[t.id]?.isKeyIssue ?? t.is_key_issue
      }));
      await completeStage(project.id, stage.instance_id, { entries, completedBy: currentUserName || null });
      dispatch('saved');
    } catch (err) { error = err.message; }
    finally { saving = false; }
  }

  function close() { dispatch('close'); }
</script>

<div class="modal-backdrop" on:click|self={close}>
  <div class="modal-content" style="max-width: 680px;">
    <div class="modal-header">
      <h2><i class="las la-check-circle" style="color:#10b981"></i> Complete: {stage.stage_name}</h2>
      <button class="close-btn" on:click={close}><i class="las la-times"></i></button>
    </div>

    {#if loadingPrefill}
      <div class="form-body"><div class="loading"><div class="spinner"></div><p>Loading prior values…</p></div></div>
    {:else}
      <div class="form-body">
        <p style="color:#64748b;font-size:0.875rem;margin:0 0 1.25rem">Update risk and summary for each issue. Values are pre-filled from the most recent completed stage.</p>

        {#if error}
          <div class="error-banner"><i class="las la-exclamation-circle"></i> {error}</div>
        {/if}

        {#each tracks as track}
          {@const row = rowState[track.id] || {}}
          <div class="issue-row">
            <div class="issue-row-header">
              <div style="display:flex;align-items:center;gap:0.5rem;flex:1">
                <button
                  class="btn btn-ghost btn-sm btn-icon"
                  style="color:{row.isKeyIssue ? '#f59e0b' : '#cbd5e1'}"
                  on:click={() => { rowState[track.id].isKeyIssue = !row.isKeyIssue; rowState = {...rowState}; }}
                  title={row.isKeyIssue ? 'Remove key issue' : 'Mark as key issue'}
                ><i class="las la-flag"></i></button>
                <span style="font-weight:{row.isKeyIssue ? 700 : 500};font-size:0.9375rem">{track.label}</span>
              </div>
              <select bind:value={rowState[track.id].riskLevel}>
                {#each RISK_OPTIONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
              </select>
            </div>
            <input type="text" placeholder="Summary…" bind:value={rowState[track.id].summary} />
            <textarea rows="2" placeholder="Notes (optional)…" bind:value={rowState[track.id].notes}></textarea>
          </div>
        {/each}

        {#if tracks.length === 0}
          <p class="empty">No issue rows on this board yet.</p>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={close}>Cancel</button>
        <button class="btn btn-success" on:click={save} disabled={saving}>
          {#if saving}<i class="las la-spinner la-spin"></i> Saving…{:else}<i class="las la-check"></i> Mark complete{/if}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem; }
  .modal-content { background:white;border-radius:12px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04); }
  .modal-header { display:flex;justify-content:space-between;align-items:center;padding:1.5rem;border-bottom:1px solid #e2e8f0; }
  .modal-header h2 { margin:0;font-size:1.125rem;font-weight:600;color:#1e293b;display:flex;align-items:center;gap:0.5rem; }
  .close-btn { background:none;border:none;font-size:1.5rem;color:#64748b;cursor:pointer;padding:0.25rem;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:all 0.2s; }
  .close-btn:hover { background:#f1f5f9;color:#1e293b; }
  .form-body { padding:1.5rem;display:flex;flex-direction:column;gap:0; }
  .modal-footer { display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.5rem;border-top:1px solid #e2e8f0; }
  .issue-row { border:1px solid #e2e8f0;border-radius:8px;padding:1rem;margin-bottom:0.75rem;background:#f8fafc;display:flex;flex-direction:column;gap:0.5rem; }
  .issue-row-header { display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap; }
  select,input[type="text"],textarea { width:100%;padding:0.625rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.875rem;box-sizing:border-box;font-family:inherit;transition:border-color 0.2s,box-shadow 0.2s; }
  select:focus,input[type="text"]:focus,textarea:focus { outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1); }
  select { width:auto;min-width:180px; }
  textarea { resize:vertical;color:#64748b; }
  .error-banner { display:flex;align-items:center;gap:0.5rem;padding:0.75rem 1rem;background:#fee2e2;color:#991b1b;border-radius:6px;font-size:0.875rem;margin-bottom:1rem; }
</style>
