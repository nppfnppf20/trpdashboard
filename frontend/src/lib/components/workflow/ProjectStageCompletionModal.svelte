<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { completeStage, getPriorStageEntries, getCurrentStageEntries, analyseStageDocument, checkDocumentSize } from '$lib/services/workflowApi.js';

  export let project;
  export let stage;
  export let tracks = [];
  export let currentUserName = null;

  const dispatch = createEventDispatcher();

  const RISK_OPTIONS = [
    { value: '', label: 'Unchanged' },
    { value: 'showstopper', label: 'Showstopper' },
    { value: 'extremely_high_risk', label: 'Extremely High Risk' },
    { value: 'high_risk', label: 'High Risk' },
    { value: 'medium_high_risk', label: 'Medium-High Risk' },
    { value: 'medium_risk', label: 'Medium Risk' },
    { value: 'medium_low_risk', label: 'Medium-Low Risk' },
    { value: 'low_risk', label: 'Low Risk' }
  ];

  let rowState = {};
  let priorRiskLevels = {};   // track id → risk level from prior stage (to detect changes)
  let saving = false;
  let loadingPrefill = true;
  let error = null;

  // Document analysis state
  let file = null;
  let dragOver = false;
  let pasteMode = false;
  let pastedText = '';
  let analysing = false;
  let analyseError = null;
  let parseWarning = null;
  let truncationWarning = null;
  let showGuidance = {};       // track id → boolean (guidance box open)
  let userGuidance = {};       // track id → guidance text

  $: hasInput = pasteMode ? pastedText.trim().length > 0 : !!file;

  onMount(async () => {
    rowState = Object.fromEntries(
      tracks.map(t => [t.id, {
        riskLevel: t.last_known_risk_level || '',
        notes: '',
        priorNotes: '',
        reasonForChange: '',
        notesLlmSuggested: false,
        isKeyIssue: t.is_key_issue
      }])
    );
    try {
      const prior = await getPriorStageEntries(project.id, stage.instance_id);
      for (const e of prior.entries) {
        if (rowState[e.issue_track_id]) {
          rowState[e.issue_track_id].riskLevel = e.risk_level || rowState[e.issue_track_id].riskLevel;
          rowState[e.issue_track_id].priorNotes = e.notes || '';
        }
      }
      // Record prior risk levels so we can detect user changes
      priorRiskLevels = Object.fromEntries(
        tracks.map(t => [t.id, rowState[t.id]?.riskLevel || ''])
      );

      const current = await getCurrentStageEntries(project.id, stage.instance_id);
      for (const e of current.entries) {
        if (rowState[e.issue_track_id]) {
          if (e.risk_level) rowState[e.issue_track_id].riskLevel = e.risk_level;
          if (e.notes)      rowState[e.issue_track_id].notes = e.notes;
        }
      }
      rowState = { ...rowState };
    } catch { /* prefill failed silently */ }
    finally { loadingPrefill = false; }
  });

  function riskChanged(trackId) {
    return rowState[trackId]?.riskLevel !== priorRiskLevels[trackId];
  }

  async function setFile(f) {
    file = f;
    analyseError = null;
    truncationWarning = null;
    if (!f) return;
    try {
      const check = await checkDocumentSize(f);
      if (check.warning) truncationWarning = check.warning;
    } catch { /* non-fatal — warning will appear after analyse if needed */ }
  }

  function handleFileInput(e) {
    setFile(e.target.files[0] ?? null);
  }

  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    setFile(e.dataTransfer.files[0] ?? null);
  }

  async function handleAnalyse() {
    if (!hasInput) return;
    analysing = true;
    analyseError = null;
    parseWarning = null;
    truncationWarning = null;
    try {
      const source = pasteMode ? { pastedText } : { file };
      const { results, parse_warning, truncation_warning } = await analyseStageDocument(
        project.id,
        stage.instance_id,
        source,
        userGuidance
      );
      parseWarning = parse_warning;
      truncationWarning = truncation_warning;

      // Apply suggested notes to rowState
      for (const r of results) {
        if (rowState[r.issue_track_id]) {
          if (r.relevant && r.suggested_notes) {
            rowState[r.issue_track_id].notes = r.suggested_notes;
            rowState[r.issue_track_id].notesLlmSuggested = true;
          }
        }
      }
      rowState = { ...rowState };
    } catch (err) {
      analyseError = err.message;
    } finally {
      analysing = false;
    }
  }

  async function save() {
    saving = true; error = null;
    try {
      const entries = tracks.map(t => ({
        issueTrackId:       t.id,
        riskLevel:          rowState[t.id]?.riskLevel || null,
        notes:              rowState[t.id]?.notes || null,
        reasonForChange:    riskChanged(t.id) ? (rowState[t.id]?.reasonForChange || null) : null,
        notesLlmSuggested:  rowState[t.id]?.notesLlmSuggested ?? false,
        isKeyIssue:         rowState[t.id]?.isKeyIssue ?? t.is_key_issue
      }));
      await completeStage(project.id, stage.instance_id, { entries, completedBy: currentUserName || null });
      dispatch('saved');
    } catch (err) { error = err.message; }
    finally { saving = false; }
  }

  function close() { dispatch('close'); }
</script>

<div class="modal-backdrop" on:click|self={close}>
  <div class="modal-content">
    <div class="modal-header">
      <h2><i class="las la-check-circle" style="color:#10b981"></i> Complete: {stage.stage_name}</h2>
      <button class="close-btn" on:click={close}><i class="las la-times"></i></button>
    </div>

    {#if loadingPrefill}
      <div class="form-body"><div class="loading"><div class="spinner"></div><p>Loading prior values…</p></div></div>
    {:else}
      <div class="form-body">

        <!-- Document upload + LLM analysis -->
        <div class="analyse-section">
          <div class="analyse-header">
            <div>
              <div class="analyse-title">AI Document Analysis <span class="optional-tag">optional</span></div>
              <div class="analyse-subtitle">Drop a PDF, Word, .txt or .md file or paste text to have the AI suggest notes for each issue based on this project's history.</div>
            </div>
          </div>

          <!-- Toggle between file upload and paste text -->
          <div class="input-mode-toggle">
            <button class="mode-btn" class:active={!pasteMode} on:click={() => { pasteMode = false; analyseError = null; truncationWarning = null; }}>
              <i class="las la-file-upload"></i> Upload file
            </button>
            <button class="mode-btn" class:active={pasteMode} on:click={() => { pasteMode = true; analyseError = null; truncationWarning = null; file = null; }}>
              <i class="las la-paste"></i> Paste text
            </button>
          </div>

          {#if pasteMode}
            <textarea
              class="paste-textarea"
              rows="6"
              placeholder="Paste the document text here, e.g. copy from a PDF, email, or meeting notes..."
              bind:value={pastedText}
            ></textarea>
          {:else}
            <div
              class="drop-zone"
              class:drag-over={dragOver}
              class:has-file={!!file}
              on:dragover|preventDefault={() => dragOver = true}
              on:dragleave={() => dragOver = false}
              on:drop={handleDrop}
              role="region"
              aria-label="Document drop zone"
            >
              {#if file}
                <div class="file-selected">
                  <i class="las la-file-alt"></i>
                  <span>{file.name}</span>
                  <button class="clear-file" on:click={() => { file = null; analyseError = null; }}>
                    <i class="las la-times"></i>
                  </button>
                </div>
              {:else}
                <label class="drop-label" for="file-input-stage">
                  <i class="las la-cloud-upload-alt"></i>
                  <span>Drop a PDF, Word, .txt or .md file here, or <u>browse</u></span>
                </label>
                <input
                  id="file-input-stage"
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  class="hidden-input"
                  on:change={handleFileInput}
                />
              {/if}
            </div>
          {/if}

          {#if parseWarning}
            <div class="warning-banner"><i class="las la-exclamation-triangle"></i> {parseWarning}</div>
          {/if}

          {#if truncationWarning}
            <div class="warning-banner"><i class="las la-cut"></i> {truncationWarning}</div>
          {/if}

          {#if analyseError}
            <div class="error-banner"><i class="las la-exclamation-circle"></i> {analyseError}</div>
          {/if}

          {#if hasInput}
            <button class="btn-analyse" on:click={handleAnalyse} disabled={analysing}>
              {#if analysing}
                <span class="spinner-sm"></span> Analysing…
              {:else}
                <i class="las la-magic"></i> Analyse & suggest notes
              {/if}
            </button>
          {/if}
        </div>

        <div class="divider"></div>

        <p class="prefill-note">Risk levels are pre-filled from the most recent completed stage. Change a risk level to explain why.</p>

        {#if error}
          <div class="error-banner"><i class="las la-exclamation-circle"></i> {error}</div>
        {/if}

        {#each tracks as track}
          {@const row = rowState[track.id] || {}}
          {@const changed = riskChanged(track.id)}
          <div class="issue-row">
            <div class="issue-row-header">
              <div style="display:flex;align-items:center;gap:0.5rem;flex:1">
                <button
                  class="btn btn-ghost btn-sm btn-icon"
                  style="color:{row.isKeyIssue ? '#f59e0b' : '#cbd5e1'}"
                  on:click={() => { rowState[track.id].isKeyIssue = !row.isKeyIssue; rowState = {...rowState}; }}
                  title={row.isKeyIssue ? 'Remove key issue' : 'Mark as key issue'}
                ><i class="las la-flag"></i></button>
                <span class="track-label" style="font-weight:{row.isKeyIssue ? 700 : 500}">{track.label}</span>
              </div>
              <div style="display:flex;align-items:center;gap:0.5rem">
                {#if changed}
                  <span class="changed-badge">changed</span>
                {/if}
                <select bind:value={rowState[track.id].riskLevel} on:change={() => rowState = {...rowState}}>
                  {#each RISK_OPTIONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
                </select>
              </div>
            </div>

            <!-- Reason for change — only appears when user has changed the risk level -->
            {#if changed}
              <div class="reason-for-change">
                <label class="reason-label"><i class="las la-exchange-alt"></i> Reason for risk level change <span class="required">*</span></label>
                <textarea
                  rows="2"
                  placeholder="Explain why the risk level has changed from the previous stage…"
                  bind:value={rowState[track.id].reasonForChange}
                  class="reason-textarea"
                ></textarea>
              </div>
            {/if}

            <!-- Prior stage notes — read-only, shown if a previous stage recorded anything -->
            {#if row.priorNotes}
              <div class="prior-notes-field">
                <span class="prior-notes-label"><i class="las la-history"></i> Previous stage summary</span>
                <div class="prior-notes-box">{row.priorNotes}</div>
              </div>
            {/if}

            <!-- Notes field with optional LLM badge and guidance toggle -->
            <div class="notes-field">
              <div class="notes-label-row">
                <span class="notes-label">This stage notes</span>
                {#if row.notesLlmSuggested}
                  <span class="ai-badge">AI suggested - review before saving</span>
                {/if}
                <button
                  class="btn-guidance-toggle"
                  on:click={() => { showGuidance[track.id] = !showGuidance[track.id]; showGuidance = {...showGuidance}; }}
                >
                  {showGuidance[track.id] ? 'Hide guidance' : 'Add AI guidance'}
                </button>
              </div>

              {#if showGuidance[track.id]}
                <textarea
                  rows="2"
                  class="guidance-textarea"
                  placeholder="Tell the AI what to focus on for {track.label} in this document (e.g. 'check section 4 on mitigation')…"
                  bind:value={userGuidance[track.id]}
                ></textarea>
              {/if}

              <textarea
                rows="4"
                placeholder="Summary notes for {track.label} at this stage…"
                bind:value={rowState[track.id].notes}
                on:input={() => { rowState[track.id].notesLlmSuggested = false; rowState = {...rowState}; }}
                class:llm-populated={row.notesLlmSuggested}
              ></textarea>
            </div>
          </div>
        {/each}

        {#if tracks.length === 0}
          <p class="empty">No issue rows on this board yet.</p>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={close}>Cancel</button>
        <button class="btn btn-success" on:click={save} disabled={saving}>
          {#if saving}<i class="las la-spinner la-spin"></i> Saving…{:else}<i class="las la-check"></i> Mark complete{/if}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem; }
  .modal-content { background:white;border-radius:12px;width:100%;max-width:720px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04); }
  .modal-header { display:flex;justify-content:space-between;align-items:center;padding:1.25rem 1.5rem;border-bottom:1px solid #e2e8f0;position:sticky;top:0;background:white;z-index:1; }
  .modal-header h2 { margin:0;font-size:1.125rem;font-weight:600;color:#1e293b;display:flex;align-items:center;gap:0.5rem; }
  .close-btn { background:none;border:none;font-size:1.5rem;color:#64748b;cursor:pointer;padding:0.25rem;border-radius:4px;transition:all 0.2s; }
  .close-btn:hover { background:#f1f5f9;color:#1e293b; }
  .form-body { padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:0; }
  .modal-footer { display:flex;justify-content:flex-end;gap:0.75rem;padding:1rem 1.5rem;border-top:1px solid #e2e8f0;position:sticky;bottom:0;background:white; }

  /* Analysis section */
  .analyse-section { margin-bottom:0; }
  .analyse-header { margin-bottom:0.75rem; }
  .analyse-title { font-size:0.9rem;font-weight:600;color:#1e293b;display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem; }
  .analyse-subtitle { font-size:0.78rem;color:#64748b; }
  .optional-tag { font-size:0.65rem;font-weight:500;background:#f1f5f9;color:#94a3b8;padding:0.1rem 0.4rem;border-radius:20px;vertical-align:middle; }

  .drop-zone {
    border:2px dashed #e2e8f0;border-radius:8px;padding:1.25rem;
    text-align:center;cursor:pointer;background:#fafafa;
    transition:border-color 0.15s,background 0.15s;position:relative;
  }
  .drop-zone.drag-over { border-color:#9333ea;background:#faf5ff; }
  .drop-zone.has-file  { border-color:#c4b5fd;background:#faf5ff;border-style:solid; }

  .drop-label { display:flex;flex-direction:column;align-items:center;gap:0.35rem;cursor:pointer;color:#64748b;font-size:0.8rem; }
  .drop-label i { font-size:1.75rem;color:#9333ea; }
  .drop-label u { color:#9333ea; }
  .hidden-input { position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%; }

  .file-selected { display:flex;align-items:center;justify-content:center;gap:0.5rem;font-size:0.875rem;font-weight:500;color:#7e22ce; }
  .clear-file { background:none;border:none;color:#94a3b8;cursor:pointer;padding:0.1rem;border-radius:3px;transition:color 0.15s;line-height:1; }
  .clear-file:hover { color:#ef4444; }

  .btn-analyse {
    display:flex;align-items:center;justify-content:center;gap:0.4rem;
    width:100%;margin-top:0.6rem;padding:0.6rem;
    background:#9333ea;color:white;border:none;border-radius:7px;
    font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit;
    transition:background 0.15s;
  }
  .btn-analyse:hover:not(:disabled) { background:#7e22ce; }
  .btn-analyse:disabled { opacity:0.6;cursor:not-allowed; }

  .input-mode-toggle { display:flex;gap:0;border:1px solid #e2e8f0;border-radius:7px;overflow:hidden; }
  .mode-btn { flex:1;padding:0.45rem 0.75rem;background:white;border:none;font-size:0.78rem;font-weight:500;color:#64748b;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:0.35rem;transition:background 0.15s,color 0.15s; }
  .mode-btn.active { background:#9333ea;color:white; }
  .mode-btn:hover:not(.active) { background:#f8fafc; }

  .paste-textarea { width:100%;padding:0.75rem;border:1px solid #e2e8f0;border-radius:7px;font-size:0.8rem;font-family:inherit;resize:vertical;color:#1e293b;outline:none;box-sizing:border-box;transition:border-color 0.15s; }
  .paste-textarea:focus { border-color:#9333ea; }

  .warning-banner { display:flex;align-items:flex-start;gap:0.5rem;font-size:0.78rem;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:0.5rem 0.75rem;margin-top:0.5rem;line-height:1.4; }
  .error-banner { display:flex;align-items:flex-start;gap:0.5rem;padding:0.65rem 0.875rem;background:#fee2e2;color:#991b1b;border-radius:6px;font-size:0.8rem;margin-top:0.5rem;line-height:1.4; }

  .divider { height:1px;background:#e2e8f0;margin:1.25rem 0; }
  .prefill-note { margin:0 0 1rem 0;color:#64748b;font-size:0.8rem; }

  /* Issue rows */
  .issue-row { border:1px solid #e2e8f0;border-radius:8px;padding:0.875rem 1rem;margin-bottom:0.75rem;background:#f8fafc;display:flex;flex-direction:column;gap:0.6rem; }
  .issue-row-header { display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap; }
  .track-label { font-size:0.9375rem; }

  .changed-badge { font-size:0.65rem;font-weight:700;background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:0.15rem 0.5rem;border-radius:20px; }

  .reason-for-change { display:flex;flex-direction:column;gap:0.3rem; }
  .reason-label { font-size:0.75rem;font-weight:600;color:#92400e;display:flex;align-items:center;gap:0.3rem; }
  .required { color:#ef4444; }
  .reason-textarea { width:100%;padding:0.5rem 0.625rem;border:1px solid #fde68a;border-radius:6px;font-size:0.8rem;font-family:inherit;background:#fffbeb;color:#1e293b;resize:vertical;box-sizing:border-box;outline:none; }
  .reason-textarea:focus { border-color:#f59e0b; }

  .prior-notes-field { display:flex;flex-direction:column;gap:0.3rem; }
  .prior-notes-label { font-size:0.75rem;font-weight:600;color:#64748b;display:flex;align-items:center;gap:0.3rem; }
  .prior-notes-box {
    font-size:0.8rem;color:#475569;background:#f1f5f9;border:1px solid #e2e8f0;
    border-radius:6px;padding:0.625rem 0.75rem;white-space:pre-wrap;line-height:1.6;
    max-height:160px;overflow-y:auto;
  }

  .notes-field { display:flex;flex-direction:column;gap:0.35rem; }
  .notes-label-row { display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap; }
  .notes-label { font-size:0.75rem;font-weight:600;color:#475569; }

  .ai-badge { font-size:0.65rem;font-weight:600;background:#f3e8ff;color:#7e22ce;border:1px solid #c4b5fd;padding:0.15rem 0.5rem;border-radius:20px;display:flex;align-items:center;gap:0.25rem; }

  .btn-guidance-toggle { margin-left:auto;background:none;border:none;font-size:0.72rem;color:#9333ea;cursor:pointer;font-family:inherit;padding:0;text-decoration:underline;text-underline-offset:2px; }
  .btn-guidance-toggle:hover { color:#7e22ce; }

  .guidance-textarea { width:100%;padding:0.5rem 0.625rem;border:1px dashed #c4b5fd;border-radius:6px;font-size:0.78rem;font-family:inherit;background:#faf5ff;color:#374151;resize:vertical;box-sizing:border-box;outline:none;font-style:italic; }
  .guidance-textarea:focus { border-color:#9333ea;border-style:solid; }

  select,textarea { width:100%;padding:0.625rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.875rem;box-sizing:border-box;font-family:inherit;transition:border-color 0.2s; }
  select:focus,textarea:focus { outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1); }
  select { width:auto;min-width:180px; }
  textarea { resize:vertical;color:#374151; }
  textarea.llm-populated { border-color:#c4b5fd;background:#faf5ff; }

  .loading { display:flex;flex-direction:column;align-items:center;gap:0.5rem;padding:2rem;color:#64748b; }
  .spinner { width:2rem;height:2rem;border:3px solid #f3f4f6;border-top-color:#9333ea;border-radius:50%;animation:spin 1s linear infinite; }
  .spinner-sm { width:0.9rem;height:0.9rem;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block; }
  @keyframes spin { to { transform:rotate(360deg); } }

  .empty { color:#94a3b8;font-size:0.875rem;text-align:center;padding:1rem 0; }
</style>
