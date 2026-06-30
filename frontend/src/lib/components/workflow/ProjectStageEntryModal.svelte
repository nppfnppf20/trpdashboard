<script>
  import { createEventDispatcher } from 'svelte';
  import { saveStageEntry } from '$lib/services/workflowApi.js';

  export let project;
  export let stage;
  export let track;
  export let existingEntry = null;

  const dispatch = createEventDispatcher();

  const RISK_OPTIONS = [
    { value: '', label: 'No change' },
    { value: 'showstopper', label: 'Showstopper' },
    { value: 'extremely_high_risk', label: 'Extremely High Risk' },
    { value: 'high_risk', label: 'High Risk' },
    { value: 'medium_high_risk', label: 'Medium-High Risk' },
    { value: 'medium_risk', label: 'Medium Risk' },
    { value: 'medium_low_risk', label: 'Medium-Low Risk' },
    { value: 'low_risk', label: 'Low Risk' }
  ];

  let riskLevel = existingEntry?.risk_level || '';
  let notes = existingEntry?.notes || '';
  let saving = false;
  let error = null;

  async function save() {
    saving = true; error = null;
    try {
      const entry = await saveStageEntry(project.id, stage.instance_id, {
        issueTrackId: track.id,
        riskLevel: riskLevel || null,
        notes: notes || null
      });
      dispatch('saved', entry);
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  function close() { dispatch('close'); }
</script>

<div class="modal-backdrop" on:click|self={close}>
  <div class="modal-content">
    <div class="modal-header">
      <div class="modal-title">
        <span class="stage-label">{stage.stage_name}</span>
        <h2>{track.discipline || track.label || 'Entry'}</h2>
        {#if track.discipline && track.label}<p class="sub-label">{track.label}</p>{/if}
      </div>
      <button class="close-btn" on:click={close}><i class="las la-times"></i></button>
    </div>
    <div class="form-body">
      {#if error}
        <div class="error-banner"><i class="las la-exclamation-circle"></i> {error}</div>
      {/if}
      <div class="form-group">
        <label for="risk-level">Risk Level</label>
        <select id="risk-level" bind:value={riskLevel}>
          {#each RISK_OPTIONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
        </select>
      </div>
      <div class="form-group">
        <label for="notes">Notes</label>
        <textarea id="notes" rows="4" placeholder="Notes…" bind:value={notes}></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={close}>Cancel</button>
      <button class="btn btn-primary" on:click={save} disabled={saving}>
        {#if saving}<i class="las la-spinner la-spin"></i> Saving…{:else}<i class="las la-save"></i> Save{/if}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem; }
  .modal-content { background:white;border-radius:12px;width:100%;max-width:480px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04); }
  .modal-header { display:flex;justify-content:space-between;align-items:flex-start;padding:1.5rem;border-bottom:1px solid #e2e8f0; }
  .modal-title { display:flex;flex-direction:column;gap:0.125rem; }
  .stage-label { font-size:0.75rem;font-weight:500;color:#9333ea;text-transform:uppercase;letter-spacing:0.05em; }
  .modal-title h2 { margin:0;font-size:1.125rem;font-weight:600;color:#1e293b; }
  .sub-label { margin:0;font-size:0.875rem;color:#64748b; }
  .close-btn { background:none;border:none;font-size:1.5rem;color:#64748b;cursor:pointer;padding:0.25rem;display:flex;align-items:center;border-radius:4px;transition:all 0.2s;flex-shrink:0; }
  .close-btn:hover { background:#f1f5f9;color:#1e293b; }
  .form-body { padding:1.5rem;display:flex;flex-direction:column;gap:1rem; }
  .form-group { display:flex;flex-direction:column;gap:0.375rem; }
  label { font-weight:500;color:#334155;font-size:0.875rem; }
  select,textarea { width:100%;padding:0.625rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.875rem;box-sizing:border-box;font-family:inherit;transition:border-color 0.2s,box-shadow 0.2s; }
  select:focus,textarea:focus { outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1); }
  textarea { resize:vertical; }
  .error-banner { display:flex;align-items:center;gap:0.5rem;padding:0.75rem 1rem;background:#fee2e2;color:#991b1b;border-radius:6px;font-size:0.875rem; }
  .modal-footer { display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.5rem;border-top:1px solid #e2e8f0; }
</style>
