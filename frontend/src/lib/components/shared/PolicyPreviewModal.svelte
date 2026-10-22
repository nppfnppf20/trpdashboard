<script>
  // Read-only preview of one policy (or plan) with a light annotation layer.
  // Used by the Policy tab and the Drafting Issues page, so both behave the same.
  //
  // The verbatim policy_text is never touched. What is saved is a separate
  // HTML version (policy_text_annotated) that only ever differs from it in
  // layout: line breaks, spacing, and bold / italic / underline / highlight.
  //
  // The user may change spacing and line breaks (Enter splits a line, Backspace
  // joins two, spaces can be added or removed) but never the words. That is
  // enforced twice: beforeinput refuses any edit that would insert or delete
  // anything other than whitespace, and after every edit the text with all
  // whitespace removed is compared with what it was on open, reverting to the
  // last good version if it ever differs (covers anything beforeinput can't see:
  // undo/redo, autocorrect, IME, browser quirks).
  import { createEventDispatcher, onMount } from 'svelte';
  import { sanitizeHtml } from '$lib/utils/sanitizeHtml.js';
  import { autoFormatPolicyText } from '$lib/utils/policyFormat.js';
  import { updatePolicyAnnotatedText } from '$lib/api/lpaAnalysis.js';

  // A policy row, or a plan shaped like one (see _kind): { id, policy_reference,
  // policy_name, policy_type, is_key_policy, policy_text, policy_text_annotated,
  // relevant_supporting_text, notes, _kind?: 'plan' }
  export let policy;

  const dispatch = createEventDispatcher();

  const isPlan = policy._kind === 'plan';
  let annotatedHtml = policy.policy_text_annotated ?? null;
  let richTextEl;
  let saving = false;
  let error = null;
  let highlightColour = '';
  let highlightRgb = ''; // the same colour as the browser reports it, for comparing
  let notice = '';
  let noticeTimer;
  let saveTimer;
  let lastGoodHtml = '';
  let baseline = '';

  const squash = s => (s ?? '').replace(/\s+/g, '');

  onMount(() => {
    // Token-driven so the highlight follows the design system rather than a literal colour.
    highlightColour = getComputedStyle(document.documentElement).getPropertyValue('--color-amber-200').trim();
    // Browsers hand colours back as "rgb(r, g, b)", so read ours back the same way to compare.
    const probe = document.createElement('span');
    probe.style.backgroundColor = highlightColour;
    document.body.appendChild(probe);
    highlightRgb = getComputedStyle(probe).backgroundColor;
    probe.remove();

    if (richTextEl) {
      // Make highlight / colour commands write inline CSS rather than legacy <font> tags.
      document.execCommand('styleWithCSS', false, true);
      // Enter should split a <p>, not add a <div>
      document.execCommand('defaultParagraphSeparator', false, 'p');
      // The baseline is what is on screen now, so an older saved version is respected as-is.
      lastGoodHtml = richTextEl.innerHTML;
      baseline = squash(richTextEl.textContent);
    }
  });

  function flashNotice(message) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice = ''; }, 3500);
  }

  function refuse(e) {
    e.preventDefault();
    flashNotice('Only spacing and line breaks can be changed here, not the words.');
  }

  // Runs before the browser applies each edit. Line breaks and whitespace pass;
  // anything that would add or remove other characters is refused.
  function onBeforeInput(e) {
    const type = e.inputType;
    if (type === 'insertParagraph' || type === 'insertLineBreak') return;
    if (type === 'historyUndo' || type === 'historyRedo') return; // verified after the fact in onInput
    if (type.startsWith('format')) return; // bold / italic / underline / highlight

    if (type === 'insertText') {
      if (/^\s*$/.test(e.data ?? '')) return;
      refuse(e);
      return;
    }

    if (type.startsWith('delete')) {
      const target = e.getTargetRanges?.()[0];
      if (!target) return; // can't tell what is being removed: onInput decides
      const range = document.createRange();
      range.setStart(target.startContainer, target.startOffset);
      range.setEnd(target.endContainer, target.endOffset);
      // Joining two lines selects no text at all, so it passes too.
      if (/^\s*$/.test(range.toString())) return;
      refuse(e);
      return;
    }

    refuse(e);
  }

  // Runs after every edit. If the words somehow changed, put the last good
  // version back; otherwise remember it and save the new layout shortly.
  function onInput() {
    if (!richTextEl) return;
    if (squash(richTextEl.textContent) !== baseline) {
      richTextEl.innerHTML = lastGoodHtml;
      const sel = window.getSelection();
      sel?.selectAllChildren(richTextEl);
      sel?.collapseToEnd();
      flashNotice('That change would have altered the words, so it was undone.');
      return;
    }
    lastGoodHtml = richTextEl.innerHTML;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(richTextEl.innerHTML), 700);
  }

  // Saves anything still waiting, then closes. Used by every way of closing.
  async function close() {
    if (saveTimer && richTextEl) {
      clearTimeout(saveTimer);
      saveTimer = null;
      await save(richTextEl.innerHTML);
    }
    dispatch('close');
  }

  async function save(html) {
    saving = true;
    error = null;
    try {
      await updatePolicyAnnotatedText(policy.id, html);
      annotatedHtml = html;
      dispatch('annotated', { id: policy.id, html });
    } catch (e) {
      console.error('Failed to save annotated policy text:', e);
      error = 'Could not save formatting. It will be lost when this closes.';
    } finally {
      saving = false;
    }
  }

  function hasSelection() {
    const sel = window.getSelection();
    return !!sel && !sel.isCollapsed && !!richTextEl?.contains(sel.anchorNode);
  }

  // With nothing selected these commands would only toggle a typing state
  // (typing is blocked), so there would be nothing to save.
  function format(command) {
    if (!hasSelection()) return;
    document.execCommand(command);
    commitFormatting();
  }

  // Is the start of the selection already inside our highlight? Walks up from
  // the selection to the text box looking for our highlight colour. (Asking the
  // browser via queryCommandValue doesn't work: it reports the text box's own
  // background while it has focus, so everything looks "already highlighted".)
  function selectionIsHighlighted() {
    let el = window.getSelection()?.anchorNode;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    while (el && el !== richTextEl) {
      if (getComputedStyle(el).backgroundColor === highlightRgb) return true;
      el = el.parentElement;
    }
    return false;
  }

  function toggleHighlight() {
    if (!hasSelection()) return;
    document.execCommand('hiliteColor', false, selectionIsHighlighted() ? 'transparent' : highlightColour);
    commitFormatting();
  }

  // Toolbar changes only add or remove tags, never words, so they save straight away.
  function commitFormatting() {
    clearTimeout(saveTimer);
    saveTimer = null;
    lastGoodHtml = richTextEl.innerHTML;
    save(lastGoodHtml);
  }

  function resetFormatting() {
    if (!annotatedHtml) return;
    if (!confirm('Remove all bold, italic, underline and highlight from this policy?')) return;
    save(null);
  }

  // Only navigation, selection, spacing and line-break keys get through, plus
  // copy / select-all / undo / redo, and Ctrl/Cmd+B/I/U (routed through the same
  // actions as the toolbar). Letters and the rest are stopped here, and
  // onBeforeInput / onInput are the backstop for anything else. Paste, drop and
  // cut are blocked in the markup.
  function onKeydown(e) {
    const allowedKeys = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown',
      'Tab', 'Shift', 'Control', 'Meta', 'Alt', 'Escape',
      'Enter', 'Backspace', 'Delete', ' '
    ];
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const shortcuts = { b: 'bold', i: 'italic', u: 'underline' };
    if (mod && shortcuts[key]) {
      e.preventDefault();
      format(shortcuts[key]);
      return;
    }
    if (allowedKeys.includes(e.key) || (mod && ['c', 'a', 'z', 'y'].includes(key))) return;
    e.preventDefault();
  }

  // Sets the region's HTML once on mount. Later changes (such as the reset
  // button) re-sync it, but never while it has focus: then the DOM is the
  // source of truth and our own save must not replace it under the caret.
  function richTextContent(node, html) {
    node.innerHTML = sanitizeHtml(html);
    return {
      update(newHtml) {
        if (document.activeElement === node) return;
        const clean = sanitizeHtml(newHtml);
        if (node.innerHTML !== clean) {
          node.innerHTML = clean;
          lastGoodHtml = node.innerHTML;
          baseline = squash(node.textContent);
        }
      }
    };
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
         nothing can scroll past it. mousedown is prevented on the buttons so
         pressing one doesn't shift focus off the text and collapse the selection
         before the command runs. -->
    {#if policy.policy_text}
      <div class="toolbar-bar">
        <p class="section-label">Policy Text</p>
        <div class="toolbar">
          {#if saving}<span class="mini-spinner"></span>{/if}
          <button type="button" class="btn btn-ghost btn-sm tool" on:mousedown|preventDefault on:click={() => format('bold')} title="Bold (Ctrl+B)"><b>B</b></button>
          <button type="button" class="btn btn-ghost btn-sm tool" on:mousedown|preventDefault on:click={() => format('italic')} title="Italic (Ctrl+I)"><i>I</i></button>
          <button type="button" class="btn btn-ghost btn-sm tool" on:mousedown|preventDefault on:click={() => format('underline')} title="Underline (Ctrl+U)"><u>U</u></button>
          <button type="button" class="btn btn-ghost btn-sm tool" on:mousedown|preventDefault on:click={toggleHighlight} title="Highlight"><i class="las la-highlighter"></i></button>
          <button type="button" class="btn btn-ghost btn-sm tool" on:click={resetFormatting} disabled={!annotatedHtml} title="Remove all formatting"><i class="las la-undo"></i></button>
        </div>
      </div>
    {/if}

    <div class="dialog-body">
      {#if !policy.policy_text}
        <div class="section">
          <p class="section-label">Policy Text</p>
          <p class="plain none">None recorded</p>
        </div>
      {:else}
        <div class="section">
          <div
            class="rich"
            contenteditable="true"
            role="textbox"
            tabindex="0"
            spellcheck="false"
            bind:this={richTextEl}
            use:richTextContent={annotatedHtml || autoFormatPolicyText(policy.policy_text)}
            on:keydown={onKeydown}
            on:beforeinput={onBeforeInput}
            on:input={onInput}
            on:paste|preventDefault
            on:drop|preventDefault
            on:cut|preventDefault
          ></div>
          {#if notice}<div class="alert alert-info">{notice}</div>{/if}
          {#if error}<div class="alert alert-error">{error}</div>{/if}
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

  .toolbar { display: flex; align-items: center; gap: var(--space-1); }
  .tool { min-width: 1.75rem; padding: 0.25rem 0.4rem; }

  .rich {
    margin: 0 calc(var(--space-2) * -1);
    padding: var(--space-1) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    outline: none;
    cursor: text;
    font-size: var(--font-size-sm);
    line-height: 1.65;
    color: var(--color-slate-700);
  }
  .rich:focus { border-color: var(--color-slate-200); background: var(--color-slate-50); }
  .rich :global(p) { margin: 0 0 var(--space-2); }
  .rich :global(p:last-child) { margin-bottom: 0; }
  .rich :global(b), .rich :global(strong) { font-weight: 700; }

  .plain { margin: 0; font-size: var(--font-size-sm); line-height: 1.65; white-space: pre-wrap; }
  .support { color: var(--color-slate-500); font-style: italic; }
  .none { color: var(--color-slate-400); }

  .mini-spinner {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
