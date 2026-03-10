<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  let label = '';
  let error = null;

  function submit() {
    const trimmed = label.trim();
    if (!trimmed) { error = 'Label is required'; return; }
    dispatch('add', { label: trimmed });
  }

  function close() { dispatch('close'); }
</script>

<div class="modal-backdrop" on:click|self={close}>
  <div class="modal-content" style="max-width:440px">
    <div class="modal-header">
      <h2>Add Issue Row</h2>
      <button class="close-btn" on:click={close}><i class="las la-times"></i></button>
    </div>
    <div class="form-body">
      <div class="form-group">
        <label for="issue-label">Label <span style="color:#ef4444">*</span></label>
        <input id="issue-label" type="text" bind:value={label} placeholder="e.g. Planning Strategy, Land Control…" on:keydown={(e) => e.key === 'Enter' && submit()} />
        {#if error}<p style="color:#ef4444;font-size:0.8125rem;margin:0.25rem 0 0">{error}</p>{/if}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={close}>Cancel</button>
      <button class="btn btn-primary" on:click={submit}><i class="las la-plus"></i> Add row</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem; }
  .modal-content { background:white;border-radius:12px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04); }
  .modal-header { display:flex;justify-content:space-between;align-items:center;padding:1.5rem;border-bottom:1px solid #e2e8f0; }
  .modal-header h2 { margin:0;font-size:1.25rem;font-weight:600;color:#1e293b; }
  .close-btn { background:none;border:none;font-size:1.5rem;color:#64748b;cursor:pointer;padding:0.25rem;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:all 0.2s; }
  .close-btn:hover { background:#f1f5f9;color:#1e293b; }
  .form-body { padding:1.5rem; }
  .form-group { margin-bottom:1.25rem; }
  .form-group:last-child { margin-bottom:0; }
  label { display:block;margin-bottom:0.5rem;font-weight:500;color:#334155;font-size:0.875rem; }
  input[type="text"] { width:100%;padding:0.625rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.875rem;box-sizing:border-box;transition:border-color 0.2s,box-shadow 0.2s; }
  input[type="text"]:focus { outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1); }
  .modal-footer { display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.5rem;border-top:1px solid #e2e8f0; }
</style>
