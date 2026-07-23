<script>
  import {
    getDraftingIssues, createDraftingIssue, updateDraftingIssue, setDraftingIssueType,
    deleteDraftingIssue, importFromKeyIssues,
    getDraftingIssuePolicyRelevance, toggleDraftingIssuePolicy,
  } from '$lib/api/draftingIssues.js';
  import { getPolicies } from '$lib/api/lpaAnalysis.js';
  import { listIssueTypes } from '$lib/api/issueTypes.js';
  import DraftingIssuePolicyNotes from './DraftingIssuePolicyNotes.svelte';
  import NoteSourcePicker from '$lib/components/shared/NoteSourcePicker.svelte';

  export let project = null;

  let issues = [];
  let policyRelevance = {}; // { [draftingIssueId]: [policyId, ...] }
  let projectPolicies = [];
  let issueTypes = [];
  let loading = true;
  let newLabel = '';
  let newDiscipline = '';

  // ── Draft from Briefing Note ────────────────────────────────────────────────
  let showDraftModal = false;
  let draftSources = [];   // bind:selectedSources from NoteSourcePicker
  let draftOverBudget = false;
  let notePicker;

  function openDraftModal() {
    notePicker?.reset();
    draftSources = [];
    showDraftModal = true;
  }

  function closeDraftModal() {
    showDraftModal = false;
  }

  // Selection is wired up; the actual drafting behaviour (what to do with
  // draftSources once confirmed) is still to be specified.
  function handleDraftContinue() {
    console.log('Draft from Briefing Note — selected sources:', draftSources);
    closeDraftModal();
  }

  $: if (project?.id) load();

  async function load() {
    loading = true;
    try {
      [issues, policyRelevance, projectPolicies, issueTypes] = await Promise.all([
        getDraftingIssues(project.id),
        getDraftingIssuePolicyRelevance(project.id),
        getPolicies(project.id),
        listIssueTypes(),
      ]);

      // Auto-seed from Key Issues the first time this list is empty, so
      // there's nothing to click before you see something useful here.
      // Only fires when empty — once you've got issues (imported or
      // manual), pulling in anything added later is the button's job.
      if (issues.length === 0) {
        const result = await importFromKeyIssues(project.id);
        if (result.imported > 0) {
          [issues, policyRelevance] = await Promise.all([
            getDraftingIssues(project.id),
            getDraftingIssuePolicyRelevance(project.id),
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to load drafting issues:', err);
    } finally {
      loading = false;
    }
  }

  async function handleAdd() {
    if (!newLabel.trim()) return;
    try {
      const created = await createDraftingIssue(project.id, {
        label: newLabel.trim(),
        discipline: newDiscipline.trim() || null,
        issue_type_id: null,
      });
      issues = [...issues, created];
      newLabel = '';
      newDiscipline = '';
    } catch (err) {
      console.error('Failed to add drafting issue:', err);
    }
  }

  async function handleDelete(issue) {
    if (!confirm(`Delete "${issue.label}"? This only removes it from the drafting issues list — the original key issue (if any) is untouched.`)) return;
    try {
      await deleteDraftingIssue(issue.id);
      issues = issues.filter(i => i.id !== issue.id);
    } catch (err) {
      console.error('Failed to delete drafting issue:', err);
    }
  }

  async function handleFieldBlur(issue, field, value) {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (field === 'label' && trimmed === issue.label) return;
    if (field === 'discipline' && trimmed === (issue.discipline ?? '')) return;
    try {
      const updated = await updateDraftingIssue(issue.id, { [field]: trimmed });
      issues = issues.map(i => i.id === issue.id ? { ...i, ...updated } : i);
    } catch (err) {
      console.error('Failed to save drafting issue field:', err);
    }
  }

  async function handleIssueTypeChange(issue, e) {
    const val = e.target.value ? parseInt(e.target.value, 10) : null;
    try {
      await setDraftingIssueType(issue.id, val);
      const matched = val ? issueTypes.find(t => t.id === val) : null;
      issues = issues.map(i => i.id === issue.id ? {
        ...i,
        issue_type_id: val,
        issue_type_label: matched?.label ?? null,
        issue_type_development_type: matched?.development_type ?? null,
      } : i);
    } catch (err) {
      console.error('Failed to set issue type:', err);
    }
  }

  async function handlePolicyToggle(issueId, policyId) {
    const result = await toggleDraftingIssuePolicy(issueId, policyId);
    const current = policyRelevance[issueId] ?? [];
    policyRelevance = {
      ...policyRelevance,
      [issueId]: result.linked ? [...current, policyId] : current.filter(id => id !== policyId),
    };
    return result;
  }
</script>

<div class="drafting-issues-tab">
  <div class="di-header">
    <div class="di-header-text">
      <h3>Drafting Issues</h3>
      <p>An independent issue list used for AI document generation (currently Planning Statement v3). Seeded from Key Issues, but editing here never changes the Stages board — and vice versa.</p>
    </div>
    <div class="di-header-actions">
      <button class="btn btn-secondary" on:click={openDraftModal} disabled={!project}>
        <i class="las la-magic"></i> Draft from Briefing Note
      </button>
    </div>
  </div>

  {#if loading}
    <div class="di-loading"><div class="mini-spinner"></div> Loading...</div>
  {:else}
    <div class="di-add-row">
      <input class="di-input" placeholder="New issue label..." bind:value={newLabel} on:keydown={e => e.key === 'Enter' && handleAdd()} />
      <input class="di-input di-input-discipline" placeholder="Discipline (optional)" bind:value={newDiscipline} on:keydown={e => e.key === 'Enter' && handleAdd()} />
      <button class="btn btn-primary" on:click={handleAdd} disabled={!newLabel.trim()}><i class="las la-plus"></i> Add</button>
    </div>

    {#if issues.length === 0}
      <p class="di-empty">No drafting issues yet. Click "Import from Key Issues" to start from your tracked issues, or add one manually above.</p>
    {:else}
      <div class="di-list">
        {#each issues as issue (issue.id)}
          <div class="di-card">
            <div class="di-card-top">
              <input
                class="di-label-input"
                value={issue.label}
                on:blur={e => handleFieldBlur(issue, 'label', e.target.value)}
                on:keydown={e => e.key === 'Enter' && e.target.blur()}
              />
              <input
                class="di-discipline-input"
                placeholder="Discipline"
                value={issue.discipline ?? ''}
                on:blur={e => handleFieldBlur(issue, 'discipline', e.target.value)}
                on:keydown={e => e.key === 'Enter' && e.target.blur()}
              />
              <select class="di-type-select" value={issue.issue_type_id ?? ''} on:change={e => handleIssueTypeChange(issue, e)} title="Snippet template">
                <option value="">No template</option>
                {#each issueTypes as it}
                  <option value={it.id}>{it.label}{it.development_type ? ` — ${it.development_type}` : ' — generic'}</option>
                {/each}
              </select>
              <button class="di-icon-btn di-delete-btn" title="Delete" on:click={() => handleDelete(issue)}>
                <i class="las la-trash"></i>
              </button>
            </div>

            {#if issue.issue_type_label}
              <span class="di-type-badge">{issue.issue_type_label}{issue.issue_type_development_type ? ` — ${issue.issue_type_development_type}` : ''}</span>
            {/if}

            <div class="di-card-body">
              <DraftingIssuePolicyNotes
                {issue}
                policies={projectPolicies}
                relevantPolicyIds={policyRelevance[issue.id] ?? []}
                toggleFn={(policyId) => handlePolicyToggle(issue.id, policyId)}
                onNoteChange={(tierKey, value) => handleFieldBlur(issue, tierKey, value)}
              />

              <label class="di-field-label">Argument notes</label>
              <textarea
                class="di-textarea"
                value={issue.argument_for ?? ''}
                placeholder="Outline the argument structure for this issue: how the proposals comply with policy, key evidence to cite..."
                on:blur={e => handleFieldBlur(issue, 'argument_for', e.target.value)}
              ></textarea>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

{#if showDraftModal}
  <div class="di-modal-overlay" on:click|self={closeDraftModal}>
    <div class="di-modal">
      <div class="di-modal-header">
        <span class="di-modal-title"><i class="las la-magic"></i> Draft from Briefing Note</span>
        <button class="di-icon-btn" on:click={closeDraftModal}><i class="las la-times"></i></button>
      </div>
      <div class="di-modal-body">
        <NoteSourcePicker
          bind:this={notePicker}
          projectUniqueId={project?.unique_id}
          bind:selectedSources={draftSources}
          bind:overBudget={draftOverBudget}
          hint="Tick any briefing notes and meeting notes to draft drafting issues from."
        />
      </div>
      <div class="di-modal-footer">
        <button class="btn btn-secondary" on:click={closeDraftModal}>Cancel</button>
        <button class="btn btn-primary" on:click={handleDraftContinue} disabled={draftSources.length === 0}>
          Continue
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .drafting-issues-tab { display: flex; flex-direction: column; gap: 1rem; max-width: 800px; }

  .di-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .di-header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

  .di-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1200;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }

  .di-modal {
    background: white; border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    max-width: 560px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;
  }

  .di-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
  }

  .di-modal-title { display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; font-weight: 600; color: #1e293b; }

  .di-modal-body { padding: 1.25rem; overflow-y: auto; }

  .di-modal-footer {
    display: flex; justify-content: flex-end; gap: 0.5rem;
    padding: 1rem 1.25rem; border-top: 1px solid #e2e8f0; flex-shrink: 0;
  }
  .di-header-text h3 { margin: 0 0 0.25rem; font-size: 1rem; color: #1e293b; }
  .di-header-text p { margin: 0; font-size: 0.8rem; color: #64748b; max-width: 46rem; line-height: 1.5; }

  .di-loading { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.875rem; padding: 1rem 0; }

  .di-add-row { display: flex; gap: 0.5rem; }
  .di-input {
    padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; font-family: inherit;
  }
  .di-input:first-child { flex: 2; }
  .di-input-discipline { flex: 1; }

  .di-empty { color: #94a3b8; font-size: 0.85rem; }

  .di-list { display: flex; flex-direction: column; gap: 0.875rem; }

  .di-card {
    border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 0.875rem 1rem; background: white;
  }

  .di-card-top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

  .di-label-input {
    flex: 2; min-width: 10rem; font-weight: 600; font-size: 0.9rem; color: #1e293b;
    border: 1px solid transparent; border-radius: 5px; padding: 0.3rem 0.5rem; font-family: inherit;
  }
  .di-label-input:hover, .di-label-input:focus { border-color: #cbd5e1; outline: none; }

  .di-discipline-input {
    flex: 1; min-width: 8rem; font-size: 0.8rem; color: #64748b;
    border: 1px solid transparent; border-radius: 5px; padding: 0.3rem 0.5rem; font-family: inherit;
  }
  .di-discipline-input:hover, .di-discipline-input:focus { border-color: #cbd5e1; outline: none; }

  .di-type-select {
    font-size: 0.775rem; padding: 0.3rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 5px;
    color: #1e293b; background: white; max-width: 14rem;
  }

  .di-icon-btn {
    background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.3rem; border-radius: 4px; font-size: 0.95rem;
  }
  .di-icon-btn:hover { background: #f1f5f9; color: #475569; }
  .di-delete-btn:hover { background: #fef2f2; color: #dc2626; }

  .di-type-badge {
    display: inline-block; margin-top: 0.4rem; font-size: 0.6875rem; font-weight: 500; color: #7c3aed;
    background: #f5f3ff; border: 1px solid #ddd6fe; padding: 0.05rem 0.4rem; border-radius: 999px;
  }

  .di-card-body { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 0.4rem; }

  .di-field-label { font-size: 0.72rem; font-weight: 600; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0.4rem; }

  .di-textarea {
    width: 100%; min-height: 4rem; padding: 0.5rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: 0.825rem; font-family: inherit; color: #334155; resize: vertical;
  }
  .di-textarea:focus { outline: none; border-color: #a78bfa; }

  .mini-spinner {
    width: 14px; height: 14px; border: 2px solid rgba(124, 58, 237, 0.25); border-top-color: #7c3aed;
    border-radius: 50%; animation: di-spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes di-spin { to { transform: rotate(360deg); } }

  .btn {
    display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 0.9rem; border-radius: 6px;
    font-size: 0.825rem; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: #7c3aed; color: white; }
  .btn-primary:hover:not(:disabled) { background: #6d28d9; }
  .btn-secondary { background: white; color: #475569; border-color: #cbd5e1; }
  .btn-secondary:hover:not(:disabled) { background: #f8fafc; }
</style>
