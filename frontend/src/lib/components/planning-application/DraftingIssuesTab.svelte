<script>
  import {
    getDraftingIssues, createDraftingIssue, updateDraftingIssue,
    deleteDraftingIssue, draftIssuesFromBriefing,
    getDraftingIssuePolicyRelevance, toggleDraftingIssuePolicy,
    getDraftingIssueSnippetRelevance, toggleDraftingIssueSnippet,
  } from '$lib/api/draftingIssues.js';
  import { getPolicies } from '$lib/api/lpaAnalysis.js';
  import { listIssueTypes } from '$lib/api/issueTypes.js';
  import DraftingIssuePolicyNotes from './DraftingIssuePolicyNotes.svelte';
  import NoteSourcePicker from '$lib/components/shared/NoteSourcePicker.svelte';
  import PromptEditModal from '$lib/components/shared/PromptEditModal.svelte';
  import {
    actionPromptState, openActionPrompt, closeActionPrompt,
    saveActionPromptStore, resetActionPromptStore, setPromptText,
  } from '$lib/stores/actionPrompts.js';

  export let project = null;

  let issues = [];
  let policyRelevance = {};  // { [draftingIssueId]: [policyId, ...] }
  let snippetRelevance = {}; // { [draftingIssueId]: [{issue_type_id, field}, ...] }
  let projectPolicies = [];
  let issueTypes = [];
  let loading = true;
  let newLabel = '';
  let newDiscipline = '';

  const draftPromptState = actionPromptState('draft_issues_from_briefing');

  // ── Draft from Briefing Note ────────────────────────────────────────────────
  let showDraftModal = false;
  let draftSources = [];   // bind:selectedSources from NoteSourcePicker
  let draftOverBudget = false;
  let drafting = false;
  let notePicker;

  // Per-issue permission for this run: which fields the LLM is allowed to
  // write to. Lets you, for example, drop in a specialist report for one
  // issue without disturbing anything else's argument notes.
  let allowNewIssues = true;
  let issueScope = {}; // { [issueId]: { argumentNotes: bool, specialistReport: bool } }

  function openDraftModal() {
    notePicker?.reset();
    draftSources = [];
    allowNewIssues = true;
    issueScope = Object.fromEntries(issues.map(i => [i.id, { argumentNotes: true, specialistReport: true }]));
    showDraftModal = true;
  }

  function closeDraftModal() {
    showDraftModal = false;
  }

  function toggleScope(issueId, field) {
    issueScope = {
      ...issueScope,
      [issueId]: { ...issueScope[issueId], [field]: !issueScope[issueId][field] },
    };
  }

  async function handleDraftContinue() {
    drafting = true;
    try {
      await draftIssuesFromBriefing(project.id, draftSources, { allowNewIssues, issueScope });
      closeDraftModal();
      await load();
    } catch (err) {
      console.error('Failed to draft issues from briefing:', err);
    } finally {
      drafting = false;
    }
  }

  $: if (project?.id) load();

  // Each piece loads independently — one failing request (e.g. a migration
  // that hasn't been run yet) shouldn't blank out everything else that did
  // load successfully. Failures keep whatever was already in state.
  async function load() {
    loading = true;

    const [issuesR, policyR, snippetR, policiesR, typesR] = await Promise.allSettled([
      getDraftingIssues(project.id),
      getDraftingIssuePolicyRelevance(project.id),
      getDraftingIssueSnippetRelevance(project.id),
      getPolicies(project.id),
      listIssueTypes(),
    ]);

    for (const [label, r] of [
      ['drafting issues', issuesR], ['policy relevance', policyR], ['snippet relevance', snippetR],
      ['project policies', policiesR], ['issue types', typesR],
    ]) {
      if (r.status === 'rejected') console.error(`Failed to load ${label}:`, r.reason);
    }

    if (issuesR.status === 'fulfilled') issues = issuesR.value;
    if (policyR.status === 'fulfilled') policyRelevance = policyR.value;
    if (snippetR.status === 'fulfilled') snippetRelevance = snippetR.value;
    if (policiesR.status === 'fulfilled') projectPolicies = policiesR.value;
    if (typesR.status === 'fulfilled') issueTypes = typesR.value;

    loading = false;
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
    if (!confirm(`Delete "${issue.label}"?`)) return;
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

  async function handlePolicyToggle(issueId, policyId) {
    const result = await toggleDraftingIssuePolicy(issueId, policyId);
    const current = policyRelevance[issueId] ?? [];
    policyRelevance = {
      ...policyRelevance,
      [issueId]: result.linked ? [...current, policyId] : current.filter(id => id !== policyId),
    };
    return result;
  }

  async function handleSnippetToggle(issueId, issueTypeId, field) {
    const result = await toggleDraftingIssueSnippet(issueId, issueTypeId, field);
    const current = snippetRelevance[issueId] ?? [];
    snippetRelevance = {
      ...snippetRelevance,
      [issueId]: result.linked
        ? [...current, { issue_type_id: issueTypeId, field }]
        : current.filter(f => !(f.issue_type_id === issueTypeId && f.field === field)),
    };
    return result;
  }
</script>

<div class="drafting-issues-tab">
  <div class="di-header">
    <div class="di-header-text">
      <h3>Drafting Issues</h3>
      <p>An independent issue list used for AI document generation (currently Planning Statement v3). Build it up manually or with "Draft from Briefing Note" below.</p>
    </div>
    <div class="di-header-actions">
      <button class="btn btn-secondary" on:click={openDraftModal} disabled={!project}>
        <i class="las la-magic"></i> Draft from Briefing Note
      </button>
      <button class="di-icon-btn" title="Edit generation prompt" on:click={() => openActionPrompt('draft_issues_from_briefing')}>
        <i class="las la-sliders-h"></i>
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
      <p class="di-empty">No drafting issues yet. Add one manually above, or use "Draft from Briefing Note".</p>
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
              <button class="di-icon-btn di-delete-btn" title="Delete" on:click={() => handleDelete(issue)}>
                <i class="las la-trash"></i>
              </button>
            </div>

            <div class="di-card-body">
              <DraftingIssuePolicyNotes
                {issue}
                policies={projectPolicies}
                relevantPolicyIds={policyRelevance[issue.id] ?? []}
                toggleFn={(policyId) => handlePolicyToggle(issue.id, policyId)}
                onNoteChange={(tierKey, value) => handleFieldBlur(issue, tierKey, value)}
                allSnippets={issueTypes}
                relevantSnippetFields={snippetRelevance[issue.id] ?? []}
                snippetToggleFn={(issueTypeId, field) => handleSnippetToggle(issue.id, issueTypeId, field)}
              />

              <label class="di-field-label">Argument notes</label>
              <textarea
                class="di-textarea"
                value={issue.argument_for ?? ''}
                placeholder="Outline the argument structure for this issue: how the proposals comply with policy, key evidence to cite..."
                on:blur={e => handleFieldBlur(issue, 'argument_for', e.target.value)}
              ></textarea>

              <label class="di-field-label">Specialist report</label>
              <textarea
                class="di-textarea"
                value={issue.specialist_report ?? ''}
                placeholder="Who prepared the specialist report for this issue, when, and its key findings relevant to the argument..."
                on:blur={e => handleFieldBlur(issue, 'specialist_report', e.target.value)}
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

        <div class="di-scope">
          <p class="di-scope-title">Which fields can this update?</p>
          <label class="di-scope-new">
            <input type="checkbox" bind:checked={allowNewIssues} />
            <span>Add newly discovered issues</span>
          </label>
          {#if issues.length > 0}
            <div class="di-scope-list">
              {#each issues as issue (issue.id)}
                <div class="di-scope-issue">
                  <span class="di-scope-label">{issue.label}</span>
                  <label class="di-scope-field">
                    <input
                      type="checkbox"
                      checked={issueScope[issue.id]?.argumentNotes}
                      on:change={() => toggleScope(issue.id, 'argumentNotes')}
                    />
                    Argument notes{issue.argument_for?.trim() ? ' (filled)' : ''}
                  </label>
                  <label class="di-scope-field">
                    <input
                      type="checkbox"
                      checked={issueScope[issue.id]?.specialistReport}
                      on:change={() => toggleScope(issue.id, 'specialistReport')}
                    />
                    Specialist report{issue.specialist_report?.trim() ? ' (filled)' : ''}
                  </label>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <div class="di-modal-footer">
        <button class="btn btn-secondary" on:click={closeDraftModal} disabled={drafting}>Cancel</button>
        <button class="btn btn-primary" on:click={handleDraftContinue} disabled={draftSources.length === 0 || drafting}>
          {#if drafting}<div class="mini-spinner"></div> Drafting...{:else}Continue{/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<PromptEditModal
  open={$draftPromptState.open}
  title="Edit Prompt: Draft Issues from Briefing Note"
  promptText={$draftPromptState.text}
  contextTemplate={$draftPromptState.contextTemplate}
  loading={$draftPromptState.loading}
  saving={$draftPromptState.saving}
  saved={$draftPromptState.saved}
  on:close={() => closeActionPrompt('draft_issues_from_briefing')}
  on:change={(e) => setPromptText('draft_issues_from_briefing', e.detail)}
  on:save={() => saveActionPromptStore('draft_issues_from_briefing')}
  on:reset={() => resetActionPromptStore('draft_issues_from_briefing')}
/>

<style>
  .drafting-issues-tab { display: flex; flex-direction: column; gap: 1rem; max-width: 800px; }

  .di-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .di-header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

  .di-modal-overlay {
    position: fixed; inset: 0; background: var(--overlay-bg); z-index: 1200;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }

  .di-modal {
    background: white; border-radius: 10px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    max-width: 640px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;
  }

  .di-scope { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--color-slate-200); }
  .di-scope-title { margin: 0 0 0.5rem; font-size: 0.8125rem; font-weight: 600; color: var(--color-slate-800); }
  .di-scope-new {
    display: flex; align-items: center; gap: 0.45rem; font-size: 0.8125rem; color: var(--color-slate-700);
    margin-bottom: 0.65rem; cursor: pointer;
  }
  .di-scope-list {
    display: flex; flex-direction: column; gap: 0.5rem; max-height: 12rem; overflow-y: auto;
    border: 1px solid var(--color-slate-200); border-radius: 6px; padding: 0.5rem 0.65rem;
  }
  .di-scope-issue { display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem 0.9rem; padding: 0.2rem 0; }
  .di-scope-label { flex: 1; min-width: 8rem; font-size: 0.8125rem; font-weight: 500; color: var(--color-slate-800); }
  .di-scope-field {
    display: flex; align-items: center; gap: 0.35rem; font-size: 0.775rem; color: var(--color-slate-500); cursor: pointer; white-space: nowrap;
  }

  .di-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0;
  }

  .di-modal-title { display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; font-weight: 600; color: var(--color-slate-800); }

  .di-modal-body { padding: 1.25rem; overflow-y: auto; }

  .di-modal-footer {
    display: flex; justify-content: flex-end; gap: 0.5rem;
    padding: 1rem 1.25rem; border-top: 1px solid var(--color-slate-200); flex-shrink: 0;
  }
  .di-header-text h3 { margin: 0 0 0.25rem; font-size: 1rem; color: var(--color-slate-800); }
  .di-header-text p { margin: 0; font-size: 0.8rem; color: var(--color-slate-500); max-width: 46rem; line-height: 1.5; }

  .di-loading { display: flex; align-items: center; gap: 0.5rem; color: var(--color-slate-500); font-size: 0.875rem; padding: 1rem 0; }

  .di-add-row { display: flex; gap: 0.5rem; }
  .di-input {
    padding: 0.5rem 0.75rem; border: 1px solid var(--color-slate-300); border-radius: 6px; font-size: 0.85rem; font-family: inherit;
  }
  .di-input:first-child { flex: 2; }
  .di-input-discipline { flex: 1; }

  .di-empty { color: var(--color-slate-400); font-size: 0.85rem; }

  .di-list { display: flex; flex-direction: column; gap: 0.875rem; }

  .di-card {
    border: 1.5px solid var(--color-slate-200); border-radius: 8px; padding: 0.875rem 1rem; background: white;
  }

  .di-card-top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

  .di-label-input {
    flex: 1; min-width: 10rem; font-weight: 600; font-size: 0.9rem; color: var(--color-slate-800);
    border: 1px solid transparent; border-radius: 5px; padding: 0.3rem 0.5rem; font-family: inherit;
  }
  .di-label-input:hover, .di-label-input:focus { border-color: var(--color-slate-300); outline: none; }

  .di-icon-btn {
    background: none; border: none; color: var(--color-slate-400); cursor: pointer; padding: 0.3rem; border-radius: 4px; font-size: 0.95rem;
  }
  .di-icon-btn:hover { background: var(--color-slate-100); color: var(--color-slate-600); }
  .di-delete-btn:hover { background: var(--color-red-50); color: var(--color-red-600); }

  .di-card-body { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--color-slate-100); display: flex; flex-direction: column; gap: 0.4rem; }

  .di-field-label { font-size: 0.72rem; font-weight: 600; color: var(--color-violet-600); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0.4rem; }

  .di-textarea {
    width: 100%; min-height: 4rem; padding: 0.5rem 0.6rem; border: 1px solid var(--color-slate-200); border-radius: 6px;
    font-size: 0.825rem; font-family: inherit; color: var(--color-slate-700); resize: vertical;
  }
  .di-textarea:focus { outline: none; border-color: var(--color-violet-300); }

  .mini-spinner {
    width: 14px; height: 14px; border: 2px solid rgba(124, 58, 237, 0.25); border-top-color: var(--color-violet-600);
    border-radius: 50%; animation: di-spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes di-spin { to { transform: rotate(360deg); } }

  .btn {
    display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 0.9rem; border-radius: 6px;
    font-size: 0.825rem; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--color-violet-600); color: white; }
  .btn-primary:hover:not(:disabled) { background: var(--color-violet-700); }
  .btn-secondary { background: white; color: var(--color-slate-600); border-color: var(--color-slate-300); }
  .btn-secondary:hover:not(:disabled) { background: var(--color-slate-50); }
</style>
