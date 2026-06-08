<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { sendSectionChatMessage, parseSectionChatDoc } from '$lib/api/sectionChat.js';

  export let project;
  export let currentDraftHtml = '';

  const dispatch = createEventDispatcher();

  // ── State machine ─────────────────────────────────────────────────────────────
  // 'selecting' → user ticks paragraphs
  // 'chatting'  → chat interface active
  let panelState = 'selecting';

  // ── Paragraph selection ───────────────────────────────────────────────────────
  let allParagraphs = [];
  let scopedIds = new Set();

  $: allParagraphs = splitAllParagraphs(currentDraftHtml);
  $: selectedParagraphs = allParagraphs.filter(p => scopedIds.has(p.id));

  function splitAllParagraphs(html) {
    if (!html?.trim()) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstChild;
    if (!root) return [];
    const blocks = [];
    let idx = 0;
    root.childNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      const text = node.textContent.trim();
      if (text) blocks.push({ id: `p${idx++}`, html: node.outerHTML, text });
    });
    return blocks;
  }

  function getHeadingLevel(html) {
    const m = html.match(/^<h([1-6])/i);
    return m ? parseInt(m[1]) : null;
  }

  function selectSection(headingIdx) {
    const level = getHeadingLevel(allParagraphs[headingIdx].html);
    if (!level) return;
    const next = new Set(scopedIds);
    for (let i = headingIdx + 1; i < allParagraphs.length; i++) {
      const l = getHeadingLevel(allParagraphs[i].html);
      if (l && l <= level) break;
      next.add(allParagraphs[i].id);
    }
    scopedIds = next;
  }

  function deselectSection(headingIdx) {
    const level = getHeadingLevel(allParagraphs[headingIdx].html);
    if (!level) return;
    const next = new Set(scopedIds);
    for (let i = headingIdx + 1; i < allParagraphs.length; i++) {
      const l = getHeadingLevel(allParagraphs[i].html);
      if (l && l <= level) break;
      next.delete(allParagraphs[i].id);
    }
    scopedIds = next;
  }

  function isSectionSelected(headingIdx) {
    const level = getHeadingLevel(allParagraphs[headingIdx].html);
    if (!level) return false;
    for (let i = headingIdx + 1; i < allParagraphs.length; i++) {
      const l = getHeadingLevel(allParagraphs[i].html);
      if (l && l <= level) break;
      if (!scopedIds.has(allParagraphs[i].id)) return false;
    }
    return true;
  }

  function toggleParagraph(id) {
    const next = new Set(scopedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    scopedIds = next;
  }

  function selectAll() {
    scopedIds = new Set(allParagraphs.filter(p => !getHeadingLevel(p.html)).map(p => p.id));
  }

  function deselectAll() { scopedIds = new Set(); }

  $: allBodySelected = allParagraphs.filter(p => !getHeadingLevel(p.html)).every(p => scopedIds.has(p.id));

  // ── Source doc ────────────────────────────────────────────────────────────────
  let docInputTab = 'upload';
  let uploadFile = null;
  let uploadLabel = '';
  let pasteText = '';
  let pasteTitle = '';
  let docDragOver = false;
  let docFileInput;
  let docParsing = false;
  let docError = null;
  let docText = '';
  let docTitle = '';

  $: docReady = !!docText.trim();

  function onDrop(e) {
    e.preventDefault();
    docDragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleFile(file);
  }

  async function handleFile(file) {
    uploadFile = file;
    uploadLabel = file.name;
    docError = null;
    docParsing = true;
    try {
      const result = await parseSectionChatDoc(project.id, file);
      docText = result.text || '';
      docTitle = file.name;
    } catch (err) {
      docError = err.message;
      docText = '';
      docTitle = '';
    } finally {
      docParsing = false;
    }
  }

  function clearDoc() {
    uploadFile = null;
    uploadLabel = '';
    pasteText = '';
    pasteTitle = '';
    docText = '';
    docTitle = '';
    docError = null;
  }

  function confirmPaste() {
    if (!pasteText.trim()) return;
    docText = pasteText.trim();
    docTitle = pasteTitle.trim() || 'Pasted document';
  }

  // ── Chat ──────────────────────────────────────────────────────────────────────
  let messages = [];
  let inputText = '';
  let sending = false;
  let chatError = null;
  let chatEndEl;
  let previewExpanded = false;
  let applyMode = 'replace';

  $: latestHtml = [...messages].reverse().find(m => m.role === 'assistant' && m.sectionHtml)?.sectionHtml ?? null;
  $: if (messages.length && chatEndEl) tick().then(() => chatEndEl?.scrollIntoView({ behavior: 'smooth' }));

  function startChat() {
    if (!scopedIds.size) return;
    panelState = 'chatting';
  }

  function backToSelection() {
    panelState = 'selecting';
    messages = [];
    inputText = '';
    chatError = null;
    previewExpanded = false;
    latestHtml; // reset reactive
  }

  async function send() {
    const text = inputText.trim();
    if (!text || sending) return;

    const userMsg = { role: 'user', content: text, sectionHtml: null };
    messages = [...messages, userMsg];
    inputText = '';
    chatError = null;
    sending = true;

    try {
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
      const result = await sendSectionChatMessage({
        projectId: project.id,
        messages: apiMessages,
        paragraphs: selectedParagraphs.map(p => ({ id: p.id, html: p.html })),
        docText: docText || null,
        docTitle: docTitle || null,
      });

      messages = [...messages, {
        role: 'assistant',
        content: result.reply || '',
        sectionHtml: result.section_html || null,
      }];

      if (result.section_html) previewExpanded = true;
    } catch (err) {
      chatError = err.message;
      messages = messages.slice(0, -1);
      inputText = text;
    } finally {
      sending = false;
    }
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function applyToSection() {
    if (!latestHtml) return;
    dispatch('apply', {
      selected_paragraphs: selectedParagraphs,
      new_html: latestHtml,
      mode: applyMode,
    });
  }
</script>

<div class="sc-panel">
  <div class="sc-header">
    <span class="sc-title">
      <i class="las la-comments"></i>
      {panelState === 'selecting' ? 'Select paragraphs' : 'Doc Chat'}
    </span>
    <button class="sc-close" on:click={() => dispatch('close')} title="Close"><i class="las la-times"></i></button>
  </div>

  <!-- ── SELECTING STATE ──────────────────────────────────────────────────────── -->
  {#if panelState === 'selecting'}
    {#if allParagraphs.length === 0}
      <div class="sc-empty">
        <i class="las la-file-alt"></i>
        <p>No draft content yet. Generate the document first, then open Doc Chat to target specific paragraphs.</p>
      </div>
    {:else}
      <div class="scoped-instruct-row">
        <p class="scoped-instruct">Tick the paragraphs you want to update, then start the chat.</p>
        <div class="scoped-select-all">
          {#if allBodySelected}
            <button class="scoped-selectall-btn" on:click={deselectAll}>Deselect all</button>
          {:else}
            <button class="scoped-selectall-btn" on:click={selectAll}>Select all</button>
          {/if}
        </div>
      </div>

      <div class="scoped-list">
        {#each allParagraphs as para, idx}
          {@const checked = scopedIds.has(para.id)}
          {@const headingLevel = getHeadingLevel(para.html)}
          {#if headingLevel}
            <div class="scoped-heading">
              <span class="scoped-heading-text">{para.text}</span>
              <button class="scoped-section-btn" on:click={() => isSectionSelected(idx) ? deselectSection(idx) : selectSection(idx)}>
                {isSectionSelected(idx) ? 'Deselect' : 'Select'}
              </button>
            </div>
          {:else}
            <label class="scoped-item" class:selected={checked}>
              <input type="checkbox" {checked} on:change={() => toggleParagraph(para.id)} />
              <span class="scoped-item-text">{para.text.slice(0, 120)}{para.text.length > 120 ? '…' : ''}</span>
            </label>
          {/if}
        {/each}
      </div>

      <div class="scoped-actions">
        <button class="btn-primary" disabled={scopedIds.size === 0} on:click={startChat}>
          <i class="las la-comments"></i> Chat about {scopedIds.size} paragraph{scopedIds.size !== 1 ? 's' : ''}
        </button>
      </div>
    {/if}

  <!-- ── CHATTING STATE ───────────────────────────────────────────────────────── -->
  {:else}
    <!-- Selection summary -->
    <div class="sc-selection-bar">
      <span class="sc-selection-count"><i class="las la-check-square"></i> {selectedParagraphs.length} paragraph{selectedParagraphs.length !== 1 ? 's' : ''} selected</span>
      <button class="sc-change-btn" on:click={backToSelection}><i class="las la-edit"></i> Change</button>
    </div>

    <!-- Doc area -->
    {#if docReady}
      <div class="sc-doc-loaded">
        <i class="las la-file-alt"></i>
        <span class="sc-doc-name">{docTitle}</span>
        <button class="sc-doc-remove" on:click={clearDoc} title="Remove"><i class="las la-times"></i></button>
      </div>
    {:else}
      <div class="sc-doc-area">
        <div class="sc-doc-tabs">
          <button class="sc-doc-tab" class:active={docInputTab === 'upload'} on:click={() => docInputTab = 'upload'}>Upload doc</button>
          <button class="sc-doc-tab" class:active={docInputTab === 'paste'} on:click={() => docInputTab = 'paste'}>Paste text</button>
        </div>
        {#if docInputTab === 'upload'}
          <div
            class="sc-dropzone"
            class:drag-over={docDragOver}
            on:dragover|preventDefault={() => docDragOver = true}
            on:dragleave={() => docDragOver = false}
            on:drop={onDrop}
            on:click={() => docFileInput.click()}
            role="button" tabindex="0"
            on:keydown={(e) => e.key === 'Enter' && docFileInput.click()}
          >
            {#if docParsing}
              <div class="mini-spinner"></div><span>Parsing…</span>
            {:else if uploadLabel}
              <i class="las la-check-circle" style="color:var(--success,#16a34a)"></i><span>{uploadLabel}</span>
            {:else}
              <i class="las la-cloud-upload-alt"></i>
              <span>Drop file or click to upload</span>
              <span class="sc-drop-hint">PDF, Word, or text</span>
            {/if}
          </div>
          <input type="file" bind:this={docFileInput} on:change={onFileChange} style="display:none" accept=".pdf,.doc,.docx,.txt,.md" />
        {:else}
          <div class="sc-paste-area">
            <input class="sc-paste-title" type="text" bind:value={pasteTitle} placeholder="Document title (optional)" />
            <textarea class="sc-paste-text" bind:value={pasteText} placeholder="Paste document text here…" rows="4"></textarea>
            <button class="sc-paste-confirm" on:click={confirmPaste} disabled={!pasteText.trim()}>Use this text</button>
          </div>
        {/if}
        {#if docError}<div class="sc-error">{docError}</div>{/if}
      </div>
    {/if}

    <!-- Chat history -->
    <div class="sc-messages">
      {#if messages.length === 0}
        <div class="sc-empty">
          <i class="las la-comment-dots"></i>
          <p>Tell Claude what to do with the selected paragraphs{docReady ? ' using the uploaded document' : ''}.</p>
        </div>
      {:else}
        {#each messages as msg (msg)}
          {#if msg.role === 'user'}
            <div class="sc-msg sc-msg--user">
              <div class="sc-bubble sc-bubble--user">{msg.content}</div>
            </div>
          {:else}
            <div class="sc-msg sc-msg--assistant">
              {#if msg.content}
                <div class="sc-bubble sc-bubble--assistant">{msg.content}</div>
              {/if}
              {#if msg.sectionHtml}
                <div class="sc-draft-toggle">
                  <button class="sc-draft-toggle-btn" on:click={() => previewExpanded = !previewExpanded}>
                    <i class="las la-file-code"></i> Updated draft
                    <i class="las la-angle-{previewExpanded ? 'up' : 'down'}"></i>
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        {/each}
        <div bind:this={chatEndEl}></div>
      {/if}
    </div>

    <!-- Draft preview -->
    {#if latestHtml && previewExpanded}
      <div class="sc-preview">
        <div class="sc-preview-header">
          <span class="sc-preview-label">Current draft</span>
          <button class="sc-preview-close" on:click={() => previewExpanded = false}><i class="las la-angle-down"></i></button>
        </div>
        <div class="sc-preview-body">{@html latestHtml}</div>
      </div>
    {/if}

    <!-- Apply bar -->
    {#if latestHtml}
      <div class="sc-apply-bar">
        <div class="sc-mode-toggle">
          <button class="sc-mode-btn" class:active={applyMode === 'replace'} on:click={() => applyMode = 'replace'}>Replace</button>
          <button class="sc-mode-btn" class:active={applyMode === 'add'} on:click={() => applyMode = 'add'}>Add</button>
        </div>
        <button class="sc-apply-btn" on:click={applyToSection}>
          <i class="las la-check"></i> Apply to draft
        </button>
      </div>
    {/if}

    <!-- Input area -->
    <div class="sc-input-area">
      {#if chatError}<div class="sc-error sc-error--chat">{chatError}</div>{/if}
      <div class="sc-input-row">
        <textarea
          class="sc-input"
          bind:value={inputText}
          on:keydown={onKeydown}
          placeholder="Describe what to do with the selected paragraphs…"
          rows="2"
          disabled={sending}
        ></textarea>
        <button class="sc-send-btn" on:click={send} disabled={sending || !inputText.trim()}>
          {#if sending}<div class="mini-spinner"></div>{:else}<i class="las la-paper-plane"></i>{/if}
        </button>
      </div>
      <p class="sc-hint">Shift+Enter for new line · Enter to send</p>
    </div>
  {/if}
</div>

<style>
  .sc-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fff;
    border-left: 1px solid #e5e7eb;
    font-size: 0.8125rem;
  }

  /* Header */
  .sc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    flex-shrink: 0;
  }
  .sc-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .sc-close {
    background: none; border: none; cursor: pointer;
    color: #6b7280; font-size: 1.1rem; padding: 0.2rem; line-height: 1;
  }
  .sc-close:hover { color: #111827; }

  /* Empty state */
  .sc-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; gap: 0.5rem;
    color: #9ca3af; padding: 2rem 1rem; flex: 1;
  }
  .sc-empty i { font-size: 2rem; }
  .sc-empty p { margin: 0; font-size: 0.8rem; max-width: 240px; }

  /* Paragraph selection (matches incorporate panel style) */
  .scoped-instruct-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.5rem 1rem; gap: 0.5rem; flex-shrink: 0;
    border-bottom: 1px solid #e5e7eb; background: #fafafa;
  }
  .scoped-instruct { margin: 0; font-size: 0.75rem; color: #6b7280; }
  .scoped-selectall-btn {
    font-size: 0.72rem; padding: 0.2rem 0.5rem;
    background: none; border: 1px solid #d1d5db; border-radius: 4px;
    color: #374151; cursor: pointer; white-space: nowrap;
  }
  .scoped-selectall-btn:hover { background: #f3f4f6; }

  .scoped-list {
    flex: 1; overflow-y: auto; padding: 0.25rem 0;
  }
  .scoped-heading {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.4rem 1rem; background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb; gap: 0.5rem;
  }
  .scoped-heading-text {
    font-size: 0.78rem; font-weight: 600; color: #111827; flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .scoped-section-btn {
    font-size: 0.7rem; padding: 0.15rem 0.45rem; white-space: nowrap;
    background: none; border: 1px solid #d1d5db; border-radius: 3px;
    color: #374151; cursor: pointer; flex-shrink: 0;
  }
  .scoped-section-btn:hover { background: #e5e7eb; }

  .scoped-item {
    display: flex; align-items: flex-start; gap: 0.5rem;
    padding: 0.35rem 1rem; cursor: pointer;
    border-bottom: 1px solid #f3f4f6; transition: background 0.1s;
  }
  .scoped-item:hover { background: #f9fafb; }
  .scoped-item.selected { background: #eff6ff; }
  .scoped-item input[type="checkbox"] { margin-top: 0.1rem; flex-shrink: 0; }
  .scoped-item-text { font-size: 0.76rem; color: #374151; line-height: 1.4; }

  .scoped-actions {
    padding: 0.75rem 1rem; border-top: 1px solid #e5e7eb; flex-shrink: 0;
  }
  .btn-primary {
    width: 100%; padding: 0.45rem; font-size: 0.82rem; font-weight: 600;
    background: #1d4ed8; color: #fff; border: none; border-radius: 5px;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary:not(:disabled):hover { background: #1e40af; }

  /* Selection summary bar */
  .sc-selection-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.45rem 1rem; border-bottom: 1px solid #e5e7eb;
    background: #eff6ff; flex-shrink: 0;
  }
  .sc-selection-count { font-size: 0.75rem; font-weight: 500; color: #1d4ed8; }
  .sc-change-btn {
    font-size: 0.72rem; padding: 0.2rem 0.5rem; background: none;
    border: 1px solid #bfdbfe; border-radius: 4px; color: #1d4ed8; cursor: pointer;
    display: flex; align-items: center; gap: 0.25rem;
  }
  .sc-change-btn:hover { background: #dbeafe; }

  /* Doc area */
  .sc-doc-area {
    border-bottom: 1px solid #e5e7eb; flex-shrink: 0;
    padding: 0.5rem 1rem 0.6rem; background: #fafafa;
  }
  .sc-doc-tabs { display: flex; gap: 0.25rem; margin-bottom: 0.5rem; }
  .sc-doc-tab {
    font-size: 0.75rem; padding: 0.2rem 0.6rem;
    border: 1px solid #d1d5db; border-radius: 4px;
    background: #fff; color: #6b7280; cursor: pointer;
  }
  .sc-doc-tab.active { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
  .sc-dropzone {
    border: 1.5px dashed #d1d5db; border-radius: 6px; padding: 0.65rem;
    text-align: center; cursor: pointer; display: flex; flex-direction: column;
    align-items: center; gap: 0.2rem; color: #6b7280; font-size: 0.78rem;
    transition: border-color 0.15s, background 0.15s;
  }
  .sc-dropzone:hover, .sc-dropzone.drag-over { border-color: #1d4ed8; background: #eff6ff; color: #1d4ed8; }
  .sc-dropzone i { font-size: 1.2rem; }
  .sc-drop-hint { font-size: 0.68rem; color: #9ca3af; }
  .sc-paste-area { display: flex; flex-direction: column; gap: 0.35rem; }
  .sc-paste-title {
    font-size: 0.78rem; padding: 0.3rem 0.5rem;
    border: 1px solid #d1d5db; border-radius: 4px;
  }
  .sc-paste-text {
    font-size: 0.76rem; padding: 0.35rem 0.5rem;
    border: 1px solid #d1d5db; border-radius: 4px; resize: vertical; font-family: inherit;
  }
  .sc-paste-confirm {
    align-self: flex-end; font-size: 0.76rem; padding: 0.25rem 0.65rem;
    background: #1d4ed8; color: #fff; border: none; border-radius: 4px; cursor: pointer;
  }
  .sc-paste-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  .sc-doc-loaded {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.45rem 1rem; border-bottom: 1px solid #e5e7eb;
    background: #f0fdf4; flex-shrink: 0;
  }
  .sc-doc-loaded i { color: #16a34a; }
  .sc-doc-name {
    flex: 1; font-size: 0.76rem; color: #15803d; font-weight: 500;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sc-doc-remove {
    background: none; border: none; cursor: pointer; color: #6b7280; font-size: 0.9rem; padding: 0.1rem;
  }
  .sc-doc-remove:hover { color: #ef4444; }

  /* Messages */
  .sc-messages {
    flex: 1; overflow-y: auto; padding: 0.75rem 1rem;
    display: flex; flex-direction: column; gap: 0.6rem; min-height: 0;
  }
  .sc-msg { display: flex; }
  .sc-msg--user { justify-content: flex-end; }
  .sc-msg--assistant { flex-direction: column; gap: 0.3rem; }
  .sc-bubble {
    padding: 0.45rem 0.65rem; border-radius: 10px;
    line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-width: 88%;
  }
  .sc-bubble--user { background: #1d4ed8; color: #fff; border-bottom-right-radius: 3px; }
  .sc-bubble--assistant { background: #f3f4f6; color: #111827; border-bottom-left-radius: 3px; }
  .sc-draft-toggle { display: flex; }
  .sc-draft-toggle-btn {
    display: flex; align-items: center; gap: 0.35rem;
    font-size: 0.74rem; padding: 0.22rem 0.55rem;
    background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 5px; cursor: pointer;
  }
  .sc-draft-toggle-btn:hover { background: #dbeafe; }

  /* Preview */
  .sc-preview {
    border-top: 1px solid #e5e7eb; flex-shrink: 0; max-height: 32%;
    display: flex; flex-direction: column; background: #fff;
  }
  .sc-preview-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.35rem 1rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb;
  }
  .sc-preview-label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
  .sc-preview-close { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 0.85rem; }
  .sc-preview-body { overflow-y: auto; padding: 0.65rem 1rem; font-size: 0.78rem; line-height: 1.6; color: #111827; }
  :global(.sc-preview-body h2) { font-size: 0.9rem; font-weight: 700; margin: 0.4rem 0 0.2rem; }
  :global(.sc-preview-body h3) { font-size: 0.82rem; font-weight: 600; margin: 0.35rem 0 0.15rem; }
  :global(.sc-preview-body p)  { margin: 0 0 0.4rem; }

  /* Apply bar */
  .sc-apply-bar {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.45rem 1rem; border-top: 1px solid #e5e7eb;
    background: #f9fafb; flex-shrink: 0;
  }
  .sc-mode-toggle { display: flex; border: 1px solid #d1d5db; border-radius: 5px; overflow: hidden; }
  .sc-mode-btn {
    padding: 0.25rem 0.6rem; font-size: 0.74rem;
    border: none; background: #fff; color: #6b7280; cursor: pointer;
  }
  .sc-mode-btn.active { background: #1d4ed8; color: #fff; }
  .sc-apply-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    padding: 0.32rem 0.75rem; font-size: 0.78rem; font-weight: 600;
    background: #16a34a; color: #fff; border: none; border-radius: 5px; cursor: pointer;
  }
  .sc-apply-btn:hover { background: #15803d; }

  /* Input */
  .sc-input-area {
    padding: 0.45rem 0.75rem 0.45rem; border-top: 1px solid #e5e7eb;
    flex-shrink: 0; background: #fff;
  }
  .sc-input-row { display: flex; gap: 0.35rem; align-items: flex-end; }
  .sc-input {
    flex: 1; padding: 0.4rem 0.55rem; border: 1px solid #d1d5db; border-radius: 6px;
    font-size: 0.78rem; font-family: inherit; resize: none; line-height: 1.5; min-height: 2.5rem;
  }
  .sc-input:focus { outline: none; border-color: #1d4ed8; box-shadow: 0 0 0 2px #dbeafe; }
  .sc-input:disabled { background: #f9fafb; color: #9ca3af; }
  .sc-send-btn {
    width: 2.2rem; height: 2.2rem; flex-shrink: 0;
    background: #1d4ed8; color: #fff; border: none; border-radius: 6px;
    cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;
  }
  .sc-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sc-send-btn:not(:disabled):hover { background: #1e40af; }
  .sc-hint { margin: 0.25rem 0 0; font-size: 0.66rem; color: #9ca3af; text-align: right; }

  .sc-error {
    font-size: 0.73rem; color: #dc2626; background: #fef2f2;
    border: 1px solid #fecaca; border-radius: 4px; padding: 0.28rem 0.45rem; margin-bottom: 0.35rem;
  }

  .mini-spinner {
    width: 0.9rem; height: 0.9rem; border: 2px solid currentColor;
    border-top-color: transparent; border-radius: 50%;
    animation: spin 0.6s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
