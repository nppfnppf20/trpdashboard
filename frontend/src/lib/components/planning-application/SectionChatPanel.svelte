<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { diffArrays, diffWords } from 'diff';
  import { sendSectionChatMessage, parseSectionChatDoc } from '$lib/api/sectionChat.js';

  export let project;
  export let docTypeSlug = 'planning_statement';
  export let currentDraftHtml = '';

  const dispatch = createEventDispatcher();

  // ── State machine ─────────────────────────────────────────────────────────────
  // 'selecting' → user ticks paragraphs from draft
  // 'chatting'  → multi-turn chat
  // 'reviewing' → tracked-changes diff view (same as incorporate panel)
  let panelState = 'selecting';

  // Snapshot of draft HTML at the moment the user enters chatting state.
  // Keeps paragraph IDs stable while the user chats.
  let draftSnapshot = '';

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
    uploadFile = null; uploadLabel = '';
    pasteText = ''; pasteTitle = '';
    docText = ''; docTitle = ''; docError = null;
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
  let applyMode = 'replace';

  $: latestHtml = [...messages].reverse().find(m => m.role === 'assistant' && m.sectionHtml)?.sectionHtml ?? null;
  $: if (messages.length && chatEndEl) tick().then(() => chatEndEl?.scrollIntoView({ behavior: 'smooth' }));

  function startChat() {
    if (!scopedIds.size) return;
    draftSnapshot = currentDraftHtml;
    panelState = 'chatting';
  }

  function backToSelection() {
    panelState = 'selecting';
    messages = [];
    inputText = '';
    chatError = null;
  }

  async function send() {
    const text = inputText.trim();
    if (!text || sending) return;

    messages = [...messages, { role: 'user', content: text, sectionHtml: null }];
    inputText = '';
    chatError = null;
    sending = true;

    try {
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
      const result = await sendSectionChatMessage({
        projectId: project.id,
        docTypeSlug,
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
      // Auto-jump to tracked-changes review as soon as AI produces a draft
      if (result.section_html) {
        await reviewChanges(result.section_html);
      }
    } catch (err) {
      chatError = err.message;
      messages = messages.slice(0, -1);
      inputText = inputText || messages[messages.length - 1]?.content || '';
    } finally {
      sending = false;
    }
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // ── Diff / review ─────────────────────────────────────────────────────────────
  let changeGroups = [];
  let reviewError = null;
  let reviewRowsEl;

  $: changedCount  = changeGroups.filter(g => g.type !== 'unchanged').length;
  $: acceptedCount = changeGroups.filter(g => g.type !== 'unchanged' && g.accepted).length;

  function splitIntoParagraphs(html) {
    if (!html?.trim()) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const blocks = [];
    doc.body.firstChild?.childNodes.forEach(node => {
      if (node.nodeType === 1) blocks.push(node.outerHTML);
      else if (node.nodeType === 3 && node.textContent.trim()) blocks.push(`<p>${node.textContent.trim()}</p>`);
    });
    return blocks;
  }

  function stripHtml(html) { return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function wordDiff(oldHtml, newHtml) { return diffWords(stripHtml(oldHtml), stripHtml(newHtml)); }

  function computeParagraphDiff(oldHtml, newHtml) {
    const oldParas = splitIntoParagraphs(oldHtml);
    const newParas = splitIntoParagraphs(newHtml);
    const raw = diffArrays(oldParas, newParas);
    const groups = [];
    let i = 0;
    while (i < raw.length) {
      const part = raw[i];
      if (part.removed && i + 1 < raw.length && raw[i + 1].added) {
        const oldVals = part.value, newVals = raw[i + 1].value;
        const pairs = Math.min(oldVals.length, newVals.length);
        for (let j = 0; j < pairs; j++)
          groups.push({ type: 'modified', oldHtml: oldVals[j], newHtml: newVals[j], accepted: true, words: wordDiff(oldVals[j], newVals[j]) });
        for (let j = pairs; j < oldVals.length; j++)
          groups.push({ type: 'removed',  html: oldVals[j],  accepted: true, words: wordDiff(oldVals[j], '') });
        for (let j = pairs; j < newVals.length; j++)
          groups.push({ type: 'added',    html: newVals[j],  accepted: true, words: wordDiff('', newVals[j]) });
        i += 2;
      } else if (part.removed) {
        for (const html of part.value) groups.push({ type: 'removed', html, accepted: true, words: wordDiff(html, '') });
        i++;
      } else if (part.added) {
        for (const html of part.value) groups.push({ type: 'added', html, accepted: true, words: wordDiff('', html) });
        i++;
      } else {
        for (const html of part.value) groups.push({ type: 'unchanged', html });
        i++;
      }
    }
    return groups;
  }

  function buildFinalHtml(groups) {
    return groups.map(g => {
      if (g.type === 'unchanged') return g.html;
      if (g.type === 'added')    return g.accepted ? g.html : '';
      if (g.type === 'removed')  return g.accepted ? '' : g.html;
      if (g.type === 'modified') return g.accepted ? g.newHtml : g.oldHtml;
      return '';
    }).filter(Boolean).join('\n');
  }

  function computeNewDraftHtml(newSectionHtml, mode) {
    const base = draftSnapshot || '';
    if (!base.trim()) return newSectionHtml;

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${base}</div>`, 'text/html');
    const allNodes = Array.from(doc.body.firstChild?.childNodes ?? [])
      .filter(n => n.nodeType === 1 && n.textContent.trim());
    const paras = allNodes.map((node, idx) => ({ id: `p${idx}`, html: node.outerHTML }));

    const selectedIds = new Set(selectedParagraphs.map(p => p.id));
    const selectedIndices = paras.map((p, i) => selectedIds.has(p.id) ? i : -1).filter(i => i >= 0);

    if (!selectedIndices.length) return base + '\n' + newSectionHtml;

    const firstIdx = selectedIndices[0];
    const lastIdx  = selectedIndices[selectedIndices.length - 1];
    const before = paras.slice(0, firstIdx).map(p => p.html).join('\n');
    const after  = paras.slice(lastIdx + 1).map(p => p.html).join('\n');

    if (mode === 'replace') {
      return [before, newSectionHtml, after].filter(Boolean).join('\n');
    } else {
      const kept = paras.slice(firstIdx, lastIdx + 1).map(p => p.html).join('\n');
      return [before, kept, newSectionHtml, after].filter(Boolean).join('\n');
    }
  }

  async function reviewChanges(htmlOverride = null) {
    const html = htmlOverride ?? latestHtml;
    if (!html) return;
    reviewError = null;
    const newDraftHtml = computeNewDraftHtml(html, applyMode);
    changeGroups = computeParagraphDiff(draftSnapshot || '', newDraftHtml);
    panelState = 'reviewing';
    dispatch('reviewchange', { active: true });
    await tick();
    reviewRowsEl?.querySelector('.review-row--changed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleGroup(idx) {
    changeGroups = changeGroups.map((g, i) => i === idx ? { ...g, accepted: !g.accepted } : g);
  }

  function acceptAll() {
    changeGroups = changeGroups.map(g => g.type === 'unchanged' ? g : { ...g, accepted: true });
    commitAccepted();
  }

  function commitAccepted() {
    const html = buildFinalHtml(changeGroups);
    dispatch('accepted', { html });
    discardReview();
  }

  function discardReview() {
    changeGroups = [];
    panelState = 'chatting';
    dispatch('reviewchange', { active: false });
  }
</script>

<div class="sc-panel">
  <div class="sc-header">
    <span class="sc-title">
      <i class="las la-comments"></i>
      {#if panelState === 'selecting'}Select paragraphs{:else if panelState === 'reviewing'}Review changes{:else}Doc Chat{/if}
    </span>
    <button class="sc-close" on:click={() => dispatch('close')} title="Close"><i class="las la-times"></i></button>
  </div>

  <!-- ── SELECTING ──────────────────────────────────────────────────────────────── -->
  {#if panelState === 'selecting'}
    {#if allParagraphs.length === 0}
      <div class="sc-empty">
        <i class="las la-file-alt"></i>
        <p>No draft content yet. Generate the document first, then open Doc Chat to target specific paragraphs.</p>
      </div>
    {:else}
      <div class="sc-selecting-body">
        <div class="scoped-instruct-row">
          <p class="scoped-instruct">Tick the paragraphs you want to update, then start the chat.</p>
          <div class="scoped-select-all">
            {#if allBodySelected}
              <button class="scoped-selectall-btn" on:click={() => scopedIds = new Set()}>Deselect all</button>
            {:else}
              <button class="scoped-selectall-btn" on:click={() => scopedIds = new Set(allParagraphs.filter(p => !getHeadingLevel(p.html)).map(p => p.id))}>Select all</button>
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
      </div>
    {/if}

  <!-- ── CHATTING ───────────────────────────────────────────────────────────────── -->
  {:else if panelState === 'chatting'}
    <div class="sc-selection-bar">
      <span class="sc-selection-count"><i class="las la-check-square"></i> {selectedParagraphs.length} paragraph{selectedParagraphs.length !== 1 ? 's' : ''} selected</span>
      <button class="sc-change-btn" on:click={backToSelection}><i class="las la-edit"></i> Change</button>
    </div>

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
            class="sc-dropzone" class:drag-over={docDragOver}
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
              <i class="las la-check-circle" style="color:#16a34a"></i><span>{uploadLabel}</span>
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
            </div>
          {/if}
        {/each}
        <div bind:this={chatEndEl}></div>
      {/if}
    </div>

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

  <!-- ── REVIEWING ──────────────────────────────────────────────────────────────── -->
  {:else if panelState === 'reviewing'}
    <div class="review-layout">
      <div class="review-bar">
        <div class="review-bar-left">
          <span class="review-bar-count">{acceptedCount}/{changedCount} changes accepted</span>
          <div class="sc-mode-toggle">
            <button class="sc-mode-btn" class:active={applyMode === 'replace'} on:click={() => { applyMode = 'replace'; reviewChanges(); }}>Replace</button>
            <button class="sc-mode-btn" class:active={applyMode === 'add'} on:click={() => { applyMode = 'add'; reviewChanges(); }}>Add</button>
          </div>
        </div>
        <div class="review-bar-actions">
          <button class="btn-discard" on:click={discardReview}>Back to chat</button>
          <button class="btn-accept-all" on:click={acceptAll}><i class="las la-check-double"></i> Accept all</button>
          <button class="btn-commit" disabled={acceptedCount === 0} on:click={commitAccepted}><i class="las la-check"></i> Apply</button>
        </div>
      </div>

      {#if reviewError}<p class="error-msg">{reviewError}</p>{/if}

      <div class="review-rows" bind:this={reviewRowsEl}>
        {#if changeGroups.length === 0}
          <p class="diff-no-changes">No changes detected.</p>
        {:else}
          {#each changeGroups as group, idx}
            <div class="review-row" class:review-row--changed={group.type !== 'unchanged'}>
              <div class="review-row-doc" class:review-row-doc--unchanged={group.type === 'unchanged'}>
                {#if group.type === 'unchanged'}
                  {@html group.html}
                {:else if group.type === 'added'}
                  <div class="doc-para-change {group.accepted ? 'doc-para-added' : ''}">
                    <div class="word-diff">{#each group.words as w}{#if w.added}<ins class="wd-add">{w.value}</ins>{:else if w.removed}{:else}<span>{w.value}</span>{/if}{/each}</div>
                  </div>
                {:else if group.type === 'removed'}
                  {#if group.accepted}
                    <div class="doc-para-change doc-para-removed"><div class="word-diff">{#each group.words as w}{#if w.removed}<del class="wd-del">{w.value}</del>{:else if w.added}{:else}<span>{w.value}</span>{/if}{/each}</div></div>
                  {:else}
                    <div class="doc-para-kept">{@html group.html}</div>
                  {/if}
                {:else if group.type === 'modified'}
                  {#if group.accepted}
                    <div class="doc-para-change doc-para-modified"><div class="word-diff">{#each group.words as w}{#if w.added}<ins class="wd-add">{w.value}</ins>{:else if w.removed}<del class="wd-del">{w.value}</del>{:else}<span>{w.value}</span>{/if}{/each}</div></div>
                  {:else}
                    <div class="doc-para-change doc-para-kept-original">{@html group.oldHtml}</div>
                  {/if}
                {/if}
              </div>
              <div class="review-row-ctrl">
                {#if group.type !== 'unchanged'}
                  <div class="ctrl-card" class:rejected={!group.accepted}>
                    <div class="ctrl-card-tag">
                      {#if group.type === 'added'}<span class="change-tag change-tag--added">+ Added</span>
                      {:else if group.type === 'removed'}<span class="change-tag change-tag--removed">− Removed</span>
                      {:else}<span class="change-tag change-tag--modified">~ Modified</span>{/if}
                    </div>
                    <div class="para-btns">
                      {#if group.type === 'added'}
                        <button class="para-btn para-btn--accept" class:active={group.accepted} on:click={() => !group.accepted && toggleGroup(idx)}>Accept</button>
                        <button class="para-btn para-btn--reject" class:active={!group.accepted} on:click={() => group.accepted && toggleGroup(idx)}>Reject</button>
                      {:else if group.type === 'removed'}
                        <button class="para-btn para-btn--accept" class:active={group.accepted} on:click={() => !group.accepted && toggleGroup(idx)}>Accept removal</button>
                        <button class="para-btn para-btn--reject" class:active={!group.accepted} on:click={() => group.accepted && toggleGroup(idx)}>Keep</button>
                      {:else}
                        <button class="para-btn para-btn--accept" class:active={group.accepted} on:click={() => !group.accepted && toggleGroup(idx)}>Accept</button>
                        <button class="para-btn para-btn--reject" class:active={!group.accepted} on:click={() => group.accepted && toggleGroup(idx)}>Keep original</button>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .sc-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: #f8fafc; }
  .sc-selecting-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }

  /* Header */
  .sc-header { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 1rem; border-bottom: 1px solid #e2e8f0; background: white; flex-shrink: 0; }
  .sc-title { font-weight: 600; font-size: 0.875rem; color: #111827; display: flex; align-items: center; gap: 0.4rem; }
  .sc-close { background: none; border: none; cursor: pointer; color: #6b7280; font-size: 1.1rem; padding: 0.2rem; line-height: 1; }
  .sc-close:hover { color: #111827; }

  /* Empty */
  .sc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 0.5rem; color: #9ca3af; padding: 2rem 1rem; flex: 1; }
  .sc-empty i { font-size: 2rem; }
  .sc-empty p { margin: 0; font-size: 0.8rem; max-width: 240px; }

  /* Paragraph selection */
  .scoped-instruct-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 1rem; gap: 0.5rem; flex-shrink: 0; border-bottom: 1px solid #e2e8f0; background: white; }
  .scoped-instruct { margin: 0; font-size: 0.75rem; color: #64748b; }
  .scoped-selectall-btn { font-size: 0.72rem; padding: 0.2rem 0.5rem; background: none; border: 1px solid #e2e8f0; border-radius: 4px; color: #374151; cursor: pointer; white-space: nowrap; }
  .scoped-selectall-btn:hover { background: #f1f5f9; }
  .scoped-list { flex: 1; overflow-y: auto; padding: 0.25rem 0; min-height: 0; }
  .scoped-heading { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 1rem; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; gap: 0.5rem; }
  .scoped-heading-text { font-size: 0.78rem; font-weight: 600; color: #1e293b; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scoped-section-btn { font-size: 0.7rem; padding: 0.15rem 0.45rem; white-space: nowrap; background: none; border: 1px solid #e2e8f0; border-radius: 3px; color: #374151; cursor: pointer; flex-shrink: 0; }
  .scoped-section-btn:hover { background: #e2e8f0; }
  .scoped-item { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.35rem 1rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.1s; }
  .scoped-item:hover { background: #f8fafc; }
  .scoped-item.selected { background: #eff6ff; }
  .scoped-item input[type="checkbox"] { margin-top: 0.1rem; flex-shrink: 0; }
  .scoped-item-text { font-size: 0.76rem; color: #374151; line-height: 1.4; }
  .scoped-actions { padding: 0.75rem 1rem; border-top: 1px solid #e2e8f0; flex-shrink: 0; background: white; }
  .btn-primary { width: 100%; padding: 0.45rem; font-size: 0.82rem; font-weight: 600; background: #7c3aed; color: #fff; border: none; border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-family: inherit; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary:not(:disabled):hover { background: #6d28d9; }

  /* Selection summary bar */
  .sc-selection-bar { display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 1rem; border-bottom: 1px solid #e2e8f0; background: #eff6ff; flex-shrink: 0; }
  .sc-selection-count { font-size: 0.75rem; font-weight: 500; color: #1d4ed8; }
  .sc-change-btn { font-size: 0.72rem; padding: 0.2rem 0.5rem; background: none; border: 1px solid #bfdbfe; border-radius: 4px; color: #1d4ed8; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; }
  .sc-change-btn:hover { background: #dbeafe; }

  /* Doc area */
  .sc-doc-area { border-bottom: 1px solid #e2e8f0; flex-shrink: 0; padding: 0.5rem 1rem 0.6rem; background: white; }
  .sc-doc-tabs { display: flex; gap: 0.25rem; margin-bottom: 0.5rem; }
  .sc-doc-tab { font-size: 0.75rem; padding: 0.2rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 4px; background: white; color: #64748b; cursor: pointer; }
  .sc-doc-tab.active { background: #7c3aed; border-color: #7c3aed; color: #fff; }
  .sc-dropzone { border: 1.5px dashed #cbd5e1; border-radius: 6px; padding: 0.65rem; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; color: #64748b; font-size: 0.78rem; transition: border-color 0.15s, background 0.15s; }
  .sc-dropzone:hover, .sc-dropzone.drag-over { border-color: #7c3aed; background: #f5f3ff; color: #7c3aed; }
  .sc-dropzone i { font-size: 1.2rem; }
  .sc-drop-hint { font-size: 0.68rem; color: #94a3b8; }
  .sc-paste-area { display: flex; flex-direction: column; gap: 0.35rem; }
  .sc-paste-title { font-size: 0.78rem; padding: 0.3rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; }
  .sc-paste-text { font-size: 0.76rem; padding: 0.35rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; resize: vertical; font-family: inherit; }
  .sc-paste-confirm { align-self: flex-end; font-size: 0.76rem; padding: 0.25rem 0.65rem; background: #7c3aed; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  .sc-paste-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
  .sc-doc-loaded { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 1rem; border-bottom: 1px solid #e2e8f0; background: #f0fdf4; flex-shrink: 0; }
  .sc-doc-loaded i { color: #16a34a; }
  .sc-doc-name { flex: 1; font-size: 0.76rem; color: #15803d; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-doc-remove { background: none; border: none; cursor: pointer; color: #64748b; font-size: 0.9rem; padding: 0.1rem; }
  .sc-doc-remove:hover { color: #ef4444; }

  /* Chat */
  .sc-messages { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; }
  .sc-msg { display: flex; }
  .sc-msg--user { justify-content: flex-end; }
  .sc-msg--assistant { flex-direction: column; gap: 0.3rem; }
  .sc-bubble { padding: 0.45rem 0.65rem; border-radius: 10px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-width: 88%; font-size: 0.8rem; }
  .sc-bubble--user { background: #7c3aed; color: #fff; border-bottom-right-radius: 3px; }
  .sc-bubble--assistant { background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 3px; }
  /* Mode toggle (in review bar) */
  .sc-mode-toggle { display: flex; border: 1px solid #e2e8f0; border-radius: 5px; overflow: hidden; }
  .sc-mode-btn { padding: 0.2rem 0.5rem; font-size: 0.7rem; border: none; background: white; color: #64748b; cursor: pointer; }
  .sc-mode-btn.active { background: #7c3aed; color: #fff; }

  /* Input */
  .sc-input-area { padding: 0.45rem 0.75rem; border-top: 1px solid #e2e8f0; flex-shrink: 0; background: white; }
  .sc-input-row { display: flex; gap: 0.35rem; align-items: flex-end; }
  .sc-input { flex: 1; padding: 0.4rem 0.55rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.78rem; font-family: inherit; resize: none; line-height: 1.5; min-height: 2.5rem; }
  .sc-input:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 2px #ede9fe; }
  .sc-input:disabled { background: #f8fafc; color: #94a3b8; }
  .sc-send-btn { width: 2.2rem; height: 2.2rem; flex-shrink: 0; background: #7c3aed; color: #fff; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; }
  .sc-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sc-send-btn:not(:disabled):hover { background: #6d28d9; }
  .sc-hint { margin: 0.25rem 0 0; font-size: 0.66rem; color: #94a3b8; text-align: right; }
  .sc-error { font-size: 0.73rem; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 0.28rem 0.45rem; margin-bottom: 0.35rem; }
  .sc-error--chat { margin-bottom: 0.35rem; }

  /* Review (matches PlanningDocIncorporatePanel exactly) */
  .review-layout { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  .review-bar { flex-shrink: 0; display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 1rem; background: white; border-bottom: 2px solid #e2e8f0; flex-wrap: wrap; }
  .review-bar-left { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; flex: 1; }
  .review-bar-title { font-size: 0.8rem; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
  .review-bar-count { font-size: 0.7rem; color: #64748b; }
  .review-bar-actions { display: flex; gap: 0.375rem; flex-shrink: 0; }
  .btn-discard { padding: 0.4rem 0.75rem; background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.8125rem; cursor: pointer; font-family: inherit; }
  .btn-discard:hover { background: #f1f5f9; }
  .btn-accept-all { display: flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.625rem; background: #16a34a; color: white; border: none; border-radius: 5px; font-size: 0.75rem; font-weight: 600; cursor: pointer; font-family: inherit; }
  .btn-accept-all:hover { background: #15803d; }
  .btn-commit { display: flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.625rem; background: #7c3aed; color: white; border: none; border-radius: 5px; font-size: 0.75rem; font-weight: 600; cursor: pointer; font-family: inherit; }
  .btn-commit:hover:not(:disabled) { background: #6d28d9; }
  .btn-commit:disabled { opacity: 0.4; cursor: not-allowed; }
  .error-msg { font-size: 0.75rem; color: #dc2626; padding: 0.375rem 1rem; margin: 0; flex-shrink: 0; }
  .review-rows { flex: 1; overflow-y: auto; background: white; }
  .diff-no-changes { font-size: 0.875rem; color: #94a3b8; text-align: center; padding: 3rem 2rem; margin: 0; }
  .review-row { display: grid; grid-template-columns: 1fr 220px; border-bottom: 1px solid #f1f5f9; }
  .review-row--changed { border-bottom-color: #e2e8f0; }
  .review-row-doc { padding: 0.375rem 1.5rem 0.375rem 2rem; font-family: 'Calibri', 'Arial', sans-serif; font-size: 0.9375rem; line-height: 1.6; color: #1e293b; min-width: 0; }
  .review-row-doc--unchanged { opacity: 0.45; }
  .review-row-doc :global(h2) { font-size: 1.2rem; font-weight: 300; color: #1F4E78; margin: 0.5rem 0 0.25rem; }
  .review-row-doc :global(h3) { font-size: 1rem; font-weight: 300; color: #1F4E78; margin: 0.375rem 0 0.2rem; }
  .review-row-doc :global(p) { margin: 0.25rem 0; }
  .doc-para-change { border-left: 3px solid transparent; padding-left: 0.625rem; margin-left: -0.625rem; }
  .doc-para-added   { border-left-color: #22c55e; }
  .doc-para-removed { border-left-color: #ef4444; }
  .doc-para-modified { border-left-color: #f59e0b; }
  .doc-para-kept-original { border-left-color: #94a3b8; }
  .doc-para-kept { border-left-color: #94a3b8; }
  .review-row-ctrl { padding: 0.375rem 0.625rem; border-left: 1px solid #f1f5f9; background: #fafafa; display: flex; align-items: flex-start; }
  .review-row--changed .review-row-ctrl { border-left-color: #e2e8f0; background: #f8fafc; }
  .ctrl-card { width: 100%; display: flex; flex-direction: column; gap: 0.375rem; transition: opacity 0.15s; }
  .ctrl-card.rejected { opacity: 0.5; }
  .ctrl-card-tag { display: flex; }
  .change-tag { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.1rem 0.4rem; border-radius: 3px; }
  .change-tag--added   { background: #dcfce7; color: #15803d; }
  .change-tag--removed { background: #fee2e2; color: #b91c1c; }
  .change-tag--modified { background: #fef9c3; color: #a16207; }
  .para-btns { display: flex; gap: 0.375rem; align-self: flex-start; }
  .para-btn { padding: 0.2rem 0.625rem; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.7rem; font-weight: 500; color: #94a3b8; background: white; cursor: pointer; font-family: inherit; opacity: 0.5; }
  .para-btn.active { opacity: 1; cursor: default; }
  .para-btn:not(.active):hover { background: #f1f5f9; color: #374151; opacity: 0.8; }
  .para-btn--accept.active { background: #dcfce7; border-color: #86efac; color: #15803d; }
  .para-btn--reject.active { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; }
  .word-diff { font-size: 0.8rem; line-height: 1.7; color: #1e293b; }
  .wd-add { background: #bbf7d0; color: #14532d; text-decoration: none; border-radius: 2px; padding: 0 1px; }
  .wd-del { background: #fecaca; color: #7f1d1d; text-decoration: line-through; border-radius: 2px; padding: 0 1px; }

  .mini-spinner { width: 0.875rem; height: 0.875rem; border: 1.5px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
