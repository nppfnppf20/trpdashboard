<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { authFetch } from '$lib/api/client.js';

  const dispatch = createEventDispatcher();

  let discipline = '';
  let issueTypeId = null;
  let issueTypeLabel = '';
  let search = '';
  let issueTypes = [];
  let filtered = [];
  let dropdownOpen = false;
  let creating = false;
  let error = null;

  onMount(async () => {
    try {
      const res = await authFetch('/api/issue-types');
      issueTypes = await res.json();
      filtered = issueTypes;
    } catch (e) {
      console.error('Failed to load issue types', e);
    }
  });

  function filterList() {
    const q = search.trim().toLowerCase();
    filtered = q ? issueTypes.filter(t => t.label.toLowerCase().includes(q)) : issueTypes;
  }

  function selectType(type) {
    issueTypeId = type.id;
    issueTypeLabel = type.label;
    search = type.label;
    dropdownOpen = false;
  }

  function clearType() {
    issueTypeId = null;
    issueTypeLabel = '';
    search = '';
    filtered = issueTypes;
  }

  async function createAndSelect() {
    const label = search.trim();
    if (!label) return;
    creating = true;
    error = null;
    try {
      const res = await authFetch('/api/issue-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });
      if (!res.ok) throw new Error('Failed to create issue type');
      const newType = await res.json();
      issueTypes = [...issueTypes, newType].sort((a, b) => a.label.localeCompare(b.label));
      selectType(newType);
    } catch (e) {
      error = e.message || 'Failed to create issue type';
    } finally {
      creating = false;
    }
  }

  function onSearchInput() {
    issueTypeId = null;
    issueTypeLabel = '';
    dropdownOpen = true;
    filterList();
  }

  function submit() {
    const d = discipline.trim();
    if (!d && !issueTypeId && !search.trim()) {
      error = 'Enter at least a discipline or a specific issue';
      return;
    }
    dispatch('add', {
      discipline: d || null,
      label: issueTypeLabel || search.trim() || null,
      issue_type_id: issueTypeId || null,
    });
  }

  function close() { dispatch('close'); }

  function handleBackdropClick(e) { if (e.target === e.currentTarget) close(); }
</script>

<div class="modal-backdrop" on:click={handleBackdropClick}>
  <div class="modal-content" style="max-width:440px">
    <div class="modal-header">
      <h2>Add Issue Row</h2>
      <button class="close-btn" on:click={close}><i class="las la-times"></i></button>
    </div>
    <div class="form-body">
      <div class="form-group">
        <label for="discipline">Discipline <span class="optional">optional</span></label>
        <input id="discipline" type="text" bind:value={discipline} placeholder="e.g. Heritage, Ecology, Highways…" />
      </div>

      <div class="form-group">
        <label for="issue-search">Specific Issue <span class="optional">optional</span></label>
        <div class="dropdown-wrap">
          <div class="input-row">
            <input
              id="issue-search"
              type="text"
              bind:value={search}
              on:input={onSearchInput}
              on:focus={() => { dropdownOpen = true; filterList(); }}
              placeholder="Search or create an issue type…"
              autocomplete="off"
            />
            {#if issueTypeId}
              <button class="clear-btn" on:click={clearType} title="Clear"><i class="las la-times"></i></button>
            {/if}
          </div>

          {#if dropdownOpen && (filtered.length > 0 || search.trim())}
            <ul class="dropdown-list">
              {#each filtered as type (type.id)}
                <li>
                  <button class="dropdown-item" on:click={() => selectType(type)}>
                    {type.label}
                    {#if type.development_type}<span class="dev-type">{type.development_type}</span>{/if}
                  </button>
                </li>
              {/each}

              {#if search.trim() && !filtered.some(t => t.label.toLowerCase() === search.trim().toLowerCase())}
                <li>
                  <button class="dropdown-item create-item" on:click={createAndSelect} disabled={creating}>
                    <i class="las la-plus"></i>
                    {creating ? 'Creating…' : `Create "${search.trim()}"`}
                  </button>
                </li>
              {/if}
            </ul>
          {/if}
        </div>
      </div>

      {#if error}<p class="error-msg">{error}</p>{/if}
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
  .form-body { padding:1.5rem;display:flex;flex-direction:column;gap:1rem; }
  .form-group { display:flex;flex-direction:column;gap:0.375rem; }
  label { font-weight:500;color:#334155;font-size:0.875rem; }
  .optional { font-weight:400;color:#94a3b8;font-size:0.75rem;margin-left:0.25rem; }
  input[type="text"] { width:100%;padding:0.625rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.875rem;box-sizing:border-box;transition:border-color 0.2s,box-shadow 0.2s; }
  input[type="text"]:focus { outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1); }
  .dropdown-wrap { position:relative; }
  .input-row { display:flex;align-items:center;gap:0.25rem; }
  .input-row input { flex:1; }
  .clear-btn { background:none;border:none;color:#94a3b8;cursor:pointer;padding:0.25rem;font-size:1rem;display:flex;align-items:center; }
  .clear-btn:hover { color:#64748b; }
  .dropdown-list { position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);max-height:200px;overflow-y:auto;z-index:10;margin-top:2px;padding:0.25rem 0;list-style:none;margin-left:0; }
  .dropdown-item { width:100%;text-align:left;background:none;border:none;padding:0.5rem 0.75rem;font-size:0.875rem;color:#334155;cursor:pointer;display:flex;align-items:center;gap:0.5rem; }
  .dropdown-item:hover { background:#f8fafc; }
  .dev-type { font-size:0.75rem;color:#94a3b8;margin-left:auto; }
  .create-item { color:#3b82f6;font-weight:500; }
  .create-item:disabled { opacity:0.6;cursor:not-allowed; }
  .error-msg { color:#ef4444;font-size:0.8125rem;margin:0; }
  .modal-footer { display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.5rem;border-top:1px solid #e2e8f0; }
</style>
