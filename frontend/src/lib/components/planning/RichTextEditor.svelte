<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import '$lib/styles/trpformatting.css';
  import { highlightPlaceholders } from '$lib/utils/draftParagraphs.js';

  export let content = '';
  export let placeholder = 'Start typing...';
  export let fullHeight = false;
  // Off for table-format deliverables (Stage 1 Review, HLPV) — their content
  // is an HTML <table>, and selecting across table cells is a fundamentally
  // different, cell-bounded browser behavior rather than flowing text
  // selection. The paragraph-id scoping this popup relies on doesn't map onto
  // table content sensibly anyway (the whole table is one "paragraph").
  export let enableSelectionPopup = true;
  // Planning deliverable drafts use "[...]" as a fill-in/flag-for-review
  // placeholder convention — off by default since this component is reused
  // for meeting notes, email templates, etc. where square brackets don't
  // carry that meaning.
  export let highlightBracketPlaceholders = false;

  const dispatch = createEventDispatcher();

  let editorElement;
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;

  function applyContent(html) {
    return highlightBracketPlaceholders ? highlightPlaceholders(html) : html;
  }

  onMount(() => {
    if (editorElement && content) {
      editorElement.innerHTML = applyContent(content);
    }

    // Firefox's contenteditable implementation has a legacy "object resizing"
    // feature that can draw a resize box around a block element when a
    // selection is extended across it — these two calls turn that off. A
    // no-op (and safe) in browsers that don't support the commands.
    try {
      document.execCommand('enableObjectResizing', false, false);
      document.execCommand('enableInlineTableEditing', false, false);
    } catch { /* unsupported outside Firefox — harmless */ }

    // Listen for selection changes to update toolbar state
    document.addEventListener('selectionchange', updateToolbarState);
    document.addEventListener('mouseup', handleSelectionMouseUp);

    return () => {
      document.removeEventListener('selectionchange', updateToolbarState);
      document.removeEventListener('mouseup', handleSelectionMouseUp);
    };
  });

  // Maps a selection endpoint to the index of the top-level editor child it
  // falls within — matches the p{idx} scheme PlanningDocIncorporatePanel's
  // splitAllParagraphs() uses, so a highlight can be resolved to whole
  // paragraph ids without ever slicing the DOM mid-element.
  function topLevelChildIndex(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el.parentElement !== editorElement) el = el.parentElement;
    if (!el) return -1;
    return Array.prototype.indexOf.call(editorElement.children, el);
  }

  // Reports a completed text selection up to the caller (paragraph ids touched,
  // the quoted text, and a viewport anchor point) — the caller owns whatever UI
  // shows up in response (a comment/AI popup). This component doesn't render
  // any selection UI itself.
  function handleSelectionMouseUp() {
    if (!enableSelectionPopup) return;
    setTimeout(() => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !editorElement || !editorElement.contains(sel.anchorNode)) {
        return;
      }
      const range = sel.getRangeAt(0);
      const startIdx = topLevelChildIndex(range.startContainer);
      const endIdx = topLevelChildIndex(range.endContainer);
      if (startIdx === -1 || endIdx === -1) return;

      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      const paragraphIds = [];
      for (let i = lo; i <= hi; i++) paragraphIds.push(`p${i}`);

      const rect = range.getBoundingClientRect();
      const quotedText = sel.toString();

      // This is the one point we trust the range: it's settled (drag is over)
      // and has already passed the topLevelChildIndex checks above. Snapshot
      // its geometry for our own highlight overlay, then drop the native
      // selection entirely.
      selectionHighlightRects = Array.from(range.getClientRects());
      sel.removeAllRanges();

      dispatch('textselected', {
        paragraphIds,
        quotedText,
        top: rect.bottom,
        left: rect.left + rect.width / 2,
      });
    }, 0);
  }

  function updateToolbarState() {
    const sel = document.getSelection();
    if (!editorElement || !sel || !editorElement.contains(sel.anchorNode)) {
      return;
    }

    isBold = document.queryCommandState('bold');
    isItalic = document.queryCommandState('italic');
    isUnderline = document.queryCommandState('underline');
  }

  // ── Selection highlight ────────────────────────────────────────────────────
  // Drawn as plain positioned <div>s from Range.getClientRects(), NOT through
  // native ::selection or the CSS Custom Highlight API. Both of those go
  // through Firefox's internal selection-painting code, which has a bug
  // rendering a contenteditable range that spans multiple block-level
  // elements (shows as stray lines, or briefly balloons to cover far more
  // than intended) — switching from ::selection to ::highlight() didn't
  // escape it because both apparently share that same broken code path.
  // Plain divs with a background color go through ordinary box painting
  // instead, so they can't inherit that bug. Only ever set once, from the
  // settled range at mouseup (see handleSelectionMouseUp) — never kept live
  // during the drag itself.
  let selectionHighlightRects = [];

  export function clearSelectionHighlight() {
    selectionHighlightRects = [];
  }

  function execCommand(command, value = null) {
    document.execCommand(command, false, value);
    editorElement.focus();
    updateToolbarState();
    handleInput();
  }

  function formatBold() {
    execCommand('bold');
  }

  function formatItalic() {
    execCommand('italic');
  }

  function formatUnderline() {
    execCommand('underline');
  }

  function formatHeading(level) {
    execCommand('formatBlock', `<h${level}>`);
  }

  function formatSubtitle() {
    // Apply subtitle formatting using h4 element styled as subtitle
    execCommand('formatBlock', '<h4>');
  }

  function formatParagraph() {
    execCommand('formatBlock', '<p>');
  }

  function insertUnorderedList() {
    execCommand('insertUnorderedList');
  }

  function insertOrderedList() {
    execCommand('insertOrderedList');
  }

  function handleInput() {
    const html = editorElement.innerHTML;
    dispatch('change', { html });
  }

  function handlePaste(event) {
    // Prevent pasting formatted content, paste as plain text
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  export function getHTML() {
    return editorElement ? editorElement.innerHTML : '';
  }

  export function setHTML(html) {
    if (editorElement) {
      editorElement.innerHTML = applyContent(html);
    }
  }

  export function clear() {
    if (editorElement) {
      editorElement.innerHTML = '';
    }
  }

  // ── Locate text in the document (used by the Check Draft panel) ──
  // Highlights via the CSS Custom Highlight API (or selection fallback) so the
  // DOM is never mutated — the highlight can't leak into saved draft HTML.
  const LOCATE_HIGHLIGHT = 'draft-locate';

  export function highlightText(needle) {
    if (!editorElement || !needle?.trim()) return false;
    const range = findTextRange(needle.trim());
    if (!range) return false;
    const el = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.set(LOCATE_HIGHLIGHT, new Highlight(range));
    } else {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return true;
  }

  export function clearHighlight() {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.delete(LOCATE_HIGHLIGHT);
    }
  }

  function findTextRange(needle) {
    const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let full = '';
    let n;
    while ((n = walker.nextNode())) {
      nodes.push({ node: n, start: full.length });
      full += n.textContent;
    }
    if (!full) return null;

    // Tolerate whitespace runs and straight/curly quote differences between
    // the LLM's excerpt and the document text
    const pattern = needle
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/['‘’]/g, "['‘’]")
      .replace(/["“”]/g, '["“”]')
      .replace(/\s+/g, '\\s+');
    let match;
    try {
      match = full.match(new RegExp(pattern, 'i'));
    } catch {
      return null;
    }
    if (!match) return null;

    const pointAt = (idx) => {
      for (const { node, start } of nodes) {
        if (idx <= start + node.textContent.length) {
          return { node, offset: Math.max(0, idx - start) };
        }
      }
      const last = nodes[nodes.length - 1];
      return { node: last.node, offset: last.node.textContent.length };
    };

    const s = pointAt(match.index);
    const e = pointAt(match.index + match[0].length);
    const range = document.createRange();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    return range;
  }
</script>

<div class="rich-text-editor" class:full-height={fullHeight}>
  <div class="toolbar">
    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        class:active={isBold}
        on:click={formatBold}
        title="Bold (Ctrl+B)"
        type="button"
      >
        <i class="las la-bold"></i>
      </button>
      <button
        class="toolbar-btn"
        class:active={isItalic}
        on:click={formatItalic}
        title="Italic (Ctrl+I)"
        type="button"
      >
        <i class="las la-italic"></i>
      </button>
      <button
        class="toolbar-btn"
        class:active={isUnderline}
        on:click={formatUnderline}
        title="Underline (Ctrl+U)"
        type="button"
      >
        <i class="las la-underline"></i>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        on:click={() => formatHeading(1)}
        title="Heading 1"
        type="button"
      >
        <span class="btn-text">H1</span>
      </button>
      <button
        class="toolbar-btn"
        on:click={() => formatHeading(2)}
        title="Heading 2"
        type="button"
      >
        <span class="btn-text">H2</span>
      </button>
      <button
        class="toolbar-btn"
        on:click={() => formatHeading(3)}
        title="Heading 3"
        type="button"
      >
        <span class="btn-text">H3</span>
      </button>
      <button
        class="toolbar-btn subtitle-btn"
        on:click={formatSubtitle}
        title="Subtitle (for address/document title)"
        type="button"
      >
        <span class="btn-text">Sub</span>
      </button>
      <button
        class="toolbar-btn"
        on:click={formatParagraph}
        title="Normal Text"
        type="button"
      >
        <span class="btn-text">¶</span>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button
        class="toolbar-btn"
        on:click={insertUnorderedList}
        title="Bullet List"
        type="button"
      >
        <i class="las la-list-ul"></i>
      </button>
      <button
        class="toolbar-btn"
        on:click={insertOrderedList}
        title="Numbered List"
        type="button"
      >
        <i class="las la-list-ol"></i>
      </button>
    </div>
  </div>

  <div
    class="editor-content trp-document-content"
    contenteditable="true"
    bind:this={editorElement}
    on:input={handleInput}
    on:paste={handlePaste}
    data-placeholder={placeholder}
  ></div>
</div>

{#each selectionHighlightRects as r}
  <div
    class="selection-highlight-box"
    style="top:{r.top}px; left:{r.left}px; width:{r.width}px; height:{r.height}px;"
  ></div>
{/each}

<style>
  .rich-text-editor {
    border: 1px solid var(--color-slate-300);
    border-radius: 8px;
    background: white;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-slate-50);
    border-bottom: 1px solid var(--color-slate-200);
    flex-wrap: wrap;
  }

  .toolbar-group {
    display: flex;
    gap: 0.25rem;
  }

  .toolbar-divider {
    width: 1px;
    height: 1.5rem;
    background: var(--color-slate-300);
  }

  .toolbar-btn {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-slate-600);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .toolbar-btn:hover {
    background: var(--color-slate-200);
    border-color: var(--color-slate-300);
  }

  .toolbar-btn.active {
    background: var(--color-primary-100);
    border-color: var(--color-primary-200);
    color: var(--color-primary-800);
  }

  .toolbar-btn i {
    font-size: 1.125rem;
  }

  .btn-text {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .full-height .editor-content {
    max-height: none;
  }

  .editor-content {
    min-height: 400px;
    max-height: 600px;
    overflow-y: auto;
    padding: 1.5rem;
    font-family: 'Calibri', 'Arial', sans-serif;
    font-size: 0.9375rem; /* 11pt equivalent */
    line-height: 1.6;
    color: var(--color-black);
    outline: none;
  }

  .editor-content:empty:before {
    content: attr(data-placeholder);
    color: var(--color-slate-400);
    font-style: italic;
  }

  /* Native selection is painted invisibly for the entire drag — see
     selectionHighlightRects in the script, which draws our own highlight as
     plain positioned boxes instead, once the drag settles. Native selection
     highlighting is left off throughout (rather than only after mouseup)
     because Firefox's selection-painting bug for multi-block contenteditable
     ranges shows up mid-drag too, not just at the end. */
  .editor-content ::selection {
    background-color: transparent;
    color: inherit;
  }

  .selection-highlight-box {
    position: fixed;
    background-color: var(--color-primary-100);
    opacity: 0.6;
    pointer-events: none;
    z-index: 5;
  }

  /* Scrollbar styling */
  .editor-content::-webkit-scrollbar {
    width: 8px;
  }

  .editor-content::-webkit-scrollbar-track {
    background: var(--color-slate-100);
  }

  .editor-content::-webkit-scrollbar-thumb {
    background: var(--color-slate-300);
    border-radius: 4px;
  }

  .editor-content::-webkit-scrollbar-thumb:hover {
    background: var(--color-slate-400);
  }

  :global(.llm-generated) {
    color: var(--color-slate-500) !important;
    border-left: 2px solid var(--color-slate-300);
    padding-left: 0.75rem;
    margin-left: -0.75rem;
  }
  :global(.llm-generated *) {
    color: var(--color-slate-500) !important;
  }
</style>

