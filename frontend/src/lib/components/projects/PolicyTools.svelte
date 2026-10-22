<script>
  // Reference and checking tools for the policy list, kept out of the main
  // header: National Policy Templates, policies used on similar projects, and
  // the NPPF inconsistency check. Each opens in its own dialog.
  import { createEventDispatcher } from 'svelte';
  import { sanitizeHtml } from '$lib/utils/sanitizeHtml.js';
  import ActionMenu from '$lib/components/shared/ActionMenu.svelte';
  import PromptEditModal from '$lib/components/shared/PromptEditModal.svelte';
  import { createPolicy, getNationalPolicyPrecedents } from '$lib/api/lpaAnalysis.js';
  import { listIssueTypes } from '$lib/api/issueTypes.js';
  import { checkNppfPolicyLibrary } from '$lib/api/draftCheck.js';
  import { getActionPrompt, saveActionPrompt, resetActionPrompt } from '$lib/api/planningApplication.js';

  export let projectId;
  export let projectDevTypes = [];

  const dispatch = createEventDispatcher();

  // The three "add" entries live here for now and are handled by the parent
  // (reported through the `add` event); the rest open a dialog in this component.
  const MENU_ITEMS = [
    { key: 'add:nppf', label: 'Add policies from the NPPF library', icon: 'la-flag', description: 'Tick several; the wording is filled in for you' },
    { key: 'add:document', label: 'Add policies from a document', icon: 'la-file-import', description: 'Find the policies a planning document cites' },
    { key: 'add:plan', label: 'Add a plan or guidance document', icon: 'la-book', description: 'Add to the documents the policies belong to' },
    { key: 'templates', label: 'National Policy Templates', icon: 'la-layer-group', description: 'Ready-made NPPF / NPPG snippets for this development type' },
    { key: 'precedents', label: 'Used on Similar Projects', icon: 'la-history', description: 'National policies recorded on projects like this one' },
    { key: 'nppf', label: 'NPPF Inconsistency Check', icon: 'la-exchange-alt', description: 'Compare local policies against the NPPF' }
  ];
  const TOOL_TITLES = Object.fromEntries(MENU_ITEMS.map(i => [i.key, i.label]));

  let activeTool = null;

  function onSelect(e) {
    const key = e.detail;
    if (key.startsWith('add:')) {
      dispatch('add', key.slice(4));
      return;
    }
    activeTool = key;
    if (activeTool === 'templates') loadTemplates();
    if (activeTool === 'precedents') loadPrecedents();
  }

  // ── National Policy Templates ──
  let issueTypes = [];
  let templatesLoaded = false;

  async function loadTemplates() {
    if (templatesLoaded) return;
    try {
      issueTypes = await listIssueTypes();
      templatesLoaded = true;
    } catch (err) {
      console.error('Failed to load policy snippet templates:', err);
    }
  }

  // Generic templates (development_type IS NULL) always apply; dev-type ones
  // only apply where they overlap the project's selected development types.
  $: matchingTemplates = issueTypes.filter(
    t => !t.development_type || projectDevTypes.includes(t.development_type)
  );

  function templateFieldCount(t) {
    return ['nppf_text', 'nppg_text', 'other_national_text', 'other_guidance_text'].filter(f => t[f]?.trim()).length;
  }

  // ── Used on Similar Projects ──
  let precedents = [];
  let precedentsLoaded = false;
  let importingKey = null;

  async function loadPrecedents() {
    if (precedentsLoaded) return;
    try {
      precedents = await getNationalPolicyPrecedents(projectId);
      precedentsLoaded = true;
    } catch (err) {
      console.error('Failed to load national policy precedents:', err);
    }
  }

  // Copies only the portable parts (reference/name/verbatim text), never
  // relevant_supporting_text or is_key_policy, which are the other project's
  // own judgment calls, not facts that should carry across.
  async function importPrecedent(p) {
    const key = `${p.policy_reference}|${p.policy_name}`;
    importingKey = key;
    try {
      await createPolicy(projectId, {
        policy_reference: p.policy_reference,
        policy_name: p.policy_name,
        policy_type: 'national',
        policy_text: p.policy_text
      });
      dispatch('imported');
    } catch (err) {
      alert(err.message);
    } finally {
      importingKey = null;
    }
  }

  // ── NPPF inconsistency check (whole policy library) ──
  const NPPF_PROMPT_KEY = 'policy_check_nppf';
  const NPPF_KINDS = {
    requirement_removed: 'Requirement removed by the NPPF',
    test_differs: 'Different test',
    weight_differs: 'Different weight',
    superseded: 'Superseded',
    scope_differs: 'Different scope',
    other: 'Inconsistency',
  };
  let nppfCheck = { status: 'idle', items: [], error: null, meta: {} };
  let nppfPromptOpen = false;
  let nppfPrompt = { text: '', loading: false, saving: false, saved: false };

  async function runNppfCheck() {
    nppfCheck = { status: 'running', items: [], error: null, meta: {} };
    try {
      const { items = [], ...meta } = await checkNppfPolicyLibrary(projectId);
      nppfCheck = { status: 'done', items, error: null, meta };
    } catch (err) {
      nppfCheck = { status: 'error', items: [], error: err.message, meta: {} };
    }
  }

  async function openNppfPrompt() {
    nppfPromptOpen = true;
    nppfPrompt = { text: '', loading: true, saving: false, saved: false };
    try {
      const data = await getActionPrompt(NPPF_PROMPT_KEY);
      nppfPrompt = { text: data.prompt ?? '', loading: false, saving: false, saved: false };
    } catch {
      nppfPrompt = { text: '', loading: false, saving: false, saved: false };
    }
  }

  async function saveNppfPrompt() {
    nppfPrompt = { ...nppfPrompt, saving: true };
    try {
      await saveActionPrompt(NPPF_PROMPT_KEY, nppfPrompt.text);
      nppfPrompt = { ...nppfPrompt, saving: false, saved: true };
      setTimeout(() => { nppfPrompt = { ...nppfPrompt, saved: false }; }, 2500);
    } catch {
      nppfPrompt = { ...nppfPrompt, saving: false };
    }
  }

  async function resetNppfPrompt() {
    nppfPrompt = { ...nppfPrompt, saving: true };
    try {
      const data = await resetActionPrompt(NPPF_PROMPT_KEY);
      nppfPrompt = { text: data.prompt ?? '', loading: false, saving: false, saved: true };
      setTimeout(() => { nppfPrompt = { ...nppfPrompt, saved: false }; }, 2500);
    } catch {
      nppfPrompt = { ...nppfPrompt, saving: false };
    }
  }
</script>

<ActionMenu label="Tools" icon="la-tools" badge="Beta" items={MENU_ITEMS} on:select={onSelect} />

{#if activeTool}
  <div class="dialog-backdrop" on:click|self={() => activeTool = null} role="presentation">
    <div class="dialog dialog-lg">
      <div class="dialog-header">
        <h3 class="dialog-title">{TOOL_TITLES[activeTool]} <span class="badge badge-sm badge-warning">Beta</span></h3>
        <button class="dialog-close" on:click={() => activeTool = null} aria-label="Close">&times;</button>
      </div>

      <div class="dialog-body">
        {#if activeTool === 'templates'}
          {#if !projectDevTypes.length}
            <p class="dialog-hint">This project has no Development Type set, so only generic (non-dev-type-specific) templates are shown below. Set a development type on the project's info page to also see dev-type-specific ones.</p>
          {/if}
          {#if matchingTemplates.length === 0}
            <p class="dialog-hint">No matching snippet templates.</p>
          {:else}
            <div class="tools-list">
              {#each matchingTemplates as t (t.id)}
                <details class="template-item">
                  <summary>
                    <span class="template-label">{t.label}</span>
                    <span class="badge badge-sm badge-neutral">{t.development_type || 'generic'}</span>
                    <span class="template-fields">{templateFieldCount(t)} field{templateFieldCount(t) === 1 ? '' : 's'}</span>
                  </summary>
                  {#if t.nppf_text}<div class="template-field"><strong>NPPF</strong>{@html sanitizeHtml(t.nppf_text)}</div>{/if}
                  {#if t.nppg_text}<div class="template-field"><strong>NPPG</strong>{@html sanitizeHtml(t.nppg_text)}</div>{/if}
                  {#if t.other_national_text}<div class="template-field"><strong>Other National Policy</strong>{@html sanitizeHtml(t.other_national_text)}</div>{/if}
                  {#if t.other_guidance_text}<div class="template-field"><strong>Other Guidance</strong>{@html sanitizeHtml(t.other_guidance_text)}</div>{/if}
                </details>
              {/each}
            </div>
          {/if}

        {:else if activeTool === 'precedents'}
          {#if !projectDevTypes.length}
            <p class="dialog-hint">This project has no Development Type set, so no other projects can be matched. Set a development type on the project's info page first.</p>
          {:else if precedents.length === 0}
            <p class="dialog-hint">No national policies recorded yet on other projects sharing this project's development type.</p>
          {:else}
            <div class="tools-list">
              {#each precedents as p (`${p.policy_reference}|${p.policy_name}`)}
                <div class="precedent-item">
                  <div class="precedent-header">
                    {#if p.policy_reference}<span class="ref-chip">{p.policy_reference}</span>{/if}
                    <span class="precedent-name">{p.policy_name}</span>
                    <span class="precedent-used-on">used on {p.used_on} other project{p.used_on == 1 ? '' : 's'}</span>
                    <button
                      class="btn btn-secondary btn-sm"
                      disabled={importingKey === `${p.policy_reference}|${p.policy_name}`}
                      on:click={() => importPrecedent(p)}
                    >
                      {importingKey === `${p.policy_reference}|${p.policy_name}` ? 'Adding…' : 'Add to this project'}
                    </button>
                  </div>
                  {#if p.policy_text}
                    <details class="policy-detail">
                      <summary>Policy text</summary>
                      <p class="detail-body">{p.policy_text}</p>
                    </details>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

        {:else if activeTool === 'nppf'}
          <p class="dialog-hint">Compares this project's NPPF policies against its Local Plan, Neighbourhood Plan, supplementary guidance and other policies, looking for genuine inconsistencies where the NPPF takes precedence.</p>
          <div class="btn-group">
            <button class="btn btn-primary btn-sm" disabled={nppfCheck.status === 'running'} on:click={runNppfCheck}>
              {#if nppfCheck.status === 'running'}Checking…{:else}<i class="las la-play"></i> {nppfCheck.status === 'idle' ? 'Run check' : 'Run again'}{/if}
            </button>
            <button class="btn btn-secondary btn-sm" title="View / edit prompt" on:click={openNppfPrompt}><i class="las la-sliders-h"></i> Prompt</button>
          </div>

          {#if nppfCheck.status === 'error'}
            <div class="alert alert-error">{nppfCheck.error}</div>
          {:else if nppfCheck.status === 'done'}
            {#if nppfCheck.meta.no_nppf_policies}
              <p class="dialog-hint">No NPPF (national) policies recorded for this project yet.</p>
            {:else if nppfCheck.meta.no_other_policies}
              <p class="dialog-hint">No local, neighbourhood or guidance policies recorded to compare against.</p>
            {:else}
              {#if nppfCheck.meta.plans_failed}
                <div class="alert alert-error">{nppfCheck.meta.plans_failed} of {nppfCheck.meta.plans_checked} plans could not be checked. Run again to retry.</div>
              {/if}
              {#if nppfCheck.items.length === 0}
                <p class="dialog-hint">No inconsistencies found.</p>
              {:else}
                <div class="tools-list">
                  {#each nppfCheck.items as item}
                    <div class="nppf-check-item">
                      <div class="precedent-header">
                        <span class="badge badge-sm badge-warning">{NPPF_KINDS[item.kind] ?? NPPF_KINDS.other}</span>
                        <span class="precedent-name">{item.plan_name}</span>
                      </div>
                      <div class="nppf-check-quote"><strong>NPPF {item.nppf_reference ?? ''}{item.nppf_name ? ` (${item.nppf_name})` : ''}:</strong> "{item.nppf_wording}"</div>
                      <div class="nppf-check-quote"><strong>{item.local_reference ? `${item.local_reference} ` : ''}{item.local_name}:</strong> "{item.local_wording}"</div>
                      {#if item.explanation}<p class="nppf-check-text">{item.explanation}</p>{/if}
                      {#if item.suggestion}<p class="nppf-check-text nppf-check-suggestion">{item.suggestion}</p>{/if}
                    </div>
                  {/each}
                </div>
              {/if}
            {/if}
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<PromptEditModal
  open={nppfPromptOpen}
  title="Edit Prompt: NPPF Inconsistency Check"
  promptText={nppfPrompt.text}
  loading={nppfPrompt.loading}
  saving={nppfPrompt.saving}
  saved={nppfPrompt.saved}
  on:close={() => nppfPromptOpen = false}
  on:change={(e) => { nppfPrompt = { ...nppfPrompt, text: e.detail }; }}
  on:save={saveNppfPrompt}
  on:reset={resetNppfPrompt}
/>

<style>
  .tools-list { display: flex; flex-direction: column; gap: var(--space-2); }

  .template-item, .precedent-item {
    padding: var(--space-2) var(--space-3);
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
  }
  .template-item summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    list-style: none;
    cursor: pointer;
    font-weight: 500;
    color: var(--color-slate-800);
  }
  .template-item summary::-webkit-details-marker { display: none; }
  .template-label { flex: 1; }
  .template-fields { font-size: var(--font-size-xs); color: var(--color-slate-400); white-space: nowrap; }
  .template-field {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-slate-100);
    color: var(--color-slate-700);
    line-height: 1.6;
  }
  .template-field strong {
    display: block;
    margin-bottom: 0.2rem;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-slate-400);
  }

  .precedent-header { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
  .precedent-name { flex: 1; min-width: 8rem; font-weight: 500; color: var(--color-slate-800); }
  .precedent-used-on { font-size: var(--font-size-xs); color: var(--color-slate-400); white-space: nowrap; }
  .ref-chip {
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-slate-100);
    color: var(--color-slate-600);
    font-family: monospace;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .policy-detail summary { cursor: pointer; color: var(--color-primary-600); font-weight: 500; user-select: none; }
  .detail-body { margin: var(--space-2) 0 0; white-space: pre-wrap; color: var(--color-slate-700); line-height: 1.5; }

  .nppf-check-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-left: 3px solid var(--color-amber-500);
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
  }
  .nppf-check-quote { color: var(--color-slate-700); line-height: 1.45; }
  .nppf-check-text { margin: 0; color: var(--color-slate-600); line-height: 1.45; }
  .nppf-check-suggestion { color: var(--color-slate-800); font-weight: 500; }
</style>
