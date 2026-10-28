<script>
  // Preview of one policy (or plan) with a light annotation layer. Used by the
  // Policy tab and the Drafting Issues page, so both behave the same.
  //
  // The verbatim policy_text is never touched. The wording is shown in a
  // FormattedTextEditor, which saves a separate HTML version (policy_text_annotated)
  // that only differs in layout and marks, never in words.
  import { createEventDispatcher } from 'svelte';
  import FormattedTextEditor from '$lib/components/shared/FormattedTextEditor.svelte';
  import FormatToolbar from '$lib/components/shared/FormatToolbar.svelte';
  import { updatePolicyAnnotatedText } from '$lib/api/lpaAnalysis.js';
  import { autoFormatPolicyText } from '$lib/utils/policyFormat.js';

  // A policy row, or a plan shaped like one (see _kind): { id, policy_reference,
  // policy_name, policy_type, is_key_policy, policy_text, policy_text_annotated,
  // relevant_supporting_text, notes, _kind?: 'plan' }
  export let policy;
  // Read-only view for a policy that isn't a project policy row (e.g. the NPPF
  // library): same layout, but no formatting toolbar and nothing is saved.
  export let readonly = false;

  const dispatch = createEventDispatcher();

  const isPlan = policy._kind === 'plan';
  let editor;
  let saving = false;
  let canReset = false;

  // Saves anything still waiting, then closes. Used by every way of closing.
  async function close() {
    await editor?.flush();
    dispatch('close');
  }
</script>

<div class="dialog-backdrop" on:click|self={close} role="presentation">
  <div class="dialog dialog-md">
    <div class="dialog-header">
      <h3 class="dialog-title">
        {#if policy.policy_reference}<span class="ref-chip">{policy.policy_reference}</span>{/if}
        <span>{policy.policy_name}</span>
        {#if policy.is_key_policy}<span class="badge badge-sm badge-warning">Key</span>{/if}
        {#if policy.policy_type}<span class="badge badge-sm badge-neutral">{policy.policy_type}</span>{/if}
      </h3>
      <button class="dialog-close" on:click={close} aria-label="Close">&times;</button>
    </div>

    <!-- The toolbar sits outside the scrolling area, so it is always in view and
         nothing can scroll past it. -->
    {#if policy.policy_text && !readonly}
      <div class="toolbar-bar">
        <p class="section-label">Policy Text</p>
        <FormatToolbar {editor} {saving} {canReset} />
      </div>
    {/if}

    <div class="dialog-body">
      {#if !policy.policy_text}
        <div class="section">
          <p class="section-label">Policy Text</p>
          <p class="plain none">None recorded</p>
        </div>
      {:else if readonly}
        <div class="section">
          <p class="section-label">Policy Text</p>
          <div class="static-text">{@html autoFormatPolicyText(policy.policy_text)}</div>
        </div>
      {:else}
        <div class="section">
          <FormattedTextEditor
            bind:this={editor}
            bind:saving
            bind:canReset
            text={policy.policy_text}
            savedHtml={policy.policy_text_annotated}
            save={(html) => updatePolicyAnnotatedText(policy.id, html)}
            resetPrompt="Remove all bold, italic, underline and highlight from this policy?"
            on:annotated={(e) => dispatch('annotated', { id: policy.id, html: e.detail.html })}
          />
        </div>
      {/if}

      <!-- Every section always shows, so it is clear what is (and isn't) recorded -->
      <div class="section">
        <p class="section-label">{isPlan ? 'Relevance to Project' : 'Supporting Text'}</p>
        {#if policy.relevant_supporting_text}
          <p class="plain support">{policy.relevant_supporting_text}</p>
        {:else}
          <p class="plain none">None recorded</p>
        {/if}
      </div>

      <div class="section">
        <p class="section-label">{isPlan ? 'Summary' : 'Notes'}</p>
        {#if policy.notes}
          <p class="plain support">{policy.notes}</p>
        {:else}
          <p class="plain none">None recorded</p>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .dialog-title { flex-wrap: wrap; font-size: var(--font-size-base); }

  .ref-chip {
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-slate-100);
    color: var(--color-slate-600);
    font-family: monospace;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .section { display: flex; flex-direction: column; gap: var(--space-2); }
  .section-label {
    margin: 0;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-slate-400);
  }
  /* Label and formatting buttons, between the title and the scrolling text */
  .toolbar-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-6);
    background: var(--color-white);
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  /* Matches the editable layout used for project policies */
  .static-text { font-size: var(--font-size-sm); line-height: 1.65; color: var(--color-slate-700); }
  .static-text :global(p) { margin: 0 0 var(--space-2); }
  .static-text :global(p:last-child) { margin-bottom: 0; }
  .static-text :global(p.bullet) { padding-left: 1.25em; text-indent: -1.25em; }

  .plain { margin: 0; font-size: var(--font-size-sm); line-height: 1.65; white-space: pre-wrap; }
  .support { color: var(--color-slate-500); font-style: italic; }
  .none { color: var(--color-slate-400); }
</style>
