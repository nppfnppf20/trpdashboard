<script>
  import { onMount } from 'svelte';
  import { getFilterRules, createFilterRule, deleteFilterRule, updateLlmPrompt, getSyncRuns } from '$lib/api/tenders.js';

  let rules = [];
  let runs = [];
  let loading = true;
  let errorMsg = '';

  let newValues = { cpv_prefix: '', keyword: '', exclusion_keyword: '' };
  let editingPrompt = false;
  let draftPrompt = '';
  let savingPrompt = false;

  const RULE_SECTIONS = [
    {
      type: 'cpv_prefix',
      title: 'CPV code prefixes',
      hint: 'Notices whose CPV classification starts with any of these are kept (e.g. 71 = architecture/engineering/planning services).',
      placeholder: 'e.g. 714',
    },
    {
      type: 'keyword',
      title: 'Keywords',
      hint: 'Notices whose title or description contains any of these are kept.',
      placeholder: 'e.g. town centre',
    },
    {
      type: 'exclusion_keyword',
      title: 'Exclusion keywords',
      hint: 'Notices containing any of these are always discarded, even if a CPV or keyword matches.',
      placeholder: 'e.g. highway maintenance',
    },
  ];

  $: llmPromptRule = rules.find((r) => r.rule_type === 'llm_prompt');
  $: rulesByType = (type) => rules.filter((r) => r.rule_type === type);

  function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  async function load() {
    loading = true;
    errorMsg = '';
    try {
      [rules, runs] = await Promise.all([getFilterRules(), getSyncRuns(15)]);
    } catch (err) {
      errorMsg = err.message;
    } finally {
      loading = false;
    }
  }

  async function addRule(type) {
    const value = (newValues[type] || '').trim();
    if (!value) return;
    try {
      const rule = await createFilterRule(type, value);
      rules = [...rules.filter((r) => r.id !== rule.id), rule];
      newValues[type] = '';
    } catch (err) {
      alert(`Failed to add rule: ${err.message}`);
    }
  }

  async function removeRule(rule) {
    if (!confirm(`Remove ${rule.rule_type.replace('_', ' ')} "${rule.value}"?`)) return;
    try {
      await deleteFilterRule(rule.id);
      rules = rules.filter((r) => r.id !== rule.id);
    } catch (err) {
      alert(`Failed to delete rule: ${err.message}`);
    }
  }

  function startEditPrompt() {
    draftPrompt = llmPromptRule?.value || '';
    editingPrompt = true;
  }

  async function savePrompt() {
    if (!draftPrompt.trim()) return;
    savingPrompt = true;
    try {
      const rule = await updateLlmPrompt(draftPrompt.trim());
      rules = [...rules.filter((r) => r.rule_type !== 'llm_prompt'), rule];
      editingPrompt = false;
    } catch (err) {
      alert(`Failed to save prompt: ${err.message}`);
    } finally {
      savingPrompt = false;
    }
  }

  onMount(load);
</script>

<div class="settings-tab">
  {#if errorMsg}
    <div class="error-state">
      <i class="las la-exclamation-triangle"></i>
      <h3>Error loading settings</h3>
      <p>{errorMsg}</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading settings…</p>
    </div>
  {:else}
    <p class="tab-intro">
      Rules decide which notices are kept when syncing - notices matching no rule are discarded, so
      broadening rules only affects future syncs (re-run a backfill to pick up older notices).
      The AI prompt then reviews kept notices and marks them relevant or irrelevant.
    </p>

    <div class="rules-grid">
      {#each RULE_SECTIONS as section (section.type)}
        <div class="rule-section">
          <h4>{section.title}</h4>
          <p class="rule-hint">{section.hint}</p>
          <div class="chips">
            {#each rulesByType(section.type) as rule (rule.id)}
              <span class="chip">
                {rule.value}
                <button class="chip-remove" title="Remove" on:click={() => removeRule(rule)}>
                  <i class="las la-times"></i>
                </button>
              </span>
            {:else}
              <span class="chips-empty">None</span>
            {/each}
          </div>
          <div class="add-row">
            <input
              type="text"
              placeholder={section.placeholder}
              bind:value={newValues[section.type]}
              on:keydown={(e) => e.key === 'Enter' && addRule(section.type)}
            />
            <button class="btn-secondary" on:click={() => addRule(section.type)}>
              <i class="las la-plus"></i> Add
            </button>
          </div>
        </div>
      {/each}
    </div>

    <div class="prompt-section">
      <div class="prompt-header">
        <h4>AI relevance prompt</h4>
        {#if !editingPrompt}
          <button class="btn-secondary" on:click={startEditPrompt}>
            <i class="las la-pen"></i> Edit
          </button>
        {/if}
      </div>
      {#if editingPrompt}
        <textarea bind:value={draftPrompt} rows="7"></textarea>
        <div class="prompt-actions">
          <button class="btn-save" on:click={savePrompt} disabled={savingPrompt}>
            {savingPrompt ? 'Saving…' : 'Save'}
          </button>
          <button class="btn-secondary" on:click={() => (editingPrompt = false)}>Cancel</button>
        </div>
      {:else}
        <p class="prompt-preview">{llmPromptRule?.value || 'No prompt configured - AI review will be skipped.'}</p>
      {/if}
    </div>

    <div class="runs-section">
      <h4>Recent syncs</h4>
      {#if runs.length > 0}
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Status</th>
                <th>Window</th>
                <th>Pages</th>
                <th>Seen</th>
                <th>Stored</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {#each runs as run (run.id)}
                <tr>
                  <td class="cell-date">{formatDate(run.started_at)}</td>
                  <td><span class="run-badge run-{run.status}">{run.status}</span></td>
                  <td class="cell-date">{formatDate(run.window_from)} → {formatDate(run.window_to)}</td>
                  <td class="cell-num">{run.pages_fetched}</td>
                  <td class="cell-num">{run.notices_seen}</td>
                  <td class="cell-num">{run.notices_stored}</td>
                  <td class="cell-error">{run.error_message || '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="rule-hint">No syncs yet.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .settings-tab { display: flex; flex-direction: column; gap: 1.5rem; }

  .tab-intro { margin: 0; font-size: 0.8rem; color: #64748b; line-height: 1.5; }

  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: #64748b;
    text-align: center;
  }

  .error-state { color: #991b1b; }
  .error-state i { font-size: 3rem; margin-bottom: 1rem; }
  .error-state h3 { margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 600; }
  .error-state p { margin: 0; font-size: 0.875rem; }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

  .rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .rule-section {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .rule-section h4, .prompt-section h4, .runs-section h4 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
  }

  .rule-hint { margin: 0; font-size: 0.72rem; color: #94a3b8; line-height: 1.4; }

  .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #eef2ff;
    color: #4338ca;
    border-radius: 0.75rem;
    padding: 0.15rem 0.3rem 0.15rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 500;
  }

  .chip-remove {
    background: none;
    border: none;
    color: #6366f1;
    cursor: pointer;
    padding: 0 0.15rem;
    font-size: 0.8rem;
    line-height: 1;
  }
  .chip-remove:hover { color: #dc2626; }

  .chips-empty { font-size: 0.72rem; color: #94a3b8; }

  .add-row { display: flex; gap: 0.4rem; margin-top: auto; }

  .add-row input {
    flex: 1;
    padding: 0.35rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: #1e293b;
  }

  .btn-secondary, .btn-save {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.7rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid #e2e8f0;
    background: white;
    color: #475569;
    transition: background 0.15s;
  }
  .btn-secondary:hover { background: #f1f5f9; }

  .btn-save { background: #10b981; color: white; border-color: #10b981; }
  .btn-save:hover:not(:disabled) { background: #059669; }
  .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

  .prompt-section {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .prompt-header { display: flex; justify-content: space-between; align-items: center; }

  .prompt-preview {
    margin: 0;
    font-size: 0.78rem;
    color: #475569;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .prompt-section textarea {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-size: 0.78rem;
    color: #1e293b;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
  }

  .prompt-actions { display: flex; gap: 0.5rem; }

  .runs-section { display: flex; flex-direction: column; gap: 0.6rem; }

  .table-wrapper { overflow: auto; }

  .data-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  .data-table th {
    text-align: left;
    padding: 0.4rem 0.75rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
  }
  .data-table tbody tr { border-bottom: 1px solid #f1f5f9; }
  .data-table td { padding: 0.4rem 0.75rem; color: #334155; }

  .cell-date { white-space: nowrap; color: #64748b; }
  .cell-num { text-align: right; }
  .cell-error { color: #991b1b; max-width: 260px; }

  .run-badge {
    display: inline-block;
    padding: 0.1rem 0.45rem;
    border-radius: 0.75rem;
    font-size: 0.68rem;
    font-weight: 600;
  }
  .run-success { background: #d1fae5; color: #065f46; }
  .run-failed { background: #fee2e2; color: #991b1b; }
  .run-running { background: #fef3c7; color: #92400e; }
</style>
