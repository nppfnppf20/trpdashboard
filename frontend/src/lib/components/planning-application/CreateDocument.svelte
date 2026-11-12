<script>
  // The "Create" card: write a document by conversation. Tick sources on the left,
  // pick a document type, and tell the AI what to write; keep chatting to add, cut
  // and change. Highlight text in the document to point the next message at it.
  //
  // Changes come back as exact-match edits (or, for an empty document, a full
  // draft) and are shown in the document as pending highlights to Accept or
  // Discard, using the same engine as the highlight-to-edit flow
  // (utils/documentEdits.js). Saves into the project's custom deliverables.
  import { onMount, tick, createEventDispatcher } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import CreateSourcePicker from '$lib/components/planning-application/CreateSourcePicker.svelte';
  import AiEditBar from '$lib/components/planning-application/AiEditBar.svelte';
  import VoiceDictationButton from '$lib/components/projects/VoiceDictationButton.svelte';
  import { listCreateDocTypes } from '$lib/api/createDocTypes.js';
  import { sendCreateChat } from '$lib/api/draftCreate.js';
  import { applyAiEditResult } from '$lib/utils/documentEdits.js';
  import { clearPendingMarkers } from '$lib/utils/draftParagraphs.js';
  import { renderReply } from '$lib/utils/chatMarkdown.js';
  import { createCustomDeliverable, updateDeliverableFromHTML, getDeliverableAsHTML } from '$lib/services/planningDeliverablesApi.js';
  import { draftTypes, drafts } from '$lib/stores/planning-drafts.js';
  import { getSections as paGetSections, getSectionPrompt as paGetSectionPrompt } from '$lib/api/planningApplication.js';
  import { getSections as appealGetSections } from '$lib/api/appeal.js';
  import { buildImportGroups, cleanImportedHtml, extractSectionHtml, combineSectionPrompts, IMPORT_PROMPT_MAX_CHARS } from '$lib/utils/documentImport.js';
  import { exportHtmlToWord, getExportConfigForTemplate } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';

  export let project;
  /** Existing document to continue working on (a saved custom document). */
  export let initialHtml = '';
  export let initialName = '';
  export let deliverableId = null;
  /** Everything saved on the project's Planning Deliverables list (custom documents and template deliverables). */
  export let deliverables = [];

  const dispatch = createEventDispatcher();

  const EXAMPLE_PROMPTS = [
    'Write a short covering letter to the case officer confirming submission of the application.',
    'Draft a one-page summary of the proposal for the client, using the ticked sources.',
    'Write an introduction to the site and its surroundings.',
  ];

  // ── Document types ───────────────────────────────────────────────────────
  let docTypes = [];
  let docTypeId = null;
  let typesError = null;
  $: docType = docTypes.find(d => d.id === docTypeId) ?? null;
  // The backend caps the example it sends at 12k characters; the meter mirrors that.
  $: exampleChars = Math.min(docType?.example_text?.length ?? 0, 12000);

  onMount(async () => {
    try {
      docTypes = await listCreateDocTypes({ activeOnly: true });
      docTypeId = (docTypes.find(d => d.slug === 'general') ?? docTypes[0])?.id ?? null;
    } catch (err) {
      // Not fatal: the chat works without a type, it just uses the basic Word template.
      typesError = err.message;
    }
    ensureSections();
  });

  // ── Document ─────────────────────────────────────────────────────────────
  let editor;
  let html = initialHtml;
  let docName = initialName;
  let dirty = false;
  let saving = false;
  let justSaved = false;
  let exporting = false;

  const hasContent = h => !!h?.replace(/<[^>]+>/g, '').trim();
  $: importedChars = importedContext.reduce((n, c) => n + Math.min(c.prompt.length, IMPORT_PROMPT_MAX_CHARS), 0);
  $: extraChars = (html?.length ?? 0) + exampleChars + importedChars;

  function onEditorChange(e) {
    if (e?.detail?.html !== undefined) html = e.detail.html;
    dirty = true;
    justSaved = false;
  }

  function setDocument(next) {
    editor?.setHTML(next);
    html = editor?.getHTML() ?? next;
  }

  // ── Import ───────────────────────────────────────────────────────────────
  // Bring in text made elsewhere in the workspace (saved documents, other
  // deliverables, whole drafts or single sections). The text goes into the
  // document; the prompt that produced it is attached to the chat as context,
  // so the AI knows what the text was written to do.
  let sectionsByType = {};
  let importLoading = false;
  // [{ id, title, prompt }] sent with every message
  let importedContext = [];

  $: importGroups = buildImportGroups({ draftTypes: $draftTypes, drafts: $drafts, sectionsByType, deliverables });

  async function ensureSections() {
    const missing = ($draftTypes ?? []).filter(t => (t.tool === 'pa' || t.tool === 'appeal') && !sectionsByType[t.id]);
    await Promise.all(missing.map(async t => {
      try {
        const secs = t.tool === 'appeal' ? await appealGetSections(t._rawId) : await paGetSections(t.id);
        sectionsByType = { ...sectionsByType, [t.id]: secs };
      } catch {
        // Non-fatal: that draft can still be imported whole.
      }
    }));
  }

  // The prompt that generates a section: its own, or (planning application) the built-in default.
  async function sectionPromptFor(type, section) {
    if (section.generation_prompt?.trim()) return section.generation_prompt.trim();
    if (type.tool === 'pa') {
      try { return (await paGetSectionPrompt(section.id)).prompt?.trim() ?? ''; } catch { return ''; }
    }
    return '';
  }

  function appendToDocument(importedHtml) {
    const current = editor?.getHTML() ?? html;
    setDocument(hasContent(current) ? `${current}\n${importedHtml}` : importedHtml);
    dirty = true;
    justSaved = false;
  }

  function removeContext(id) {
    importedContext = importedContext.filter(c => c.id !== id);
  }

  async function handleImportChange(e) {
    const value = e.target.value;
    e.target.value = '';
    if (!value || importLoading) return;
    importLoading = true;
    try {
      await ensureSections();
      const [kind, a, b] = value.split(':');
      let title = '';
      let importedHtml = '';
      let prompt = '';

      if (kind === 'deliv') {
        const d = deliverables.find(x => String(x.id) === a);
        importedHtml = (await getDeliverableAsHTML(Number(a))).html;
        title = d?.deliverable_name ?? 'Document';
        // Documents don't record the prompt that made them, so only the text comes across.
      } else {
        const type = $draftTypes.find(t => String(t.id) === a);
        const draftHtml = $drafts[type?.id]?.content_html ?? '';
        const sections = sectionsByType[type?.id] ?? [];
        if (kind === 'sect') {
          const section = sections.find(s => String(s.id) === b);
          importedHtml = extractSectionHtml(draftHtml, section?.name);
          title = `${type.name}: ${section?.name}`;
          prompt = await sectionPromptFor(type, section);
        } else {
          importedHtml = draftHtml;
          title = `${type.name} (whole draft)`;
          const present = sections.filter(s => hasContent(extractSectionHtml(draftHtml, s.name)));
          const entries = await Promise.all(present.map(async s => ({ name: s.name, prompt: await sectionPromptFor(type, s) })));
          prompt = combineSectionPrompts(entries);
        }
      }

      importedHtml = cleanImportedHtml(importedHtml);
      if (!hasContent(importedHtml)) {
        alert('There is no text to import from that.');
        return;
      }
      appendToDocument(importedHtml);
      if (prompt) importedContext = [...importedContext.filter(c => c.id !== value), { id: value, title, prompt }];
      messages = [...messages, {
        role: 'assistant',
        kind: 'info',
        content: `Imported "${title}".`,
        note: prompt
          ? 'The prompt that produced it is attached, so the AI knows what the text was written to do.'
          : 'No prompt is recorded for this, so only the text was imported.',
      }];
      scrollChat();
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed: ' + err.message);
    } finally {
      importLoading = false;
    }
  }

  // ── Sources ──────────────────────────────────────────────────────────────
  let sources = { project_details: false, document_ids: [], meeting_ids: [], groups: [] };
  let sourcesOverBudget = false;
  let sourcesOpen = true;

  function onSourcesChange(e) {
    sources = e.detail.sources;
    sourcesOverBudget = e.detail.overBudget;
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  // { role: 'user'|'assistant', content, note?, kind?: 'error' }
  let messages = [];
  let input = '';
  let sending = false;
  let sendError = null;
  let chatScroll;
  let inputEl;
  // A highlight pointing the next message at a passage: { quotedText, paragraphIds }
  let selection = null;
  // The bar at the bottom: while waiting, or while changes await Accept/Discard.
  // { loading, warning, originalHtml } | null
  let aiBar = null;
  // Bumped on each new request and on cancel, so a late response is ignored.
  let seq = 0;

  const apiMessages = () => messages.filter(m => m.kind !== 'error' && m.kind !== 'info').map(m => ({ role: m.role, content: m.content }));

  async function scrollChat() {
    await tick();
    if (chatScroll) chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  function handleTextSelected(e) {
    if (aiBar?.loading) return;
    selection = { quotedText: e.detail.quotedText, paragraphIds: e.detail.paragraphIds };
    inputEl?.focus();
  }

  function clearSelection() {
    selection = null;
    editor?.clearSelectionHighlight();
  }

  function showPending(next, originalHtml, warnings) {
    setDocument(next);
    dirty = true;
    justSaved = false;
    aiBar = { loading: false, warning: warnings.join(' ') || null, originalHtml };
  }

  function acceptPending() {
    if (!aiBar) return;
    setDocument(clearPendingMarkers(editor?.getHTML() ?? html));
    aiBar = null;
  }

  function discardPending() {
    if (!aiBar) return;
    setDocument(aiBar.originalHtml);
    aiBar = null;
  }

  // "Edit Again": put the changes back and give the last request back to the user to rephrase.
  function editAgain() {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    discardPending();
    if (lastUser) input = lastUser.content;
    inputEl?.focus();
  }

  function cancelRequest() {
    seq++;
    sending = false;
    const last = messages[messages.length - 1];
    if (last?.role === 'user') {
      input = last.content;
      messages = messages.slice(0, -1);
    }
    aiBar = null;
  }

  /** @param {string} content @param {string} [note] @param {string} [kind] */
  function pushAssistant(content, note = '', kind = '') {
    messages = [...messages, { role: 'assistant', content, note, kind }];
  }

  async function applyResult(result, baseHtml, sel, attempt, mySeq) {
    if (result.mode === 'edits') {
      try {
        const { html: next, warnings } = applyAiEditResult(baseHtml, { edits: result.edits }, sel?.paragraphIds ?? null);
        showPending(next, baseHtml, warnings);
        const n = result.edits.length;
        pushAssistant(result.reply, `${n} change${n === 1 ? '' : 's'} made. Review the highlighted text, then Accept or Discard.`);
      } catch (err) {
        // One automatic retry: tell the AI exactly what went wrong so it can quote the text properly.
        if (err.code === 'EDITS_REJECTED' && attempt === 0) {
          const retry = await sendCreateChat(project.id, {
            messages: [
              ...apiMessages(),
              { role: 'assistant', content: result.reply || 'I will make those changes.' },
              { role: 'user', content: `Those edits could not be applied to the document (${err.reasons}). Please redo them: copy the text to find exactly as it appears in the current document, and include a few neighbouring words so each one is unique.` },
            ],
            sources,
            docTypeId,
            documentHtml: baseHtml,
            selection: sel ? { quoted_text: sel.quotedText } : null,
            imports: importedContext.map(c => ({ title: c.title, prompt: c.prompt })),
          });
          if (mySeq !== seq) return;
          return applyResult(retry, baseHtml, sel, 1, mySeq);
        }
        aiBar = null;
        pushAssistant(result.reply || "I couldn't make that change.", err.message, 'error');
      }
    } else if (result.mode === 'full') {
      showPending(result.html, baseHtml, []);
      pushAssistant(
        result.reply,
        hasContent(baseHtml)
          ? 'Rewrote the whole document. Review it, then Accept or Discard.'
          : 'Document written. Review it, then Accept or Discard.'
      );
    } else {
      aiBar = null;
      pushAssistant(result.reply || 'No changes made.');
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || sourcesOverBudget) return;

    // Carrying on with the conversation counts as accepting the last changes.
    if (aiBar && !aiBar.loading) acceptPending();

    sendError = null;
    const baseHtml = editor?.getHTML() ?? html;
    const sel = selection;
    const mySeq = ++seq;

    messages = [...messages, { role: 'user', content: text }];
    input = '';
    clearSelection();
    sending = true;
    aiBar = { loading: true, warning: null, originalHtml: baseHtml };
    scrollChat();

    try {
      const result = await sendCreateChat(project.id, {
        messages: apiMessages(),
        sources,
        docTypeId,
        documentHtml: baseHtml,
        selection: sel ? { quoted_text: sel.quotedText } : null,
        imports: importedContext.map(c => ({ title: c.title, prompt: c.prompt })),
      });
      if (mySeq !== seq) return;
      await applyResult(result, baseHtml, sel, 0, mySeq);
    } catch (err) {
      if (mySeq !== seq) return;
      // Drop the failed turn so the history sent next time stays valid.
      messages = messages.slice(0, -1);
      input = text;
      sendError = err.message;
      aiBar = null;
    } finally {
      if (mySeq === seq) sending = false;
      scrollChat();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function onTranscript(e) {
    input = input.trim() ? `${input.trim()} ${e.detail}` : e.detail;
  }

  // ── Save / export / close ─────────────────────────────────────────────────
  function guessName(content) {
    const match = content.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
    const heading = match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
    return heading || `${docType?.name ?? 'Document'} - ${new Date().toLocaleDateString('en-GB')}`;
  }

  async function save() {
    const content = editor?.getHTML() ?? html;
    if (!hasContent(content)) {
      alert('Nothing to save yet. Write something first.');
      return;
    }
    saving = true;
    try {
      if (deliverableId) {
        await updateDeliverableFromHTML(deliverableId, content);
      } else {
        const name = docName.trim() || guessName(content);
        const { deliverable } = await createCustomDeliverable(project.id, name, content);
        deliverableId = deliverable.id;
        docName = deliverable.deliverable_name ?? name;
      }
      dirty = false;
      justSaved = true;
      dispatch('saved');
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      saving = false;
    }
  }

  async function exportWord() {
    const content = editor?.getHTML() ?? html;
    if (!hasContent(content)) return;
    const { templatePath, styles } = getExportConfigForTemplate(docType?.word_template);
    const filename = buildExportFilename(project, docName.trim() || docType?.name || 'Document');
    exporting = true;
    try {
      await exportHtmlToWord(content, filename, templatePath, styles);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    } finally {
      exporting = false;
    }
  }

  function close() {
    if (dirty && hasContent(editor?.getHTML() ?? html) && !confirm('Leave without saving? Unsaved changes will be lost.')) return;
    dispatch('close');
  }
</script>

<div class="cd">
  <div class="cd-bar">
    <button class="cd-back" on:click={close}><i class="las la-arrow-left"></i> Documents</button>
    <input
      class="cd-title"
      type="text"
      bind:value={docName}
      placeholder="Untitled document"
      readonly={!!deliverableId}
      title={deliverableId ? 'Name is fixed once saved' : 'Name this document'}
    />
    <select class="cd-type" bind:value={docTypeId} title="Document type: sets the Word template and the style example the AI follows" disabled={!docTypes.length}>
      {#if !docTypes.length}<option value={null}>{typesError ? 'Types unavailable' : 'Loading…'}</option>{/if}
      {#each docTypes as d (d.id)}
        <option value={d.id}>{d.name}</option>
      {/each}
    </select>
    <select
      class="cd-type"
      on:change={handleImportChange}
      on:focus={ensureSections}
      disabled={importLoading || sending || !!aiBar || !importGroups.length}
      title="Import an existing document, draft or section into this one, with the prompt that produced it"
    >
      <option value="">{importLoading ? 'Importing…' : 'Import…'}</option>
      {#each importGroups as g (g.label)}
        <optgroup label={g.label}>
          {#each g.items as item (item.value)}
            <option value={item.value}>{item.label}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
    <div class="cd-actions">
      <button class="cd-btn" class:cd-btn--on={sourcesOpen} on:click={() => sourcesOpen = !sourcesOpen} title="Show or hide the sources">
        <i class="las la-database"></i> Sources
      </button>
      <button class="cd-btn cd-btn--primary" disabled={saving || !!aiBar} on:click={save}>
        {#if saving}Saving…{:else if justSaved}<i class="las la-check"></i> Saved{:else}<i class="las la-save"></i> Save{/if}
      </button>
      <button class="cd-btn cd-btn--primary" disabled={exporting || !!aiBar} on:click={exportWord}>
        {#if exporting}Exporting…{:else}<i class="las la-file-word"></i> Export{/if}
      </button>
    </div>
  </div>

  <div class="cd-body" class:cd-body--no-sources={!sourcesOpen}>
    <!-- Kept mounted when hidden so the ticked sources are not lost -->
    <aside class="cd-sources" class:cd-hidden={!sourcesOpen}>
      <CreateSourcePicker {project} {extraChars} disabled={sending} on:change={onSourcesChange} />
    </aside>

    <section class="cd-editor">
      <RichTextEditor
        bind:this={editor}
        content={initialHtml}
        enableSelectionPopup={true}
        highlightBracketPlaceholders
        placeholder="Your document will appear here. Tell the AI what to write, or paste or type your own."
        on:change={onEditorChange}
        on:textselected={handleTextSelected}
      />
    </section>

    <section class="cd-chat">
      <div class="cd-messages" bind:this={chatScroll}>
        {#if messages.length === 0}
          <div class="cd-empty">
            <i class="las la-magic"></i>
            <p>Tell the AI what to write.</p>
            <p class="cd-empty-hint">Pick a document type, tick the sources it can use, then ask. Keep chatting to add, cut or change. Highlight text in the document to point your next message at it.</p>
            <div class="cd-examples">
              {#each EXAMPLE_PROMPTS as p}
                <button class="cd-example" on:click={() => { input = p; inputEl?.focus(); }}>{p}</button>
              {/each}
            </div>
          </div>
        {/if}
        {#each messages as m}
          <div class="cd-msg cd-msg--{m.role}">
            {#if m.role === 'user'}
              <div class="cd-bubble cd-bubble--user">{m.content}</div>
            {:else}
              <div class="cd-bubble cd-bubble--ai" class:cd-bubble--error={m.kind === 'error'} class:cd-bubble--info={m.kind === 'info'}>
                {#if m.content}<p>{@html renderReply(m.content, {}, { inlineCitations: false })}</p>{/if}
                {#if m.note}<p class="cd-note">{m.note}</p>{/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if sendError}<div class="cd-error">{sendError}</div>{/if}

      {#if importedContext.length}
        <div class="cd-imports">
          <span class="cd-imports-label">Prompts attached:</span>
          {#each importedContext as c (c.id)}
            <span class="cd-chip" title={c.prompt.length > 300 ? `${c.prompt.slice(0, 300)}…` : c.prompt}>
              {c.title}
              <button aria-label="Remove {c.title} prompt" on:click={() => removeContext(c.id)}><i class="las la-times"></i></button>
            </span>
          {/each}
        </div>
      {/if}

      {#if selection}
        <div class="cd-selection">
          <i class="las la-quote-left"></i>
          <span class="cd-selection-text">{selection.quotedText.length > 140 ? `${selection.quotedText.slice(0, 140)}…` : selection.quotedText}</span>
          <button class="cd-selection-x" aria-label="Clear highlighted passage" on:click={clearSelection}><i class="las la-times"></i></button>
        </div>
      {/if}

      <div class="cd-input-row">
        <textarea
          bind:this={inputEl}
          bind:value={input}
          on:keydown={handleKeydown}
          rows="3"
          disabled={sending}
          placeholder={sourcesOverBudget ? 'Untick some sources to make room…' : selection ? 'What should I do with the highlighted text?' : 'Tell the AI what to write or change…'}
        ></textarea>
        <VoiceDictationButton class="cd-mic-btn" disabled={sending} on:transcript={onTranscript} />
        <button class="cd-send" on:click={send} disabled={sending || sourcesOverBudget || !input.trim()} title={sourcesOverBudget ? 'Untick some sources to make room' : 'Send'} aria-label="Send">
          <i class="las la-paper-plane"></i>
        </button>
      </div>
    </section>
  </div>
</div>

{#if aiBar}
  <AiEditBar
    loading={aiBar.loading}
    error={null}
    warning={aiBar.warning}
    on:accept={acceptPending}
    on:discard={discardPending}
    on:editagain={editAgain}
    on:cancel={cancelRequest}
  />
{/if}

<style>
  .cd {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 120px);
    min-height: 600px;
    background: var(--color-white);
  }

  /* ── Top bar ── */
  .cd-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    background: var(--color-white);
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .cd-back {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.625rem;
    background: transparent;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.8rem;
    color: var(--color-slate-600);
    cursor: pointer;
  }
  .cd-back:hover { background: var(--color-slate-100); }
  .cd-title {
    flex: 1;
    min-width: 160px;
    padding: 0.35rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-slate-800);
    background: transparent;
    font-family: inherit;
  }
  .cd-title:hover:not([readonly]) { border-color: var(--color-slate-200); }
  .cd-title:focus { outline: none; border-color: var(--color-primary-500); background: var(--color-white); box-shadow: var(--focus-ring-blue); }
  .cd-type {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.8rem;
    color: var(--color-slate-700);
    background: var(--color-white);
    font-family: inherit;
  }
  .cd-actions { display: flex; gap: 0.5rem; }
  .cd-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.8rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
  }
  .cd-btn:hover:not(:disabled) { background: var(--color-slate-50); }
  .cd-btn--on { background: var(--color-primary-50); border-color: var(--color-primary-200); color: var(--color-primary-700); }
  .cd-btn--primary { background: var(--color-primary-600); border-color: var(--color-primary-600); color: var(--color-white); }
  .cd-btn--primary:hover:not(:disabled) { background: var(--color-primary-700); }
  .cd-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Three panes ── */
  .cd-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) 380px;
  }
  .cd-body--no-sources { grid-template-columns: minmax(0, 1fr) 380px; }
  .cd-hidden { display: none; }

  .cd-sources {
    min-height: 0;
    border-right: 1px solid var(--color-slate-200);
    overflow: hidden;
  }

  .cd-editor {
    min-width: 0;
    min-height: 0;
    padding: 1rem;
    background: var(--color-slate-50);
    display: flex;
    flex-direction: column;
  }
  .cd-editor :global(.rich-text-editor) {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .cd-editor :global(.toolbar) { flex-shrink: 0; }
  .cd-editor :global(.editor-content.trp-document-content) {
    flex: 1;
    min-height: 0;
    max-height: none;
    font-size: 1rem;
  }
  .cd-editor :global(.editor-content.trp-document-content p),
  .cd-editor :global(.editor-content.trp-document-content ul),
  .cd-editor :global(.editor-content.trp-document-content ol) { font-size: 1rem; }

  /* ── Chat ── */
  .cd-chat {
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--color-slate-200);
    background: var(--color-white);
  }
  .cd-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .cd-empty {
    margin: auto 0;
    text-align: center;
    color: var(--color-slate-500);
  }
  .cd-empty > i { font-size: 2rem; color: var(--color-primary-500); }
  .cd-empty p { margin: 0.25rem 0; font-size: 0.85rem; }
  .cd-empty-hint { font-size: 0.75rem; line-height: 1.5; color: var(--color-slate-400); }
  .cd-examples { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.75rem; }
  .cd-example {
    text-align: left;
    padding: 0.45rem 0.65rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--color-slate-600);
    cursor: pointer;
    font-family: inherit;
  }
  .cd-example:hover { background: var(--color-primary-50); border-color: var(--color-primary-200); color: var(--color-primary-700); }

  .cd-msg { display: flex; }
  .cd-msg--user { justify-content: flex-end; }
  .cd-bubble {
    max-width: 92%;
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
    font-size: 0.82rem;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .cd-bubble p { margin: 0; }
  .cd-bubble--user { background: var(--color-primary-600); color: var(--color-white); }
  /* Replies are rendered to HTML (bold, bullets, line breaks), so normal whitespace handling. */
  .cd-bubble--ai { white-space: normal; }
  .cd-bubble--ai { background: var(--color-slate-100); color: var(--color-slate-800); }
  .cd-bubble--error { background: var(--color-red-50); color: var(--color-red-600); }
  .cd-bubble--info { background: var(--color-primary-50); color: var(--color-primary-700); }
  .cd-bubble--info .cd-note { color: var(--color-primary-600); }
  .cd-note { margin-top: 0.3rem !important; font-size: 0.72rem; color: var(--color-slate-500); }
  .cd-bubble--error .cd-note { color: var(--color-red-600); }

  .cd-error {
    margin: 0 1rem 0.5rem;
    padding: 0.5rem 0.7rem;
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
    font-size: 0.78rem;
    color: var(--color-red-600);
  }

  .cd-imports {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin: 0 1rem 0.4rem;
    font-size: 0.72rem;
    color: var(--color-slate-500);
  }
  .cd-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    padding: 0.15rem 0.2rem 0.15rem 0.5rem;
    background: var(--color-slate-100);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-pill);
    color: var(--color-slate-700);
  }
  .cd-chip button {
    display: flex;
    background: none;
    border: none;
    padding: 0.1rem;
    color: var(--color-slate-400);
    cursor: pointer;
  }
  .cd-chip button:hover { color: var(--color-slate-700); }

  .cd-selection {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    margin: 0 1rem 0.4rem;
    padding: 0.4rem 0.55rem;
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    border-radius: 6px;
    font-size: 0.75rem;
    color: var(--color-primary-700);
  }
  .cd-selection-text { flex: 1; min-width: 0; line-height: 1.4; overflow-wrap: anywhere; }
  .cd-selection-x { background: none; border: none; padding: 0; color: var(--color-primary-600); cursor: pointer; font-size: 0.9rem; }

  .cd-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--color-slate-200);
  }
  .cd-input-row textarea {
    flex: 1;
    resize: none;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 8px;
    font-size: 0.85rem;
    font-family: inherit;
    line-height: 1.4;
  }
  .cd-input-row textarea:focus { outline: none; border-color: var(--color-primary-500); box-shadow: var(--focus-ring-blue); }
  .cd-input-row textarea:disabled { background: var(--color-slate-50); }
  .cd-input-row :global(.cd-mic-btn) { width: 40px; height: 40px; flex-shrink: 0; }
  .cd-send {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-600);
    color: var(--color-white);
    border: none;
    border-radius: 50%;
    font-size: 1.1rem;
    cursor: pointer;
  }
  .cd-send:hover:not(:disabled) { background: var(--color-primary-700); }
  .cd-send:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 1100px) {
    .cd-body { grid-template-columns: 220px minmax(0, 1fr) 320px; }
    .cd-body--no-sources { grid-template-columns: minmax(0, 1fr) 320px; }
  }
</style>
