<script>
  import { onMount } from 'svelte';
  import { getLpaDocuments, uploadLpaDocument, deleteLpaDocument, getLpaAnalysis, saveBriefingNote, triggerSynthesis } from '$lib/api/lpaAnalysis.js';

  export let project;
  $: projectId = project?.id;

  let documents = [];
  let analysis = null;
  let loading = true;
  let error = null;

  // Upload queue state — files are staged here first, nothing uploads until
  // "Process" is clicked, then each is analysed (and saved) one at a time.
  let queue = []; // { id, file, status: 'pending'|'processing'|'done'|'error', error }
  let queueProcessing = false;
  let queueDone = 0;
  let uploadError = null;

  // Briefing note state
  let briefingNoteDraft = null; // null = not yet loaded from analysis
  let briefingNoteSaving = false;
  let showBriefingNote = false;

  // Synthesis state
  let synthesising = false;

  // Active section in the report
  let activeSection = 'documents'; // 'documents' | 'report'

  onMount(() => { if (projectId) loadAll(); });
  $: if (projectId) loadAll();

  async function loadAll() {
    loading = true;
    error = null;
    try {
      [documents, analysis] = await Promise.all([
        getLpaDocuments(projectId),
        getLpaAnalysis(projectId)
      ]);
      if (briefingNoteDraft === null) briefingNoteDraft = analysis?.briefing_note || '';
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function saveBriefingNoteNow() {
    briefingNoteSaving = true;
    try {
      analysis = await saveBriefingNote(projectId, briefingNoteDraft);
    } catch (err) {
      alert(err.message);
    } finally {
      briefingNoteSaving = false;
    }
  }

  let queueIdCounter = 0;
  function addFilesToQueue(files) {
    const items = files.map(file => ({ id: ++queueIdCounter, file, status: 'pending', error: null }));
    queue = [...queue, ...items];
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // reset input
    if (files.length) addFilesToQueue(files);
  }

  function handleDrop(e) {
    e.preventDefault();
    isDragOver = false;
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) addFilesToQueue(files);
  }

  function removeFromQueue(id) {
    queue = queue.filter(item => item.id !== id);
  }

  function clearFinishedQueue() {
    queue = queue.filter(item => item.status === 'pending' || item.status === 'processing');
  }

  async function processQueue() {
    queueProcessing = true;
    uploadError = null;
    queueDone = 0;
    const toProcess = queue.filter(item => item.status === 'pending');
    try {
      for (const item of toProcess) {
        queue = queue.map(q => q.id === item.id ? { ...q, status: 'processing' } : q);
        try {
          const result = await uploadLpaDocument(projectId, item.file);
          documents = [...documents, result.document];
          if (result.parseWarning) uploadError = `Note: ${result.parseWarning}`;
          queue = queue.map(q => q.id === item.id ? { ...q, status: 'done' } : q);
        } catch (err) {
          queue = queue.map(q => q.id === item.id ? { ...q, status: 'error', error: err.message } : q);
        }
        queueDone += 1;
      }
      // Refresh analysis once at the end, not after every file — the backend
      // already re-synthesises on each upload, so this just fetches the
      // final result instead of every intermediate one.
      analysis = await getLpaAnalysis(projectId);
    } finally {
      queueProcessing = false;
    }
  }

  async function removeDocument(doc) {
    if (!confirm(`Remove "${doc.filename}" from this analysis?`)) return;
    try {
      await deleteLpaDocument(projectId, doc.id);
      documents = documents.filter(d => d.id !== doc.id);
      analysis = await getLpaAnalysis(projectId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function regenerate() {
    synthesising = true;
    try {
      analysis = await triggerSynthesis(projectId);
    } catch (err) {
      alert(err.message);
    } finally {
      synthesising = false;
    }
  }

  let isDragOver = false;

  const OUTCOME_COLOURS = {
    'Approved':   { bg: '#dcfce7', text: '#166534' },
    'Refused':    { bg: '#fee2e2', text: '#991b1b' },
    'Allowed':    { bg: '#dcfce7', text: '#166534' },
    'Dismissed':  { bg: '#fee2e2', text: '#991b1b' },
    'N/A':        { bg: '#f1f5f9', text: '#64748b' },
    'Unknown':    { bg: '#f1f5f9', text: '#64748b' }
  };

  function outcomeStyle(outcome) {
    const c = OUTCOME_COLOURS[outcome] || OUTCOME_COLOURS['Unknown'];
    return `background: ${c.bg}; color: ${c.text};`;
  }

  // Simple markdown-ish render: bold **text**, headings ##, bullet -
  // We convert the structured AI markdown report to HTML for display.
  function renderMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Headings
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Bullets
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr>')
      // Paragraphs — double newlines become paragraph breaks
      .replace(/\n\n+/g, '</p><p>')
      .replace(/^(?!<[hul]|<hr)(.+)/gm, '$1')
      // Wrap in paragraph if not already a block element
      .replace(/^([^<].+)/gm, (m) => m.startsWith('<') ? m : m);
  }
</script>

<div class="lpa-tab">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading…</p>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>{error}</p>
      <button on:click={loadAll}>Retry</button>
    </div>
  {:else}
    <!-- Section switcher -->
    <div class="section-nav">
      <button class="section-btn" class:active={activeSection === 'documents'} on:click={() => activeSection = 'documents'}>
        <i class="las la-file-alt"></i> Documents
        {#if documents.length > 0}<span class="count">{documents.length}</span>{/if}
      </button>
      <button class="section-btn" class:active={activeSection === 'report'} on:click={() => activeSection = 'report'}
              disabled={!analysis?.full_report}>
        <i class="las la-chart-bar"></i> Analysis Report
        {#if analysis?.documents_processed}<span class="count">{analysis.documents_processed}</span>{/if}
      </button>
    </div>

    <!-- Documents section -->
    {#if activeSection === 'documents'}
      <div class="documents-section">
        <!-- Briefing note -->
        <div class="briefing-note-card">
          <button class="briefing-note-toggle" on:click={() => showBriefingNote = !showBriefingNote}>
            <i class="las la-sticky-note"></i> Briefing Note
            {#if briefingNoteDraft}<span class="count">set</span>{/if}
            <i class="las {showBriefingNote ? 'la-angle-up' : 'la-angle-down'}" style="margin-left: auto;"></i>
          </button>
          {#if showBriefingNote}
            <div class="briefing-note-body">
              <p class="sub">
                Give the AI scheme-specific context, e.g. "we're proposing 40 units, the site abuts a Conservation Area, the
                key sensitivity is heritage impact". This is used to frame both individual document analysis and the report below.
              </p>
              <textarea rows="4" placeholder="e.g. Key facts about our scheme the AI should keep in mind…" bind:value={briefingNoteDraft}></textarea>
              <button class="btn-regen" on:click={saveBriefingNoteNow} disabled={briefingNoteSaving}>
                {#if briefingNoteSaving}<div class="spinner-sm"></div> Saving…{:else}<i class="las la-save"></i> Save{/if}
              </button>
            </div>
          {/if}
        </div>

        <!-- Upload area -->
        <div
          class="upload-zone"
          class:drag-over={isDragOver}
          role="button"
          tabindex="0"
          on:dragover|preventDefault={() => isDragOver = true}
          on:dragleave={() => isDragOver = false}
          on:drop={handleDrop}
        >
          <i class="las la-cloud-upload-alt"></i>
          <p>Drop documents here or <label class="browse-link">browse<input type="file" accept=".pdf,.docx,.txt,.md" multiple on:change={handleFileSelect} /></label></p>
          <p class="sub">PDF, Word, .txt or .md: decision notices, officer reports, appeal decisions, supporting documents</p>
        </div>

        {#if queue.length > 0}
          <div class="upload-queue">
            <div class="queue-header">
              <span>{queue.length} file{queue.length === 1 ? '' : 's'} queued</span>
              {#if !queueProcessing}
                <div class="queue-header-actions">
                  <button class="btn-cancel-sm" on:click={clearFinishedQueue}>Clear finished</button>
                  <button class="btn-regen" on:click={processQueue} disabled={!queue.some(i => i.status === 'pending')}>
                    <i class="las la-play"></i> Process {queue.filter(i => i.status === 'pending').length} file{queue.filter(i => i.status === 'pending').length === 1 ? '' : 's'}
                  </button>
                </div>
              {/if}
            </div>

            {#if queueProcessing}
              <div class="queue-progress-bar">
                <div class="queue-progress-fill" style="width: {(queueDone / queue.length) * 100}%"></div>
              </div>
              <p class="queue-progress-label">Processing {Math.min(queueDone + 1, queue.length)} of {queue.length}… the AI is reading each document against your project context, policies, and briefing note.</p>
            {/if}

            <div class="queue-list">
              {#each queue as item (item.id)}
                <div class="queue-item" class:queue-item--error={item.status === 'error'}>
                  {#if item.status === 'pending'}
                    <i class="las la-file queue-icon"></i>
                  {:else if item.status === 'processing'}
                    <div class="spinner-sm"></div>
                  {:else if item.status === 'done'}
                    <i class="las la-check-circle queue-icon queue-icon--done"></i>
                  {:else}
                    <i class="las la-times-circle queue-icon queue-icon--error"></i>
                  {/if}
                  <span class="queue-item-name">{item.file.name}</span>
                  {#if item.status === 'error'}<span class="queue-item-error">{item.error}</span>{/if}
                  {#if item.status === 'pending'}
                    <button class="queue-remove-btn" on:click={() => removeFromQueue(item.id)} title="Remove"><i class="las la-times"></i></button>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if uploadError}
          <div class="upload-notice" class:warning={uploadError.startsWith('Note:')}>
            <i class="las la-{uploadError.startsWith('Note:') ? 'info-circle' : 'exclamation-triangle'}"></i>
            {uploadError}
          </div>
        {/if}

        {#if documents.length === 0}
          <div class="empty-state">
            <i class="las la-gavel"></i>
            <p>No documents uploaded yet.</p>
            <p class="sub">Upload decision notices, officer reports, or appeal decisions from similar schemes. The AI will read each one in the context of your project and relevant policies.</p>
          </div>
        {:else}
          <div class="doc-list">
            {#each documents as doc (doc.id)}
              {@const s = doc.doc_summary || {}}
              <div class="card doc-card" class:error={doc.status === 'error'}>
                <div class="doc-card-header">
                  <div class="doc-meta">
                    {#if s.outcome && s.outcome !== 'Unknown' && s.outcome !== 'N/A'}
                      <span class="outcome-badge" style={outcomeStyle(s.outcome)}>{s.outcome}</span>
                    {/if}
                    {#if s.document_type}
                      <span class="type-chip">{s.document_type}</span>
                    {/if}
                    {#if s.application_ref}
                      <span class="ref-chip">{s.application_ref}</span>
                    {/if}
                    {#if s.lpa_name}
                      <span class="lpa-chip"><i class="las la-building"></i> {s.lpa_name}</span>
                    {/if}
                  </div>
                  <button class="icon-btn danger" on:click={() => removeDocument(doc)} title="Remove">
                    <i class="las la-trash"></i>
                  </button>
                </div>

                <div class="doc-filename">
                  <i class="las la-file-pdf"></i> {doc.filename}
                </div>

                {#if doc.status === 'error'}
                  <div class="doc-error">Analysis failed for this document</div>
                {:else if s.summary}
                  <p class="doc-summary">{s.summary}</p>

                  {#if s.key_reasoning}
                    <details class="doc-detail">
                      <summary>Key reasoning</summary>
                      <p class="detail-body">{s.key_reasoning}</p>
                    </details>
                  {/if}

                  {#if s.policy_treatment?.length > 0}
                    <details class="doc-detail">
                      <summary>Policy treatment ({s.policy_treatment.length} {s.policy_treatment.length === 1 ? 'policy' : 'policies'})</summary>
                      <div class="policy-treatment-list">
                        {#each s.policy_treatment as pt}
                          <div class="pt-row">
                            <div class="pt-ref">{pt.policy_ref || pt.policy_name}</div>
                            <div class="pt-text">{pt.treatment}</div>
                          </div>
                        {/each}
                      </div>
                    </details>
                  {/if}
                {:else if doc.status === 'processing'}
                  <p class="doc-processing">Analysing…</p>
                {/if}

                {#if doc.parse_warning}
                  <div class="parse-warning"><i class="las la-exclamation-triangle"></i> {doc.parse_warning}</div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

    <!-- Report section -->
    {:else if activeSection === 'report'}
      <div class="report-section">
        <div class="report-header">
          <div>
            <p class="report-meta">
              Based on {analysis.documents_processed} document{analysis.documents_processed !== 1 ? 's' : ''},
              last updated {new Date(analysis.last_synthesised_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button class="btn-regen" on:click={regenerate} disabled={synthesising}>
            {#if synthesising}
              <div class="spinner-sm"></div> Regenerating…
            {:else}
              <i class="las la-sync"></i> Regenerate
            {/if}
          </button>
        </div>

        <div class="report-body">
          {@html `<div class="report-content">${renderMarkdown(analysis.full_report)}</div>`}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .lpa-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    color: var(--color-slate-500);
  }
  .error-state i { font-size: 2rem; color: var(--color-red-500); }
  .error-state button {
    padding: 0.5rem 1rem; background: var(--color-purple-600); color: white;
    border: none; border-radius: 6px; cursor: pointer; font-family: inherit;
  }

  .spinner {
    width: 2rem; height: 2rem;
    border: 3px solid var(--color-slate-100); border-top-color: var(--color-purple-600);
    border-radius: 50%; animation: spin 1s linear infinite;
  }
  .spinner-sm {
    width: 1rem; height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: white;
    border-radius: 50%; animation: spin 1s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Section nav */
  .section-nav {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
    padding: 0 1.25rem;
  }
  .section-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.65rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
    margin-bottom: -1px;
  }
  .section-btn.active { color: var(--color-purple-600); border-bottom-color: var(--color-purple-600); }
  .section-btn:hover:not(.active):not(:disabled) { color: var(--color-slate-800); }
  .section-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .count {
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--color-violet-100);
    color: var(--color-purple-700);
    padding: 0.1rem 0.4rem;
    border-radius: 20px;
  }

  /* Documents section */
  .documents-section {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Upload zone */
  .upload-zone {
    border: 2px dashed var(--color-slate-300);
    border-radius: 10px;
    padding: 2rem;
    text-align: center;
    color: var(--color-slate-500);
    font-size: 0.875rem;
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
    flex-shrink: 0;
  }
  .upload-zone:hover, .upload-zone.drag-over {
    border-color: var(--color-purple-600);
    background: var(--color-purple-50);
  }
  .upload-zone i { font-size: 2.5rem; color: var(--color-purple-600); display: block; margin-bottom: 0.5rem; }
  .upload-zone p { margin: 0 0 0.25rem; }
  .upload-zone .sub { font-size: 0.78rem; color: var(--color-slate-400); }
  .browse-link {
    color: var(--color-purple-600);
    cursor: pointer;
    font-weight: 600;
    text-decoration: underline;
  }
  .browse-link input { display: none; }

  /* Briefing note */
  .briefing-note-card {
    border: 1px solid var(--color-violet-200);
    border-radius: 10px;
    background: var(--color-purple-50);
    overflow: hidden;
    flex-shrink: 0;
  }
  .briefing-note-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-purple-700);
    font-family: inherit;
  }
  .briefing-note-body {
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .briefing-note-body .sub { margin: 0; font-size: 0.78rem; color: var(--color-slate-500); line-height: 1.5; }
  .briefing-note-body textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    resize: vertical;
  }
  .briefing-note-body textarea:focus {
    outline: none;
    border-color: var(--color-purple-600);
    box-shadow: 0 0 0 3px var(--color-violet-100);
  }
  .briefing-note-body .btn-regen { align-self: flex-end; }

  /* Upload queue */
  .upload-queue {
    border: 1px solid var(--color-slate-200);
    border-radius: 10px;
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    flex-shrink: 0;
  }
  .queue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }
  .queue-header-actions { display: flex; align-items: center; gap: 0.5rem; }
  .btn-cancel-sm {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--color-slate-300);
    background: white;
    border-radius: 6px;
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    color: var(--color-slate-500);
  }
  .btn-cancel-sm:hover { background: var(--color-slate-50); }

  .queue-progress-bar {
    height: 6px;
    border-radius: 3px;
    background: var(--color-slate-100);
    overflow: hidden;
  }
  .queue-progress-fill {
    height: 100%;
    background: var(--color-purple-600);
    transition: width 0.25s ease;
  }
  .queue-progress-label { margin: 0; font-size: 0.78rem; color: var(--color-slate-500); }

  .queue-list { display: flex; flex-direction: column; gap: 0.4rem; }
  .queue-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    background: var(--color-slate-50);
    border-radius: 6px;
    font-size: 0.82rem;
  }
  .queue-item--error { background: var(--color-red-50); }
  .queue-icon { font-size: 1rem; color: var(--color-slate-400); flex-shrink: 0; }
  .queue-icon--done { color: var(--color-emerald-600); }
  .queue-icon--error { color: var(--color-red-600); }
  .queue-item-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-slate-700); }
  .queue-item-error { font-size: 0.75rem; color: var(--color-red-600); flex-shrink: 0; }
  .queue-remove-btn {
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border: none; background: none; cursor: pointer;
    border-radius: 5px; color: var(--color-slate-400); font-size: 0.85rem; flex-shrink: 0;
  }
  .queue-remove-btn:hover { background: var(--color-slate-100); color: var(--color-red-600); }

  .upload-notice {
    padding: 0.6rem 0.85rem;
    border-radius: 6px;
    font-size: 0.82rem;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: var(--color-red-50);
    color: var(--color-red-600);
    border: 1px solid var(--color-red-200);
  }
  .upload-notice.warning {
    background: var(--color-red-50);
    color: var(--color-amber-800);
    border-color: var(--color-amber-200);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem;
    color: var(--color-slate-400);
    text-align: center;
  }
  .empty-state i { font-size: 2.5rem; }
  .empty-state p { margin: 0; font-size: 0.875rem; }
  .empty-state .sub { font-size: 0.8rem; max-width: 420px; line-height: 1.5; }

  /* Document cards */
  .doc-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .doc-card {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .doc-card.error { border-color: var(--color-red-200); background: var(--color-red-50); }

  .doc-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .doc-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .outcome-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .type-chip {
    font-size: 0.72rem;
    color: var(--color-slate-600);
    background: var(--color-slate-100);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }
  .ref-chip {
    font-size: 0.72rem;
    color: var(--color-slate-500);
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
  }
  .lpa-chip {
    font-size: 0.72rem;
    color: var(--color-slate-500);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .icon-btn {
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border: none; background: none; cursor: pointer;
    border-radius: 6px;
    color: var(--color-slate-500);
    font-size: 0.95rem;
    flex-shrink: 0;
  }
  .icon-btn.danger:hover { background: var(--color-red-50); color: var(--color-red-600); }

  .doc-filename {
    font-size: 0.78rem;
    color: var(--color-slate-400);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .doc-summary {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-slate-700);
    line-height: 1.6;
  }

  .doc-processing { margin: 0; font-size: 0.82rem; color: var(--color-slate-400); font-style: italic; }
  .doc-error { font-size: 0.82rem; color: var(--color-red-600); }

  .doc-detail {
    font-size: 0.82rem;
  }
  .doc-detail summary {
    cursor: pointer;
    color: var(--color-purple-600);
    font-weight: 500;
    user-select: none;
  }
  .detail-body {
    margin: 0.5rem 0 0;
    color: var(--color-slate-700);
    line-height: 1.6;
    background: var(--color-slate-50);
    border-left: 3px solid var(--color-violet-200);
    padding: 0.5rem 0.75rem;
    border-radius: 0 4px 4px 0;
  }

  .policy-treatment-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .pt-row {
    background: var(--color-slate-50);
    border-left: 3px solid var(--color-violet-200);
    padding: 0.4rem 0.75rem;
    border-radius: 0 4px 4px 0;
  }
  .pt-ref {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-purple-700);
    font-family: monospace;
    margin-bottom: 0.2rem;
  }
  .pt-text {
    font-size: 0.82rem;
    color: var(--color-slate-700);
    line-height: 1.5;
  }

  .parse-warning {
    font-size: 0.75rem;
    color: var(--color-amber-800);
    background: var(--color-red-50);
    border: 1px solid var(--color-amber-200);
    border-radius: 4px;
    padding: 0.3rem 0.5rem;
    display: flex;
    gap: 0.35rem;
    align-items: flex-start;
  }

  /* Report section */
  .report-section {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
    gap: 1rem;
  }
  .report-meta {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-slate-500);
  }

  .btn-regen {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.9rem;
    background: var(--color-purple-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn-regen:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-regen:disabled { opacity: 0.6; cursor: not-allowed; }

  .report-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  /* Report content styles — scoped via the wrapper div rendered via @html */
  :global(.report-content h3) {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-slate-800);
    margin: 1.5rem 0 0.5rem;
    padding-bottom: 0.4rem;
    border-bottom: 2px solid var(--color-violet-200);
  }
  :global(.report-content h3:first-child) { margin-top: 0; }
  :global(.report-content h4) {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-indigo-800);
    margin: 1.25rem 0 0.35rem;
  }
  :global(.report-content p) {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: var(--color-slate-700);
    line-height: 1.7;
  }
  :global(.report-content ul) {
    padding-left: 1.25rem;
    margin: 0 0 0.75rem;
  }
  :global(.report-content li) {
    font-size: 0.875rem;
    color: var(--color-slate-700);
    line-height: 1.7;
    margin-bottom: 0.25rem;
  }
  :global(.report-content strong) { color: var(--color-slate-800); }
  :global(.report-content hr) {
    border: none;
    border-top: 1px solid var(--color-slate-200);
    margin: 1.25rem 0;
  }
</style>
