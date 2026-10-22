<script>
  // A block of saved text shown with a light, user-markable layer on top.
  // Used by the policy viewer and the transcript / document viewers.
  //
  // The verbatim text is never touched. What is saved is a separate HTML version
  // that only ever differs from it in layout: line breaks, spacing, and bold /
  // italic / underline / highlight.
  //
  // The user may change spacing and line breaks (Enter splits a line, Backspace
  // joins two, spaces can be added or removed) but never the words. That is
  // enforced twice: beforeinput refuses any edit that would insert or delete
  // anything other than whitespace, and after every edit the text with all
  // whitespace removed is compared with what it was on open, reverting to the
  // last good version if it ever differs (covers anything beforeinput can't see:
  // undo/redo, autocorrect, IME, browser quirks).
  //
  // The toolbar is a separate component (FormatToolbar) so each viewer can place
  // it where it wants; hand it this editor through bind:this.
  import { createEventDispatcher, onMount } from 'svelte';
  import { sanitizeHtml } from '$lib/utils/sanitizeHtml.js';
  import { autoFormatPolicyText } from '$lib/utils/policyFormat.js';

  export let text = ''; // the plain text, used to build the starting layout
  export let savedHtml = null; // the saved layout, if there is one
  export let startingLayout = autoFormatPolicyText; // plain text -> starting HTML
  export let save; // async (html | null) => void: stores the layout
  export let resetPrompt = 'Remove all bold, italic, underline and highlight?';

  // Read these with bind: to drive the toolbar
  export let saving = false;
  export let canReset = false;
  export let error = null;

  const dispatch = createEventDispatcher();

  let annotatedHtml = savedHtml ?? null;
  $: canReset = !!annotatedHtml;

  let richTextEl;
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
    saveTimer = setTimeout(() => persist(richTextEl.innerHTML), 700);
  }

  async function persist(html) {
    saving = true;
    error = null;
    try {
      await save(html);
      annotatedHtml = html;
      dispatch('annotated', { html });
    } catch (e) {
      console.error('Failed to save formatting:', e);
      error = e?.message && e.message !== 'Failed to fetch'
        ? `Could not save formatting: ${e.message}. It will be lost when this closes.`
        : 'Could not save formatting. It will be lost when this closes.';
    } finally {
      saving = false;
    }
  }

  // Saves anything still waiting. Call before closing the viewer.
  export async function flush() {
    if (saveTimer && richTextEl) {
      clearTimeout(saveTimer);
      saveTimer = null;
      await persist(richTextEl.innerHTML);
    }
  }

  function hasSelection() {
    const sel = window.getSelection();
    return !!sel && !sel.isCollapsed && !!richTextEl?.contains(sel.anchorNode);
  }

  // Toolbar changes only add or remove tags, never words, so they save straight away.
  function commitFormatting() {
    clearTimeout(saveTimer);
    saveTimer = null;
    lastGoodHtml = richTextEl.innerHTML;
    persist(lastGoodHtml);
  }

  // With nothing selected these commands would only toggle a typing state
  // (typing is blocked), so there would be nothing to save.
  export function format(command) {
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

  export function toggleHighlight() {
    if (!hasSelection()) return;
    document.execCommand('hiliteColor', false, selectionIsHighlighted() ? 'transparent' : highlightColour);
    commitFormatting();
  }

  export function resetFormatting() {
    if (!annotatedHtml) return;
    if (!confirm(resetPrompt)) return;
    persist(null);
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

<div class="fte">
  <div
    class="rich"
    contenteditable="true"
    role="textbox"
    tabindex="0"
    spellcheck="false"
    bind:this={richTextEl}
    use:richTextContent={annotatedHtml || startingLayout(text)}
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

<style>
  .fte { display: flex; flex-direction: column; gap: var(--space-2); }

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
</style>
