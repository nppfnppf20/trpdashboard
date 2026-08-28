<script>
  import { createEventDispatcher, tick, onMount } from 'svelte';
  import { diffArrays, diffWords } from 'diff';
  import { paScopeIncorporation, paIncorporateTargeted } from '$lib/api/planningApplication.js';
  import { generateDocumentSummary, replaceDocumentSummary, getDocumentSummaries } from '$lib/api/projectDocs.js';
  import { getDraftingIssues } from '$lib/api/draftingIssues.js';
  import PromptEditModal from '$lib/components/shared/PromptEditModal.svelte';
  import { actionPromptState, openActionPrompt, closeActionPrompt, saveActionPromptStore, resetActionPromptStore, setPromptText } from '$lib/stores/actionPrompts.js';

  export let project;
  export let typeId;
  export let currentDraftHtml = '';
  export let apiScope = null;           // override for non-PA contexts
  export let apiIncorporate = null;     // override for non-PA contexts
  export let docTypes = null;           // array of { value, label } — when set shows a dropdown
  export let splitAll = false;          // when true, split entire document not just assessment section
  export let manualSelect = false;      // when true, skip LLM scoping — user ticks paragraphs manually
  export let incorporateLabel = null;   // button label override
  export let enableIssueLink = false;   // when true, a "specialist_report" doc type asks which drafting issue this report belongs to

  let selectedDocType = docTypes?.[0]?.value ?? null;

  $: if (docTypes && !docTypes.some(dt => dt.value === selectedDocType)) {
    selectedDocType = docTypes[0]?.value ?? null;
  }

  $: isSpecialistReport = selectedDocType === 'specialist_report';

  // ── Issue link (specialist reports only) ────────────────────────────────────
  const specialistReportPromptState = actionPromptState('incorporate_specialist_report');
  let draftingIssuesList = [];
  let draftingIssuesLoaded = false;
  let selectedIssueId = null;

  async function loadDraftingIssuesIfNeeded() {
    if (draftingIssuesLoaded) return;
    draftingIssuesLoaded = true;
    try {
      draftingIssuesList = await getDraftingIssues(project.id);
    } catch (err) {
      console.error('Failed to load drafting issues:', err);
    }
  }

  $: if (enableIssueLink && isSpecialistReport) loadDraftingIssuesIfNeeded();
  $: if (!isSpecialistReport) selectedIssueId = null;

  $: isProjectDoc = !!docTypes?.find(dt => dt.value === selectedDocType)?.projectDoc;
  $: selectedDocType, resetProjDoc();

  // project doc state machine: idle | generating | preview | saving | saved
  let projDocState = 'idle';
  let projDocSummaryHtml = '';
  let projDocError = null;
  let projDocFileName = null;

  // existing summaries (keyed by doc_type) — loaded once on mount, refreshed after save
  let summariesByType = {};

  async function loadExistingSummaries() {
    try {
      const rows = await getDocumentSummaries(project.id);
      summariesByType = Object.fromEntries(rows.map(r => [r.doc_type, r]));
    } catch (_) { /* non-critical */ }
  }

  onMount(loadExistingSummaries);

  $: existingSummary = isProjectDoc ? (summariesByType[selectedDocType] ?? null) : null;

  function resetProjDoc() {
    projDocState = 'idle';
    projDocSummaryHtml = '';
    projDocError = null;
    projDocFileName = null;
  }

  async function startProjectDocSummary() {
    if (inputTab === 'upload' && !uploadFile) return;
    if (inputTab === 'paste' && !pasteText.trim()) return;
    projDocError = null;
    projDocState = 'generating';
    try {
      const result = await generateDocumentSummary(project.id, {
        file: inputTab === 'upload' ? uploadFile : null,
        text: inputTab === 'paste' ? pasteText : null,
        fileName: inputTab === 'upload' ? uploadFile.name : (pasteTitle || null),
        docType: selectedDocType
      });
      projDocSummaryHtml = result.summary_html;
      projDocFileName = result.file_name ?? null;
      projDocState = 'preview';
    } catch (err) {
      projDocError = err.message;
      projDocState = 'idle';
    }
  }

  async function saveProjectDoc() {
    projDocState = 'saving';
    const docTypeLabel = docTypes?.find(dt => dt.value === selectedDocType)?.label ?? selectedDocType;
    const titleVal = (inputTab === 'upload' ? (uploadTitle || uploadFile?.name) : pasteTitle) || docTypeLabel;
    try {
      await replaceDocumentSummary(project.id, {
        title: titleVal,
        file_name: projDocFileName || null,
        doc_type: selectedDocType,
        summary_html: projDocSummaryHtml
      });
      projDocState = 'saved';
      await loadExistingSummaries();
      dispatch('summarysaved', { docType: selectedDocType, summaryHtml: projDocSummaryHtml });
    } catch (err) {
      projDocError = err.message;
      projDocState = 'preview';
    }
  }

  const scopeState       = actionPromptState('scope_incorporation');
  const incorporateState = actionPromptState('incorporate_assessment');

  const dispatch = createEventDispatcher();

  // idle | uploading | scoping | scoped | incorporating | review
  let panelState = 'idle';
  let reviewRowsEl;

  let inputTab = 'upload';
  let pasteText = '';
  let pasteTitle = '';
  let uploadFile = null;
  let uploadLabel = '';
  let uploadTitle = '';
  let docDragOver = false;
  let docFileInput;
  let uploadError = null;
  let userNotes = '';
  let incorporateError = null;
  let suggestedHtml = '';
  let changeGroups = [];

  // scoping state
  let allParagraphs = [];
  let scopeSummary = '';
  let scopedIds = new Set();
  let scopeError = null;

  // ── Paragraph splitting ──────────────────────────────────────────────────────
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

  function splitAssessmentParagraphs(html) {
    if (!html?.trim()) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstChild;
    if (!root) return [];

    // Find the Planning Assessment <h2> node
    let inAssessment = false;
    const blocks = [];
    let idx = 0;

    root.childNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (tag === 'h2') {
        const text = node.textContent.trim().toLowerCase();
        inAssessment = text.includes('planning assessment') || text.includes('assessment');
        // Include the heading itself so the LLM has section context
        if (inAssessment) blocks.push({ id: `p${idx++}`, html: node.outerHTML, text: node.textContent.trim() });
      } else if (inAssessment) {
        blocks.push({ id: `p${idx++}`, html: node.outerHTML, text: node.textContent.trim() });
      }
    });

    return blocks;
  }

  // â"€â"€ File handling â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function onDrop(e) {
    e.preventDefault();
    docDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) selectFile(file);
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) selectFile(file);
  }

  function selectFile(file) {
    uploadFile = file;
    uploadLabel = file.name;
    uploadError = null;
  }

  // â"€â"€ Scoping â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  async function startIncorporate() {
    if (inputTab === 'upload' && !uploadFile) return;
    if (inputTab === 'paste' && !pasteText.trim()) return;

    scopeError = null;
    incorporateError = null;
    suggestedHtml = '';
    changeGroups = [];

    await runScope();
  }

  async function runScope() {
    panelState = 'scoping';
    allParagraphs = (splitAll ? splitAllParagraphs : splitAssessmentParagraphs)(currentDraftHtml);

    // Manual selection: skip LLM scoping entirely — user ticks paragraphs themselves
    if (manualSelect || splitAll) {
      scopedIds = new Set();
      scopeSummary = '';
      if (!allParagraphs.length) {
        scopeError = 'No content found in the draft, open the draft and make sure it has been generated.';
      }
      panelState = 'scoped';
      return;
    }

    if (!allParagraphs.length) {
      scopeError = 'No paragraphs found in the draft assessment section.';
      panelState = 'scoped';
      return;
    }

    try {
      const payload = inputTab === 'upload'
        ? { file: uploadFile, documentTitle: uploadTitle || null, paragraphs: allParagraphs.map(p => ({ id: p.id, text: p.text })) }
        : { documentText: pasteText, documentTitle: pasteTitle || 'Pasted document', paragraphs: allParagraphs.map(p => ({ id: p.id, text: p.text })) };

      const result = await (apiScope ?? paScopeIncorporation)(project.id, typeId, { ...payload, docType: selectedDocType });
      scopeSummary = result.summary ?? '';
      scopedIds = new Set(result.relevant_ids ?? []);
      panelState = 'scoped';
    } catch (err) {
      scopeError = err.message;
      panelState = 'scoped';
    }
  }

  async function runIncorporate(paragraphsOverride = null) {
    incorporateError = null;
    panelState = 'incorporating';

    const targeted = paragraphsOverride ?? allParagraphs.filter(p => scopedIds.has(p.id));

    if (!targeted.length) {
      incorporateError = 'No paragraphs selected â€" tick at least one to update.';
      panelState = 'scoped';
      return;
    }

    try {
      const payload = inputTab === 'upload'
        ? { file: uploadFile, documentTitle: uploadTitle || null, paragraphs: targeted, userNotes: userNotes || null }
        : { documentText: pasteText, documentTitle: pasteTitle || 'Pasted document', paragraphs: targeted, userNotes: userNotes || null };

      const issueId = enableIssueLink && isSpecialistReport ? selectedIssueId : null;
      const result = await (apiIncorporate ?? paIncorporateTargeted)(project.id, typeId, { ...payload, docType: selectedDocType, issueId });

      const updatedMap = {};
      const insertionsAfter = {};
      for (const p of (result.updated ?? [])) {
        if (p.id.startsWith('INSERT_AFTER_')) {
          const anchorId = p.id.replace('INSERT_AFTER_', '');
          if (!insertionsAfter[anchorId]) insertionsAfter[anchorId] = [];
          insertionsAfter[anchorId].push(p.html);
        } else {
          updatedMap[p.id] = p.html;
        }
      }

      // Reconstruct: merge updated assessment paragraphs back into the full draft
      const updatedAssessmentParts = [];
      for (const p of allParagraphs) {
        updatedAssessmentParts.push(updatedMap[p.id] ?? p.html);
        if (insertionsAfter[p.id]) updatedAssessmentParts.push(...insertionsAfter[p.id]);
      }

      // Deduplicate conclusion paragraphs — keep only the last one.
      // A conclusion paragraph contains "considered to comply with" or "therefore comply".
      const isConclusion = html => /considered to comply with|therefore comply/i.test(
        html.replace(/<[^>]+>/g, '')
      );
      const conclusionIndices = updatedAssessmentParts.reduce((acc, html, i) => {
        if (isConclusion(html)) acc.push(i);
        return acc;
      }, []);
      // If more than one conclusion found, remove all but the last
      if (conclusionIndices.length > 1) {
        const toRemove = new Set(conclusionIndices.slice(0, -1));
        updatedAssessmentParts.splice(0, updatedAssessmentParts.length,
          ...updatedAssessmentParts.filter((_, i) => !toRemove.has(i))
        );
      }

      const updatedAssessmentHtml = updatedAssessmentParts.join('\n');

      // For splitAll mode the paragraphs cover the whole document — use directly.
      // Otherwise splice updated paragraphs back into the Planning Assessment section.
      suggestedHtml = splitAll
        ? updatedAssessmentHtml
        : replaceAssessmentSection(currentDraftHtml, updatedAssessmentHtml);
      changeGroups = computeParagraphDiff(currentDraftHtml, suggestedHtml);
      panelState = 'review';
      dispatch('reviewchange', { active: true });
      await tick();
      reviewRowsEl?.querySelector('.review-row--changed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      incorporateError = err.message;
      panelState = 'scoped';
    }
  }

  // Replace the planning assessment section in the full HTML with new HTML
  function replaceAssessmentSection(fullHtml, newAssessmentHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${fullHtml}</div>`, 'text/html');
    const root = doc.body.firstChild;
    if (!root) return fullHtml;

    const nodes = Array.from(root.childNodes);
    let inAssessment = false;
    let assessmentStart = -1;
    let assessmentEnd = nodes.length;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.nodeType !== 1) continue;
      const tag = node.tagName.toLowerCase();
      if (tag === 'h2') {
        const text = node.textContent.trim().toLowerCase();
        if (text.includes('planning assessment') || text.includes('assessment')) {
          inAssessment = true;
          assessmentStart = i;
        } else if (inAssessment) {
          assessmentEnd = i;
          break;
        }
      }
    }

    if (assessmentStart === -1) return fullHtml;

    const before = nodes.slice(0, assessmentStart).map(n => n.outerHTML ?? n.textContent).join('\n');
    const after = nodes.slice(assessmentEnd).map(n => n.outerHTML ?? n.textContent).join('\n');
    return [before, newAssessmentHtml, after].filter(Boolean).join('\n');
  }

  // â"€â"€ Accept / discard â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function acceptAll() {
    changeGroups = changeGroups.map(g => g.type === 'unchanged' ? g : { ...g, accepted: true });
    commitAccepted();
  }

  function commitAccepted() {
    const html = buildFinalHtml(changeGroups);
    dispatch('accepted', { html });
    reset();
  }

  function toggleGroup(idx) {
    changeGroups = changeGroups.map((g, i) => i === idx ? { ...g, accepted: !g.accepted } : g);
  }

  function discard() { reset(); }

  function reset() {
    panelState = 'idle';
    uploadFile = null;
    uploadLabel = '';
    suggestedHtml = '';
    changeGroups = [];
    incorporateError = null;
    resetProjDoc();
    dispatch('reviewchange', { active: false });
  }

  // â"€â"€ Paragraph diff â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
        for (let j = 0; j < pairs; j++) groups.push({ type: 'modified', oldHtml: oldVals[j], newHtml: newVals[j], accepted: true, words: wordDiff(oldVals[j], newVals[j]) });
        for (let j = pairs; j < oldVals.length; j++) groups.push({ type: 'removed', html: oldVals[j], accepted: true, words: wordDiff(oldVals[j], '') });
        for (let j = pairs; j < newVals.length; j++) groups.push({ type: 'added', html: newVals[j], accepted: true, words: wordDiff('', newVals[j]) });
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

  function stripHtml(html) { return (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function wordDiff(oldHtml, newHtml) { return diffWords(stripHtml(oldHtml), stripHtml(newHtml)); }

  function buildFinalHtml(groups) {
    return groups.map(g => {
      if (g.type === 'unchanged') return g.html;
      if (g.type === 'added')    return g.accepted ? g.html : '';
      if (g.type === 'removed')  return g.accepted ? '' : g.html;
      if (g.type === 'modified') return g.accepted ? g.newHtml : g.oldHtml;
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
</script>

<div class="panel">

  {#if panelState === 'idle'}
    {#if docTypes}
      <div class="doc-type-row">
        <label class="doc-type-label">Document type</label>
        <select class="doc-type-select" bind:value={selectedDocType}>
          {#if docTypes.some(dt => dt.projectDoc)}
            <optgroup label="Planning Statement Variables">
              {#each docTypes.filter(dt => dt.projectDoc) as dt}
                <option value={dt.value}>{dt.label}</option>
              {/each}
            </optgroup>
            <optgroup label="Survey Reports">
              {#each docTypes.filter(dt => !dt.projectDoc) as dt}
                <option value={dt.value}>{dt.label}</option>
              {/each}
            </optgroup>
          {:else}
            {#each docTypes as dt}
              <option value={dt.value}>{dt.label}</option>
            {/each}
          {/if}
        </select>
      </div>
    {/if}

    {#if enableIssueLink && isSpecialistReport}
      <div class="doc-type-row">
        <label class="doc-type-label">For issue</label>
        <select class="doc-type-select" bind:value={selectedIssueId}>
          <option value={null}>Select an issue...</option>
          {#each draftingIssuesList as issue (issue.id)}
            <option value={issue.id}>{issue.label}{issue.discipline ? ` (${issue.discipline})` : ''}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if isProjectDoc && projDocState !== 'idle'}
      {#if projDocState === 'generating'}
        <div class="loading-state">
          <div class="spinner"></div>
          <div class="loading-text">
            <span>Generating summary...</span>
            <span class="loading-sub">Summarising document for planning statement</span>
          </div>
        </div>
      {:else}
        <div class="proj-preview">
          <div class="proj-preview-header">
            <span class="proj-preview-title">{docTypes?.find(dt => dt.value === selectedDocType)?.label ?? selectedDocType}</span>
            <button class="btn-secondary" on:click={() => { projDocState = 'idle'; projDocSummaryHtml = ''; projDocError = null; }}>Replace</button>
          </div>
          <div class="proj-preview-body">
            {@html projDocSummaryHtml}
          </div>
          {#if projDocError}<p class="proj-error-msg">{projDocError}</p>{/if}
          {#if existingSummary && projDocState !== 'saved'}
            <p class="proj-replace-warning"><i class="las la-exclamation-triangle"></i> Saving will replace the existing {docTypes?.find(dt => dt.value === selectedDocType)?.label ?? ''} summary.</p>
          {/if}
          <div class="proj-preview-actions">
            {#if projDocState === 'saved'}
              <span class="proj-saved-badge"><i class="las la-check-circle"></i> Saved, planning statement will use this on next generate</span>
            {:else}
              <button class="incorporate-btn" disabled={projDocState === 'saving'} on:click={saveProjectDoc}>
                {#if projDocState === 'saving'}<div class="mini-spinner"></div> Saving...{:else}<i class="las la-save"></i> {existingSummary ? 'Replace summary' : 'Save summary'}{/if}
              </button>
            {/if}
          </div>
        </div>
      {/if}
    {:else}
    {#if isProjectDoc}
      {#if existingSummary}
        <div class="existing-summary-notice existing-summary-notice--has">
          <i class="las la-check-circle"></i>
          <span>Existing summary saved ({new Date(existingSummary.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}). Upload a new document to replace it.</span>
        </div>
      {:else}
        <div class="existing-summary-notice existing-summary-notice--none">
          <i class="las la-exclamation-circle"></i>
          <span>No summary saved yet for this variable. Generate one below.</span>
        </div>
      {/if}
    {/if}
    <div class="input-tabs">
      <button class="input-tab" class:active={inputTab === 'upload'} on:click={() => inputTab = 'upload'}>
        <i class="las la-upload"></i> Upload
      </button>
      <button class="input-tab" class:active={inputTab === 'paste'} on:click={() => inputTab = 'paste'}>
        <i class="las la-paste"></i> Paste text
      </button>
    </div>

    {#if inputTab === 'upload'}
      <div
        class="upload-zone"
        class:drag-over={docDragOver}
        class:file-selected={!!uploadFile}
        on:dragover|preventDefault={() => docDragOver = true}
        on:dragleave={() => docDragOver = false}
        on:drop={onDrop}
        on:click={() => docFileInput.click()}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && docFileInput.click()}
      >
        {#if uploadFile}
          <i class="las la-file-check" style="color:var(--color-emerald-600)"></i>
          <span>{uploadLabel}</span>
          <span class="upload-sub">Click to replace</span>
        {:else}
          <i class="las la-cloud-upload-alt"></i>
          <span>{isProjectDoc ? 'Drop the document or click to upload' : 'Drop a specialist report or click to upload'}</span>
          <span class="upload-sub">PDF, TXT or MD</span>
        {/if}
      </div>
      <input type="file" accept=".pdf,.txt,.md" bind:this={docFileInput} on:change={onFileChange} style="display:none" />
      {#if uploadError}<p class="error-msg">{uploadError}</p>{/if}

      <input
        class="paste-title-input"
        type="text"
        placeholder="Document title (e.g. Heritage Statement), leave blank and Claude will derive one"
        bind:value={uploadTitle}
        style="margin: 0 1rem 0; width: calc(100% - 2rem); box-sizing: border-box;"
      />

      <div class="notes-area">
        <label class="notes-label">
          <i class="las la-pen"></i> Your notes
          <span class="notes-hint">Tell Claude what to focus on, high priority in the prompt</span>
        </label>
        <textarea class="notes-textarea" placeholder="e.g. Focus on the transport conclusions in section 4..." bind:value={userNotes}></textarea>
      </div>

      <div class="idle-actions">
        {#if isProjectDoc}
          <button class="incorporate-btn" disabled={!uploadFile} on:click={startProjectDocSummary}>
            <i class="las la-magic"></i> Generate Summary
          </button>
        {:else}
          <button class="incorporate-btn" disabled={!uploadFile || (enableIssueLink && isSpecialistReport && !selectedIssueId)} on:click={startIncorporate}>
            <i class="las la-file-import"></i> {incorporateLabel ?? 'Incorporate into assessment'}
          </button>
          {#if enableIssueLink && isSpecialistReport}
            <button class="prompt-info-btn" title="Edit specialist report prompt" on:click={() => openActionPrompt('incorporate_specialist_report')}><i class="las la-code-branch"></i></button>
          {:else}
            <button class="prompt-info-btn" title="Edit scope prompt" on:click={() => openActionPrompt('scope_incorporation')}><i class="las la-sliders-h"></i></button>
            <button class="prompt-info-btn" title="Edit incorporate prompt" on:click={() => openActionPrompt('incorporate_assessment')}><i class="las la-code-branch"></i></button>
          {/if}
        {/if}
      </div>
      {#if enableIssueLink && isSpecialistReport && !selectedIssueId}<p class="error-msg">Select which issue this report is for before incorporating.</p>{/if}
      {#if projDocError && isProjectDoc}<p class="error-msg">{projDocError}</p>{/if}

    {:else}
      <div class="paste-area">
        <input class="paste-title-input" type="text" placeholder="Document title (optional)" bind:value={pasteTitle} />
        <textarea class="paste-textarea" placeholder="Paste the document text here..." bind:value={pasteText}></textarea>
        <div class="notes-area notes-area--inline">
          <label class="notes-label">
            <i class="las la-pen"></i> Your notes
            <span class="notes-hint">Tell Claude what to focus on â€" high priority</span>
          </label>
          <textarea class="notes-textarea" placeholder="e.g. Focus only on transport conclusions..." bind:value={userNotes}></textarea>
        </div>
        <div class="idle-actions idle-actions--inline">
          {#if isProjectDoc}
            <button class="incorporate-btn incorporate-btn--full" disabled={!pasteText.trim()} on:click={startProjectDocSummary}>
              <i class="las la-magic"></i> Generate Summary
            </button>
          {:else}
            <button class="incorporate-btn incorporate-btn--full" disabled={!pasteText.trim() || (enableIssueLink && isSpecialistReport && !selectedIssueId)} on:click={startIncorporate}>
              <i class="las la-file-import"></i> {incorporateLabel ?? 'Incorporate into assessment'}
            </button>
            {#if enableIssueLink && isSpecialistReport}
              <button class="prompt-info-btn" title="Edit specialist report prompt" on:click={() => openActionPrompt('incorporate_specialist_report')}><i class="las la-code-branch"></i></button>
            {:else}
              <button class="prompt-info-btn" title="Edit scope prompt" on:click={() => openActionPrompt('scope_incorporation')}><i class="las la-sliders-h"></i></button>
              <button class="prompt-info-btn" title="Edit incorporate prompt" on:click={() => openActionPrompt('incorporate_assessment')}><i class="las la-code-branch"></i></button>
            {/if}
          {/if}
        </div>
        {#if enableIssueLink && isSpecialistReport && !selectedIssueId}<p class="error-msg">Select which issue this report is for before incorporating.</p>{/if}
        {#if projDocError && isProjectDoc}<p class="error-msg">{projDocError}</p>{/if}
      </div>
    {/if}
    {/if}

  {:else if panelState === 'scoping'}
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">
        <span>Identifying relevant assessment paragraphs...</span>
        <span class="loading-sub">Reading document against planning assessment</span>
      </div>
    </div>

  {:else if panelState === 'scoped'}
    <div class="scoped-panel">
      <div class="scoped-header">
        <span class="scoped-title"><i class="las la-search"></i> {uploadFile?.name ?? (pasteTitle || 'Document')}</span>
        {#if scopeSummary}<p class="scoped-summary">{scopeSummary}</p>{/if}
        {#if scopeError}<p class="scoped-error"><i class="las la-exclamation-circle"></i> Scoping failed â€" select paragraphs manually.</p>{/if}
      </div>

      <div class="scoped-instruct-row">
        <p class="scoped-instruct">
          {#if manualSelect || splitAll}
            Tick the paragraphs you want to update, then click Incorporate.
          {:else}
            {scopedIds.size} paragraph{scopedIds.size !== 1 ? 's' : ''} identified in the Planning Assessment. Review and adjust, then incorporate.
          {/if}
        </p>
        <div class="scoped-select-all">
          {#if scopedIds.size === allParagraphs.filter(p => !getHeadingLevel(p.html)).length}
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
                {isSectionSelected(idx) ? 'Deselect section' : 'Select section'}
              </button>
            </div>
          {:else}
            <label class="scoped-item" class:selected={checked}>
              <input type="checkbox" {checked} on:change={() => {
                const next = new Set(scopedIds);
                if (next.has(para.id)) next.delete(para.id); else next.add(para.id);
                scopedIds = next;
              }} />
              <span class="scoped-item-text">{para.text.slice(0, 100)}{para.text.length > 100 ? '...' : ''}</span>
            </label>
          {/if}
        {/each}
      </div>

      {#if incorporateError}<p class="error-msg error-msg--padded">{incorporateError}</p>{/if}

      <div class="scoped-actions">
        <button class="btn-secondary" on:click={discard}>Cancel</button>
        <button class="btn-primary" disabled={scopedIds.size === 0} on:click={() => runIncorporate()}>
          <i class="las la-file-import"></i> Incorporate {scopedIds.size} paragraph{scopedIds.size !== 1 ? 's' : ''}
        </button>
        <button class="prompt-info-btn" title="Edit incorporate prompt" on:click={() => openActionPrompt('incorporate_assessment')}><i class="las la-sliders-h"></i></button>
      </div>
    </div>

  {:else if panelState === 'incorporating'}
    <div class="loading-state">
      <div class="spinner"></div>
      <div class="loading-text">
        <span>Updating {scopedIds.size} paragraph{scopedIds.size !== 1 ? 's' : ''}...</span>
        <span class="loading-sub">This may take 15â€"30 seconds</span>
      </div>
    </div>

  {:else if panelState === 'review'}
    <div class="review-layout">
      <div class="review-bar">
        <div class="review-bar-left">
          <span class="review-bar-title">{uploadFile?.name ?? (pasteTitle || 'Document')}</span>
          <span class="review-bar-count">{acceptedCount}/{changedCount} changes accepted</span>
        </div>
        <div class="review-bar-actions">
          <button class="btn-discard" on:click={discard}>Discard</button>
          <button class="btn-accept-all" on:click={acceptAll}><i class="las la-check-double"></i> Accept all</button>
          <button class="btn-commit" disabled={acceptedCount === 0} on:click={commitAccepted}><i class="las la-check"></i> Apply</button>
        </div>
      </div>

      {#if incorporateError}<p class="error-msg" style="padding:0.375rem 1rem;flex-shrink:0">{incorporateError}</p>{/if}

      <div class="review-rows" bind:this={reviewRowsEl}>
        {#if changeGroups.length === 0}
          <p class="diff-no-changes">No changes suggested.</p>
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
                      {:else if group.type === 'removed'}<span class="change-tag change-tag--removed">âˆ' Removed</span>
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

<!-- Prompt edit modals -->
<PromptEditModal
  open={$scopeState.open}
  title="Edit Prompt: Scope Incorporation"
  promptText={$scopeState.text}
  contextTemplate={$scopeState.contextTemplate}
  loading={$scopeState.loading}
  saving={$scopeState.saving}
  saved={$scopeState.saved}
  on:close={() => closeActionPrompt('scope_incorporation')}
  on:change={(e) => setPromptText('scope_incorporation', e.detail)}
  on:save={() => saveActionPromptStore('scope_incorporation')}
  on:reset={() => resetActionPromptStore('scope_incorporation')}
/>

<PromptEditModal
  open={$incorporateState.open}
  title="Edit Prompt: Incorporate into Assessment"
  promptText={$incorporateState.text}
  contextTemplate={$incorporateState.contextTemplate}
  loading={$incorporateState.loading}
  saving={$incorporateState.saving}
  saved={$incorporateState.saved}
  on:close={() => closeActionPrompt('incorporate_assessment')}
  on:change={(e) => setPromptText('incorporate_assessment', e.detail)}
  on:save={() => saveActionPromptStore('incorporate_assessment')}
  on:reset={() => resetActionPromptStore('incorporate_assessment')}
/>

<PromptEditModal
  open={$specialistReportPromptState.open}
  title="Edit Prompt: Incorporate Specialist Report"
  promptText={$specialistReportPromptState.text}
  contextTemplate={$specialistReportPromptState.contextTemplate}
  loading={$specialistReportPromptState.loading}
  saving={$specialistReportPromptState.saving}
  saved={$specialistReportPromptState.saved}
  on:close={() => closeActionPrompt('incorporate_specialist_report')}
  on:change={(e) => setPromptText('incorporate_specialist_report', e.detail)}
  on:save={() => saveActionPromptStore('incorporate_specialist_report')}
  on:reset={() => resetActionPromptStore('incorporate_specialist_report')}
/>

<style>
  .panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--color-slate-50); }

  .doc-type-row { display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 0.875rem; background: white; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0; }
  .doc-type-label { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); white-space: nowrap; }
  .doc-type-select { flex: 1; padding: 0.3rem 0.5rem; border: 1px solid var(--color-slate-200); border-radius: 6px; font-size: 0.8rem; font-family: inherit; color: var(--color-slate-700); background: white; cursor: pointer; }
  .doc-type-select:focus { outline: none; border-color: var(--color-violet-600); }

  .input-tabs { display: flex; flex-shrink: 0; border-bottom: 1px solid var(--color-slate-200); background: white; }
  .input-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.625rem; border: none; background: transparent; font-size: 0.8rem; font-weight: 500; color: var(--color-slate-500); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; font-family: inherit; transition: all 0.15s; }
  .input-tab.active { color: var(--color-violet-600); border-bottom-color: var(--color-violet-600); }
  .input-tab:hover:not(.active) { color: var(--color-slate-700); }

  .upload-zone { flex-shrink: 0; margin: 1rem; border: 2px dashed var(--color-slate-300); border-radius: 8px; padding: 1.25rem 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.3rem; cursor: pointer; transition: all 0.15s; background: white; text-align: center; }
  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--color-violet-600); background: var(--color-purple-50); }
  .upload-zone.file-selected { border-color: var(--color-slate-400); background: var(--color-slate-100); }
  .upload-zone i { font-size: 1.5rem; color: var(--color-slate-400); }
  .upload-zone span { font-size: 0.8125rem; color: var(--color-slate-600); font-weight: 500; }
  .upload-sub { font-size: 0.75rem !important; color: var(--color-slate-400) !important; font-weight: 400 !important; }

  .error-msg { font-size: 0.8rem; color: var(--color-red-500); margin: 0 1rem 0.5rem; }
  .error-msg--padded { padding: 0 1rem; }
  .proj-error-msg { font-size: 0.8rem; color: var(--color-red-500); padding: 0 1rem 0.5rem; margin: 0; }

  .notes-area { flex-shrink: 0; padding: 0 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; }
  .notes-area--inline { padding: 0; }
  .notes-label { display: flex; align-items: baseline; gap: 0.375rem; font-size: 0.75rem; font-weight: 600; color: var(--color-slate-700); }
  .notes-hint { font-size: 0.7rem; font-weight: 400; color: var(--color-slate-400); }
  .notes-textarea { width: 100%; box-sizing: border-box; padding: 0.5rem 0.625rem; border: 1px solid var(--color-slate-200); border-radius: 6px; font-size: 0.8rem; font-family: inherit; color: var(--color-slate-700); background: var(--color-red-50); resize: none; line-height: 1.5; min-height: 64px; transition: border-color 0.15s; }
  .notes-textarea:focus { outline: none; border-color: var(--color-amber-500); background: white; }
  .notes-textarea::placeholder { color: var(--color-slate-400); }

  .idle-actions { padding: 0 1rem 1rem; display: flex; align-items: center; gap: 0.5rem; }
  .idle-actions--inline { padding: 0.5rem 0 0; }

  .prompt-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: transparent;
    border: 1px solid var(--color-slate-300);
    border-radius: 0.25rem;
    color: var(--color-slate-400);
    cursor: pointer;
    font-size: 0.8rem;
    flex-shrink: 0;
    transition: color 0.15s, border-color 0.15s;
  }
  .prompt-info-btn:hover { color: var(--color-primary-500); border-color: var(--color-primary-500); }
  .incorporate-btn { display: flex; align-items: center; gap: 0.3rem; padding: 0.45rem 0.875rem; background: var(--color-violet-600); color: white; border: none; border-radius: 5px; font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
  .incorporate-btn:hover:not(:disabled) { background: var(--color-violet-700); }
  .incorporate-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .incorporate-btn--full { width: 100%; justify-content: center; }

  .paste-area { display: flex; flex-direction: column; gap: 0.625rem; padding: 1rem; flex: 1; min-height: 0; }
  .paste-title-input { padding: 0.5rem 0.75rem; border: 1px solid var(--color-slate-200); border-radius: 6px; font-size: 0.8125rem; font-family: inherit; color: var(--color-slate-800); background: white; flex-shrink: 0; }
  .paste-title-input:focus { outline: none; border-color: var(--color-violet-600); }
  .paste-title-input::placeholder { color: var(--color-slate-400); }
  .paste-textarea { flex: 1; min-height: 200px; padding: 0.625rem 0.75rem; border: 1px solid var(--color-slate-200); border-radius: 6px; font-size: 0.8rem; font-family: inherit; color: var(--color-slate-700); background: white; resize: none; line-height: 1.5; }
  .paste-textarea:focus { outline: none; border-color: var(--color-violet-600); }
  .paste-textarea::placeholder { color: var(--color-slate-400); }

  .loading-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: var(--color-slate-500); font-size: 0.875rem; }
  .loading-text { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
  .loading-sub { font-size: 0.75rem; color: var(--color-slate-400); }

  .scoped-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .scoped-header { flex-shrink: 0; padding: 1rem; border-bottom: 1px solid var(--color-slate-200); background: white; display: flex; flex-direction: column; gap: 0.375rem; }
  .scoped-title { font-size: 0.8125rem; font-weight: 700; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.375rem; }
  .scoped-summary { margin: 0; font-size: 0.8rem; color: var(--color-slate-600); line-height: 1.5; background: var(--color-primary-50); border: 1px solid var(--color-primary-200); border-radius: 5px; padding: 0.5rem 0.625rem; }
  .scoped-error { margin: 0; font-size: 0.75rem; color: var(--color-red-600); display: flex; align-items: center; gap: 0.3rem; }
  .scoped-instruct-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.5rem 0.75rem 0.5rem 1rem; border-bottom: 1px solid var(--color-slate-100); flex-shrink: 0; }
  .scoped-instruct { margin: 0; font-size: 0.75rem; color: var(--color-slate-500); }
  .scoped-select-all { flex-shrink: 0; }
  .scoped-selectall-btn { padding: 0.25rem 0.625rem; background: white; border: 1px solid var(--color-slate-200); border-radius: 5px; font-size: 0.75rem; color: var(--color-slate-700); cursor: pointer; font-family: inherit; white-space: nowrap; }
  .scoped-selectall-btn:hover { background: var(--color-slate-100); border-color: var(--color-slate-300); }
  .scoped-list { flex: 1; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; }
  .scoped-item { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem 0.625rem; border: 1px solid var(--color-slate-200); border-radius: 6px; background: white; cursor: pointer; transition: all 0.12s; font-size: 0; }
  .scoped-item.selected { background: var(--color-slate-100); border-color: var(--color-slate-400); }
  .scoped-item input[type="checkbox"] { flex-shrink: 0; margin-top: 0.1rem; accent-color: var(--color-emerald-600); }
  .scoped-item-text { font-size: 0.75rem; color: var(--color-slate-700); line-height: 1.4; }
  .scoped-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.5rem 0.625rem 0.25rem; margin-top: 0.375rem; border-bottom: 1px solid var(--color-slate-200); }
  .scoped-heading-text { font-size: 0.75rem; font-weight: 700; color: var(--color-slate-800); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scoped-section-btn { flex-shrink: 0; padding: 0.15rem 0.5rem; background: white; border: 1px solid var(--color-slate-200); border-radius: 4px; font-size: 0.68rem; font-weight: 500; color: var(--color-violet-600); cursor: pointer; font-family: inherit; white-space: nowrap; transition: all 0.12s; }
  .scoped-section-btn:hover { background: var(--color-purple-50); border-color: var(--color-violet-300); }
  .scoped-actions { flex-shrink: 0; display: flex; gap: 0.5rem; padding: 0.75rem 1rem; border-top: 1px solid var(--color-slate-200); background: white; }

  .btn-primary { padding: 0.4rem 0.875rem; background: var(--color-violet-600); color: white; border: none; border-radius: 6px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; font-family: inherit; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary { padding: 0.4rem 0.75rem; background: white; color: var(--color-slate-500); border: 1px solid var(--color-slate-200); border-radius: 6px; font-size: 0.8125rem; cursor: pointer; font-family: inherit; }

  .review-layout { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  .review-bar { flex-shrink: 0; display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 1rem; background: white; border-bottom: 2px solid var(--color-slate-200); flex-wrap: wrap; }
  .review-bar-left { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; flex: 1; }
  .review-bar-title { font-size: 0.8rem; font-weight: 700; color: var(--color-slate-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
  .review-bar-count { font-size: 0.7rem; color: var(--color-slate-500); }
  .review-bar-actions { display: flex; gap: 0.375rem; flex-shrink: 0; }

  .btn-discard { padding: 0.4rem 0.75rem; background: white; color: var(--color-slate-500); border: 1px solid var(--color-slate-200); border-radius: 6px; font-size: 0.8125rem; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .btn-discard:hover { background: var(--color-slate-100); }
  .btn-accept-all { display: flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.625rem; background: var(--color-emerald-600); color: white; border: none; border-radius: 5px; font-size: 0.75rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
  .btn-accept-all:hover { background: var(--color-green-800); }
  .btn-commit { display: flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.625rem; background: var(--color-violet-600); color: white; border: none; border-radius: 5px; font-size: 0.75rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
  .btn-commit:hover:not(:disabled) { background: var(--color-violet-700); }
  .btn-commit:disabled { opacity: 0.4; cursor: not-allowed; }

  .existing-summary-notice { display: flex; align-items: flex-start; gap: 0.4rem; padding: 0.5rem 0.875rem; font-size: 0.75rem; line-height: 1.4; flex-shrink: 0; }
  .existing-summary-notice i { flex-shrink: 0; margin-top: 0.05rem; }
  .existing-summary-notice--has { background: var(--color-slate-100); color: var(--color-green-800); border-bottom: 1px solid var(--color-emerald-100); }
  .existing-summary-notice--none { background: var(--color-red-50); color: var(--color-amber-800); border-bottom: 1px solid var(--color-amber-200); }
  .proj-replace-warning { display: flex; align-items: center; gap: 0.375rem; margin: 0; padding: 0.375rem 1rem; font-size: 0.75rem; color: var(--color-orange-700); background: var(--color-red-50); border-top: 1px solid var(--color-amber-200); flex-shrink: 0; }

  .proj-preview { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  .proj-preview-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.625rem 1rem; background: white; border-bottom: 1px solid var(--color-slate-200); }
  .proj-preview-title { font-size: 0.8rem; font-weight: 700; color: var(--color-slate-800); }
  .proj-preview-body { flex: 1; overflow-y: auto; padding: 0.875rem 1rem; font-size: 0.8rem; line-height: 1.6; color: var(--color-slate-700); }
  .proj-preview-body :global(h1) { font-size: 0.875rem; font-weight: 700; margin: 0.75rem 0 0.375rem; color: var(--color-slate-800); }
  .proj-preview-body :global(h2) { font-size: 0.875rem; font-weight: 700; margin: 0.75rem 0 0.375rem; color: var(--color-slate-800); }
  .proj-preview-body :global(h3) { font-size: 0.875rem; font-weight: 700; margin: 0.75rem 0 0.375rem; color: var(--color-slate-800); }
  .proj-preview-body :global(h4) { font-size: 0.875rem; font-weight: 700; margin: 0.75rem 0 0.375rem; color: var(--color-slate-800); }
  .proj-preview-body :global(p) { margin: 0 0 0.5rem; }
  .proj-preview-body :global(ul) { padding-left: 1.25rem; margin: 0 0 0.5rem; }
  .proj-preview-body :global(ol) { padding-left: 1.25rem; margin: 0 0 0.5rem; }
  .proj-preview-body :global(strong) { font-weight: 600; }
  .proj-preview-actions { flex-shrink: 0; display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-top: 1px solid var(--color-slate-200); background: white; }
  .proj-saved-badge { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8rem; font-weight: 600; color: var(--color-emerald-600); }

  .mini-spinner { width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .review-rows { flex: 1; overflow-y: auto; background: white; }
  .diff-no-changes { font-size: 0.875rem; color: var(--color-slate-400); text-align: center; padding: 3rem 2rem; margin: 0; }
  .review-row { display: grid; grid-template-columns: 1fr 220px; border-bottom: 1px solid var(--color-slate-100); }
  .review-row--changed { border-bottom-color: var(--color-slate-200); }
  .review-row-doc { padding: 0.375rem 1.5rem 0.375rem 2rem; font-family: 'Calibri', 'Arial', sans-serif; font-size: 0.9375rem; line-height: 1.6; color: var(--color-slate-800); min-width: 0; }
  .review-row-doc--unchanged { opacity: 0.45; }
  .review-row-doc :global(h2) { font-size: 1.2rem; font-weight: 300; color: var(--color-sky-900); margin: 0.5rem 0 0.25rem; }
  .review-row-doc :global(h3) { font-size: 1rem; font-weight: 300; color: var(--color-sky-900); margin: 0.375rem 0 0.2rem; }
  .review-row-doc :global(p)  { margin: 0.25rem 0; }
  .doc-para-change { border-left: 3px solid transparent; padding-left: 0.625rem; margin-left: -0.625rem; }
  .doc-para-added   { border-left-color: var(--color-green-500); }
  .doc-para-removed { border-left-color: var(--color-red-500); }
  .doc-para-modified { border-left-color: var(--color-amber-500); }
  .doc-para-kept-original { border-left-color: var(--color-slate-400); }
  .doc-para-kept { border-left-color: var(--color-slate-400); }
  .review-row-ctrl { padding: 0.375rem 0.625rem; border-left: 1px solid var(--color-slate-100); background: var(--color-slate-50); display: flex; align-items: flex-start; }
  .review-row--changed .review-row-ctrl { border-left-color: var(--color-slate-200); background: var(--color-slate-50); }
  .ctrl-card { width: 100%; display: flex; flex-direction: column; gap: 0.375rem; transition: opacity 0.15s; }
  .ctrl-card.rejected { opacity: 0.5; }
  .ctrl-card-tag { display: flex; }
  .change-tag { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.1rem 0.4rem; border-radius: 3px; }
  .change-tag--added   { background: var(--color-emerald-100); color: var(--color-green-800); }
  .change-tag--removed { background: var(--color-red-100); color: var(--color-red-800); }
  .change-tag--modified { background: var(--color-amber-100); color: var(--color-amber-800); }
  .para-btns { display: flex; gap: 0.375rem; align-self: flex-start; }
  .para-btn { padding: 0.2rem 0.625rem; border: 1px solid var(--color-slate-200); border-radius: 4px; font-size: 0.7rem; font-weight: 500; color: var(--color-slate-400); background: white; cursor: pointer; font-family: inherit; transition: all 0.15s; opacity: 0.5; }
  .para-btn.active { opacity: 1; cursor: default; }
  .para-btn:not(.active):hover { background: var(--color-slate-100); color: var(--color-slate-700); opacity: 0.8; }
  .para-btn--accept.active { background: var(--color-emerald-100); border-color: var(--color-slate-400); color: var(--color-green-800); }
  .para-btn--reject.active { background: var(--color-red-100); border-color: var(--color-red-200); color: var(--color-red-800); }
  .word-diff { font-size: 0.8rem; line-height: 1.7; color: var(--color-slate-800); }
  .wd-add { background: var(--color-emerald-100); color: var(--color-green-800); text-decoration: none; border-radius: 2px; padding: 0 1px; }
  .wd-del { background: var(--color-red-200); color: var(--color-red-800); text-decoration: line-through; border-radius: 2px; padding: 0 1px; }

  .spinner { width: 1.5rem; height: 1.5rem; border: 2px solid var(--color-slate-200); border-top-color: var(--color-violet-600); border-radius: 50%; animation: spin 0.8s linear infinite; }
  .mini-spinner { width: 0.875rem; height: 0.875rem; border: 1.5px solid rgba(255, 255, 255, 0.4); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>

