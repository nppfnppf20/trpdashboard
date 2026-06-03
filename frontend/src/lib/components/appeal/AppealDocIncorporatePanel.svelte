<script>
  import { createEventDispatcher } from 'svelte';
  import { diffArrays, diffWords } from 'diff';
  import { getDocuments, uploadDocument, incorporateDocument, scopeIncorporation, incorporateTargeted } from '$lib/api/appeal.js';

  export let project;
  export let typeId;
  export let keyIssues = [];
  export let currentDraftHtml = '';

  const dispatch = createEventDispatcher();

  // ── State machine ──────────────────────────────────────────────────────────
  // idle | uploading | scoping | scoped | incorporating | review
  let panelState = 'idle';

  let inputTab = 'upload'; // 'upload' | 'paste'
  let pasteText = '';
  let pasteTitle = '';

  let documents = [];
  let docDragOver = false;
  let docFileInput;
  let uploadError = null;

  let incorporatingDoc = null;
  let incorporatingLabel = '';
  let userNotes = '';
  let incorporateError = null;

  let suggestedHtml = '';
  let changeGroups = []; // paragraph-level diff groups

  // scoping state
  let allParagraphs = [];      // [{id, html, text}] — full draft split
  let scopeSummary = '';
  let scopedIds = new Set();   // IDs Claude identified as relevant (user can adjust)
  let scopeError = null;

  let conversation = [];
  let chatInput = '';
  let chatLoading = false;

  // ── Load documents on mount ────────────────────────────────────────────────
  import { onMount } from 'svelte';
  onMount(loadDocuments);

  async function loadDocuments() {
    try {
      documents = await getDocuments(project.id);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload(file) {
    if (!file) return;
    panelState = 'uploading';
    uploadError = null;
    try {
      const doc = await uploadDocument(project.id, file);
      documents = [doc, ...documents];
      dispatch('uploaded', doc);
    } catch (err) {
      uploadError = err.message;
    } finally {
      panelState = 'idle';
    }
  }

  function onDrop(e) {
    e.preventDefault();
    docDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleUpload(file);
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleUpload(file);
  }

  // ── Incorporate ────────────────────────────────────────────────────────────
  // ── Paragraph splitting (shared between scoping and reconstruction) ─────────
  function splitDraftWithIds(html) {
    if (!html?.trim()) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const blocks = [];
    let idx = 0;
    doc.body.firstChild?.childNodes.forEach(node => {
      if (node.nodeType === 1) {
        blocks.push({ id: `p${idx++}`, html: node.outerHTML, text: node.textContent.trim() });
      } else if (node.nodeType === 3 && node.textContent.trim()) {
        blocks.push({ id: `p${idx++}`, html: `<p>${node.textContent.trim()}</p>`, text: node.textContent.trim() });
      }
    });
    return blocks;
  }

  function buildDocPayload() {
    return incorporatingDoc
      ? { documentId: incorporatingDoc.id }
      : { documentText: pasteText, documentTitle: incorporatingLabel };
  }

  async function startIncorporate(doc) {
    incorporatingDoc = doc;
    incorporatingLabel = doc.filename;
    conversation = [];
    suggestedHtml = '';
    changeGroups = [];
    scopeError = null;
    await runScope();
  }

  async function startIncorporateFromPaste() {
    if (!pasteText.trim()) return;
    incorporatingDoc = null;
    incorporatingLabel = pasteTitle.trim() || 'Pasted document';
    conversation = [];
    suggestedHtml = '';
    changeGroups = [];
    scopeError = null;
    await runScope();
  }

  async function runScope() {
    panelState = 'scoping';
    scopeError = null;
    allParagraphs = splitDraftWithIds(currentDraftHtml);

    if (!allParagraphs.length) {
      // No draft yet — skip scoping, go straight to incorporate
      await runIncorporate(allParagraphs);
      return;
    }

    try {
      const result = await scopeIncorporation(project.id, {
        ...buildDocPayload(),
        paragraphs: allParagraphs.map(p => ({ id: p.id, text: p.text }))
      });
      scopeSummary = result.summary ?? '';
      scopedIds = new Set(result.relevant_ids ?? []);
      panelState = 'scoped';
    } catch (err) {
      scopeError = err.message;
      panelState = 'scoped'; // still show UI so user can proceed manually
    }
  }

  async function runIncorporate(paragraphsOverride = null) {
    incorporateError = null;
    panelState = 'incorporating';

    const targeted = paragraphsOverride ?? allParagraphs.filter(p => scopedIds.has(p.id));

    if (!targeted.length) {
      incorporateError = 'No paragraphs selected — tick at least one paragraph to update.';
      panelState = 'scoped';
      return;
    }

    try {
      const result = await incorporateTargeted(project.id, {
        ...buildDocPayload(),
        paragraphs: targeted,
        userNotes: userNotes || null
      });

      // Reconstruct: updated paragraphs from Claude, everything else verbatim from original
      const updatedMap = {};
      for (const p of (result.updated ?? [])) updatedMap[p.id] = p.html;

      const reconstructed = allParagraphs.map(p => updatedMap[p.id] ?? p.html).join('\n');
      suggestedHtml = reconstructed;
      changeGroups = computeParagraphDiff(currentDraftHtml, suggestedHtml);
      panelState = 'review';
      dispatch('reviewchange', { active: true });
    } catch (err) {
      incorporateError = err.message;
      panelState = 'scoped';
    }
  }

  // ── Chat refinement ────────────────────────────────────────────────────────
  async function sendChat() {
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    chatInput = '';
    chatLoading = true;

    // Chat refines the full draft via the original incorporate endpoint with conversation history
    const newTurns = [
      { role: 'assistant', content: suggestedHtml },
      { role: 'user', content: userMessage }
    ];
    conversation = [...conversation, ...newTurns];

    try {
      const result = await incorporateDocument(project.id, typeId, {
        ...buildDocPayload(),
        userNotes: userNotes || null,
        conversation
      });
      suggestedHtml = result.content_html;
      changeGroups = computeParagraphDiff(currentDraftHtml, suggestedHtml);
    } catch (err) {
      incorporateError = err.message;
    } finally {
      chatLoading = false;
    }
  }

  // ── Accept / discard ───────────────────────────────────────────────────────
  function acceptAll() {
    changeGroups = changeGroups.map(g => g.type === 'unchanged' ? g : { ...g, accepted: true });
    commitAccepted();
  }

  function commitAccepted() {
    const html = buildFinalHtml(changeGroups);
    dispatch('accepted', { html, doc: incorporatingDoc });
    if (incorporatingDoc) {
      documents = documents.map(d => d.id === incorporatingDoc.id ? { ...d, review_status: 'reviewed' } : d);
    }
    reset();
  }

  function toggleGroup(idx) {
    changeGroups = changeGroups.map((g, i) => i === idx ? { ...g, accepted: !g.accepted } : g);
  }

  function discard() {
    reset();
  }

  function reset() {
    panelState = 'idle';
    incorporatingDoc = null;
    suggestedHtml = '';
    changeGroups = [];
    conversation = [];
    incorporateError = null;
    dispatch('reviewchange', { active: false });
  }

  // ── Paragraph diff ─────────────────────────────────────────────────────────
  function splitIntoParagraphs(html) {
    if (!html?.trim()) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const blocks = [];
    doc.body.firstChild?.childNodes.forEach(node => {
      if (node.nodeType === 1) {
        blocks.push(node.outerHTML);
      } else if (node.nodeType === 3 && node.textContent.trim()) {
        blocks.push(`<p>${node.textContent.trim()}</p>`);
      }
    });
    return blocks;
  }

  function computeParagraphDiff(oldHtml, newHtml) {
    const oldParas = splitIntoParagraphs(oldHtml);
    const newParas = splitIntoParagraphs(newHtml);
    const raw = diffArrays(oldParas, newParas);

    const groups = [];
    let i = 0;
    while (i < raw.length) {
      const part = raw[i];
      if (part.removed && i + 1 < raw.length && raw[i + 1].added) {
        // Pair removed+added as modifications
        const oldVals = part.value;
        const newVals = raw[i + 1].value;
        const pairs = Math.min(oldVals.length, newVals.length);
        for (let j = 0; j < pairs; j++) {
          groups.push({ type: 'modified', oldHtml: oldVals[j], newHtml: newVals[j], accepted: true, words: wordDiff(oldVals[j], newVals[j]) });
        }
        for (let j = pairs; j < oldVals.length; j++) {
          groups.push({ type: 'removed', html: oldVals[j], accepted: true, words: wordDiff(oldVals[j], '') });
        }
        for (let j = pairs; j < newVals.length; j++) {
          groups.push({ type: 'added', html: newVals[j], accepted: true, words: wordDiff('', newVals[j]) });
        }
        i += 2;
      } else if (part.removed) {
        for (const html of part.value) {
          groups.push({ type: 'removed', html, accepted: true, words: wordDiff(html, '') });
        }
        i++;
      } else if (part.added) {
        for (const html of part.value) {
          groups.push({ type: 'added', html, accepted: true, words: wordDiff('', html) });
        }
        i++;
      } else {
        for (const html of part.value) {
          groups.push({ type: 'unchanged', html });
        }
        i++;
      }
    }
    return groups;
  }

  function stripHtml(html) {
    return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function wordDiff(oldHtml, newHtml) {
    return diffWords(stripHtml(oldHtml), stripHtml(newHtml));
  }

  function buildFinalHtml(groups) {
    return groups.map(g => {
      if (g.type === 'unchanged') return g.html;
      if (g.type === 'added')     return g.accepted ? g.html : '';
      if (g.type === 'removed')   return g.accepted ? '' : g.html;
      if (g.type === 'modified')  return g.accepted ? g.newHtml : g.oldHtml;
      return '';
    }).filter(Boolean).join('\n');
  }

  $: changedCount = changeGroups.filter(g => g.type !== 'unchanged').length;
  $: acceptedCount = changeGroups.filter(g => g.type !== 'unchanged' && g.accepted).length;

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

  // ── Status labels ──────────────────────────────────────────────────────────
  const statusLabels = {
    reviewed: { label: 'Incorporated', colour: '#16a34a', bg: '#f0fdf4' },
    pending:  { label: 'Pending',      colour: '#d97706', bg: '#fffbeb' },
    skipped:  { label: 'Skipped',      colour: '#94a3b8', bg: '#f8fafc' }
  };
</script>

<div class="panel">

  {#if panelState === 'idle'}
    <!-- ── Tab switcher ── -->
    <div class="input-tabs">
      <button class="input-tab" class:active={inputTab === 'upload'} on:click={() => inputTab = 'upload'}>
        <i class="las la-upload"></i> Upload
      </button>
      <button class="input-tab" class:active={inputTab === 'paste'} on:click={() => inputTab = 'paste'}>
        <i class="las la-paste"></i> Paste text
      </button>
    </div>

    {#if inputTab === 'upload'}
      <!-- ── Upload zone ── -->
      <div
        class="upload-zone"
        class:drag-over={docDragOver}
        on:dragover|preventDefault={() => docDragOver = true}
        on:dragleave={() => docDragOver = false}
        on:drop={onDrop}
        on:click={() => docFileInput.click()}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && docFileInput.click()}
      >
        <i class="las la-cloud-upload-alt"></i>
        <span>Drop a document or click to upload</span>
        <span class="upload-sub">PDF, TXT or MD</span>
      </div>
      <input type="file" accept=".pdf,.txt,.md" bind:this={docFileInput} on:change={onFileChange} style="display:none" />

      {#if uploadError}
        <p class="error-msg">{uploadError}</p>
      {/if}

      <!-- ── User notes ── -->
      <div class="notes-area">
        <label class="notes-label">
          <i class="las la-pen"></i> Your notes
          <span class="notes-hint">Tell Claude what to focus on — given high priority in the prompt</span>
        </label>
        <textarea
          class="notes-textarea"
          placeholder="e.g. Focus on section 4.2, ignore ecology..."
          bind:value={userNotes}
        ></textarea>
      </div>

      <!-- ── Document list ── -->
      {#if documents.length === 0}
        <div class="empty-docs">
          <i class="las la-file-alt"></i>
          <p>No documents uploaded yet.</p>
        </div>
      {:else}
        <div class="doc-list">
          {#each documents as doc (doc.id)}
            {@const status = statusLabels[doc.review_status] ?? statusLabels.pending}
            <div class="doc-row">
              <div class="doc-row-info">
                <span class="doc-name">{doc.filename}</span>
                <div class="doc-row-meta">
                  <span class="doc-status" style="color:{status.colour};background:{status.bg}">{status.label}</span>
                  <span class="doc-date">{new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <button class="incorporate-btn" on:click={() => startIncorporate(doc)}>
                <i class="las la-file-import"></i> Incorporate
              </button>
            </div>
          {/each}
        </div>
      {/if}

    {:else}
      <!-- ── Paste text ── -->
      <div class="paste-area">
        <input
          class="paste-title-input"
          type="text"
          placeholder="Document title (optional)"
          bind:value={pasteTitle}
        />
        <textarea
          class="paste-textarea"
          placeholder="Paste the document text here..."
          bind:value={pasteText}
        ></textarea>
        <div class="notes-area notes-area--inline">
          <label class="notes-label">
            <i class="las la-pen"></i> Your notes
            <span class="notes-hint">Tell Claude what to focus on — given high priority</span>
          </label>
          <textarea
            class="notes-textarea"
            placeholder="e.g. Focus only on transport conclusions..."
            bind:value={userNotes}
          ></textarea>
        </div>
        <button
          class="incorporate-btn incorporate-btn--full"
          disabled={!pasteText.trim()}
          on:click={startIncorporateFromPaste}
        >
          <i class="las la-file-import"></i> Incorporate
        </button>
      </div>
    {/if}

  {:else if panelState === 'uploading'}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Uploading document...</span>
    </div>

  {:else if panelState === 'scoping'}
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">
        <span>Identifying relevant paragraphs...</span>
        <span class="loading-sub">Reading document against draft</span>
      </div>
    </div>

  {:else if panelState === 'scoped'}
    <div class="scoped-panel">
      <div class="scoped-header">
        <span class="scoped-title"><i class="las la-search"></i> {incorporatingLabel}</span>
        {#if scopeSummary}
          <p class="scoped-summary">{scopeSummary}</p>
        {/if}
        {#if scopeError}
          <p class="scoped-error"><i class="las la-exclamation-circle"></i> Scoping failed — select paragraphs manually below.</p>
        {/if}
      </div>

      <p class="scoped-instruct">
        Claude identified {scopedIds.size} paragraph{scopedIds.size !== 1 ? 's' : ''} to update. Review and adjust, then click Incorporate.
      </p>

      <div class="scoped-list">
        {#each allParagraphs as para, idx}
          {@const checked = scopedIds.has(para.id)}
          {@const headingLevel = getHeadingLevel(para.html)}
          {#if headingLevel}
            <div class="scoped-heading">
              <span class="scoped-heading-text">{para.text}</span>
              <button
                class="scoped-section-btn"
                on:click={() => isSectionSelected(idx) ? deselectSection(idx) : selectSection(idx)}
              >
                {isSectionSelected(idx) ? 'Deselect section' : 'Select section'}
              </button>
            </div>
          {:else}
            <label class="scoped-item" class:selected={checked}>
              <input
                type="checkbox"
                {checked}
                on:change={() => {
                  const next = new Set(scopedIds);
                  if (next.has(para.id)) next.delete(para.id); else next.add(para.id);
                  scopedIds = next;
                }}
              />
              <span class="scoped-item-text">{para.text.slice(0, 100)}{para.text.length > 100 ? '...' : ''}</span>
            </label>
          {/if}
        {/each}
      </div>

      {#if incorporateError}
        <p class="error-msg" style="padding:0 1rem">{incorporateError}</p>
      {/if}

      <div class="scoped-actions">
        <button class="btn-secondary" on:click={discard}>Cancel</button>
        <button class="btn-primary" disabled={scopedIds.size === 0} on:click={() => runIncorporate()}>
          <i class="las la-file-import"></i> Incorporate {scopedIds.size} paragraph{scopedIds.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>

  {:else if panelState === 'incorporating'}
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">
        <span>Updating {scopedIds.size} paragraph{scopedIds.size !== 1 ? 's' : ''}...</span>
        <span class="loading-sub">This may take 15–30 seconds</span>
      </div>
    </div>

  {:else if panelState === 'review'}
    <!-- ── Full-width two-column review layout ── -->
    <div class="review-layout">

      <!-- Left: document-style diff -->
      <div class="review-doc-col">
        <div class="review-doc-header">
          <span class="review-doc-title">{incorporatingLabel}</span>
          <span class="review-doc-subtitle">Review suggested changes before applying</span>
        </div>
        <div class="review-doc-body trp-document-content">
          {#if changeGroups.length === 0}
            <p style="color:#94a3b8">No changes suggested.</p>
          {:else}
            {#each changeGroups as group, idx}
              {#if group.type === 'unchanged'}
                <div class="doc-para-unchanged">{@html group.html}</div>
              {:else if group.type === 'added'}
                <div class="doc-para-change doc-para-added" class:faded={!group.accepted}>
                  <div class="word-diff">{#each group.words as w}{#if w.added}<ins class="wd-add">{w.value}</ins>{:else if w.removed}{:else}<span>{w.value}</span>{/if}{/each}</div>
                </div>
              {:else if group.type === 'removed'}
                <div class="doc-para-change doc-para-removed" class:faded={!group.accepted}>
                  <div class="word-diff">{#each group.words as w}{#if w.removed}<del class="wd-del">{w.value}</del>{:else if w.added}{:else}<span>{w.value}</span>{/if}{/each}</div>
                </div>
              {:else if group.type === 'modified'}
                <div class="doc-para-change doc-para-modified" class:faded={!group.accepted}>
                  <div class="word-diff">{#each group.words as w}{#if w.added}<ins class="wd-add">{w.value}</ins>{:else if w.removed}<del class="wd-del">{w.value}</del>{:else}<span>{w.value}</span>{/if}{/each}</div>
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      </div>

      <!-- Right: controls -->
      <div class="review-ctrl-col">
        <div class="review-ctrl-header">
          <span class="review-ctrl-title">Changes</span>
          <span class="review-ctrl-count">{acceptedCount}/{changedCount} accepted</span>
        </div>
        <div class="review-ctrl-actions">
          <button class="btn-accept-all" on:click={acceptAll}><i class="las la-check-double"></i> Accept all</button>
          <button class="btn-commit" disabled={acceptedCount === 0} on:click={commitAccepted}><i class="las la-check"></i> Apply</button>
          <button class="btn-discard" on:click={discard}>Discard</button>
        </div>

        <div class="review-ctrl-list">
          {#each changeGroups as group, idx}
            {#if group.type !== 'unchanged'}
              <div class="ctrl-item" class:rejected={!group.accepted}>
                <div class="ctrl-item-tag">
                  {#if group.type === 'added'}<span class="change-tag change-tag--added">+ Added</span>
                  {:else if group.type === 'removed'}<span class="change-tag change-tag--removed">− Removed</span>
                  {:else}<span class="change-tag change-tag--modified">~ Modified</span>{/if}
                </div>
                <p class="ctrl-item-preview">
                  {#if group.type === 'modified'}{stripHtml(group.newHtml).slice(0, 80)}...
                  {:else}{stripHtml(group.html ?? '').slice(0, 80)}...{/if}
                </p>
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
          {/each}
        </div>

        <!-- Chat -->
        <div class="chat-area">
          <div class="chat-input-row">
            <input
              class="chat-input"
              type="text"
              placeholder="Refine suggestions..."
              bind:value={chatInput}
              disabled={chatLoading}
              on:keydown={(e) => e.key === 'Enter' && !chatLoading && sendChat()}
            />
            <button class="chat-send-btn" disabled={chatLoading || !chatInput.trim()} on:click={sendChat}>
              {#if chatLoading}<div class="mini-spinner"></div>{:else}<i class="las la-paper-plane"></i>{/if}
            </button>
          </div>
          {#if incorporateError}
            <p class="error-msg" style="margin-top:0.5rem">{incorporateError}</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #f8fafc;
  }

  /* ── Tab switcher ── */
  .input-tabs {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid #e2e8f0;
    background: white;
  }

  .input-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.625rem;
    border: none;
    background: transparent;
    font-size: 0.8rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-family: inherit;
    transition: all 0.15s;
  }
  .input-tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }
  .input-tab:hover:not(.active) { color: #374151; }

  /* ── Paste area ── */
  .paste-area {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1rem;
    flex: 1;
    min-height: 0;
  }

  .paste-title-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
    flex-shrink: 0;
  }
  .paste-title-input:focus { outline: none; border-color: #7c3aed; }
  .paste-title-input::placeholder { color: #94a3b8; }

  .paste-textarea {
    flex: 1;
    min-height: 200px;
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #374151;
    background: white;
    resize: none;
    line-height: 1.5;
  }
  .paste-textarea:focus { outline: none; border-color: #7c3aed; }
  .paste-textarea::placeholder { color: #94a3b8; }

  .incorporate-btn--full {
    width: 100%;
    justify-content: center;
  }
  .incorporate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Upload zone ── */
  .upload-zone {
    flex-shrink: 0;
    margin: 1rem;
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    padding: 1.25rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    cursor: pointer;
    transition: all 0.15s;
    background: white;
    text-align: center;
  }
  .upload-zone:hover, .upload-zone.drag-over { border-color: #7c3aed; background: #faf5ff; }
  .upload-zone i { font-size: 1.5rem; color: #94a3b8; }
  .upload-zone span { font-size: 0.8125rem; color: #475569; font-weight: 500; }
  .upload-sub { font-size: 0.75rem !important; color: #94a3b8 !important; font-weight: 400 !important; }

  .error-msg { font-size: 0.8rem; color: #ef4444; margin: 0 1rem 0.5rem; }

  /* ── User notes ── */
  .notes-area {
    flex-shrink: 0;
    padding: 0 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .notes-area--inline {
    padding: 0;
  }

  .notes-label {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
  }

  .notes-hint {
    font-size: 0.7rem;
    font-weight: 400;
    color: #94a3b8;
  }

  .notes-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: #374151;
    background: #fffbeb;
    resize: none;
    line-height: 1.5;
    min-height: 64px;
    transition: border-color 0.15s;
  }
  .notes-textarea:focus { outline: none; border-color: #f59e0b; background: white; box-shadow: 0 0 0 3px rgba(245,158,11,0.08); }
  .notes-textarea::placeholder { color: #94a3b8; }

  /* ── Doc list ── */
  .doc-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty-docs {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    color: #94a3b8;
    text-align: center;
  }
  .empty-docs i { font-size: 2rem; }
  .empty-docs p { margin: 0; font-size: 0.8125rem; max-width: 220px; }

  .doc-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
  }

  .doc-row-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .doc-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .doc-row-meta { display: flex; align-items: center; gap: 0.5rem; }

  .doc-status {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .doc-date { font-size: 0.7rem; color: #94a3b8; }

  .incorporate-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.625rem;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .incorporate-btn:hover { background: #6d28d9; }

  /* ── Loading / error states ── */
  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: #64748b;
    font-size: 0.875rem;
  }

  .loading-text { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
  .loading-sub { font-size: 0.75rem; color: #94a3b8; }

  .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    text-align: center;
    color: #64748b;
  }
  .error-state i { font-size: 2rem; color: #ef4444; }
  .error-state p { margin: 0; font-size: 0.875rem; }
  .error-actions { display: flex; gap: 0.5rem; }

  /* ── Review panel ── */
  .review-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: white;
    border-bottom: 1px solid #e2e8f0;
  }

  .review-header-left {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .review-title { font-size: 0.8125rem; font-weight: 700; color: #1e293b; }
  .review-doc-name { font-size: 0.75rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .review-header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

  .btn-accept {
    display: flex; align-items: center; gap: 0.3rem;
    padding: 0.4rem 0.875rem;
    background: #16a34a; color: white;
    border: none; border-radius: 6px;
    font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: background 0.15s;
  }
  .btn-accept:hover { background: #15803d; }

  .btn-discard {
    padding: 0.4rem 0.75rem;
    background: white; color: #64748b;
    border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: 0.8125rem; cursor: pointer; font-family: inherit;
    transition: all 0.15s;
  }
  .btn-discard:hover { background: #f1f5f9; }

  .btn-primary {
    padding: 0.4rem 0.875rem;
    background: #7c3aed; color: white;
    border: none; border-radius: 6px;
    font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .btn-secondary {
    padding: 0.4rem 0.75rem;
    background: white; color: #64748b;
    border: 1px solid #e2e8f0; border-radius: 6px;
    font-size: 0.8125rem; cursor: pointer; font-family: inherit;
  }

  /* ── Scoped panel ── */
  .scoped-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .scoped-header {
    flex-shrink: 0;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    background: white;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .scoped-title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .scoped-summary {
    margin: 0;
    font-size: 0.8rem;
    color: #475569;
    line-height: 1.5;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 5px;
    padding: 0.5rem 0.625rem;
  }

  .scoped-error {
    margin: 0;
    font-size: 0.75rem;
    color: #dc2626;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .scoped-instruct {
    flex-shrink: 0;
    margin: 0;
    padding: 0.625rem 1rem;
    font-size: 0.75rem;
    color: #64748b;
    border-bottom: 1px solid #f1f5f9;
  }

  .scoped-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .scoped-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: all 0.12s;
    font-size: 0;
  }

  .scoped-item.selected {
    background: #f0fdf4;
    border-color: #86efac;
  }

  .scoped-item input[type="checkbox"] {
    flex-shrink: 0;
    margin-top: 0.1rem;
    accent-color: #16a34a;
  }

  .scoped-item-text {
    font-size: 0.75rem;
    color: #374151;
    line-height: 1.4;
  }

  .scoped-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem 0.25rem;
    margin-top: 0.375rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .scoped-heading-text {
    font-size: 0.75rem;
    font-weight: 700;
    color: #1e293b;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scoped-section-btn {
    flex-shrink: 0;
    padding: 0.15rem 0.5rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 500;
    color: #7c3aed;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.12s;
  }
  .scoped-section-btn:hover { background: #faf5ff; border-color: #c4b5fd; }

  .scoped-actions {
    flex-shrink: 0;
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #e2e8f0;
    background: white;
  }

  /* ── Review two-column layout ── */
  .review-layout {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  /* Left: document diff */
  .review-doc-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    background: white;
  }

  .review-doc-header {
    flex-shrink: 0;
    padding: 0.875rem 2rem 0.625rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .review-doc-title { font-size: 0.875rem; font-weight: 600; color: #1e293b; }
  .review-doc-subtitle { font-size: 0.75rem; color: #94a3b8; }

  .review-doc-body {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 2.5rem;
    max-width: 820px;
  }

  /* Unchanged paragraphs — full document style, slightly muted */
  .doc-para-unchanged {
    opacity: 0.5;
  }

  /* Changed paragraph — left border highlight, no card background */
  .doc-para-change {
    padding-left: 0.875rem;
    margin-left: -0.875rem;
    border-left: 3px solid transparent;
    transition: opacity 0.2s;
  }

  .doc-para-change.faded { opacity: 0.35; }

  .doc-para-added    { border-left-color: #22c55e; }
  .doc-para-removed  { border-left-color: #ef4444; }
  .doc-para-modified { border-left-color: #f59e0b; }

  /* Right: compact controls */
  .review-ctrl-col {
    width: 280px;
    flex-shrink: 0;
    border-left: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f8fafc;
  }

  .review-ctrl-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    background: white;
  }
  .review-ctrl-title { font-size: 0.8125rem; font-weight: 700; color: #1e293b; }
  .review-ctrl-count { font-size: 0.75rem; color: #64748b; }

  .review-ctrl-actions {
    flex-shrink: 0;
    display: flex;
    gap: 0.375rem;
    padding: 0.625rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    background: white;
  }

  .btn-accept-all {
    display: flex; align-items: center; gap: 0.3rem;
    padding: 0.35rem 0.625rem;
    background: #16a34a; color: white;
    border: none; border-radius: 5px;
    font-size: 0.75rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: background 0.15s;
  }
  .btn-accept-all:hover { background: #15803d; }

  .btn-commit {
    display: flex; align-items: center; gap: 0.3rem;
    padding: 0.35rem 0.625rem;
    background: #7c3aed; color: white;
    border: none; border-radius: 5px;
    font-size: 0.75rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: background 0.15s;
  }
  .btn-commit:hover:not(:disabled) { background: #6d28d9; }
  .btn-commit:disabled { opacity: 0.4; cursor: not-allowed; }

  .review-ctrl-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .ctrl-item {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.5rem 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    transition: opacity 0.15s;
  }
  .ctrl-item.rejected { opacity: 0.5; }

  .ctrl-item-tag { display: flex; }

  .ctrl-item-preview {
    margin: 0;
    font-size: 0.7rem;
    color: #64748b;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .change-tag {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }
  .change-tag--added    { background: #dcfce7; color: #15803d; }
  .change-tag--removed  { background: #fee2e2; color: #b91c1c; }
  .change-tag--modified { background: #fef9c3; color: #a16207; }

  .para-btns {
    display: flex;
    gap: 0.375rem;
    align-self: flex-start;
  }

  .para-btn {
    padding: 0.2rem 0.625rem;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    color: #94a3b8;
    background: white;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    opacity: 0.5;
  }
  .para-btn.active {
    opacity: 1;
    cursor: default;
  }
  .para-btn:not(.active):hover { background: #f1f5f9; color: #374151; opacity: 0.8; }

  .para-btn--accept.active {
    background: #dcfce7;
    border-color: #86efac;
    color: #15803d;
  }
  .para-btn--reject.active {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #b91c1c;
  }

  /* ── Inline word diff ── */
  .word-diff {
    font-size: 0.8rem;
    line-height: 1.7;
    color: #1e293b;
  }

  .wd-add {
    background: #bbf7d0;
    color: #14532d;
    text-decoration: none;
    border-radius: 2px;
    padding: 0 1px;
  }

  .wd-del {
    background: #fecaca;
    color: #7f1d1d;
    text-decoration: line-through;
    border-radius: 2px;
    padding: 0 1px;
  }

  /* ── Chat ── */
  .chat-area {
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    background: white;
    border-top: 1px solid #e2e8f0;
  }

  .chat-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .chat-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #1e293b;
    background: #f8fafc;
    transition: border-color 0.15s;
  }
  .chat-input:focus { outline: none; border-color: #7c3aed; background: white; }
  .chat-input::placeholder { color: #94a3b8; }
  .chat-input:disabled { opacity: 0.6; }

  .chat-send-btn {
    display: flex; align-items: center; justify-content: center;
    width: 2.25rem; height: 2.25rem;
    background: #7c3aed; color: white;
    border: none; border-radius: 6px;
    cursor: pointer; flex-shrink: 0;
    transition: background 0.15s;
  }
  .chat-send-btn:hover:not(:disabled) { background: #6d28d9; }
  .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Spinners ── */
  .spinner {
    width: 1.5rem; height: 1.5rem;
    border: 2px solid #e2e8f0; border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .mini-spinner {
    width: 0.875rem; height: 0.875rem;
    border: 1.5px solid rgba(255,255,255,0.4); border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
