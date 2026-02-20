<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import '$lib/styles/trpformatting.css';

  export let content = '';
  export let placeholder = 'Start typing...';

  const dispatch = createEventDispatcher();

  let editorElement;
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;

  onMount(() => {
    if (editorElement && content) {
      editorElement.innerHTML = content;
    }

    // Listen for selection changes to update toolbar state
    document.addEventListener('selectionchange', updateToolbarState);

    return () => {
      document.removeEventListener('selectionchange', updateToolbarState);
    };
  });

  function updateToolbarState() {
    if (!editorElement || !editorElement.contains(document.getSelection().anchorNode)) {
      return;
    }

    isBold = document.queryCommandState('bold');
    isItalic = document.queryCommandState('italic');
    isUnderline = document.queryCommandState('underline');
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
      editorElement.innerHTML = html;
    }
  }

  export function clear() {
    if (editorElement) {
      editorElement.innerHTML = '';
    }
  }
</script>

<div class="rich-text-editor">
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

<style>
  .rich-text-editor {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: white;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    flex-wrap: wrap;
  }

  .toolbar-group {
    display: flex;
    gap: 0.25rem;
  }

  .toolbar-divider {
    width: 1px;
    height: 1.5rem;
    background: #cbd5e1;
  }

  .toolbar-btn {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    background: transparent;
    color: #475569;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .toolbar-btn:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }

  .toolbar-btn.active {
    background: #dbeafe;
    border-color: #93c5fd;
    color: #1e40af;
  }

  .toolbar-btn i {
    font-size: 1.125rem;
  }

  .btn-text {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .editor-content {
    min-height: 400px;
    max-height: 600px;
    overflow-y: auto;
    padding: 1.5rem;
    font-family: 'Calibri', 'Arial', sans-serif;
    font-size: 0.9375rem; /* 11pt equivalent */
    line-height: 1.6;
    color: #000000;
    outline: none;
  }

  .editor-content:empty:before {
    content: attr(data-placeholder);
    color: #94a3b8;
    font-style: italic;
  }

  /* Scrollbar styling */
  .editor-content::-webkit-scrollbar {
    width: 8px;
  }

  .editor-content::-webkit-scrollbar-track {
    background: #f1f5f9;
  }

  .editor-content::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .editor-content::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>

